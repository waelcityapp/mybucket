import { useState, useEffect } from 'react';
import {
  FinancialAccount,
  Category,
  Transaction,
  ActiveTab,
  Language,
  TransactionType,
  AuthUser,
} from './types';
import { INITIAL_ACCOUNTS, INITIAL_CATEGORIES, INITIAL_TRANSACTIONS } from './data/initialData';
import { translations } from './data/translations';
import { Header } from './components/Header';
import { VoiceNaturalInput } from './components/VoiceNaturalInput';
import { QuickActions } from './components/QuickActions';
import { MoneySources } from './components/MoneySources';
import { MonthSummaryCard } from './components/MonthSummaryCard';
import { RecentTransactions } from './components/RecentTransactions';
import { TransactionModal } from './components/TransactionModal';
import { EditBalanceModal } from './components/EditBalanceModal';
import { BankAccountModal } from './components/BankAccountModal';
import { CardAccountModal } from './components/CardAccountModal';
import { WalletAccountModal } from './components/WalletAccountModal';
import { OtherAccountModal } from './components/OtherAccountModal';
import { ExtraAccountModal } from './components/ExtraAccountModal';
import { ExpenseCategoriesModal } from './components/ExpenseCategoriesModal';
import { CategoryDetailModal } from './components/CategoryDetailModal';
import { MobileLinkModal } from './components/MobileLinkModal';
import { BottomNav } from './components/BottomNav';
import { TransactionsView } from './components/views/TransactionsView';
import { AccountsView } from './components/views/AccountsView';
import { CategoriesView } from './components/views/CategoriesView';
import { SettingsView } from './components/views/SettingsView';
import { AdminView } from './components/views/AdminView';
import { SearchView } from './components/views/SearchView';
import { CheckCircle2, Smartphone, Cloud, ArrowRight } from 'lucide-react';
import { AIFinancialQuery, AICorrection } from './services/ai/types';
import {
  executeDeterministicQuery,
  DeterministicQueryResult,
} from './services/ai/deterministicQueryEngine';
import { FinancialQueryResultCard } from './components/FinancialQueryResultCard';
import { LoginView } from './components/views/LoginView';
import { SubscriptionStatusCard } from './components/views/SubscriptionStatusCard';
import { requestSubscription } from './services/subscriptionClient';
import type { UserSubscription } from './types/subscription';
import {
  loginWithGoogle,
  logoutUser,
  onAuthChange,
  testFirestoreConnection,
  subscribeUserAccounts,
  subscribeUserTransactions,
  subscribeUserCategories,
  saveAccountToFirestore,
  saveAllAccountsToFirestore,
  saveTransactionToFirestore,
  deleteTransactionFromFirestore,
  saveAllCategoriesToFirestore,
  saveLearnedMemoryToFirestore,
  subscribeLearnedMemory,
  updateUserNameInFirebase,
} from './lib/firebase';
import { aiLearnedMemory } from './services/ai/aiLearnedMemory';

const STORAGE_KEY_PREFIX = 'mybucket_';
const ADMIN_EMAIL = 'waelvts@gmail.com';

export default function App() {
  // 1. Language State (Arabic is default)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}lang`);
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });

  // 2. Active Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // Check if zero initialization was done
  const isZeroInitDone = !!localStorage.getItem(`${STORAGE_KEY_PREFIX}zero_initialized_v2`);

  // Helper to migrate legacy 'acc_savings_usd' / 'مدخرات دولار' to 'acc_wallet' / 'محافظ إلكترونية' and ensure 'acc_other' exists
  const migrateLegacyAccounts = (accs: FinancialAccount[]): { updated: FinancialAccount[]; migrated: boolean } => {
    let migrated = false;
    let updated = accs.map((acc) => {
      if (acc.id === 'acc_savings_usd' || acc.nameAr === 'مدخرات دولار' || acc.name === 'USD Savings') {
        migrated = true;
        return {
          ...acc,
          id: 'acc_wallet',
          name: 'E-Wallets',
          nameAr: 'محافظ إلكترونية',
          type: 'wallet' as const,
          currency: 'EGP' as const,
          color: '#06b6d4',
        };
      }
      return acc;
    });

    const hasOther = updated.some((a) => a.id === 'acc_other' || a.type === 'other');
    if (!hasOther) {
      migrated = true;
      updated.push({
        id: 'acc_other',
        name: 'Other Methods',
        nameAr: 'وسائل دفع واستلام أخرى',
        type: 'other' as const,
        balance: 0,
        currency: 'EGP' as const,
        color: '#f59e0b',
      });
    }

    const hasExtra = updated.some((a) => a.id === 'acc_extra' || a.type === 'custom');
    if (!hasExtra) {
      migrated = true;
      updated.push({
        id: 'acc_extra',
        name: 'Other Accounts',
        nameAr: 'حسابات أخرى',
        type: 'custom' as const,
        balance: 0,
        currency: 'EGP' as const,
        color: '#6366f1',
      });
    }

    return { updated, migrated };
  };

  const migrateLegacyTransactions = (txs: Transaction[]): Transaction[] => {
    return txs.map((tx) => {
      let updated = false;
      let newAcc = tx.accountId;
      let newToAcc = tx.toAccountId;
      if (tx.accountId === 'acc_savings_usd') {
        newAcc = 'acc_wallet';
        updated = true;
      }
      if (tx.toAccountId === 'acc_savings_usd') {
        newToAcc = 'acc_wallet';
        updated = true;
      }
      return updated ? { ...tx, accountId: newAcc, toAccountId: newToAcc } : tx;
    });
  };

  // 3. Financial Accounts State
  const [accounts, setAccounts] = useState<FinancialAccount[]>(() => {
    if (!isZeroInitDone) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}zero_initialized_v2`, 'true');
      return INITIAL_ACCOUNTS;
    }
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}accounts`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return migrateLegacyAccounts(parsed).updated;
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_ACCOUNTS;
  });

  // 4. Categories State
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}categories`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_CATEGORIES;
  });

  // 5. Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (!isZeroInitDone) {
      return [];
    }
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}transactions`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return migrateLegacyTransactions(parsed);
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  // 6. User Auth State (Google Authentication)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isGoogleLoginPending, setIsGoogleLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [isApplyingAffiliateCode, setIsApplyingAffiliateCode] = useState(false);
  const [affiliateFeedback, setAffiliateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const isAdmin = authUser?.email?.trim().toLowerCase() === ADMIN_EMAIL;

  // 7. Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialType, setAddModalInitialType] = useState<TransactionType>('expense');
  const [prefilledDraft, setPrefilledDraft] = useState<Partial<Transaction> | null>(null);
  const [draftMissingFields, setDraftMissingFields] = useState<string[]>([]);
  const [activeFinancialQueryResult, setActiveFinancialQueryResult] = useState<DeterministicQueryResult | null>(null);
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [selectedAccountForBalance, setSelectedAccountForBalance] = useState<string | null>(null);
  const [isBankAccountModalOpen, setIsBankAccountModalOpen] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [isCardAccountModalOpen, setIsCardAccountModalOpen] = useState(false);
  const [selectedCardAccountId, setSelectedCardAccountId] = useState<string | null>(null);
  const [isWalletAccountModalOpen, setIsWalletAccountModalOpen] = useState(false);
  const [selectedWalletAccountId, setSelectedWalletAccountId] = useState<string | null>(null);
  const [isOtherAccountModalOpen, setIsOtherAccountModalOpen] = useState(false);
  const [selectedOtherAccountId, setSelectedOtherAccountId] = useState<string | null>(null);
  const [isExtraAccountModalOpen, setIsExtraAccountModalOpen] = useState(false);
  const [selectedExtraAccountId, setSelectedExtraAccountId] = useState<string | null>(null);
  const [isExpenseCategoriesModalOpen, setIsExpenseCategoriesModalOpen] = useState(false);
  const [isCategoryDetailModalOpen, setIsCategoryDetailModalOpen] = useState(false);
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] = useState<Category | null>(null);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // 8. Success Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync Language & RTL to document body
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(`${STORAGE_KEY_PREFIX}lang`, lang);
  }, [lang]);

  // Persist State Changes in LocalStorage as local backup
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}accounts`, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}transactions`, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}categories`, JSON.stringify(categories));
  }, [categories]);

  // Initialize Firebase Auth & Test Firestore Connection
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setAuthUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setAuthUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser || isGoogleLoginPending) {
      if (!authUser) {
        setSubscription(null);
        setSubscriptionError(null);
        setIsSubscriptionLoading(false);
      }
      return;
    }

    let isCurrent = true;
    setIsSubscriptionLoading(true);
    setSubscriptionError(null);
    requestSubscription('subscription.get')
      .then((nextSubscription) => {
        if (isCurrent) setSubscription(nextSubscription);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setSubscriptionError(
            error instanceof Error
              ? error.message
              : (lang === 'ar' ? 'تعذر تحميل حالة الاشتراك.' : 'Could not load subscription status.')
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsSubscriptionLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [authUser?.uid, isGoogleLoginPending]);

  const handleApplyAffiliateCode = async () => {
    const code = affiliateCode.trim().toUpperCase();
    if (!code) {
      setAffiliateFeedback({
        type: 'error',
        message: lang === 'ar' ? 'اكتب كود المسوّق أولاً.' : 'Enter a marketer code first.',
      });
      return;
    }

    setIsApplyingAffiliateCode(true);
    setAffiliateFeedback(null);
    try {
      const nextSubscription = await requestSubscription('subscription.applyAffiliate', { code });
      setSubscription(nextSubscription);
      setSubscriptionError(null);
      setAffiliateCode('');
      setAffiliateFeedback({
        type: 'success',
        message: lang === 'ar'
          ? `تم تفعيل الكود: ${nextSubscription.totalTrialDays} يوم تجربة، والسعر ${nextSubscription.monthlyPriceEgp ?? 180} جنيهًا لكل 30 يومًا.`
          : `Code applied: ${nextSubscription.totalTrialDays} trial days, then EGP ${nextSubscription.monthlyPriceEgp ?? 180} per 30 days.`,
      });
    } catch (error: unknown) {
      setAffiliateFeedback({
        type: 'error',
        message: error instanceof Error
          ? error.message
          : (lang === 'ar' ? 'تعذر تفعيل الكود. حاول مرة أخرى.' : 'Could not apply the code. Try again.'),
      });
    } finally {
      setIsApplyingAffiliateCode(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('settings');
    }
  }, [activeTab, isAdmin]);

  // Real-time Cloud Synchronization with Firestore when user is authenticated
  useEffect(() => {
    if (!authUser) return;

    // 1. Subscribe to User's Accounts
    const unsubAccounts = subscribeUserAccounts(authUser.uid, (cloudAccounts) => {
      if (cloudAccounts && cloudAccounts.length > 0) {
        const { updated, migrated } = migrateLegacyAccounts(cloudAccounts);
        setAccounts(updated);
        if (migrated) {
          saveAllAccountsToFirestore(authUser.uid, updated);
        }
      } else {
        // If user has no accounts in cloud yet, seed with current local accounts
        saveAllAccountsToFirestore(authUser.uid, accounts);
      }
    });

    // 2. Subscribe to User's Transactions
    const unsubTransactions = subscribeUserTransactions(authUser.uid, (cloudTx) => {
      if (cloudTx) {
        const migratedTx = migrateLegacyTransactions(cloudTx);
        setTransactions(migratedTx);
      }
    });

    // 3. Subscribe to User's Categories
    const unsubCategories = subscribeUserCategories(authUser.uid, (cloudCats) => {
      if (cloudCats && cloudCats.length > 0) {
        setCategories(cloudCats);
      } else {
        saveAllCategoriesToFirestore(authUser.uid, categories);
      }
    });

    // 4. Subscribe to User's Learned AI Memory
    const unsubLearnedMemory = subscribeLearnedMemory(authUser.uid, (cloudMemory) => {
      if (cloudMemory && cloudMemory.length > 0) {
        aiLearnedMemory.setMemoryFromRemote(cloudMemory);
      }
    });

    return () => {
      unsubAccounts();
      unsubTransactions();
      unsubCategories();
      unsubLearnedMemory();
    };
  }, [authUser?.uid]);

  // Google Login Handler
  const handleGoogleLogin = async (rawAffiliateCode = affiliateCode) => {
    setIsGoogleLoginPending(true);
    setLoginError(null);
    setAffiliateFeedback(null);

    try {
      const user = await loginWithGoogle();
      const code = rawAffiliateCode.trim().toUpperCase();

      if (code) {
        setAffiliateCode(code);
        try {
          const nextSubscription = await requestSubscription('subscription.applyAffiliate', { code }, user);
          setSubscription(nextSubscription);
          setAffiliateCode('');
          setAffiliateFeedback({
            type: 'success',
            message: lang === 'ar'
              ? `تم تفعيل الكود: ${nextSubscription.totalTrialDays} يوم تجربة، والسعر ${nextSubscription.monthlyPriceEgp ?? 180} جنيهًا لكل 30 يومًا.`
              : `Code applied: ${nextSubscription.totalTrialDays} trial days, then EGP ${nextSubscription.monthlyPriceEgp ?? 180} per 30 days.`,
          });
        } catch (affiliateError: unknown) {
          setAffiliateFeedback({
            type: 'error',
            message: affiliateError instanceof Error
              ? affiliateError.message
              : (lang === 'ar' ? 'تعذر تفعيل الكود. يمكنك المحاولة من بطاقة الاشتراك.' : 'Could not apply the code. You can retry from the subscription card.'),
          });
        }
      }

      setToastMessage(
        lang === 'ar'
          ? `أهلاً بك، تم تسجيل الدخول بنجاح (${user.displayName || user.email})`
          : `Welcome! Signed in as ${user.displayName || user.email}`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      const message = err?.code === 'auth/popup-blocked'
        ? (lang === 'ar'
          ? 'المتصفح منع نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.'
          : 'The browser blocked the sign-in window. Allow popups and try again.')
        : (lang === 'ar'
          ? 'تعذر تسجيل الدخول حالياً. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'
          : 'Could not sign in right now. Check your internet connection and try again.');

      setLoginError(message);
      setToastMessage(message);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsGoogleLoginPending(false);
    }
  };

  // Google Logout Handler
  const handleGoogleLogout = async () => {
    try {
      await logoutUser();
      setToastMessage(lang === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Signed out successfully');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Sign-Out error:', err);
    }
  };

  // Update User Display Name Handler
  const handleUpdateUserName = async (newName: string) => {
    if (!authUser || !newName.trim()) return;
    try {
      await updateUserNameInFirebase(authUser.uid, newName.trim());
      setAuthUser((prev) => (prev ? { ...prev, displayName: newName.trim() } : null));
      setToastMessage(lang === 'ar' ? 'تم تحديث اسم المستخدم بنجاح' : 'Display name updated successfully');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Update display name error:', err);
      setToastMessage(lang === 'ar' ? 'تعذر حفظ الاسم' : 'Could not save name');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Toggle Language Handler
  const handleToggleLanguage = () => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  // Open Add Modal manually
  const handleOpenAddModal = (type: TransactionType = 'expense') => {
    setPrefilledDraft(null);
    setDraftMissingFields([]);
    setAddModalInitialType(type);
    setIsAddModalOpen(true);
  };

  // Handle Natural Language / Voice input parsed draft via Gemini AI
  const handleTransactionDraft = (draft: Partial<Transaction>, missingFields: string[]) => {
    setPrefilledDraft(draft);
    setDraftMissingFields(missingFields);
    if (draft.type) {
      setAddModalInitialType(draft.type);
    }
    setIsAddModalOpen(true);
  };

  // Handle AI Correction (e.g. user says "make it 400" after a draft was generated)
  const handleAICorrection = (correction: AICorrection) => {
    if (prefilledDraft && correction.fieldToUpdate) {
      let val: any = correction.newValue;
      if (correction.fieldToUpdate === 'amount' && val != null) {
        val = typeof val === 'string' ? parseFloat(val) : val;
        val = val || undefined;
      }
      
      const updatedDraft = { ...prefilledDraft, [correction.fieldToUpdate]: val };
      setPrefilledDraft(updatedDraft);

      // Adaptive learning from correction
      if (prefilledDraft.description) {
        aiLearnedMemory.recordLearning(prefilledDraft.description, {
          categoryId: correction.fieldToUpdate === 'categoryId' ? String(val) : updatedDraft.categoryId,
          accountId: correction.fieldToUpdate === 'accountId' ? String(val) : updatedDraft.accountId,
          type: updatedDraft.type,
          description: updatedDraft.description,
        });
        if (authUser) {
          saveLearnedMemoryToFirestore(authUser.uid, aiLearnedMemory.getLearnedList());
        }
      }
      
      // Ensure modal is open to show the correction
      if (!isAddModalOpen) {
        setIsAddModalOpen(true);
      }
      
      const t = translations[lang];
      setToastMessage(lang === 'ar' ? 'تم تعديل العملية' : 'Transaction updated');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Handle AI Financial Query with Deterministic Math Engine
  const handleFinancialQuery = (query: AIFinancialQuery, questionText: string) => {
    const result = executeDeterministicQuery(
      query,
      questionText,
      transactions,
      accounts,
      categories,
      lang
    );
    setActiveFinancialQueryResult(result);
  };

  // Save Confirmed Transaction Handler
  const handleSaveTransaction = async (newTxData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newId = `tx_${Date.now()}`;
    const newTx: Transaction = {
      ...newTxData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    // Record user confirmed transaction in AI Continuous Learned Memory
    if (newTx.description) {
      const catObj = categories.find((c) => c.id === newTx.categoryId);
      const accObj = accounts.find((a) => a.id === newTx.accountId);
      aiLearnedMemory.recordLearning(newTx.description, {
        categoryId: newTx.categoryId,
        categoryNameAr: catObj?.nameAr,
        accountId: newTx.accountId,
        accountNameAr: accObj?.nameAr,
        type: newTx.type,
        description: newTx.description,
      });
    }

    // Calculate updated accounts
    const updatedAccounts = accounts.map((acc) => {
      // Source account
      if (acc.id === newTx.accountId) {
        if (newTx.type === 'expense') {
          return { ...acc, balance: acc.balance - newTx.amount };
        }
        if (newTx.type === 'income') {
          return { ...acc, balance: acc.balance + newTx.amount };
        }
        if (newTx.type === 'transfer') {
          return { ...acc, balance: acc.balance - newTx.amount };
        }
      }

      // Destination account for transfer
      if (newTx.type === 'transfer' && acc.id === newTx.toAccountId) {
        return { ...acc, balance: acc.balance + newTx.amount };
      }

      return acc;
    });

    // 1. Update local state
    setTransactions((prev) => [newTx, ...prev]);
    setAccounts(updatedAccounts);

    // 2. Sync to Firestore if signed in
    if (authUser) {
      try {
        await saveTransactionToFirestore(authUser.uid, newTx);
        await saveAllAccountsToFirestore(authUser.uid, updatedAccounts);
        await saveLearnedMemoryToFirestore(authUser.uid, aiLearnedMemory.getLearnedList());
      } catch (err) {
        console.error('Firestore save transaction error:', err);
      }
    }

    // Show temporary toast
    const t = translations[lang];
    setToastMessage(t.successSaved);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Delete Transaction Handler
  const handleDeleteTransaction = async (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    // Reverse balance impact
    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === tx.accountId) {
        if (tx.type === 'expense') {
          return { ...acc, balance: acc.balance + tx.amount };
        }
        if (tx.type === 'income') {
          return { ...acc, balance: acc.balance - tx.amount };
        }
        if (tx.type === 'transfer') {
          return { ...acc, balance: acc.balance + tx.amount };
        }
      }
      if (tx.type === 'transfer' && acc.id === tx.toAccountId) {
        return { ...acc, balance: acc.balance - tx.amount };
      }
      return acc;
    });

    setAccounts(updatedAccounts);
    setTransactions((prev) => prev.filter((t) => t.id !== txId));

    // Delete from Firestore
    if (authUser) {
      try {
        await deleteTransactionFromFirestore(authUser.uid, txId);
        await saveAllAccountsToFirestore(authUser.uid, updatedAccounts);
      } catch (err) {
        console.error('Firestore delete transaction error:', err);
      }
    }
  };

  // Edit Existing Transaction Handler (re-calculate account balance impact)
  const handleEditTransaction = async (updatedTx: Transaction) => {
    const oldTx = transactions.find((t) => t.id === updatedTx.id);
    if (!oldTx) return;

    // Recalculate account balances: first reverse oldTx, then apply updatedTx
    const updatedAccounts = accounts.map((acc) => {
      let balance = acc.balance;

      // 1. Reverse oldTx effect
      if (acc.id === oldTx.accountId) {
        if (oldTx.type === 'expense') balance += oldTx.amount;
        if (oldTx.type === 'income') balance -= oldTx.amount;
        if (oldTx.type === 'transfer') balance += oldTx.amount;
      }
      if (oldTx.type === 'transfer' && acc.id === oldTx.toAccountId) {
        balance -= oldTx.amount;
      }

      // 2. Apply updatedTx effect
      if (acc.id === updatedTx.accountId) {
        if (updatedTx.type === 'expense') balance -= updatedTx.amount;
        if (updatedTx.type === 'income') balance += updatedTx.amount;
        if (updatedTx.type === 'transfer') balance -= updatedTx.amount;
      }
      if (updatedTx.type === 'transfer' && acc.id === updatedTx.toAccountId) {
        balance += updatedTx.amount;
      }

      return { ...acc, balance };
    });

    setAccounts(updatedAccounts);
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));

    // Save to Firestore
    if (authUser) {
      try {
        await saveTransactionToFirestore(authUser.uid, updatedTx);
        await saveAllAccountsToFirestore(authUser.uid, updatedAccounts);
      } catch (err) {
        console.error('Firestore edit transaction error:', err);
      }
    }

    setToastMessage(lang === 'ar' ? 'تم تحديث المعاملة بنجاح!' : 'Transaction updated successfully!');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add New Account Handler
  const handleAddAccount = async (accData: Omit<FinancialAccount, 'id'>) => {
    const newAccount: FinancialAccount = {
      ...accData,
      id: `acc_${Date.now()}`,
    };
    const updated = [...accounts, newAccount];
    setAccounts(updated);

    if (authUser) {
      try {
        await saveAccountToFirestore(authUser.uid, newAccount);
      } catch (err) {
        console.error('Firestore save account error:', err);
      }
    }
  };

  // Add New Category Handler (from autocomplete or categories view)
  const handleAddCategory = async (newCat: Category) => {
    const updated = [...categories, newCat];
    setCategories(updated);

    if (authUser) {
      try {
        await saveAllCategoriesToFirestore(authUser.uid, updated);
      } catch (err) {
        console.error('Firestore save category error:', err);
      }
    }
  };

  // Bulk update or modify categories handler (from ExpenseCategoriesModal)
  const handleUpdateCategories = async (updatedList: Category[]) => {
    setCategories(updatedList);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}categories`, JSON.stringify(updatedList));

    if (authUser) {
      try {
        await saveAllCategoriesToFirestore(authUser.uid, updatedList);
      } catch (err) {
        console.error('Firestore save all categories error:', err);
      }
    }

    setToastMessage(lang === 'ar' ? 'تم حفظ بنود الصرف بنجاح!' : 'Spending categories saved successfully!');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Edit Balance Modal
  const handleOpenEditBalance = (accId: string | null = null) => {
    const target = accounts.find((a) => a.id === accId);
    if (target?.type === 'bank' || target?.id === 'acc_bank') {
      handleOpenBankAccountModal(accId);
      return;
    }
    if (target?.type === 'card' || target?.id === 'acc_card') {
      handleOpenCardAccountModal(accId);
      return;
    }
    if (target?.type === 'wallet' || target?.id === 'acc_wallet') {
      handleOpenWalletAccountModal(accId);
      return;
    }
    if (target?.type === 'other' || target?.id === 'acc_other') {
      handleOpenOtherAccountModal(accId);
      return;
    }
    if (target?.type === 'custom' || target?.id === 'acc_extra') {
      handleOpenExtraAccountModal(accId);
      return;
    }
    setSelectedAccountForBalance(accId);
    setIsEditBalanceModalOpen(true);
  };

  // Open Bank Account Management Modal
  const handleOpenBankAccountModal = (accId: string | null = null) => {
    const bankAcc = (accId ? accounts.find((a) => a.id === accId) : null) || accounts.find((a) => a.type === 'bank') || accounts.find((a) => a.id === 'acc_bank');
    setSelectedBankAccountId(bankAcc ? bankAcc.id : (accId || 'acc_bank'));
    setIsBankAccountModalOpen(true);
  };

  // Save Bank Account Changes (Name & Balance)
  const handleSaveBankAccount = async (accountId: string, newNameAr: string, newBalance: number) => {
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          nameAr: newNameAr,
          name: newNameAr,
          balance: newBalance,
        };
      }
      return acc;
    });
    setAccounts(updated);

    if (authUser) {
      const target = updated.find((a) => a.id === accountId);
      if (target) {
        await saveAccountToFirestore(authUser.uid, target);
      }
    }

    setToastMessage(lang === 'ar' ? `تم حفظ بيانات ${newNameAr} بنجاح` : 'Bank account updated successfully');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Card / Visa Account Management Modal
  const handleOpenCardAccountModal = (accId: string | null = null) => {
    const cardAcc = (accId ? accounts.find((a) => a.id === accId) : null) || accounts.find((a) => a.type === 'card') || accounts.find((a) => a.id === 'acc_card');
    setSelectedCardAccountId(cardAcc ? cardAcc.id : (accId || 'acc_card'));
    setIsCardAccountModalOpen(true);
  };

  // Save Card Account Changes (Name & Balance)
  const handleSaveCardAccount = async (accountId: string, newNameAr: string, newBalance: number) => {
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          nameAr: newNameAr,
          name: newNameAr,
          balance: newBalance,
        };
      }
      return acc;
    });
    setAccounts(updated);

    if (authUser) {
      const target = updated.find((a) => a.id === accountId);
      if (target) {
        await saveAccountToFirestore(authUser.uid, target);
      }
    }

    setToastMessage(lang === 'ar' ? `تم حفظ بيانات ${newNameAr} بنجاح` : 'Card updated successfully');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Wallet / E-Wallet Management Modal
  const handleOpenWalletAccountModal = (accId: string | null = null) => {
    const walletAcc = (accId ? accounts.find((a) => a.id === accId) : null) || accounts.find((a) => a.type === 'wallet') || accounts.find((a) => a.id === 'acc_wallet');
    setSelectedWalletAccountId(walletAcc ? walletAcc.id : (accId || 'acc_wallet'));
    setIsWalletAccountModalOpen(true);
  };

  // Save Wallet Account Changes (Name & Balance)
  const handleSaveWalletAccount = async (accountId: string, newNameAr: string, newBalance: number) => {
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          nameAr: newNameAr,
          name: newNameAr,
          balance: newBalance,
        };
      }
      return acc;
    });
    setAccounts(updated);

    if (authUser) {
      const target = updated.find((a) => a.id === accountId);
      if (target) {
        await saveAccountToFirestore(authUser.uid, target);
      }
    }

    setToastMessage(lang === 'ar' ? `تم حفظ بيانات ${newNameAr} بنجاح` : 'Wallet updated successfully');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Other Payment/Receiving Methods Modal
  const handleOpenOtherAccountModal = (accId: string | null = null) => {
    const otherAcc = (accId ? accounts.find((a) => a.id === accId) : null) || accounts.find((a) => a.type === 'other') || accounts.find((a) => a.id === 'acc_other');
    setSelectedOtherAccountId(otherAcc ? otherAcc.id : (accId || 'acc_other'));
    setIsOtherAccountModalOpen(true);
  };

  // Save Other Payment/Receiving Methods Changes (Name & Balance)
  const handleSaveOtherAccount = async (accountId: string, newNameAr: string, newBalance: number) => {
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          nameAr: newNameAr,
          name: newNameAr,
          balance: newBalance,
        };
      }
      return acc;
    });
    setAccounts(updated);

    if (authUser) {
      const target = updated.find((a) => a.id === accountId);
      if (target) {
        await saveAccountToFirestore(authUser.uid, target);
      }
    }

    setToastMessage(lang === 'ar' ? `تم حفظ بيانات ${newNameAr} بنجاح` : 'Payment method updated successfully');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Extra / Other Accounts Modal
  const handleOpenExtraAccountModal = (accId: string | null = null) => {
    const extraAcc = (accId ? accounts.find((a) => a.id === accId) : null) || accounts.find((a) => a.type === 'custom') || accounts.find((a) => a.id === 'acc_extra');
    setSelectedExtraAccountId(extraAcc ? extraAcc.id : (accId || 'acc_extra'));
    setIsExtraAccountModalOpen(true);
  };

  // Save Extra / Other Accounts Changes (Name & Balance)
  const handleSaveExtraAccount = async (accountId: string, newNameAr: string, newBalance: number) => {
    const updated = accounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          nameAr: newNameAr,
          name: newNameAr,
          balance: newBalance,
        };
      }
      return acc;
    });
    setAccounts(updated);

    if (authUser) {
      const target = updated.find((a) => a.id === accountId);
      if (target) {
        await saveAccountToFirestore(authUser.uid, target);
      }
    }

    setToastMessage(lang === 'ar' ? `تم حفظ بيانات ${newNameAr} بنجاح` : 'Account updated successfully');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Update Single Account Balance
  const handleUpdateSingleBalance = async (accountId: string, newBalance: number) => {
    const updated = accounts.map((acc) =>
      acc.id === accountId ? { ...acc, balance: newBalance } : acc
    );
    setAccounts(updated);

    if (authUser) {
      const target = updated.find((a) => a.id === accountId);
      if (target) {
        await saveAccountToFirestore(authUser.uid, target);
      }
    }

    const t = translations[lang];
    setToastMessage(t.openingBalanceUpdated);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Update Bulk Account Balances
  const handleUpdateBulkBalances = async (balancesMap: Record<string, number>) => {
    const updated = accounts.map((acc) => {
      if (acc.id in balancesMap) {
        return { ...acc, balance: balancesMap[acc.id] };
      }
      return acc;
    });
    setAccounts(updated);

    if (authUser) {
      await saveAllAccountsToFirestore(authUser.uid, updated);
    }

    const t = translations[lang];
    setToastMessage(t.openingBalanceUpdated);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Zero All Account Balances
  const handleZeroAllBalances = async () => {
    const zeroed = accounts.map((acc) => ({ ...acc, balance: 0 }));
    setAccounts(zeroed);
    setTransactions([]);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}transactions`);

    if (authUser) {
      await saveAllAccountsToFirestore(authUser.uid, zeroed);
    }
  };

  // Reset Demo Data Handler
  const handleResetDemoData = async () => {
    setAccounts(INITIAL_ACCOUNTS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}accounts`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}categories`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}transactions`);

    if (authUser) {
      await saveAllAccountsToFirestore(authUser.uid, INITIAL_ACCOUNTS);
      await saveAllCategoriesToFirestore(authUser.uid, INITIAL_CATEGORIES);
    }
  };

  const t = translations[lang];

  // Dynamic greeting based on current time and user name
  const currentHour = new Date().getHours();
  const userName = authUser?.displayName 
    ? authUser.displayName.trim().split(' ')[0] 
    : (lang === 'ar' ? 'صديقي' : 'Friend');

  const greetingPrefix = currentHour < 12 ? (lang === 'ar' ? 'صباح الخير يا' : 'Good morning,') : (lang === 'ar' ? 'مساء الخير يا' : 'Good evening,');
  const revisionLabel = isAdmin ? ' #5' : '';
  const greetingText = `${greetingPrefix} ${userName} 👋${revisionLabel}`;

  if (isAuthLoading) {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f5f7f6] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-10 w-10 rounded-2xl bg-emerald-600 animate-pulse" />
          <span className="text-sm">{lang === 'ar' ? 'جارٍ تجهيز حسابك...' : 'Preparing your account...'}</span>
        </div>
      </div>
    );
  }

  if (!authUser || isGoogleLoginPending) {
    return (
      <LoginView
        lang={lang}
        onToggleLanguage={handleToggleLanguage}
        onLogin={(code) => handleGoogleLogin(code)}
        affiliateCode={affiliateCode}
        onAffiliateCodeChange={(code) => { setAffiliateCode(code.toUpperCase()); setAffiliateFeedback(null); }}
        isLoading={isGoogleLoginPending}
        error={loginError}
      />
    );
  }

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Matching Reference + Google Account / Mobile quick actions */}
      <Header
        lang={lang}
        onToggleLanguage={handleToggleLanguage}
        user={authUser}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
        onOpenMobileLink={() => setIsMobileModalOpen(true)}
        onUpdateUserName={handleUpdateUserName}
      />

      {/* Main Content Area - Mobile First proportions matching reference */}
      <main className="flex-1 max-w-md sm:max-w-xl w-full mx-auto p-4 pb-24">
        {activeTab === 'home' && (
          <div className="space-y-4">
            <SubscriptionStatusCard
              lang={lang}
              subscription={subscription}
              isLoading={isSubscriptionLoading}
              error={subscriptionError}
              affiliateCode={affiliateCode}
              onAffiliateCodeChange={(code) => { setAffiliateCode(code.toUpperCase()); setAffiliateFeedback(null); }}
              isApplyingCode={isApplyingAffiliateCode}
              feedback={affiliateFeedback}
              onApplyCode={handleApplyAffiliateCode}
              onRetry={() => {
                setSubscriptionError(null);
                setIsSubscriptionLoading(true);
                requestSubscription('subscription.get')
                  .then(setSubscription)
                  .catch((error: unknown) => setSubscriptionError(error instanceof Error ? error.message : (lang === 'ar' ? 'تعذر تحميل حالة الاشتراك.' : 'Could not load subscription status.')))
                  .finally(() => setIsSubscriptionLoading(false));
              }}
            />
            {/* Quick Mobile & Google Account Banner (if not logged in) */}
            {!authUser && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-2.5 animate-in fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-950 truncate">
                      {lang === 'ar' ? 'تابع محفظتك من الموبايل 📱' : 'Track on your phone 📱'}
                    </div>
                    <div className="text-[11px] text-emerald-700 truncate">
                      {lang === 'ar'
                        ? 'سجّل بحساب Google لمزامنة فورية على جميع أجهزتك'
                        : 'Sign in with Google to sync across all your devices'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'دخول بجوجل' : 'Sign in'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMobileModalOpen(true)}
                    className="p-1.5 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer"
                    title={t.mobileLinkTitle}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              </div>
            )}

            {/* 1. Soft Greeting Section Matching Reference */}
            <div className="pt-1 pb-1 px-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                    {greetingText}
                  </h1>
                </div>
                {authUser && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                    <Cloud className="w-3 h-3 text-emerald-600" />
                    <span>{lang === 'ar' ? 'سحابي متزامن' : 'Cloud Synced'}</span>
                  </div>
                )}
              </div>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight mt-0.5">
                {t.homePrompt}
              </p>
            </div>

            {/* 2. THE PRIMARY INTERACTION: "اكتب أو قل لي أي عملية..." Large Card */}
            <VoiceNaturalInput
              lang={lang}
              accounts={accounts}
              categories={categories}
              onTransactionDraft={handleTransactionDraft}
              onFinancialQuery={handleFinancialQuery}
              onAICorrection={handleAICorrection}
            />

            {/* AI Financial Query Result Card */}
            {activeFinancialQueryResult && (
              <FinancialQueryResultCard
                result={activeFinancialQueryResult}
                lang={lang}
                onClose={() => setActiveFinancialQueryResult(null)}
              />
            )}

            {/* 3. 3 Quick Transaction Action Buttons: مصروف, دخل, تحويل */}
            <QuickActions 
              lang={lang} 
              onOpenAddModal={handleOpenAddModal} 
              onOpenSearchModal={() => setActiveTab('search')}
            />

            {/* 4. "حساباتك" - Money Sources / Accounts Grid */}
            <MoneySources
              accounts={accounts}
              lang={lang}
              onViewAll={() => setActiveTab('accounts')}
              onAddAccountClick={() => setActiveTab('accounts')}
              onOpenExpenseCategories={() => setIsExpenseCategoriesModalOpen(true)}
              onSelectAccount={(accId) => {
                const target = accounts.find((a) => a.id === accId);
                if (target?.type === 'cash' || target?.id === 'acc_cash') {
                  handleOpenEditBalance(accId);
                } else if (target?.type === 'bank' || target?.id === 'acc_bank') {
                  handleOpenBankAccountModal(accId);
                } else if (target?.type === 'card' || target?.id === 'acc_card') {
                  handleOpenCardAccountModal(accId);
                } else if (target?.type === 'wallet' || target?.id === 'acc_wallet') {
                  handleOpenWalletAccountModal(accId);
                } else if (target?.type === 'other' || target?.id === 'acc_other') {
                  handleOpenOtherAccountModal(accId);
                } else if (target?.type === 'custom' || target?.id === 'acc_extra') {
                  handleOpenExtraAccountModal(accId);
                } else {
                  setActiveTab('transactions');
                }
              }}
              onEditBalance={handleOpenEditBalance}
            />

            {/* 5. "ملخص هذا الشهر" - Donut Chart & Monthly Breakdown Card */}
            <MonthSummaryCard transactions={transactions} lang={lang} />

            {/* 6. "أحدث العمليات" - Recent Transactions List */}
            <RecentTransactions
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              lang={lang}
              onViewAll={() => setActiveTab('transactions')}
              onDeleteTransaction={handleDeleteTransaction}
            />
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            lang={lang}
            onOpenAddModal={() => handleOpenAddModal('expense')}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            lang={lang}
            onAddAccount={handleAddAccount}
            onEditBalance={handleOpenEditBalance}
          />
        )}

        {activeTab === 'search' && (
          <SearchView
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            lang={lang}
            authUser={authUser}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesView
            categories={categories}
            transactions={transactions}
            lang={lang}
            authUser={authUser}
            onSelectCategory={(cat) => {
              setSelectedCategoryForDetail(cat);
              setIsCategoryDetailModalOpen(true);
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            lang={lang}
            onSetLanguage={(newLang) => setLang(newLang)}
            user={authUser}
            onLogin={handleGoogleLogin}
            onLogout={handleGoogleLogout}
            onOpenMobileLink={() => setIsMobileModalOpen(true)}
            isAdmin={isAdmin}
            onOpenAdmin={() => setActiveTab('admin')}
          />
        )}

        {activeTab === 'admin' && isAdmin && authUser ? (
          <AdminView
            lang={lang}
            user={authUser}
            onBack={() => setActiveTab('settings')}
            onResetDemoData={handleResetDemoData}
            onZeroAllBalances={handleZeroAllBalances}
          />
        ) : null}
      </main>

      {/* Unified Transaction Form Component */}
      <TransactionModal
        isOpen={isAddModalOpen}
        initialType={addModalInitialType}
        initialValues={prefilledDraft}
        missingFields={draftMissingFields}
        accounts={accounts}
        categories={categories}
        lang={lang}
        onClose={() => setIsAddModalOpen(false)}
        onSaveTransaction={handleSaveTransaction}
        onAddCategory={handleAddCategory}
      />

      {/* Interactive Opening Balance Modal */}
      <EditBalanceModal
        isOpen={isEditBalanceModalOpen}
        accounts={accounts}
        selectedAccountId={selectedAccountForBalance}
        lang={lang}
        onClose={() => setIsEditBalanceModalOpen(false)}
        onUpdateSingleBalance={handleUpdateSingleBalance}
        onUpdateBulkBalances={handleUpdateBulkBalances}
      />

      {/* Bank Account Management & Plus/Pro Plans Modal */}
      <BankAccountModal
        isOpen={isBankAccountModalOpen}
        account={accounts.find((a) => a.id === selectedBankAccountId) || accounts.find((a) => a.type === 'bank') || null}
        lang={lang}
        onClose={() => setIsBankAccountModalOpen(false)}
        onSave={handleSaveBankAccount}
      />

      {/* Visa / Card Account Management & Plus/Pro Plans Modal */}
      <CardAccountModal
        isOpen={isCardAccountModalOpen}
        account={accounts.find((a) => a.id === selectedCardAccountId) || accounts.find((a) => a.type === 'card') || null}
        lang={lang}
        onClose={() => setIsCardAccountModalOpen(false)}
        onSave={handleSaveCardAccount}
      />

      {/* E-Wallet Account Management & Plus/Pro Plans Modal */}
      <WalletAccountModal
        isOpen={isWalletAccountModalOpen}
        account={accounts.find((a) => a.id === selectedWalletAccountId) || accounts.find((a) => a.type === 'wallet') || null}
        lang={lang}
        onClose={() => setIsWalletAccountModalOpen(false)}
        onSave={handleSaveWalletAccount}
      />

      {/* Other Payment & Receiving Methods Management & Plus/Pro Plans Modal */}
      <OtherAccountModal
        isOpen={isOtherAccountModalOpen}
        account={accounts.find((a) => a.id === selectedOtherAccountId) || accounts.find((a) => a.type === 'other') || null}
        lang={lang}
        onClose={() => setIsOtherAccountModalOpen(false)}
        onSave={handleSaveOtherAccount}
      />

      {/* Extra / Other Accounts Management & Plus/Pro Plans Modal */}
      <ExtraAccountModal
        isOpen={isExtraAccountModalOpen}
        account={accounts.find((a) => a.id === selectedExtraAccountId) || accounts.find((a) => a.type === 'custom') || null}
        lang={lang}
        onClose={() => setIsExtraAccountModalOpen(false)}
        onSave={handleSaveExtraAccount}
      />

      {/* Spending Categories Management Modal */}
      <ExpenseCategoriesModal
        isOpen={isExpenseCategoriesModalOpen}
        categories={categories}
        lang={lang}
        onClose={() => setIsExpenseCategoriesModalOpen(false)}
        onUpdateCategories={handleUpdateCategories}
      />

      {/* Category Transactions & Period Statement Modal */}
      <CategoryDetailModal
        isOpen={isCategoryDetailModalOpen}
        category={selectedCategoryForDetail}
        categories={categories}
        accounts={accounts}
        transactions={transactions}
        lang={lang}
        authUser={authUser}
        onClose={() => {
          setIsCategoryDetailModalOpen(false);
          setSelectedCategoryForDetail(null);
        }}
        onEditTransaction={handleEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onOpenAddTransaction={(prefilledCatId, type) => {
          setAddModalInitialType(type);
          setPrefilledDraft({ categoryId: prefilledCatId, type });
          setIsAddModalOpen(true);
        }}
      />

      {/* Mobile Link & QR Modal */}
      <MobileLinkModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        lang={lang}
        user={authUser}
        onLogin={handleGoogleLogin}
      />

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        lang={lang}
      />
    </div>
  );
}
