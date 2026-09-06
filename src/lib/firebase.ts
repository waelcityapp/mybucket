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
  deleteDoc,
  writeBatch,
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
    (snapshot) => {
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
  onUpdate: (transactions: Transaction[]) => void
) {
  const txRef = collection(db, 'users', userId, 'transactions');
  return onSnapshot(
    txRef,
    (snapshot) => {
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
    (snapshot) => {
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

// Save single transaction to Firestore
export async function saveTransactionToFirestore(userId: string, transaction: Transaction) {
  const txRef = doc(db, 'users', userId, 'transactions', transaction.id);
  await setDoc(txRef, { ...transaction, userId }, { merge: true });
}

// Delete transaction from Firestore
export async function deleteTransactionFromFirestore(userId: string, transactionId: string) {
  const txRef = doc(db, 'users', userId, 'transactions', transactionId);
  await deleteDoc(txRef);
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

