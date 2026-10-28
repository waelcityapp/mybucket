import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  writeBatch,
  runTransaction,
  getDocFromServer,
  getDocsFromServer,
} from 'firebase/firestore';
import { FinancialAccount, Transaction, Category } from '../types';
import firebaseConfig from './firebaseConfig';
import { isNonNegativeBalance } from '../utils/formatBalance';
import { bindMovement, movementDeltas, validateBalance, type LinkedAccount } from '../utils/accountLinking';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Pass custom firestore database ID if specified and not "(default)", otherwise standard getFirestore(app)
const customDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = customDbId
  ? getFirestore(app, customDbId)
  : getFirestore(app);

// Connection test per skill guidelines
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client appears offline:', error.message);
    }
  }
}

// Sign in with Google Popup
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  // Persist user record in users/{uid}
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving user profile to Firestore:', err);
  }

  return user;
}

// Sign out
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Update user display name in Firebase Auth and Firestore
export async function updateUserNameInFirebase(userId: string, newDisplayName: string): Promise<void> {
  if (auth.currentUser) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: newDisplayName.trim(),
      });
    } catch (e) {
      console.warn('Auth updateProfile notice:', e);
    }
  }

  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        displayName: newDisplayName.trim(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error updating user name in Firestore:', err);
  }
}

// Listen to Auth State
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Sync User Accounts
export function subscribeUserAccounts(
  userId: string,
  onUpdate: (accounts: FinancialAccount[]) => void
) {
  const accountsRef = collection(db, 'users', userId, 'accounts');
  return onSnapshot(
    accountsRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      const accounts: FinancialAccount[] = [];
      snapshot.forEach((docSnap) => {
        accounts.push(docSnap.data() as FinancialAccount);
      });
      onUpdate(accounts);
    },
    (err) => {
      console.error('Firestore accounts subscription error:', err);
    }
  );
}

// Sync User Transactions
export function subscribeUserTransactions(
  userId: string,
  onUpdate: (transactions: Transaction[]) => void,
  onError?: (error: unknown) => void
) {
  const txRef = collection(db, 'users', userId, 'transactions');
  return onSnapshot(
    txRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      const transactions: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        transactions.push(docSnap.data() as Transaction);
      });
      // Sort newest first
      transactions.sort((a, b) => {
        const aTime = a.dateTime || `${a.date}T${a.time || '00:00'}`;
        const bTime = b.dateTime || `${b.date}T${b.time || '00:00'}`;
        return bTime.localeCompare(aTime);
      });
      onUpdate(transactions);
    },
    (err) => {
      console.error('Firestore transactions subscription error:', err);
      onError?.(err);
    }
  );
}

// Sync User Categories
export function subscribeUserCategories(
  userId: string,
  onUpdate: (categories: Category[]) => void
) {
  const catRef = collection(db, 'users', userId, 'categories');
  return onSnapshot(
    catRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      const categories: Category[] = [];
      snapshot.forEach((docSnap) => {
        categories.push(docSnap.data() as Category);
      });
      onUpdate(categories);
    },
    (err) => {
      console.error('Firestore categories subscription error:', err);
    }
  );
}

// Save single account to Firestore
export async function saveAccountToFirestore(userId: string, account: FinancialAccount) {
  if (account.type === 'credit') validateBalance(account, account.balance);
  else if (!isNonNegativeBalance(account.balance)) throw new Error('invalid-balance');
  const accountRef = doc(db, 'users', userId, 'accounts', account.id);
  await setDoc(accountRef, { ...account, userId }, { merge: true });
}

// Save all accounts (batch)
export async function saveAllAccountsToFirestore(userId: string, accounts: FinancialAccount[]) {
  for (const account of accounts) {
    if (account.type === 'credit') validateBalance(account, account.balance);
    else if (!isNonNegativeBalance(account.balance)) throw new Error('invalid-balance');
  }
  const batch = writeBatch(db);
  accounts.forEach((acc) => {
    const accRef = doc(db, 'users', userId, 'accounts', acc.id);
    batch.set(accRef, { ...acc, userId }, { merge: true });
  });
  await batch.commit();
}

// Reset only current account balances, without overwriting account settings or transactions.
export async function zeroAccountBalances(userId: string): Promise<void> {
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  const snapshot = await getDocsFromServer(collection(db, 'users', userId, 'accounts'));
  if (snapshot.size > 450) throw new Error('too-many-accounts');
  await runTransaction(db, async transaction => {
    const current = await Promise.all(snapshot.docs.map(account => transaction.get(account.ref)));
    if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
    for (const account of current) {
      if (!account.exists()) throw new Error('account-changed');
      transaction.update(account.ref, { balance: 0 });
    }
  });
}

// Create defaults only if still absent, preventing concurrent sign-ins from resetting data.
export async function initializeDefaultDocuments(userId: string, group: 'accounts' | 'categories', items: Array<FinancialAccount | Category>): Promise<void> {
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  const refs = items.map(item => doc(db, 'users', userId, group, item.id));
  await runTransaction(db, async transaction => {
    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) transaction.set(refs[index], { ...items[index], userId });
    });
  });
}

export class InsufficientBalanceError extends Error {
  constructor(public readonly balance: number, public readonly currency: string, public readonly accountNameAr: string, public readonly accountName: string) {
    super('insufficient-balance');
    this.name = 'InsufficientBalanceError';
  }
}

// A movement records both the chosen method and the actual balance account.
async function applyFinancialChange(userId: string, expected: Transaction | null, proposed: Transaction | null): Promise<'changed' | 'already-done'> {
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  const id = expected?.id || proposed?.id;
  if (!id || (expected && proposed && (expected.id !== proposed.id || expected.type !== proposed.type || expected.currency !== proposed.currency))) throw new Error('invalid-transaction');
  const txRef = doc(db, 'users', userId, 'transactions', id);
  return runTransaction(db, async transaction => {
    const savedSnapshot = await transaction.get(txRef);
    const saved = savedSnapshot.exists() ? savedSnapshot.data() : null;
    const matches = (tx: Transaction) => !!saved && Object.entries(tx).every(([key, value]) => saved[key] === value);
    if (expected && !saved) return proposed ? Promise.reject(new Error('transaction-not-found')) : 'already-done';
    if (!expected && saved) {
      if (proposed && matches(proposed)) return 'already-done';
      throw new Error('duplicate-transaction');
    }
    if (expected && saved && proposed && matches(proposed)) return 'already-done';
    if (expected && !matches(expected)) throw new Error('transaction-changed');
    const cache = new Map<string, LinkedAccount & { nameAr?: string; name?: string }>();
    const load = async (accountId: string) => {
      if (!cache.has(accountId)) {
        const snap = await transaction.get(doc(db, 'users', userId, 'accounts', accountId));
        if (!snap.exists()) throw new Error('account-not-found');
        cache.set(accountId, { ...snap.data(), id: accountId } as LinkedAccount & { nameAr?: string; name?: string });
      }
      return cache.get(accountId)!;
    };
    let finalTx = proposed;
    if (proposed) {
      const fromMethod = await load(proposed.accountId);
      if (fromMethod.linkedBankId) await load(fromMethod.linkedBankId);
      if (proposed.type === 'transfer' && proposed.toAccountId) {
        const targetMethod = await load(proposed.toAccountId);
        if (targetMethod.linkedBankId) await load(targetMethod.linkedBankId);
      }
      const bound = bindMovement(Array.from(cache.values()), proposed);
      // If the selected method hasn't changed, retain the balance account captured originally.
      if (expected?.balanceAccountId && expected.accountId === proposed.accountId) bound.balanceAccountId = expected.balanceAccountId;
      if (expected?.toBalanceAccountId && expected.toAccountId === proposed.toAccountId) bound.toBalanceAccountId = expected.toBalanceAccountId;
      if (bound.type === 'transfer' && bound.balanceAccountId === bound.toBalanceAccountId) throw new Error('invalid-transfer');
      finalTx = { ...proposed, balanceAccountId: bound.balanceAccountId, ...(bound.toBalanceAccountId ? { toBalanceAccountId: bound.toBalanceAccountId } : {}) };
    }
    const deltas = new Map<string, number>();
    const apply = (tx: Transaction, factor: number) => {
      for (const [accountId, delta] of movementDeltas(tx, factor)) deltas.set(accountId, (deltas.get(accountId) || 0) + delta);
    };
    if (expected) apply(expected, -1);
    if (finalTx) apply(finalTx, 1);
    const changes: Array<{ ref: ReturnType<typeof doc>; balance: number }> = [];
    for (const [accountId, delta] of deltas) {
      const account = await load(accountId);
      if (account.currency !== (finalTx || expected)!.currency) throw new Error('currency-mismatch');
      const balance = account.balance + delta;
      try { validateBalance(account, balance); }
      catch (error) {
        if (error instanceof Error && ['insufficient-balance', 'credit-limit-exceeded'].includes(error.message)) {
          const available = account.type === 'credit' ? (account.creditLimit || 0) + account.balance : account.balance;
          throw new InsufficientBalanceError(available, account.currency, account.nameAr || 'الحساب', account.name || 'account');
        }
        throw error;
      }
      changes.push({ ref: doc(db, 'users', userId, 'accounts', accountId), balance });
    }
    changes.forEach(change => transaction.update(change.ref, { balance: change.balance }));
    if (finalTx) transaction.set(txRef, { ...Object.fromEntries(Object.entries(finalTx).filter(([, value]) => value !== undefined)), userId });
    else transaction.delete(txRef);
    return 'changed';
  });
}

export async function createFinancialTransaction(userId: string, tx: Transaction): Promise<void> {
  await applyFinancialChange(userId, null, tx);
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  const confirmed = await getDocFromServer(doc(db, 'users', userId, 'transactions', tx.id));
  const saved = confirmed.data();
  if (!confirmed.exists() || saved?.userId !== userId || !Object.entries(tx).every(([key, value]) => saved[key] === value)) throw new Error('transaction-verification-failed');
}
export async function updateFinancialTransaction(userId: string, expected: Transaction, updated: Transaction): Promise<void> {
  await applyFinancialChange(userId, expected, updated);
}
export async function deleteTransactionFromFirestore(userId: string, transactionId: string): Promise<'deleted' | 'already-deleted'> {
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  const snapshot = await getDocFromServer(doc(db, 'users', userId, 'transactions', transactionId));
  if (!snapshot.exists()) return 'already-deleted';
  const result = await applyFinancialChange(userId, snapshot.data() as Transaction, null);
  return result === 'changed' ? 'deleted' : 'already-deleted';
}

// Save all categories (batch)
export async function saveAllCategoriesToFirestore(userId: string, categories: Category[]) {
  const batch = writeBatch(db);
  categories.forEach((cat) => {
    const catRef = doc(db, 'users', userId, 'categories', cat.id);
    batch.set(catRef, { ...cat, userId }, { merge: true });
  });
  await batch.commit();
}

// Save learned AI memory to Firestore
export async function saveLearnedMemoryToFirestore(userId: string, memory: any[]) {
  try {
    const memoryRef = doc(db, 'users', userId, 'preferences', 'learned_memory');
    await setDoc(memoryRef, { items: memory, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error saving learned memory to Firestore:', err);
  }
}

// Subscribe to learned AI memory from Firestore
export function subscribeLearnedMemory(
  userId: string,
  onUpdate: (memory: any[]) => void
) {
  const memoryRef = doc(db, 'users', userId, 'preferences', 'learned_memory');
  return onSnapshot(
    memoryRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate(data?.items || []);
      }
    },
    (err) => {
      console.warn('Firestore learned memory subscription notice:', err);
    }
  );
}

