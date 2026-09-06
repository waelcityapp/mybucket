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
import { MobileLinkModal } from './components/MobileLinkModal';
import { BottomNav } from './components/BottomNav';
import { TransactionsView } from './components/views/TransactionsView';
import { AccountsView } from './components/views/AccountsView';
import { CategoriesView } from './components/views/CategoriesView';
import { SettingsView } from './components/views/SettingsView';
import { CheckCircle2, Smartphone, Cloud, ArrowRight } from 'lucide-react';
import { AIFinancialQuery, AICorrection } from './services/ai/types';
import {
  executeDeterministicQuery,
  DeterministicQueryResult,
} from './services/ai/deterministicQueryEngine';
import { FinancialQueryResultCard } from './components/FinancialQueryResultCard';
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
} from './lib/firebase';

const STORAGE_KEY_PREFIX = 'mybucket_';

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

  // 3. Financial Accounts State
  const [accounts, setAccounts] = useState<FinancialAccount[]>(() => {
    if (!isZeroInitDone) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}zero_initialized_v2`, 'true');
      return INITIAL_ACCOUNTS;
    }
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}accounts`);
    if (saved) {
      try {
        return JSON.parse(saved);
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
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  // 6. User Auth State (Google Authentication)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  // 7. Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialType, setAddModalInitialType] = useState<TransactionType>('expense');
  const [prefilledDraft, setPrefilledDraft] = useState<Partial<Transaction> | null>(null);
  const [draftMissingFields, setDraftMissingFields] = useState<string[]>([]);
  const [activeFinancialQueryResult, setActiveFinancialQueryResult] = useState<DeterministicQueryResult | null>(null);
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [selectedAccountForBalance, setSelectedAccountForBalance] = useState<string | null>(null);
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
    });

    return () => unsubscribe();
  }, []);

  // Real-time Cloud Synchronization with Firestore when user is authenticated
  useEffect(() => {
    if (!authUser) return;

    // 1. Subscribe to User's Accounts
    const unsubAccounts = subscribeUserAccounts(authUser.uid, (cloudAccounts) => {
      if (cloudAccounts && cloudAccounts.length > 0) {
        setAccounts(cloudAccounts);
      } else {
        // If user has no accounts in cloud yet, seed with current local accounts
        saveAllAccountsToFirestore(authUser.uid, accounts);
      }
    });

    // 2. Subscribe to User's Transactions
    const unsubTransactions = subscribeUserTransactions(authUser.uid, (cloudTx) => {
      if (cloudTx) {
        setTransactions(cloudTx);
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

    return () => {
      unsubAccounts();
      unsubTransactions();
      unsubCategories();
    };
  }, [authUser?.uid]);

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

  // Open Edit Balance Modal
  const handleOpenEditBalance = (accId: string | null = null) => {
    setSelectedAccountForBalance(accId);
    setIsEditBalanceModalOpen(true);
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

  // Dynamic greeting based on current time
  const currentHour = new Date().getHours();
  const greetingText = currentHour < 12 ? t.morningGreeting : t.eveningGreeting;

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

            {/* 1. Soft Greeting Section Matching Reference */}
            <div className="pt-1 pb-1 px-1">
              <div className="flex items-center justify-between">
                <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  {greetingText}
                </h1>
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
            <QuickActions lang={lang} onOpenAddModal={handleOpenAddModal} />

            {/* 4. "حساباتك" - Money Sources / Accounts Grid */}
            <MoneySources
              accounts={accounts}
              lang={lang}
              onViewAll={() => setActiveTab('accounts')}
              onAddAccountClick={() => setActiveTab('accounts')}
              onSelectAccount={() => setActiveTab('transactions')}
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

        {activeTab === 'categories' && (
          <CategoriesView
            categories={categories}
            transactions={transactions}
            lang={lang}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            lang={lang}
            onSetLanguage={(newLang) => setLang(newLang)}
            onResetDemoData={handleResetDemoData}
            onZeroAllBalances={handleZeroAllBalances}
            user={authUser}
            onLogin={handleGoogleLogin}
            onLogout={handleGoogleLogout}
            onOpenMobileLink={() => setIsMobileModalOpen(true)}
          />
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
