import { TrialSubscriptionPages } from './components/views/TrialSubscriptionPages';
import { useState, useEffect, useRef } from 'react';
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
import { INITIAL_PROMO_BANNER, INITIAL_PERK_DEALS } from './data/dealsData';
import { PromoBannerData, PerkDealItem } from './types/deals';
import { PromoBanner } from './components/PromoBanner';
import { DealsModal } from './components/DealsModal';
import { translations } from './data/translations';
import { Header } from './components/Header';
import { VoiceNaturalInput } from './components/VoiceNaturalInput';
import { QuickActions } from './components/QuickActions';
import { MoneySources } from './components/MoneySources';
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
import { SearchView } from './components/views/SearchView';
import { CheckCircle2, Smartphone, Cloud, ArrowRight, Sparkles, Clock, Settings, BookOpen, Tag } from 'lucide-react';
import { AIFinancialQuery, AICorrection } from './services/ai/types';
import {
  executeDeterministicQuery,
  DeterministicQueryResult,
} from './services/ai/deterministicQueryEngine';
import { FinancialQueryResultCard } from './components/FinancialQueryResultCard';
import { HomeFinancialOverview } from './components/HomeFinancialOverview';
import { AdminView } from './components/views/AdminView';
import { AuthPage } from './components/views/AuthPage';
import { InitialSetupView } from './components/views/InitialSetupView';
import { UsageGuideView } from './components/views/UsageGuideView';
import { UserSubscription, UserDailyUsage } from './types/prototypeSubscription';
import {
  createInitialSubscription,
  applyAffiliateCodeToExistingSubscription,
  calculateRemainingTrialDays,
  getTodayUsage,
  incrementExpenseAiUsage,
  incrementInquiryAiUsage,
} from './utils/subscriptionUtils';
import {
  loginWithGoogle,
  logoutUser,
  onAuthChange,
  testFirestoreConnection,
  auth,
  createFinancialTransaction,
  InsufficientBalanceError,
  initializeDefaultDocuments,
  subscribeUserAccounts,
  subscribeUserTransactions,
  subscribeUserCategories,
  saveAccountToFirestore,
  saveAllAccountsToFirestore,
  zeroAccountBalances,
  updateFinancialTransaction,
  deleteTransactionFromFirestore,
  saveAllCategoriesToFirestore,
  saveLearnedMemoryToFirestore,
  subscribeLearnedMemory,
  updateUserNameInFirebase,
} from './lib/firebase';
import { aiLearnedMemory } from './services/ai/aiLearnedMemory';
import { isNonNegativeBalance } from './utils/formatBalance';
import { validateBalance } from './utils/accountLinking';

import { saveUserSubscriptionToFirestore, subscribeUserSubscription, type SubscriptionReadIssue } from './services/prototypeSubscriptionClient';

const STORAGE_KEY_PREFIX = 'mybucket_';

export default function App() {
  // 1. Language State (Arabic is default)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}lang`);
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });

  // 2. Active Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => window.location.pathname === '/trial' ? 'trial-details' : window.location.pathname === '/subscription' ? 'subscription' : (window.location.pathname === '/accounts/new' || window.location.pathname === '/accounts') ? 'accounts' : window.location.pathname === '/guide' ? 'guide' : 'home');
  const openGuide = () => { window.history.pushState({ guide: true }, '', '/guide'); setActiveTab('guide'); };
  const openAccountSettings = () => { window.history.pushState({ accounts: true }, '', '/accounts'); setActiveTab('accounts'); };
  const openSubscriptionPage = (page: 'trial-details' | 'subscription') => {
    window.history.pushState({ subscriptionPage: page }, '', page === 'trial-details' ? '/trial' : '/subscription');
    setActiveTab(page);
  };
  useEffect(() => {
    const onPopState = () => setActiveTab(window.location.pathname === '/trial' ? 'trial-details' : window.location.pathname === '/subscription' ? 'subscription' : (window.location.pathname === '/accounts/new' || window.location.pathname === '/accounts') ? 'accounts' : window.location.pathname === '/guide' ? 'guide' : 'home');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Helper to migrate legacy 'acc_savings_usd' / 'مدخرات دولار' to 'acc_wallet' / 'محافظ إلكترونية' and ensure unique account IDs
  const migrateLegacyAccounts = (accs: FinancialAccount[]): { updated: FinancialAccount[]; migrated: boolean } => {
    let migrated = false;
    let mapped = accs.map((acc) => {
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

    // Deduplicate accounts by ID to ensure no duplicate keys occur (e.g. if acc_wallet and acc_savings_usd both existed)
    const seenIds = new Set<string>();
    const deduplicated: FinancialAccount[] = [];
    for (const acc of mapped) {
      if (!seenIds.has(acc.id)) {
        seenIds.add(acc.id);
        deduplicated.push(acc);
      } else {
        migrated = true;
      }
    }

    // Freshly configured accounts do not need old prototype placeholder accounts.
    if (deduplicated.some(account => account.id === 'setup_cash')) return { updated: deduplicated, migrated };

    const hasOther = deduplicated.some((a) => a.id === 'acc_other' || a.type === 'other');
    if (!hasOther) {
      migrated = true;
      deduplicated.push({
        id: 'acc_other',
        name: 'Other Methods',
        nameAr: 'وسائل دفع واستلام أخرى',
        type: 'other' as const,
        balance: 0,
        currency: 'EGP' as const,
        color: '#f59e0b',
      });
    }

    const hasExtra = deduplicated.some((a) => a.id === 'acc_extra' || a.type === 'custom');
    if (!hasExtra) {
      migrated = true;
      deduplicated.push({
        id: 'acc_extra',
        name: 'Other Accounts',
        nameAr: 'حسابات أخرى',
        type: 'custom' as const,
        balance: 0,
        currency: 'EGP' as const,
        color: '#6366f1',
      });
    }

    return { updated: deduplicated, migrated };
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

  // Financial state is loaded from the signed-in user's confirmed cloud data.
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialLoaded, setFinancialLoaded] = useState({ accounts: false, transactions: false });
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);
  const initialSetupAttempt = useRef<{ signature: string; accounts: FinancialAccount[] } | null>(null);
  const [transactionReadError, setTransactionReadError] = useState(false);
  const lastUserId = useRef<string | null>(null);
  const saveInFlight = useRef(false);
  const deleteInFlight = useRef(new Set<string>());
  const pendingTransaction = useRef<{ key: string; tx: Transaction } | null>(null);

  // 6. User Auth State & Subscription
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<SubscriptionReadIssue | null>(null);
  const [subscriptionRetry, setSubscriptionRetry] = useState(0);
  const [dailyUsage, setDailyUsage] = useState<UserDailyUsage>({
    date: new Date().toISOString().slice(0, 10),
    expenseAiCount: 0,
    inquiryAiCount: 0,
  });

  const isAdmin = authUser?.email?.trim().toLowerCase() === 'waelvts@gmail.com';

  // 7. Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(() => window.location.pathname === '/transactions/new');
  useEffect(() => {
    const onNavigation = () => {
      const isReview = window.location.pathname === '/transactions/new';
      setIsAddModalOpen(isReview);
      if (!isReview) setPrefilledDraft(null);
    };
    window.addEventListener('popstate', onNavigation);
    return () => window.removeEventListener('popstate', onNavigation);
  }, []);
  const closeTransactionForm = () => {
    setIsAddModalOpen(false);
    setPrefilledDraft(null);
    if (window.location.pathname === '/transactions/new') {
      if (window.history.state?.transactionReview) window.history.back();
      else window.history.replaceState({}, '', '/');
    }
  };
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
  const [isDealsModalOpen, setIsDealsModalOpen] = useState(false);
  const [promoBanner, setPromoBanner] = useState<PromoBannerData>(INITIAL_PROMO_BANNER);
  const [perkDeals, setPerkDeals] = useState<PerkDealItem[]>(INITIAL_PERK_DEALS);

  // 8. Success Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Sync Language & RTL to document body
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(`${STORAGE_KEY_PREFIX}lang`, lang);
  }, [lang]);

  // Initialize Firebase Auth & Test Firestore Connection
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthChange((firebaseUser) => {
      const nextId = firebaseUser?.uid || null;
      if (lastUserId.current !== nextId) {
        lastUserId.current = nextId;
        pendingTransaction.current = null;
        setAccounts([]);
        setCategories(INITIAL_CATEGORIES);
        setTransactions([]);
        setFinancialLoaded({ accounts: false, transactions: false });
        setNeedsInitialSetup(false);
        initialSetupAttempt.current = null;
        setTransactionReadError(false);
        setUserSubscription(null);
        setPrefilledDraft(null);
        setActiveFinancialQueryResult(null);
        setIsAddModalOpen(Boolean(firebaseUser) && window.location.pathname === '/transactions/new');
        setIsEditBalanceModalOpen(false);
        setIsBankAccountModalOpen(false);
        setIsCardAccountModalOpen(false);
        setIsWalletAccountModalOpen(false);
        setIsOtherAccountModalOpen(false);
        setIsExtraAccountModalOpen(false);
        setIsExpenseCategoriesModalOpen(false);
        setIsCategoryDetailModalOpen(false);
        setSelectedCategoryForDetail(null);
        setActiveTab(firebaseUser && window.location.pathname === '/guide' ? 'guide' : firebaseUser && (window.location.pathname === '/accounts/new' || window.location.pathname === '/accounts') ? 'accounts' : 'home');
        setToastMessage(null);
        aiLearnedMemory.clear();
      }
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
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Cloud Synchronization with Firestore when user is authenticated
  useEffect(() => {
    if (!authUser) return;

    setDailyUsage(getTodayUsage(authUser.uid));

    // 1. Subscribe to User's Accounts
    const unsubAccounts = subscribeUserAccounts(authUser.uid, (cloudAccounts) => {
      if (auth.currentUser?.uid !== authUser.uid) return;
      if (cloudAccounts.length > 0) {
        setAccounts(migrateLegacyAccounts(cloudAccounts).updated);
        setNeedsInitialSetup(false);
      } else {
        setAccounts([]);
        setNeedsInitialSetup(true);
      }
      setFinancialLoaded(prev => ({ ...prev, accounts: true }));
    });

    // 2. Subscribe to User's Transactions
    let transactionReadComplete = false;
    const transactionReadTimer = setTimeout(() => {
      if (!transactionReadComplete && auth.currentUser?.uid === authUser.uid) setTransactionReadError(true);
    }, 12000);
    const unsubTransactions = subscribeUserTransactions(authUser.uid, (cloudTx) => {
      if (auth.currentUser?.uid !== authUser.uid) return;
      transactionReadComplete = true;
      clearTimeout(transactionReadTimer);
      setTransactionReadError(false);
      setTransactions(migrateLegacyTransactions(cloudTx));
      setFinancialLoaded(prev => ({ ...prev, transactions: true }));
    }, () => {
      if (auth.currentUser?.uid !== authUser.uid) return;
      transactionReadComplete = true;
      clearTimeout(transactionReadTimer);
      setTransactionReadError(true);
      setFinancialLoaded(prev => ({ ...prev, transactions: false }));
    });

    // 3. Subscribe to User's Categories
    const unsubCategories = subscribeUserCategories(authUser.uid, (cloudCats) => {
      if (auth.currentUser?.uid !== authUser.uid) return;
      if (cloudCats && cloudCats.length > 0) {
        setCategories(cloudCats);
      } else {
        initializeDefaultDocuments(authUser.uid, 'categories', INITIAL_CATEGORIES).catch(() => setToastMessage(lang === 'ar' ? 'تعذر إعداد التصنيفات.' : 'Could not initialize categories.'));
      }
    });

    // 4. Subscribe to User's Learned AI Memory
    const unsubLearnedMemory = subscribeLearnedMemory(authUser.uid, (cloudMemory) => {
      if (auth.currentUser?.uid !== authUser.uid) return;
      aiLearnedMemory.setMemoryFromRemote(cloudMemory || []);
    });

    return () => {
      unsubAccounts();
      clearTimeout(transactionReadTimer);
      unsubTransactions();
      unsubCategories();
      unsubLearnedMemory();
    };
  }, [authUser?.uid]);

  useEffect(() => {
    setUserSubscription(null);
    setSubscriptionError(null);
    if (!authUser) return;
    return subscribeUserSubscription(authUser.uid, (subscription) => {
      setUserSubscription(subscription);
      setSubscriptionError(null);
    }, setSubscriptionError);
  }, [authUser?.uid, subscriptionRetry]);

  // Google Login Handler
  const handleGoogleLogin = async () => {
    try {
      const user = await loginWithGoogle();
      const t = translations[lang];
      setToastMessage(
        lang === 'ar'
          ? `أهلاً بك، تم تسجيل الدخول بنجاح (${user.displayName || user.email})`
          : `Welcome! Signed in as ${user.displayName || user.email}`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      // User closed popup or cancelled - normal user interaction, do not treat as error
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      if (err?.code === 'auth/popup-blocked') {
        setToastMessage(
          lang === 'ar'
            ? 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة أو فتح التطبيق في تبويب جديد.'
            : 'Popup was blocked by the browser. Please allow popups or open in a new tab.'
        );
      } else {
        console.warn('Google Sign-In notice:', err?.message || err);
        setToastMessage(
          lang === 'ar'
            ? 'تعذر تسجيل الدخول حالياً، يرجى المحاولة لاحقاً'
            : 'Could not sign in right now. Please try again later.'
        );
      }
      setTimeout(() => setToastMessage(null), 4000);
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

  // Usage quota tracking for AI entries & inquiries
  const handleAiEntryUsed = () => {
    const updated = incrementExpenseAiUsage(authUser!.uid);
    setDailyUsage(updated);
  };

  const handleAiQueryUsed = () => {
    const updated = incrementInquiryAiUsage(authUser!.uid);
    setDailyUsage(updated);
  };

  // Handle Natural Language / Voice input parsed draft via Gemini AI
  const handleTransactionDraft = (draft: Partial<Transaction>, missingFields: string[]) => {
    setPrefilledDraft(draft);
    setDraftMissingFields(missingFields || []);
    if (draft.type) setAddModalInitialType(draft.type);
    if (window.location.pathname !== '/transactions/new') window.history.pushState({ transactionReview: true }, '', '/transactions/new');
    setIsAddModalOpen(true);
  };

  // Handle AI Correction (e.g. user says "make it 400" after a draft was generated)
  const handleAICorrection = (correction: AICorrection) => {
    if (correction.fieldToUpdate === 'accountId' || correction.fieldToUpdate === 'toAccountId') {
      setIsAddModalOpen(true);
      setToastMessage(lang === 'ar' ? 'يرجى اختيار الحساب بنفسك من شاشة العملية.' : 'Please select the account in the transaction form.');
      return;
    }
    const targetDraft = prefilledDraft;
    if (targetDraft && correction.fieldToUpdate) {
      let val: any = correction.newValue;
      if (correction.fieldToUpdate === 'amount' && val != null) {
        val = typeof val === 'string' ? parseFloat(val) : val;
        val = val || undefined;
      }
      
      const updatedDraft = { ...targetDraft, [correction.fieldToUpdate]: val };
      setPrefilledDraft(updatedDraft);

      // Adaptive learning from correction
      if (updatedDraft.description) {
        aiLearnedMemory.recordLearning(updatedDraft.description, {
          categoryId: correction.fieldToUpdate === 'categoryId' ? String(val) : updatedDraft.categoryId,
          accountId: correction.fieldToUpdate === 'accountId' ? String(val) : updatedDraft.accountId,
          type: updatedDraft.type,
          description: updatedDraft.description,
        });
        if (authUser) {
          saveLearnedMemoryToFirestore(authUser.uid, aiLearnedMemory.getLearnedList());
        }
      }
      
      setToastMessage(lang === 'ar' ? 'تم تعديل العملية' : 'Transaction updated');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Handle AI Financial Query with Deterministic Math Engine
  const handleFinancialQuery = (query: AIFinancialQuery, questionText: string) => {
    const isPaid = userSubscription?.isPaid;
    // For free/trial users: clamp query history window to max 35 days as per business rule
    const maxDaysHistory = isPaid ? undefined : (userSubscription?.maxHistoricalQueryDays || 35);

    const result = executeDeterministicQuery(
      query,
      questionText,
      transactions,
      accounts,
      categories,
      lang,
      maxDaysHistory
    );
    setActiveFinancialQueryResult(result);
  };

  // Save only after an atomic, server-confirmed transaction and balance update.
  const handleSaveTransaction = async (newTxData: Omit<Transaction, 'id' | 'createdAt'>): Promise<{ ok: boolean; message?: string }> => {
    if (saveInFlight.current) return { ok: false };
    if (!authUser || !financialLoaded.accounts || !financialLoaded.transactions) {
      const message = lang === 'ar' ? 'انتظر تحميل بيانات حسابك وتأكد من الاتصال.' : 'Wait for your account data and check your connection.';
      setToastMessage(message);
      return { ok: false, message };
    }
    saveInFlight.current = true;
    const uid = authUser.uid;
    const key = JSON.stringify({ uid, ...newTxData });
    const newTx: Transaction = pendingTransaction.current?.key === key ? pendingTransaction.current.tx : { ...newTxData, id: `tx_${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
    pendingTransaction.current = { key, tx: newTx };
    try {
      // Firestore rejects undefined fields; omit optional fields not selected by the user.
      const cleanTx = Object.fromEntries(Object.entries(newTx).filter(([, value]) => value !== undefined)) as unknown as Transaction;
      await createFinancialTransaction(uid, cleanTx);
      if (auth.currentUser?.uid !== uid) return { ok: false };
      pendingTransaction.current = null;
      if (newTx.description) {
        const category = categories.find(c => c.id === newTx.categoryId);
        const account = accounts.find(a => a.id === newTx.accountId);
        aiLearnedMemory.recordLearning(newTx.description, { categoryId: newTx.categoryId, categoryNameAr: category?.nameAr, accountId: newTx.accountId, accountNameAr: account?.nameAr, type: newTx.type, description: newTx.description });
        void saveLearnedMemoryToFirestore(uid, aiLearnedMemory.getLearnedList());
      }
      setToastMessage(translations[lang].successSaved);
      setTimeout(() => setToastMessage(null), 3500);
      return { ok: true };
    } catch (error) {
      console.error('Transaction save failed:', error);
      const message = error instanceof InsufficientBalanceError
        ? (lang === 'ar'
          ? `لا يمكن ${newTx.type === 'transfer' ? 'التحويل' : 'تسجيل المصروف'}: رصيد ${error.accountNameAr} هو ${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(error.balance)} ${error.currency} فقط.`
          : `Cannot ${newTx.type === 'transfer' ? 'transfer' : 'record the expense'}: ${error.accountName} has only ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(error.balance)} ${error.currency}.`)
        : error instanceof Error && error.message === 'invalid-transfer'
        ? (lang === 'ar' ? 'لا يمكن التحويل بين وسيلتين مرتبطتين بنفس الحساب.' : 'Cannot transfer between methods linked to the same account.')
        : error instanceof Error && error.message === 'credit-overpayment'
        ? (lang === 'ar' ? 'المبلغ أكبر من المستحق على بطاقة الائتمان.' : 'The amount exceeds the outstanding credit balance.')
        : (lang === 'ar' ? 'تعذر تأكيد الحفظ. راجع قائمة العمليات قبل إعادة المحاولة حتى لا تتكرر.' : 'Could not confirm the transaction was saved. Check your connection and account.');
      if (auth.currentUser?.uid === uid) setToastMessage(message);
      return { ok: false, message };
    } finally {
      saveInFlight.current = false;
    }
  };

  // Reverse and delete as one confirmed server operation; never overwrite other balances.
  const handleDeleteTransaction = async (txId: string) => {
    if (!authUser || deleteInFlight.current.has(txId)) return;
    const uid = authUser.uid;
    deleteInFlight.current.add(txId);
    try {
      const result = await deleteTransactionFromFirestore(uid, txId);
      if (auth.currentUser?.uid !== uid) return;
      setToastMessage(result === 'deleted'
        ? (lang === 'ar' ? 'تم حذف العملية وتحديث الأرصدة بنجاح.' : 'Transaction deleted and balances updated.')
        : (lang === 'ar' ? 'العملية محذوفة بالفعل. راجع قائمة العمليات.' : 'Transaction was already deleted. Check the list.'));
    } catch (error) {
      console.error('Firestore delete transaction error:', error);
      if (auth.currentUser?.uid !== uid) return;
      setToastMessage(error instanceof InsufficientBalanceError
        ? (lang === 'ar'
          ? `لا يمكن حذف العملية: رصيد ${error.accountNameAr} الحالي ${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(error.balance)} ${error.currency} ولا يكفي لعكس العملية.`
          : `Cannot delete: ${error.accountName} has ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(error.balance)} ${error.currency}, which is insufficient to reverse the transaction.`)
        : error instanceof Error && error.message === 'credit-overpayment'
        ? (lang === 'ar' ? 'لا يمكن حذف العملية لأن عكسها سيتجاوز المبلغ المستحق على بطاقة الائتمان.' : 'Cannot delete because reversing it would exceed the credit card amount owed.')
        : (lang === 'ar' ? 'تعذر حذف العملية وتحديث الأرصدة. تحقق من الاتصال والحسابات ثم حاول مجددًا.' : 'Could not delete the transaction and update balances. Check your connection and accounts.'));
    } finally {
      deleteInFlight.current.delete(txId);
    }
  };

  // Save an edit and all affected balances together using current server data.
  const handleEditTransaction = async (expected: Transaction, updated: Transaction): Promise<{ ok: boolean; message?: string }> => {
    if (!authUser) return { ok: false, message: lang === 'ar' ? 'يرجى تسجيل الدخول أولًا.' : 'Please sign in first.' };
    const uid = authUser.uid;
    try {
      await updateFinancialTransaction(uid, expected, updated);
      if (auth.currentUser?.uid !== uid) return { ok: false };
      setToastMessage(lang === 'ar' ? 'تم حفظ التعديل وتحديث الأرصدة.' : 'Transaction and balances updated.');
      setTimeout(() => setToastMessage(null), 3500);
      return { ok: true };
    } catch (error) {
      console.error('Firestore edit transaction error:', error);
      const message = error instanceof InsufficientBalanceError
        ? (lang === 'ar' ? `لا يمكن حفظ التعديل: رصيد ${error.accountNameAr} الحالي ${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(error.balance)} ${error.currency} لا يكفي لإتمامه.` : `Cannot save: ${error.accountName} has insufficient funds.`)
        : error instanceof Error && error.message === 'credit-overpayment'
        ? (lang === 'ar' ? 'المبلغ أكبر من المستحق على بطاقة الائتمان.' : 'The amount exceeds the outstanding credit balance.')
        : error instanceof Error && error.message === 'transaction-changed'
        ? (lang === 'ar' ? 'العملية تغيرت على جهاز آخر. أغلق التعديل وافتحها مجددًا.' : 'This transaction changed elsewhere. Reopen it to edit.')
        : (lang === 'ar' ? 'تعذر حفظ التعديل وتحديث الأرصدة. تحقق من الاتصال والحسابات.' : 'Could not update the transaction and balances. Check your connection and accounts.');
      return { ok: false, message };
    }
  };

  // Add New Account Handler
  const rejectInvalidBalance = () => {
    setToastMessage(lang === 'ar' ? 'لا يمكن حفظ رصيد سالب. أدخل صفرًا أو مبلغًا موجبًا.' : 'A balance cannot be negative. Enter zero or a positive amount.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAddAccount = async (accData: Omit<FinancialAccount, 'id'>): Promise<boolean> => {
    if (!authUser) return false;
    try {
      validateBalance({ ...accData, id: 'new' }, accData.balance);
      if (accData.linkedBankId) {
        const bank = accounts.find(account => account.id === accData.linkedBankId);
        if (!bank || bank.type !== 'bank' || bank.currency !== accData.currency || accData.balance !== 0) throw new Error('invalid-link');
      }
      const newAccount: FinancialAccount = { ...accData, id: `acc_${crypto.randomUUID()}` };
      await saveAccountToFirestore(authUser.uid, newAccount);
      setToastMessage(lang === 'ar' ? 'تم إضافة الحساب بنجاح.' : 'Account added.');
      return true;
    } catch (error) {
      console.error('Firestore save account error:', error);
      setToastMessage(lang === 'ar' ? 'تعذر إضافة الحساب. راجع البيانات والاتصال.' : 'Could not add account. Check details and connection.');
      return false;
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
    if (target?.linkedBankId) { setToastMessage(lang === 'ar' ? 'هذه الوسيلة مرتبطة بالبنك؛ عدّل رصيد البنك نفسه.' : 'Edit the linked bank balance instead.'); return; }
    if (target?.type === 'credit') { setToastMessage(lang === 'ar' ? 'يتم تحديث مستحقات بطاقة الائتمان من العمليات والسداد.' : 'The credit balance changes through transactions and payments.'); return; }
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
    if (!isNonNegativeBalance(newBalance)) { rejectInvalidBalance(); return; }
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
    if (!isNonNegativeBalance(newBalance)) { rejectInvalidBalance(); return; }
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
    if (!isNonNegativeBalance(newBalance)) { rejectInvalidBalance(); return; }
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
    if (!isNonNegativeBalance(newBalance)) { rejectInvalidBalance(); return; }
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
    if (!isNonNegativeBalance(newBalance)) { rejectInvalidBalance(); return; }
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
    if (!isNonNegativeBalance(newBalance)) { rejectInvalidBalance(); return; }
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
    if (Object.values(balancesMap).some(value => !isNonNegativeBalance(value))) { rejectInvalidBalance(); return; }
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

  // Confirm the effect before resetting balances; retain the transaction history.
  const handleZeroAllBalances = async (): Promise<boolean> => {
    if (!authUser) return false;
    const message = lang === 'ar'
      ? 'سيتم تصفير أرصدة جميع الحسابات، بما فيها المبالغ المستحقة على بطاقات الائتمان داخل التطبيق. ستبقى الحسابات والعمليات المسجلة كما هي، وقد يؤثر تعديل أو حذف عملية قديمة على الرصيد بعد التصفير. هل تريد المتابعة؟'
      : 'All account balances, including recorded credit card debt, will be set to zero. Accounts and transaction history remain; editing or deleting an old transaction can change balances afterward. Continue?';
    if (!window.confirm(message)) return false;
    try {
      await zeroAccountBalances(authUser.uid);
      setToastMessage(lang === 'ar' ? 'تم تصفير أرصدة الحسابات. العمليات المسجلة لم تُحذف.' : 'Account balances reset. Transaction history was retained.');
      setTimeout(() => setToastMessage(null), 5000);
      return true;
    } catch (error) {
      console.error('Could not reset account balances:', error);
      setToastMessage(lang === 'ar' ? 'تعذر تصفير الأرصدة. تحقق من الاتصال وحاول مرة أخرى.' : 'Could not reset balances. Check your connection and try again.');
      setTimeout(() => setToastMessage(null), 5000);
      return false;
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
  const greetingText = `${greetingPrefix} ${userName} 👋${authUser?.email?.toLowerCase() === 'waelvts@gmail.com' ? ' #45' : ''}`;

  // The authentication callback passes the signed-in UID directly, avoiding stale React state.
  const handleAuthGateSuccess = async (appliedCode?: string | null, signedInUid?: string) => {
    if (!signedInUid || !appliedCode) return;
    try {
      await saveUserSubscriptionToFirestore(signedInUid, { affiliateCode: appliedCode });
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'تعذر حفظ الكود');
      throw error;
    }
  };

  // 1. Splash / Auth Checking State
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-600">
          {lang === 'ar' ? 'جاري تهيئة MyBucket...' : 'Initializing MyBucket...'}
        </p>
      </div>
    );
  }

  // 2. Dedicated Full-Page Auth & Registration (No popups / No modals)
  if (!authUser) {
    return (
      <AuthPage
        lang={lang}
        onSuccess={handleAuthGateSuccess}
        onToggleLanguage={handleToggleLanguage}
      />
    );
  }

  if (activeTab === 'guide') {
    return <UsageGuideView lang={lang} onBack={() => { if (window.history.state?.guide) window.history.back(); else { window.history.replaceState({}, '', '/'); setActiveTab('home'); } }} />;
  }

  if (isAdmin && new URLSearchParams(window.location.search).get('setup_preview') === '1') {
    return <InitialSetupView lang={lang} preview onClosePreview={() => { window.location.href = '/'; }} onSave={async () => {}} />;
  }

  if (needsInitialSetup && financialLoaded.accounts) {
    return <InitialSetupView lang={lang} onSave={async draft => {
      if (!auth.currentUser || auth.currentUser.uid !== authUser.uid) throw new Error('auth-changed');
      const signature = JSON.stringify(draft);
      if (initialSetupAttempt.current && initialSetupAttempt.current.signature !== signature) {
        throw new Error('check-previous-setup');
      }
      if (!initialSetupAttempt.current) {
        initialSetupAttempt.current = { signature, accounts: draft.map((account, index) => ({ ...account, id: index === 0 ? 'setup_cash' : `acc_${crypto.randomUUID()}` })) };
      }
      await saveAllAccountsToFirestore(authUser.uid, initialSetupAttempt.current.accounts);
    }} />;
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

            {/* Compact home header */}
            <section className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h1 className="min-w-0 text-base sm:text-lg font-black text-slate-800 leading-relaxed">{greetingText}</h1>
                {authUser && (userSubscription || subscriptionError) && (() => {
                  const days = userSubscription ? calculateRemainingTrialDays(userSubscription) : null;
                  const uncertain = Boolean(subscriptionError || userSubscription?.trialDatesStored === false);
                  const urgent = !userSubscription?.isPaid && days !== null && days <= 3;
                  return <button type="button" onClick={() => subscriptionError ? setSubscriptionRetry((n) => n + 1) : openSubscriptionPage('trial-details')}
                    title={lang === 'ar' ? 'تفاصيل التجربة والاشتراك' : 'Trial and subscription details'}
                    className={`shrink-0 max-w-[47%] flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold leading-5 transition-colors ${uncertain || urgent ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{subscriptionError ? (lang === 'ar' ? 'تحقق من التجربة' : 'Check trial')
                      : userSubscription?.trialDatesStored === false ? (lang === 'ar' ? 'بيانات غير مؤكدة' : 'Unconfirmed')
                      : userSubscription?.isPaid ? (lang === 'ar' ? 'اشتراك نشط' : 'Active plan')
                      : days === 0 ? (lang === 'ar' ? 'انتهت التجربة' : 'Trial ended')
                      : (lang === 'ar' ? `متبقي ${days} يوم` : `${days} days left`)}</span>
                  </button>;
                })()}
              </div>
              {subscriptionError && (
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1 break-words">
                  <p>{lang === 'ar' ? subscriptionError.messageAr : subscriptionError.messageEn}</p>
                  {isAdmin && <div className="text-[11px] text-amber-800 font-mono" dir="ltr">
                    <p>{subscriptionError.readErrors?.join(' • ') || `${subscriptionError.source}: ${subscriptionError.code}`}</p>
                    {subscriptionError.fields && <p>Fields: {subscriptionError.fields.join(', ') || '(empty)'}</p>}
                  </div>}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2">
                <button type="button" onClick={openAccountSettings} className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-1 py-2 text-center text-[11px] sm:text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                  <Settings className="h-4 w-4 text-slate-600" /><span>{lang === 'ar' ? 'الإعدادات' : 'Settings'}</span>
                </button>
                <button type="button" onClick={openGuide} className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-1 py-2 text-center text-[11px] sm:text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                  <BookOpen className="h-4 w-4 text-slate-600" /><span>{lang === 'ar' ? 'دليل الاستخدام' : 'User guide'}</span>
                </button>
                <button type="button" onClick={() => openSubscriptionPage('subscription')} className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-1 py-2 text-center text-[11px] sm:text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors">
                  <Tag className="h-4 w-4 text-slate-600" /><span>{lang === 'ar' ? 'الاشتراكات' : 'Plans'}</span>
                </button>
              </div>
            </section>

            {/* 2. Top Clear Financial Summary: Net Balance + Today/Month expenses */}
            <HomeFinancialOverview
              accounts={accounts}
              transactions={transactions}
              lang={lang}
              onViewTransactions={() => setActiveTab('transactions')}
              onViewAccounts={() => setActiveTab('accounts')}
            />

            {/* 3. THE PRIMARY INTERACTION: "اكتب أو قل لي أي عملية..." Large Card */}
            <VoiceNaturalInput
              lang={lang}
              accounts={accounts}
              categories={categories}
              userDailyUsage={dailyUsage}
              userSubscription={userSubscription}
              onTransactionDraft={handleTransactionDraft}
              onFinancialQuery={handleFinancialQuery}
              onAICorrection={handleAICorrection}
              onAiEntryUsed={handleAiEntryUsed}
              onAiQueryUsed={handleAiQueryUsed}
              onOpenManualAdd={() => handleOpenAddModal('expense')}
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

            {/* 5. "أحدث العمليات" - Recent Transactions List */}
            <RecentTransactions
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              lang={lang}
              onViewAll={() => setActiveTab('transactions')}
              onDeleteTransaction={handleDeleteTransaction}
            />

            {/* 6. Sponsored Promo Banner & Exclusive Deals Bar */}
            <PromoBanner
              banner={promoBanner}
              lang={lang}
              onOpenDeals={() => setIsDealsModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            lang={lang}
            loadState={transactionReadError ? 'error' : financialLoaded.transactions ? 'ready' : 'loading'}
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
            onZeroAllBalances={handleZeroAllBalances}
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

        {(activeTab === 'trial-details' || activeTab === 'subscription') && (
          <TrialSubscriptionPages lang={lang} subscription={userSubscription} error={subscriptionError ? (lang === 'ar' ? subscriptionError.messageAr : subscriptionError.messageEn) : null} page={activeTab} onBack={() => { window.history.pushState({}, '', activeTab === 'subscription' ? '/trial' : '/'); setActiveTab(activeTab === 'subscription' ? 'trial-details' : 'home'); }} onSubscription={() => openSubscriptionPage('subscription')} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            lang={lang}
            onSetLanguage={(newLang) => setLang(newLang)}
            onResetDemoData={handleResetDemoData}
            onZeroAllBalances={handleZeroAllBalances}
            user={authUser}
            subscription={userSubscription}
            onUpdateSubscription={async (updatedSub) => {
              if (authUser) {
                const saved = await saveUserSubscriptionToFirestore(authUser.uid, updatedSub);
                setUserSubscription(saved);
              }
            }}
            onLogin={handleGoogleLogin}
            onLogout={handleGoogleLogout}
            isAdmin={isAdmin}
            onOpenAdmin={() => setActiveTab('admin')}
            onOpenMobileLink={() => setIsMobileModalOpen(true)}
          />
        )}
        {activeTab === 'admin' && isAdmin && authUser && (
          <AdminView lang={lang} user={authUser} onBack={() => setActiveTab('settings')} onResetDemoData={handleResetDemoData} onZeroAllBalances={handleZeroAllBalances} />
        )}
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
        onClose={closeTransactionForm}
        onSaveTransaction={handleSaveTransaction}
        onAddCategory={handleAddCategory}
      />

      {/* Interactive Opening Balance Modal */}
      <EditBalanceModal
        isOpen={isEditBalanceModalOpen}
        accounts={accounts.filter(account => !account.linkedBankId && account.type !== 'credit')}
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

      {/* Exclusive Deals & Discounts Modal */}
      <DealsModal
        isOpen={isDealsModalOpen}
        onClose={() => setIsDealsModalOpen(false)}
        deals={perkDeals}
        lang={lang}
      />

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => { if (window.location.pathname === '/trial' || window.location.pathname === '/subscription' || window.location.pathname === '/accounts/new' || window.location.pathname === '/accounts' || window.location.pathname === '/guide') window.history.pushState({}, '', '/'); setActiveTab(tab); }}
        lang={lang}
      />
    </div>
  );
}
