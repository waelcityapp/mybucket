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
} from 'firebase/firestore';
import { FinancialAccount, Transaction, Category } from '../types';
import firebaseConfig from './firebaseConfig';

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
  const accountRef = doc(db, 'users', userId, 'accounts', account.id);
  await setDoc(accountRef, { ...account, userId }, { merge: true });
}

// Save all accounts (batch)
export async function saveAllAccountsToFirestore(userId: string, accounts: FinancialAccount[]) {
  const batch = writeBatch(db);
  accounts.forEach((acc) => {
    const accRef = doc(db, 'users', userId, 'accounts', acc.id);
    batch.set(accRef, { ...acc, userId }, { merge: true });
  });
  await batch.commit();
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

// Atomically create a transaction and update its affected balances from current server values.
export async function createFinancialTransaction(userId: string, tx: Transaction): Promise<void> {
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  if (!Number.isFinite(tx.amount) || tx.amount <= 0 || !tx.accountId) throw new Error('invalid-transaction');
  if (tx.type === 'transfer' && (!tx.toAccountId || tx.accountId === tx.toAccountId)) throw new Error('invalid-transfer');
  const txRef = doc(db, 'users', userId, 'transactions', tx.id);
  const fromRef = doc(db, 'users', userId, 'accounts', tx.accountId);
  const toRef = tx.type === 'transfer' && tx.toAccountId ? doc(db, 'users', userId, 'accounts', tx.toAccountId) : null;
  await runTransaction(db, async (transaction) => {
    const [oldTx, from, to] = await Promise.all([transaction.get(txRef), transaction.get(fromRef), toRef ? transaction.get(toRef) : Promise.resolve(null)]);
    if (oldTx.exists()) {
      const saved = oldTx.data();
      if (saved.userId === userId && Object.entries(tx).every(([key, value]) => saved[key] === value)) return;
      throw new Error('duplicate-transaction');
    }
    if (!from.exists() || (toRef && !to?.exists())) throw new Error('account-not-found');
    const source = from.data();
    const destination = to?.data();
    if (!Number.isFinite(source.balance) || (destination && !Number.isFinite(destination.balance))) throw new Error('invalid-balance');
    if (source.currency !== tx.currency || (destination && destination.currency !== tx.currency)) throw new Error('currency-mismatch');
    if ((tx.type === 'expense' || tx.type === 'transfer') && tx.amount > source.balance) {
      throw new InsufficientBalanceError(source.balance, source.currency, source.nameAr || 'الحساب', source.name || 'account');
    }
    const sourceBalance = source.balance + (tx.type === 'income' ? tx.amount : -tx.amount);
    transaction.set(txRef, { ...tx, userId });
    transaction.update(fromRef, { balance: sourceBalance });
    if (toRef && destination) transaction.update(toRef, { balance: destination.balance + tx.amount });
  });
  // A successful commit is followed by a server read, so the user sees success only
  // after the exact transaction is visible in the signed-in user's collection.
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  const confirmed = await getDocFromServer(txRef);
  const saved = confirmed.data();
  if (!confirmed.exists() || saved?.userId !== userId || !Object.entries(tx).every(([key, value]) => saved[key] === value)) {
    throw new Error('transaction-verification-failed');
  }
}

// Save single transaction to Firestore
export async function saveTransactionToFirestore(userId: string, transaction: Transaction) {
  const txRef = doc(db, 'users', userId, 'transactions', transaction.id);
  await setDoc(txRef, { ...transaction, userId }, { merge: true });
}

// Delete and reverse the financial effect together, based on current server values.
export async function deleteTransactionFromFirestore(userId: string, transactionId: string): Promise<'deleted' | 'already-deleted'> {
  if (auth.currentUser?.uid !== userId) throw new Error('auth-changed');
  const txRef = doc(db, 'users', userId, 'transactions', transactionId);
  return runTransaction(db, async transaction => {
    const savedTx = await transaction.get(txRef);
    if (!savedTx.exists()) return 'already-deleted';
    const tx = savedTx.data() as Transaction;
    if (!Number.isFinite(tx.amount) || tx.amount <= 0 || !tx.accountId || !['expense', 'income', 'transfer'].includes(tx.type)) throw new Error('invalid-transaction');
    if (tx.type === 'transfer' && (!tx.toAccountId || tx.toAccountId === tx.accountId)) throw new Error('invalid-transfer');
    const fromRef = doc(db, 'users', userId, 'accounts', tx.accountId);
    const toRef = tx.type === 'transfer' && tx.toAccountId ? doc(db, 'users', userId, 'accounts', tx.toAccountId) : null;
    const [from, to] = await Promise.all([transaction.get(fromRef), toRef ? transaction.get(toRef) : Promise.resolve(null)]);
    if (!from.exists() || (toRef && !to?.exists())) throw new Error('account-not-found');
    const source = from.data();
    const destination = to?.data();
    if (!Number.isFinite(source.balance) || (destination && !Number.isFinite(destination.balance))) throw new Error('invalid-balance');
    if (source.currency !== tx.currency || (destination && destination.currency !== tx.currency)) throw new Error('currency-mismatch');
    const debitedAccount = tx.type === 'income' ? source : tx.type === 'transfer' ? destination : null;
    if (debitedAccount && tx.amount > debitedAccount.balance) {
      throw new InsufficientBalanceError(debitedAccount.balance, debitedAccount.currency, debitedAccount.nameAr || 'الحساب', debitedAccount.name || 'account');
    }
    transaction.update(fromRef, { balance: source.balance + (tx.type === 'income' ? -tx.amount : tx.amount) });
    if (toRef && destination) transaction.update(toRef, { balance: destination.balance - tx.amount });
    transaction.delete(txRef);
    return 'deleted';
  });
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

