import { ReminderHomeCards } from './components/ReminderHomeCards';
import { ReminderAlerts } from './components/ReminderAlerts';
import { ReminderWorkspace } from './components/views/ReminderWorkspace';
import { LockScreen, lockRequest, type LockStatus } from './components/AppLock';
import { TrialSubscriptionPages } from './components/views/TrialSubscriptionPages';
import { currencyName, SUPPORTED_CURRENCIES } from './types';
import { ArrowLeftRight, ArrowUpDown, BadgePercent, RefreshCw } from 'lucide-react';
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
import { OffersPage } from './components/views/OffersPage';
import { CreateOfferPage } from './components/views/CreateOfferPage';
import { translations } from './data/translations';
import { Header } from './components/Header';
import { VoiceNaturalInput } from './components/VoiceNaturalInput';
import type { AnalyzerFeedbackContext } from './services/ai/analyzerFeedbackClient';
import { APP_REVISION } from './config/appRevision';
import { activeGrant } from './config/grantPolicy';
import { closePresenceBeforeSignOut, startPresence } from './services/presenceClient';
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
import { CheckCircle2, Smartphone, Cloud, ArrowRight, Sparkles, Clock, BookOpen, Tag } from 'lucide-react';
import { AIFinancialQuery, AICorrection } from './services/ai/types';
import {
  executeDeterministicQuery,
  DeterministicQueryResult,
} from './services/ai/deterministicQueryEngine';
import { FinancialQueryResultCard } from './components/FinancialQueryResultCard';
import { HomeFinancialOverview } from './components/HomeFinancialOverview';
import { AdminView, type SectionId } from './components/views/AdminView';
import { AdminUserGrantView } from './components/views/AdminUserGrantView';
import { AdminPinView } from './components/views/AdminPinView';
import { AnalyzerFeedbackAdmin } from './components/views/AnalyzerFeedbackAdmin';
import { AuthPage } from './components/views/AuthPage';
import { InitialSetupView } from './components/views/InitialSetupView';
import { UsageGuideView } from './components/views/UsageGuideView';
import { UserSubscription, UserDailyUsage } from './types/prototypeSubscription';
import { stageFor, getTrialDurations, setTrialDurations } from './config/subscriptionPolicy';
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
  setFinancialWriteBlocked,
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
  deleteUnusedAccountFromFirestore,
  saveAllCategoriesToFirestore,
  saveLearnedMemoryToFirestore,
  subscribeLearnedMemory,
  updateUserNameInFirebase,
} from './lib/firebase';
import { aiLearnedMemory } from './services/ai/aiLearnedMemory';
import { isNonNegativeBalance } from './utils/formatBalance';
import { recordTabNavigation, tabFromHistory } from './utils/navigationHistory';
import { validateBalance } from './utils/accountLinking';

import { saveUserSubscriptionToFirestore, subscribeUserSubscription, type SubscriptionReadIssue } from './services/prototypeSubscriptionClient';

const STORAGE_KEY_PREFIX = 'mybucket_';


type FxRateInfo = { from: string; to: string; rate: number | null; remaining: number; limit: number; rateDate: string; stale: boolean; availableCurrencies?: string[] };
async function callCurrencyRates(action: 'fx.get' | 'fx.select', payload: Record<string, string> = {}): Promise<FxRateInfo> {
  const user = auth.currentUser;
  if (!user) throw new Error('login_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result?.ok || !result?.data) throw new Error(result?.error || 'rate_unavailable');
  return result.data as FxRateInfo;
}
async function readPublicReferenceRate(): Promise<{ rate: number; date: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rate/EGP/USD', { signal: controller.signal });
    if (!response.ok) throw new Error('reference_provider_http_' + response.status);
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') throw new Error('reference_provider_format');
    const record = data as { base?: string; quote?: string; rate?: number; date?: string };
    if (record.base !== 'EGP' || record.quote !== 'USD' || typeof record.rate !== 'number' || !Number.isFinite(record.rate) || record.rate <= 0) {
      throw new Error('reference_provider_invalid_rate');
    }
    return { rate: record.rate, date: typeof record.date === 'string' ? record.date : '' };
  } finally { clearTimeout(timeout); }
}
function ExchangeRatesMini({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [info, setInfo] = useState<FxRateInfo | null>(null);
  const [reference, setReference] = useState<{ rate: number; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    callCurrencyRates('fx.get').then(value => {
      if (alive) { setInfo(value); setReference(null); setError(''); }
    }).catch(async failure => {
      const code = failure instanceof Error ? failure.message : 'unknown_error';
      const serverIssue = ['firebase_admin_not_configured', 'firebase_project_mismatch', 'firebase_database_mismatch', 'gateway_operation_failed'].includes(code);
      try {
        const publicQuote = await readPublicReferenceRate();
        if (alive) {
          setReference(publicQuote);
          setError((serverIssue
            ? (ar ? 'اتصال الخادم يحتاج إصلاحًا؛ تغيير العملات متوقف مؤقتًا' : 'Server connection needs repair; pair selection paused')
            : (ar ? 'سعر مباشر مؤقت؛ تغيير العملات متوقف لحين اتصال الخادم' : 'Direct reference rate; pair selection paused until server reconnects')) + ' (' + code + ')');
        }
      } catch {
        if (alive) setError(serverIssue
          ? (ar ? 'تعذر الاتصال بخادم الأسعار' : 'Rate server unavailable')
          : (ar ? 'السعر غير متاح الآن' : 'Rate unavailable') + ' (' + code + ')');
      }
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [retry, ar]);
  // Keep the same server-backed currency selection and daily quota in the compact card.
  const changePair = async (from: string, to: string) => {
    if (!info || busy || info.remaining <= 0 || (info.from === from && info.to === to)) return;
    setBusy(true);
    try {
      const updated = await callCurrencyRates('fx.select', { from, to });
      setInfo(updated);
      setError('');
    } catch (e) {
      const limited = e instanceof Error && e.message === 'exchange_daily_limit';
      setError(limited ? (ar ? 'انتهى حد تغييرات اليوم' : 'Daily changes used up') : (ar ? 'تعذر تغيير العملة' : 'Could not change currency'));
    } finally { setBusy(false); }
  };
  const effectiveRate = info?.rate ?? reference?.rate;
  const rate = effectiveRate == null ? '—' : new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6, useGrouping: false }).format(effectiveRate);
  const selectedFrom = info?.from || 'EGP';
  const selectedTo = info?.to || 'USD';
  const canChange = !!info && !busy && info.remaining > 0;
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-emerald-700/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-2.5 py-3 text-white shadow-sm sm:px-4" aria-label={ar ? 'أسعار العملات التقريبية' : 'Approximate currency rates'}>
      <div className="mb-2 flex items-center justify-center gap-1 text-[12px] font-black text-emerald-50 sm:text-sm">
        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
        <span>{ar ? 'أسعار العملات' : 'Exchange rates'}</span>
      </div>
      <div className="flex flex-col gap-1">
        {(['from', 'to'] as const).map(side => (
          <select key={side} value={side === 'from' ? selectedFrom : selectedTo}
            onChange={event => void changePair(side === 'from' ? event.target.value : selectedFrom, side === 'to' ? event.target.value : selectedTo)}
            aria-label={side === 'from' ? (ar ? 'اختر العملة الأولى' : 'Choose first currency') : (ar ? 'اختر العملة الثانية' : 'Choose second currency')}
            disabled={!canChange}
            className="h-8 min-w-0 w-full rounded-lg border border-emerald-400/50 bg-emerald-950 px-1.5 text-[11px] font-bold text-white outline-none focus:border-emerald-200 focus:ring-1 focus:ring-emerald-200 disabled:opacity-70">
            {SUPPORTED_CURRENCIES.filter(code => !info?.availableCurrencies || info.availableCurrencies.includes(code) || info[side] === code)
              .map(code => <option key={code} value={code}>{code} · {currencyName(code, lang)}</option>)}
          </select>
        ))}
      </div>
      <button type="button" disabled={!canChange || selectedFrom === selectedTo}
        onClick={() => void changePair(selectedTo, selectedFrom)}
        title={ar ? 'تبديل العملتين (يُحتسب من تغييرات اليوم)' : 'Swap currencies (counts as one daily change)'}
        aria-label={ar ? 'تبديل العملة الأولى والثانية' : 'Swap first and second currencies'}
        className="mx-auto -my-1.5 z-10 flex h-7 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400 bg-emerald-700 text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
        <ArrowUpDown className="h-4 w-4" />
      </button>
      <strong dir="ltr" className="mt-2 block min-w-0 break-words rounded-xl bg-emerald-700/65 px-1.5 py-2 text-center text-[12px] font-black leading-snug tracking-tight text-white tabular-nums sm:text-base">
        {info ? '1 ' + selectedFrom + ' = ' + rate + ' ' + selectedTo : reference ? '1 EGP = ' + rate + ' USD' : busy ? '...' : '—'}
      </strong>
      <span className="mt-1.5 text-center text-[9px] leading-snug text-emerald-100">
        {ar ? 'سعر تقريبي غير ملزم' : 'Approximate rate'}
        {(info?.rateDate || reference?.date) ? ' · ' + (info?.rateDate || reference?.date) : ''}
      </span>
      {info && <span className="mt-1 text-center text-[9px] font-semibold text-emerald-100">{ar ? 'تغييرات متبقية' : 'Changes left'}: {info.remaining}/{info.limit}</span>}
      {info?.stale && <span className="text-center text-[9px] text-amber-200">{ar ? 'آخر سعر محفوظ' : 'Cached rate'}</span>}
      {error && <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-1 flex items-center justify-center gap-1 break-words text-center text-[9px] leading-tight text-rose-100"><RefreshCw className="h-3 w-3 shrink-0"/>{error}</button>}
    </section>
  );
}

export default function App() {
  // 1. Language State (Arabic is default)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}lang`);
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });

  // 2. Active Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => window.location.pathname.startsWith('/admin') ? 'admin-pin' : window.location.pathname === '/trial' ? 'trial-details' : window.location.pathname === '/subscription' ? 'subscription' : window.location.pathname.startsWith('/reminders/') ? 'reminders' : (window.location.pathname === '/accounts/new' || window.location.pathname === '/accounts') ? 'accounts' : window.location.pathname === '/guide' ? 'guide' : (window.location.pathname === '/offers' || window.location.pathname.startsWith('/offers/category/')) ? 'offers' : 'home');
  // Keep in-app tab changes in browser history so the device Back button can restore them.
  const [transactionQuickFilter, setTransactionQuickFilter] = useState<{ period: 'today' | 'month'; currency: string } | null>(null);
  const navigateTab = (tab: ActiveTab, quickFilter: { period: 'today' | 'month'; currency: string } | null = null) => {
    if (tab === 'transactions') setTransactionQuickFilter(quickFilter);
    if (recordTabNavigation(window.history, window.location, activeTab, tab)) setActiveTab(tab);
  };
  const openGuide = () => { window.history.pushState({ guide: true }, '', '/guide'); setActiveTab('guide'); };
  const openOffers = () => { if (window.location.pathname !== '/offers') window.history.pushState({ offers: true }, '', '/offers'); setActiveTab('offers'); };
  const openAccountSettings = () => { window.history.pushState({ accounts: true }, '', '/accounts'); setActiveTab('accounts'); };
  const openSubscriptionPage = (page: 'trial-details' | 'subscription') => {
    window.history.pushState({ subscriptionPage: page }, '', page === 'trial-details' ? '/trial' : '/subscription');
    setActiveTab(page);
  };
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

    // Keep only accounts that actually exist in Firestore. Deleted legacy accounts stay deleted.

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

  const [appLockStatus, setAppLockStatus] = useState<LockStatus | null>(null);
  const [appLockUnlocked, setAppLockUnlocked] = useState(false);
  const appLockLastActivity = useRef(Date.now());
  const appLockBackgrounded = useRef(false);
  useEffect(() => {
    let active = true;
    setAppLockStatus(null);
    setAppLockUnlocked(false);
    if (!authUser?.uid) return;
    lockRequest('status').then((status: LockStatus) => {
      if (active && auth.currentUser?.uid === authUser.uid) {
        setAppLockStatus(status);
        setAppLockUnlocked(!status.enabled);
      }
    }).catch(() => { if (active) { setAppLockStatus({ enabled: false, inactivityMinutes: 1 }); setAppLockUnlocked(true); } });
    return () => { active = false; };
  }, [authUser?.uid]);
  useEffect(() => {
    if (!authUser || !appLockStatus?.enabled || !appLockUnlocked) return;
    const onActivity = () => { appLockLastActivity.current = Date.now(); };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') appLockBackgrounded.current = true;
      else if (appLockBackgrounded.current) {
        appLockBackgrounded.current = false;
        setAppLockUnlocked(false);
      }
    };
    const checkIdle = () => {
      if (Date.now() - appLockLastActivity.current >= appLockStatus.inactivityMinutes * 60_000) setAppLockUnlocked(false);
    };
    appLockLastActivity.current = Date.now();
    for (const event of ['pointerdown','keydown','touchstart','scroll']) window.addEventListener(event, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(checkIdle, 1000);
    return () => {
      for (const event of ['pointerdown','keydown','touchstart','scroll']) window.removeEventListener(event, onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [authUser?.uid, appLockStatus?.enabled, appLockStatus?.inactivityMinutes, appLockUnlocked]);

  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<SubscriptionReadIssue | null>(null);
  const [subscriptionRetry, setSubscriptionRetry] = useState(0);
  const [trialSettingsReady, setTrialSettingsReady] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<UserDailyUsage>({
    date: new Date().toISOString().slice(0, 10),
    expenseAiCount: 0,
    inquiryAiCount: 0,
  });

  const isAdmin = authUser?.email?.trim().toLowerCase() === 'waelvts@gmail.com';
  // This PIN is a temporary UI gate, not a server-side security boundary.
  const [adminPinVerified, setAdminPinVerified] = useState(false);
  const [adminRoute, setAdminRoute] = useState(() => window.location.pathname);
  const openAdminPin = () => {
    if (!isAdmin) return;
    if (adminPinVerified) { navigateTab('admin'); return; }
    window.history.pushState({ myBucketTab: 'admin-pin' }, '', '/admin/unlock');
    setAdminRoute('/admin/unlock');
    setActiveTab('admin-pin');
  };
  const verifyAdminPin = (pin: string) => {
    if (!isAdmin || pin !== '2233') return false;
    setAdminPinVerified(true);
    const currentPath = window.location.pathname;
    const safeTarget = /^\/admin\/(users|subscriptions|marketers|ads|ai|system)$/.test(currentPath) || /^\/admin\/users\/[A-Za-z0-9_-]{1,128}\/grant$/.test(currentPath) ? currentPath : '/admin';
    window.history.replaceState({ myBucketTab: 'admin' }, '', safeTarget);
    setAdminRoute(safeTarget);
    setActiveTab('admin');
    return true;
  };
  // Keep the browser and mobile Back controls aligned with full-page admin routes.
  useEffect(() => {
    const onPopState = () => {
      const next = tabFromHistory(window.location, window.history.state);
      setAdminRoute(window.location.pathname);
      setActiveTab(next === 'admin' && !adminPinVerified ? 'admin-pin' : next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [adminPinVerified]);

  const adminSectionFromPath = (): SectionId | null => {
    const section = adminRoute.match(/^\/admin\/(users|subscriptions|marketers|ads|ai|system)(?:\/new)?$/)?.[1];
    return section ? section as SectionId : null;
  };
  const openAdminSection = (section: SectionId) => {
    if (!isAdmin || !adminPinVerified) return;
    if (section === 'reports') { openFeedbackAdmin(); return; }
    window.history.pushState({ myBucketTab: 'admin' }, '', `/admin/${section}`);
    setAdminRoute(`/admin/${section}`);
    setActiveTab('admin');
  };
  const backToAdminSections = () => {
    window.history.pushState({ myBucketTab: 'admin' }, '', '/admin');
    setAdminRoute('/admin');
    setActiveTab('admin');
  };
  const openUserGrant = (uid: string) => {
    if (!isAdmin || !adminPinVerified || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return;
    const path = `/admin/users/${uid}/grant`;
    window.history.pushState({ myBucketTab: 'admin' }, '', path);
    setAdminRoute(path); setActiveTab('admin');
  };

  const closeFeedbackAdmin = () => {
    if (window.history.state?.feedbackAdmin) {
      window.history.back();
    } else {
      window.history.replaceState({ myBucketTab:'admin' }, '', '/admin');
      setAdminRoute('/admin');
      setActiveTab('admin');
    }
  };

  const openFeedbackAdmin = () => {
    if (!isAdmin || !adminPinVerified) return;
    if (window.location.pathname !== '/admin/analyzer-feedback') {
      window.history.pushState({ myBucketTab:'admin', feedbackAdmin:true }, '', '/admin/analyzer-feedback');
    }
    setAdminRoute('/admin/analyzer-feedback');
    setActiveTab('admin');
  };

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
  const [analyzerFeedbackContext, setAnalyzerFeedbackContext] = useState<AnalyzerFeedbackContext | null>(null);
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
  const [expiredNoticeOpen, setExpiredNoticeOpen] = useState(false);
  const showExpiredNotice = () => setExpiredNoticeOpen(true);
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
        setTrialSettingsReady(false);
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
        setActiveTab((window.location.pathname === '/offers' || window.location.pathname.startsWith('/offers/category/')) ? 'offers' : firebaseUser && window.location.pathname.startsWith('/admin') ? 'admin-pin': firebaseUser && window.location.pathname === '/guide' ? 'guide' : firebaseUser && window.location.pathname.startsWith('/reminders/') ? 'reminders' : firebaseUser && (window.location.pathname === '/accounts/new' || window.location.pathname === '/accounts') ? 'accounts' : 'home');
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

  // Each visible tab tracks its own connection; disconnects are handled by Firebase.
  useEffect(() => {
    if (!authUser?.uid) return;
    return startPresence(authUser.uid);
  }, [authUser?.uid]);

  // Record installed-PWA usage only once per signed-in account on this device.
  // Never track ordinary page views or send financial data.
  useEffect(() => {
    const pendingKey = 'mybucket:pwa-install-pending';
    const uid = authUser?.uid;
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const report = async () => {
      if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) return;
      const savedKey = 'mybucket:pwa-install-sent:' + uid;
      let pending = false;
      try {
        pending = window.localStorage.getItem(pendingKey) === '1';
        if (window.localStorage.getItem(savedKey) === '1') return;
      } catch { /* storage may be unavailable */ }
      if (!standalone() && !pending) return;
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/gateway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ action: 'app.installSeen', payload: { source: standalone() ? 'standalone' : 'appinstalled' } }),
        });
        const result = await response.json();
        if (!response.ok || !result?.ok) return;
        try {
          window.localStorage.setItem(savedKey, '1');
          window.localStorage.removeItem(pendingKey);
        } catch { /* best effort local de-duplication; server is idempotent */ }
      } catch {
        // Silent best-effort telemetry: never block authentication or financial workflows.
      }
    };
    const onInstalled = () => {
      try { window.localStorage.setItem(pendingKey, '1'); } catch { /* storage may be unavailable */ }
      void report();
    };
    window.addEventListener('appinstalled', onInstalled);
    void report();
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [authUser?.uid]);

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
      } else if (trialSettingsReady) {
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
  }, [authUser?.uid, trialSettingsReady]);

  // One authenticated configuration read on sign-in, and again on focus or admin save.
  // Avoid routing everyday Firestore financial operations through Vercel.
  useEffect(() => {
    if (!authUser) { setTrialSettingsReady(false); return; }
    let live = true;
    const sync = async () => {
      try {
        const user = auth.currentUser;
        if (!user || user.uid !== authUser.uid) return;
        const response = await fetch('/api/gateway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
          body: JSON.stringify({ action: 'subscription.trialSettings' }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok || !json.data) throw new Error(json.message || 'Cannot read trial settings');
        if (!live) return;
        const before = getTrialDurations();
        const changed = before.proDays !== json.data.proDays || before.basicDays !== json.data.basicDays;
        setTrialDurations({ proDays: json.data.proDays, basicDays: json.data.basicDays });
        setTrialSettingsReady(true);
        if (changed) setSubscriptionRetry(n => n + 1);
      } catch (error) {
        if (live) {
          // No fabricated expiry from unverified configuration.
          setTrialSettingsReady(false);
          console.error('Unable to verify Firebase subscription settings', error);
        }
      }
    };
    const onFocus = () => { if (document.visibilityState === 'visible') void sync(); };
    void sync();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('mybucket:trial-settings-changed', sync);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('mybucket:trial-settings-changed', sync);
    };
  }, [authUser?.uid]);

  useEffect(() => {
    setUserSubscription(null);
    setSubscriptionError(null);
    if (!authUser || !trialSettingsReady) return;
    return subscribeUserSubscription(authUser.uid, (subscription) => {
      setUserSubscription(subscription);
      setSubscriptionError(null);
    }, setSubscriptionError);
  }, [authUser?.uid, subscriptionRetry, trialSettingsReady]);

  // Reflect an expired subscription in the current user's financial controls.
  // The database rules are the remaining enforcement boundary (not shipped in this phase).
  const currentTrialExpired = Boolean(trialSettingsReady && userSubscription && stageFor(userSubscription) === 'expired');
  useEffect(() => {
    setFinancialWriteBlocked(currentTrialExpired);
    return () => setFinancialWriteBlocked(false);
  }, [currentTrialExpired, authUser?.uid]);

  useEffect(() => {
    const grant = userSubscription?.grant;
    if (!grant) return;
    const remaining = Date.parse(grant.endsAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(() => setSubscriptionRetry(n => n + 1), Math.min(remaining + 50, 2147483647));
    return () => window.clearTimeout(timer);
  }, [userSubscription?.grant?.endsAt]);

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
    setAdminPinVerified(false);
    try {
      await closePresenceBeforeSignOut();
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
    if (currentTrialExpired) { showExpiredNotice(); return; }
    setAnalyzerFeedbackContext(null);
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
  const handleTransactionDraft = (draft: Partial<Transaction>, missingFields: string[], feedback:AnalyzerFeedbackContext) => {
    if (currentTrialExpired) { showExpiredNotice(); return; }
    setAnalyzerFeedbackContext(feedback);
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
    const isPaid = userSubscription?.isPaid || userSubscription?.tier === 'trial'; // Full Pro trial
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
    if (currentTrialExpired) { showExpiredNotice(); return { ok: false, message: lang === 'ar' ? 'انتهت الفترة المجانية. اختر خطتك للاستمرار.' : 'Your free trial ended. Choose your plan to continue.' }; }
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
        : error instanceof Error && error.message === 'currency-mismatch'
        ? (lang === 'ar' ? 'لا يمكن التحويل بين حسابين بعملتين مختلفتين.' : 'Cannot transfer between accounts with different currencies.')
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

  const handleDeleteAccount = async (accountId: string): Promise<boolean> => {
    if (!authUser || !financialLoaded.accounts || !financialLoaded.transactions || transactionReadError) {
      setToastMessage(lang === 'ar' ? 'تعذر التحقق من حساباتك وعملياتك. أعد المحاولة بعد اكتمال التحميل.' : 'Could not verify accounts and transactions. Retry after loading.');
      return false;
    }
    try {
      await deleteUnusedAccountFromFirestore(authUser.uid, accountId);
      setToastMessage(lang === 'ar' ? 'تم حذف الحساب غير المستخدم بنجاح.' : 'Unused account deleted.');
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      const messages: Record<string, [string, string]> = {
        'has-transactions': ['لا يمكن مسح حساب له عمليات مسجلة. ستظل بياناتك محفوظة.', 'Cannot delete an account with recorded transactions.'],
        'nonzero-balance': ['لا يمكن مسح حساب برصيد غير صفري. راجع الرصيد أولًا.', 'Account balance must be zero before deletion.'],
        'linked-account': ['لا يمكن مسح حساب مرتبط بحساب أو بطاقة أخرى.', 'This account has linked payment methods.'],
        'account-missing': ['الحساب غير موجود بالفعل؛ حدّث الصفحة.', 'Account no longer exists. Refresh the page.'],
        'last-account': ['يجب الاحتفاظ بحساب واحد على الأقل.', 'Keep at least one account.'],
      };
      const message = messages[reason];
      setToastMessage(message ? message[lang === 'ar' ? 0 : 1] : (lang === 'ar' ? 'تعذر مسح الحساب. تحقق من الاتصال ثم حاول مرة أخرى.' : 'Could not delete account. Check connection and retry.'));
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
    if (target?.linkedBankId && target.type === 'card') { handleOpenCardAccountModal(accId); return; }
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

  // Edit card metadata and linking without silently rewriting historical transactions.
  const handleSaveCardAccount = async (accountId: string, newNameAr: string, newBalance: number, linkedBankId: string | null): Promise<boolean> => {
    const current = accounts.find(acc => acc.id === accountId && acc.type === 'card');
    if (!current || !authUser || !financialLoaded.transactions || !financialLoaded.accounts || !newNameAr.trim()) return false;
    const bank = linkedBankId ? accounts.find(acc => acc.id === linkedBankId && acc.type === 'bank') : null;
    if ((linkedBankId && (!bank || bank.currency !== current.currency)) || (!linkedBankId && !isNonNegativeBalance(newBalance))) {
      setToastMessage(lang === 'ar' ? 'تحقق من الرصيد وعملة البنك.' : 'Check the balance and bank currency.');
      return false;
    }
    const changedLink = (current.linkedBankId || null) !== linkedBankId;
    if (changedLink && transactions.some(tx => tx.accountId === accountId || tx.toAccountId === accountId)) {
      setToastMessage(lang === 'ar' ? 'لا يمكن تغيير ارتباط بطاقة لها عمليات سابقة؛ يمكنك تعديل الاسم، مع الاحتفاظ بسجل العمليات والأرصدة.' : 'Cannot change the link for a card with recorded transactions. You can still rename it.');
      return false;
    }
    const updated: FinancialAccount = {
      ...current, name: newNameAr.trim(), nameAr: newNameAr.trim(),
      balance: linkedBankId ? 0 : newBalance,
    };
    if (linkedBankId) updated.linkedBankId = linkedBankId;
    else delete updated.linkedBankId;
    try {
      await saveAccountToFirestore(authUser.uid, updated);
      setAccounts(prev => prev.map(acc => acc.id === accountId ? updated : acc));
      setToastMessage(lang === 'ar' ? 'تم حفظ إعدادات البطاقة.' : 'Card settings saved.');
      return true;
    } catch {
      setToastMessage(lang === 'ar' ? 'تعذر حفظ البطاقة. لم تتغير البيانات.' : 'Could not save the card.');
      return false;
    }
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
  const greetingText = `${greetingPrefix} ${userName} 👋${authUser?.email?.toLowerCase() === 'waelvts@gmail.com' ? ' ' + APP_REVISION : ''}`;

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

  // Keep all signed-in financial screens hidden while checking or enforcing the PIN.
  // Never block access indefinitely when the optional lock service is unavailable.
  // The lock feature is temporarily disabled until its gateway can be verified.
  if (authUser && appLockStatus?.enabled && !appLockUnlocked) {
    return <LockScreen lang={lang} onUnlock={() => { appLockLastActivity.current = Date.now(); setAppLockUnlocked(true); }} />;
  }

  // Advertisement creation is a public draft/review experience; no publishing occurs client-side.
  if (window.location.pathname === '/offers/new') {
    return <CreateOfferPage lang={lang} onBack={() => window.location.assign('/offers')} />;
  }

  // Public offers are browsable without financial account sign-in.
  if (activeTab === 'offers') {
    const categorySlug = window.location.pathname.startsWith('/offers/category/')
      ? decodeURIComponent(window.location.pathname.slice('/offers/category/'.length))
      : null;
    return <OffersPage
      lang={lang}
      categorySlug={categorySlug}
      onAddAd={() => { window.location.assign('/offers/new'); }}
      onOpenCategory={(slug) => {
        window.location.assign(`/offers/category/${encodeURIComponent(slug)}`);
      }}
      onBack={() => {
        if (categorySlug) {
          if (window.history.state?.offerCategory) window.history.back();
          else window.location.assign('/offers');
        } else if (window.history.state?.offers) window.history.back();
        else { window.history.replaceState({}, '', '/'); setActiveTab('home'); }
      }}
    />;
  }

  // 2. Dedicated Full-Page Auth & Registration (No popups / No modals)
  if (!authUser) {
    return (
      <AuthPage
        lang={lang}
        onSuccess={handleAuthGateSuccess}
        onToggleLanguage={handleToggleLanguage}
        onOpenOffers={openOffers}
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
      if (!trialSettingsReady) throw new Error('trial-access-not-ready');
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

  // Reminder management uses real pages and browser history, never modal dialogs.
  if (activeTab === 'reminders' && window.location.pathname.startsWith('/reminders/')) {
    if (window.location.pathname === '/reminders/alerts') return <ReminderAlerts page uid={authUser.uid} lang={lang} onBack={() => window.history.back()} />;
    const reminderKind = window.location.pathname.split('/')[2] === 'receivable' ? 'receivable' : 'obligation';
    return <><ReminderAlerts uid={authUser.uid} lang={lang} onOpen={() => { window.history.pushState({ myBucketTab: 'reminders' }, '', '/reminders/alerts'); setAdminRoute('/reminders/alerts'); }} /><ReminderWorkspace lang={lang} kind={reminderKind} userId={authUser.uid} onHome={() => { window.history.pushState({ myBucketTab: 'home' }, '', '/'); setActiveTab('home'); }} /></>;
  }

  const showBottomNavigation = (
    ['home', 'transactions', 'search', 'categories', 'settings', 'accounts'].includes(activeTab)
    && window.location.pathname !== '/accounts/new'
    && !isAddModalOpen
    && !isEditBalanceModalOpen
    && !isBankAccountModalOpen
    && !isCardAccountModalOpen
    && !isWalletAccountModalOpen
    && !isOtherAccountModalOpen
    && !isExtraAccountModalOpen
    && !isExpenseCategoriesModalOpen
    && !isCategoryDetailModalOpen
    && !isMobileModalOpen
    && !isDealsModalOpen
  );

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white"
    >
      {authUser && <ReminderAlerts uid={authUser.uid} lang={lang} onOpen={() => { window.history.pushState({ myBucketTab: 'reminders' }, '', '/reminders/alerts'); setActiveTab('reminders'); }} />}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {expiredNoticeOpen && <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="expired-access-heading" aria-describedby="expired-access-description" className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white px-5 py-6 shadow-2xl space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Clock className="h-6 w-6" /></div>
          <h2 id="expired-access-heading" className="text-lg font-black text-slate-900">{lang === 'ar' ? 'انتهت الفترة المجانية' : 'Your free period has ended'}</h2>
          <p id="expired-access-description" className="text-sm leading-7 text-slate-700">{lang === 'ar' ? 'اختر خطة للاشتراك قبل تسجيل أي عملية جديدة، سواء يدويًا أو بالكتابة أو بالصوت. جميع عملياتك السابقة وأرصدتك ما زالت محفوظة ويمكنك الاطلاع عليها.' : 'Choose a subscription plan before recording new transactions by hand, text or voice. Your existing records and balances are still safe and visible.'}</p>
          <button type="button" onClick={() => { setExpiredNoticeOpen(false); openSubscriptionPage('subscription'); }} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800">{lang === 'ar' ? 'عرض خطط الاشتراك' : 'View subscription plans'}</button>
          <button type="button" onClick={() => setExpiredNoticeOpen(false)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">{lang === 'ar' ? 'إغلاق' : 'Close'}</button>
        </div>
      </div>}

      {/* Top Header Matching Reference + Google Account / Mobile quick actions */}
      <Header
        lang={lang}
        onToggleLanguage={handleToggleLanguage}
        user={authUser}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
        onOpenMobileLink={() => setIsMobileModalOpen(true)}
        onOpenAdmin={isAdmin ? openAdminPin : undefined}
        onUpdateUserName={handleUpdateUserName}
      />

      {/* Main Content Area - Mobile First proportions matching reference */}
      <main className={`flex-1 max-w-md sm:max-w-xl w-full mx-auto p-4 ${showBottomNavigation ? 'pb-32' : 'pb-8'}`}>
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
                  const phase = userSubscription ? stageFor(userSubscription) : null;
                  const grant = phase !== 'paid' ? activeGrant(userSubscription?.grant) : null;
                  const trialStart = userSubscription ? Date.parse(userSubscription.trialStartedAt) : NaN;
                  const proRemaining = Number.isFinite(trialStart)
                    ? Math.max(0, Math.ceil((trialStart + getTrialDurations().proDays * 86400000 - Date.now()) / 86400000))
                    : null;
                  const basicRemaining = userSubscription ? calculateRemainingTrialDays(userSubscription) : null;
                  const isExpired = phase === 'expired';
                  const registeredAt = Number.isFinite(trialStart)
                    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(trialStart))
                    : null;
                  const remaining = grant ? Math.max(0, Math.ceil((Date.parse(grant.endsAt) - Date.now()) / 86400000)) : phase === 'pro-trial' ? proRemaining : phase === 'basic-free' ? basicRemaining : null;
                  const paidExpiresAt = userSubscription?.paidExpiresAt ? Date.parse(userSubscription.paidExpiresAt) : NaN;
                  const renewalRemaining = phase === 'paid' && Number.isFinite(paidExpiresAt)
                    ? Math.max(0, Math.ceil((paidExpiresAt - Date.now()) / 86400000))
                    : null;
                  const isUrgent = remaining !== null && remaining <= 3;
                  const plan = phase === 'pro-trial' || phase === 'paid' ? 'Pro' : 'Basic';
                  const heading = subscriptionError
                    ? (lang === 'ar' ? 'تعذر قراءة الاشتراك' : 'Subscription unavailable')
                    : !registeredAt
                    ? (lang === 'ar' ? 'تاريخ التسجيل غير متاح' : 'Registration date unavailable')
                    : isExpired
                    ? (lang === 'ar' ? 'انتهت الفترة المجانية' : 'Free trial ended')
                    : (lang === 'ar' ? `أنت الآن على خطة ${plan}` : `You are on the ${plan} plan`);
                  const detail = subscriptionError
                    ? (lang === 'ar' ? 'اضغط لإعادة المحاولة' : 'Tap to retry')
                    : !registeredAt
                    ? (lang === 'ar' ? 'راجع تفاصيل اشتراكك' : 'Review subscription details')
                    : grant
                    ? (lang === 'ar' ? `منحة مجانية · المتبقي ${remaining} يوم` : `Free grant · ${remaining} days remaining`)
                    : phase === 'paid'
                    ? renewalRemaining === null
                      ? (lang === 'ar' ? 'اشتراك مدفوع نشط' : 'Active paid subscription')
                      : (lang === 'ar' ? `التجديد خلال: ${renewalRemaining} ${renewalRemaining === 1 ? 'يوم' : 'أيام'}` : `Renewal in: ${renewalRemaining} ${renewalRemaining === 1 ? 'day' : 'days'}`)

                    : isExpired
                    ? (lang === 'ar' ? 'اختر خطتك' : 'Choose your plan')
                    : (lang === 'ar' ? `الأيام المجانية المتبقية: ${remaining} ${remaining === 1 ? 'يوم' : 'أيام'}` : `${remaining} ${remaining === 1 ? 'free day' : 'free days'} remaining`);
                  const registeredLabel = registeredAt
                    ? (lang === 'ar' ? `تاريخ تسجيلك: ${registeredAt}` : `Registered: ${registeredAt}`)
                    : null;
                  return <button
                    type="button"
                    onClick={() => subscriptionError ? setSubscriptionRetry(n => n + 1) : openSubscriptionPage('subscription')}
                    title={lang === 'ar' ? 'عرض الخطط ومدة التجربة' : 'View plans and trial details'}
                    aria-label={`${heading}، ${detail}`}
                    className={`min-w-0 shrink-0 max-w-[61%] sm:max-w-[52%] rounded-xl border px-3 py-2 text-start transition-colors flex items-center gap-2 ${subscriptionError || isUrgent || isExpired ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'}`}>
                    <Clock className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex flex-col leading-tight gap-0.5">
                      <span className="text-[11px] sm:text-xs font-extrabold break-words">{heading}</span>
                      <span className="text-[10px] sm:text-[11px] font-semibold opacity-80">{detail}</span>
                      {registeredLabel && <span className="text-[10px] sm:text-[11px] font-medium opacity-75">{registeredLabel}</span>}
                    </span>
                  </button>;
                })()}
              </div>
              {currentTrialExpired && <div role="status" className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-900 flex items-center justify-between gap-2"><span>{lang === 'ar' ? 'انتهت الفترة المجانية: يمكنك مشاهدة بياناتك، لكن تسجيل العمليات متوقف.' : 'Your free period ended: records remain visible; new transactions are disabled.'}</span><button type="button" onClick={() => openSubscriptionPage('subscription')} className="shrink-0 underline">{lang === 'ar' ? 'اختر خطتك' : 'Choose plan'}</button></div>}
              {subscriptionError && (
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1 break-words">
                  <p>{lang === 'ar' ? subscriptionError.messageAr : subscriptionError.messageEn}</p>
                  {isAdmin && <div className="text-[11px] text-amber-800 font-mono" dir="ltr">
                    <p>{subscriptionError.readErrors?.join(' • ') || `${subscriptionError.source}: ${subscriptionError.code}`}</p>
                    {subscriptionError.fields && <p>Fields: {subscriptionError.fields.join(', ') || '(empty)'}</p>}
                  </div>}
                </div>
              )}
            </section>
            {/* Four independent home shortcuts: plans/guide above, savings/rates below. */}
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5">
              <button type="button" onClick={() => openSubscriptionPage('subscription')}
                className="flex min-w-0 min-h-[54px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-2 py-2.5 text-center text-[11px] font-extrabold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-50 sm:text-sm">
                <Tag className="h-4 w-4 shrink-0 text-emerald-700 sm:h-5 sm:w-5" />
                <span>{lang === 'ar' ? 'الاشتراكات' : 'Plans'}</span>
              </button>
              <button type="button" onClick={openGuide}
                className="flex min-w-0 min-h-[54px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-2 py-2.5 text-center text-[11px] font-extrabold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-50 sm:text-sm">
                <BookOpen className="h-4 w-4 shrink-0 text-emerald-700 sm:h-5 sm:w-5" />
                <span>{lang === 'ar' ? 'دليل الاستخدام' : 'User guide'}</span>
              </button>
              <button type="button" onClick={openOffers}
                className="flex min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white px-2 py-4 text-center font-extrabold text-emerald-950 shadow-sm transition-colors hover:from-emerald-100 hover:to-emerald-50">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 sm:h-14 sm:w-14">
                  <BadgePercent className="h-7 w-7 sm:h-8 sm:w-8" />
                </span>
                <span className="text-sm leading-snug sm:text-base">{lang === 'ar' ? 'وفّر مع My Bucket' : 'Save with My Bucket'}</span>
                <span className="text-[10px] font-semibold text-emerald-700 sm:text-xs">{lang === 'ar' ? 'العروض والخصومات' : 'Offers & discounts'}</span>
              </button>
              <ExchangeRatesMini lang={lang} />
            </div>

            {/* 2. Top Clear Financial Summary: Net Balance + Today/Month expenses */}
            <HomeFinancialOverview
              accounts={accounts}
              transactions={transactions}
              lang={lang}
              onViewTransactions={(period, currency) => navigateTab('transactions', { period, currency })}
              onViewAccounts={() => navigateTab('accounts')}
              userId={authUser?.uid}
            />

            {/* 3. THE PRIMARY INTERACTION: "اكتب أو قل لي أي عملية..." Large Card */}
            <VoiceNaturalInput
              lang={lang}
              accounts={accounts}
              categories={categories}
              userDailyUsage={dailyUsage}
              userSubscription={userSubscription}
              subscriptionExpired={currentTrialExpired}
              onExpiredAttempt={showExpiredNotice}
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
              onOpenSearchModal={() => navigateTab('search')}
            />

            {/* 4. "حساباتك" - Money Sources / Accounts Grid */}
            <MoneySources
              accounts={accounts}
              lang={lang}
              onViewAll={() => navigateTab('accounts')}
              onAddAccountClick={() => navigateTab('accounts')}
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
                  navigateTab('transactions');
                }
              }}
              onEditBalance={handleOpenEditBalance}
            />

            {/* Separate obligation and receivable reminders; no changes to financial ledger. */}
            {authUser && <ReminderHomeCards lang={lang} onOpen={kind => { window.history.pushState({ myBucketTab: 'reminders' }, '', '/reminders/' + kind); setActiveTab('reminders'); }} />}

            {/* 5. "أحدث العمليات" - Recent Transactions List */}
            <RecentTransactions
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              lang={lang}
              onViewAll={() => navigateTab('transactions')}
              onDeleteTransaction={handleDeleteTransaction}
            />

            {/* 6. Sponsored Promo Banner & Exclusive Deals Bar */}
            <PromoBanner
              banner={promoBanner}
              lang={lang}
            />
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            initialFilter={transactionQuickFilter}
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
            onDeleteAccount={handleDeleteAccount}
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
          <TrialSubscriptionPages lang={lang} subscription={userSubscription} error={subscriptionError ? (lang === 'ar' ? subscriptionError.messageAr : subscriptionError.messageEn) : null} page={activeTab} onBack={() => { window.history.pushState({}, '', activeTab === 'subscription' ? '/trial' : '/'); setActiveTab(activeTab === 'subscription' ? 'trial-details' : 'home'); }} onSubscription={() => openSubscriptionPage('subscription')} onUpdateSubscription={async updated => { const saved = await saveUserSubscriptionToFirestore(authUser.uid, updated); setUserSubscription(saved); }} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            lang={lang}
            appLockStatus={appLockStatus}
            onAppLockChange={(next) => { setAppLockStatus(next); setAppLockUnlocked(true); }}

            onSetLanguage={(newLang) => setLang(newLang)}
            onZeroAllBalances={handleZeroAllBalances}
            user={authUser}
            subscription={userSubscription}
            subscriptionUnavailable={!!subscriptionError}
            onRetrySubscription={() => setSubscriptionRetry(n => n + 1)}
            onUpdateSubscription={async (updatedSub) => {
              if (authUser) {
                const saved = await saveUserSubscriptionToFirestore(authUser.uid, updatedSub);
                setUserSubscription(saved);
              }
            }}
            onLogin={handleGoogleLogin}
            onLogout={handleGoogleLogout}
            onOpenMobileLink={() => setIsMobileModalOpen(true)}
          />
        )}
        {activeTab === 'admin-pin' && isAdmin && authUser && (
          <AdminPinView lang={lang} onBack={() => navigateTab('home')} onVerify={verifyAdminPin} />
        )}
        {activeTab === 'admin' && isAdmin && adminPinVerified && authUser && (
          adminRoute === '/admin/analyzer-feedback'
            ? <AnalyzerFeedbackAdmin lang={lang} onBack={closeFeedbackAdmin} />
            : /^\/admin\/users\/[A-Za-z0-9_-]{1,128}\/grant$/.test(adminRoute)
            ? <AdminUserGrantView uid={adminRoute.split('/')[3]} lang={lang} onBack={() => openAdminSection('users')} />
            : <AdminView lang={lang} user={authUser} onBack={() => navigateTab('home')} onResetDemoData={handleResetDemoData} onZeroAllBalances={handleZeroAllBalances} onOpenFeedbackAdmin={openFeedbackAdmin} sectionId={adminSectionFromPath()} onOpenSection={openAdminSection} onBackToSections={backToAdminSections} onOpenGrant={openUserGrant} />
        )}
      </main>

      {/* Unified Transaction Form Component */}
      <TransactionModal
        isOpen={isAddModalOpen}
        initialType={addModalInitialType}
        initialValues={prefilledDraft}
        feedbackContext={analyzerFeedbackContext}
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
        banks={accounts.filter(acc => acc.type === 'bank')}
        hasTransactions={transactions.some(tx => tx.accountId === selectedCardAccountId || tx.toAccountId === selectedCardAccountId)}
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

      {/* Always visible while scrolling main pages; hidden in focused workflows. */}
      {showBottomNavigation && (
        <BottomNav
          activeTab={activeTab}
          onChangeTab={navigateTab}
          lang={lang}
        />
      )}
    </div>
  );
}
