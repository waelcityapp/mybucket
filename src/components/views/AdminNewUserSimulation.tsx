import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Banknote, CircleHelp, PlayCircle, RotateCcw, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import type { FinancialAccount, Language, Transaction } from '../../types';
import { INITIAL_CATEGORIES } from '../../data/initialData';
import { AuthPage } from './AuthPage';
import { InitialSetupView } from './InitialSetupView';
import { HomeFinancialOverview } from '../HomeFinancialOverview';
import { RecentTransactions } from '../RecentTransactions';

type Stage = 'login' | 'setup' | 'dashboard' | 'offers';
type DashboardPage = 'overview' | 'accounts' | 'transactions';
type EntryType = 'income' | 'expense';

const exampleAccounts = (): FinancialAccount[] => [
  { id: 'sim_cash', name: 'Cash', nameAr: 'كاش', type: 'cash', balance: 5000, currency: 'EGP', color: '#10b981' },
  { id: 'sim_bank', name: 'Bank account', nameAr: 'حساب بنكي', type: 'bank', balance: 16000, currency: 'EGP', color: '#3b82f6' },
  { id: 'sim_wallet', name: 'Electronic wallet', nameAr: 'محفظة إلكترونية', type: 'wallet', balance: 4000, currency: 'EGP', color: '#06b6d4' },
];

const exampleTransactions = (): Transaction[] => {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const items: Array<{ id: string; type: EntryType; amount: number; categoryId: string; description: string }> = [
    { id: 'sample_salary', type: 'income', amount: 18000, categoryId: 'cat_salary', description: 'راتب شهري' },
    { id: 'sample_food', type: 'expense', amount: 1500, categoryId: 'cat_food', description: 'مطاعم وكافيهات' },
    { id: 'sample_bills', type: 'expense', amount: 3000, categoryId: 'cat_bills', description: 'فواتير والتزامات' },
    { id: 'sample_groceries', type: 'expense', amount: 3500, categoryId: 'cat_groceries', description: 'مشتريات المنزل' },
    { id: 'sample_transport', type: 'expense', amount: 1500, categoryId: 'cat_transport', description: 'مواصلات' },
  ];
  return items.map((item, index) => ({
    ...item, currency: 'EGP' as const, accountId: 'sim_cash',
    date, time: '12:00', dateTime: date + 'T12:00:00',
    createdAt: new Date(now.getTime() - index * 60000).toISOString(),
  }));
};

interface Props { lang: Language; onExit: () => void; }

export function AdminNewUserSimulation({ lang, onExit }: Props) {
  const ar = lang === 'ar';
  const [stage, setStage] = useState<Stage>('login');
  const [page, setPage] = useState<DashboardPage>('overview');
  const [accounts, setAccounts] = useState<FinancialAccount[]>(exampleAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(exampleTransactions);
  const [sampleMode, setSampleMode] = useState(true);
  const [type, setType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const resetSamples = () => {
    setAccounts(exampleAccounts());
    setTransactions(exampleTransactions());
    setSampleMode(true); setPage('overview'); setError(''); setStage('dashboard');
  };
  const clearSamples = () => {
    setAccounts([{ id: 'sim_cash', name: 'Cash', nameAr: 'كاش', type: 'cash', balance: 0, currency: 'EGP' }]);
    setTransactions([]);
    setSampleMode(false); setPage('overview'); setError('');
  };
  const restart = () => {
    setStage('login'); setPage('overview');
    setAccounts(exampleAccounts()); setTransactions(exampleTransactions());
    setSampleMode(true); setAmount(''); setDescription(''); setError('');
  };
  const addEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    const account = accounts.find(item => item.type === 'cash' && item.currency === 'EGP')
      || accounts.find(item => item.currency === 'EGP' && !item.linkedBankId && item.type !== 'credit');
    if (!account) {
      setError(ar ? 'أضف حسابًا بالجنيه المصري أولًا.' : 'Add an EGP account first.'); return;
    }
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
      setError(ar ? 'أدخل مبلغًا صحيحًا أكبر من صفر.' : 'Enter a valid amount above zero.'); return;
    }
    if (type === 'expense' && account.balance < value) {
      setError(ar ? 'الرصيد التجريبي لا يكفي لهذا المصروف.' : 'Not enough sample balance for this expense.'); return;
    }
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const newTransaction: Transaction = {
      id: 'sim_' + crypto.randomUUID(), type, amount: value, currency: 'EGP',
      accountId: account.id, description: description.trim() || (type === 'income' ? 'دخل تجريبي' : 'مصروف تجريبي'),
      categoryId: type === 'income' ? 'cat_salary' : 'cat_other', date, createdAt: now.toISOString(),
      dateTime: now.toISOString(), time: now.toTimeString().slice(0, 5),
    };
    setAccounts(previous => previous.map(item => item.id === account.id
      ? { ...item, balance: item.balance + (type === 'income' ? value : -value) } : item));
    setTransactions(previous => [newTransaction, ...previous]);
    setAmount(''); setDescription(''); setError('');
  };
  const removeEntry = (id: string) => {
    const transaction = transactions.find(item => item.id === id);
    if (!transaction) return;
    setTransactions(previous => previous.filter(item => item.id !== id));
    setAccounts(previous => previous.map(item => item.id === transaction.accountId
      ? { ...item, balance: item.balance + (transaction.type === 'expense' ? transaction.amount : -transaction.amount) } : item));
  };

  const buttonClass = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50';
  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-3 py-2 shadow-sm">
        <div className="max-w-xl mx-auto flex flex-wrap items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-800 shrink-0" />
          <span className="text-xs font-extrabold text-amber-950 flex-1">{ar ? 'وضع محاكاة المستخدم الجديد — بلا حفظ أو تسجيل حقيقي' : 'New user simulation — no real sign-in or saved data'}</span>
          <button type="button" onClick={restart} className="text-xs font-bold text-amber-800 underline underline-offset-2">{ar ? 'من البداية' : 'Restart'}</button>
          <button type="button" onClick={onExit} className="rounded-lg bg-slate-900 text-white px-2.5 py-1.5 flex items-center gap-1 text-xs font-bold">
            {ar ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            {ar ? 'إنهاء المحاكاة' : 'Exit'}
          </button>
        </div>
      </div>

      {stage === 'login' && (
        <AuthPage lang={lang} simulation onSimulatedSignIn={() => setStage('setup')}
          onSuccess={async () => {}} onOpenOffers={() => setStage('offers')} />
      )}

      {stage === 'offers' && (
        <div className="max-w-xl mx-auto p-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <CircleHelp className="w-7 h-7 text-emerald-600" />
            <h2 className="text-lg font-black">{ar ? 'تصفح العروض قبل التسجيل' : 'Browse offers before sign-in'}</h2>
            <p className="text-sm text-slate-600">{ar ? 'هذا المسار متاح بالفعل للزائر. شاشة العروض الفعلية ليست جزءًا من المحاكاة المعزولة؛ هنا نختبر العودة لصفحة التسجيل.' : 'Public offers are already accessible. Live offers are not part of this isolated simulator; this step tests the return to sign-in.'}</p>
            <button type="button" className={buttonClass} onClick={() => setStage('login')}>{ar ? 'العودة للتسجيل' : 'Back to sign-in'}</button>
          </div>
        </div>
      )}

      {stage === 'setup' && (
        <div className="max-w-xl mx-auto">
          <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
              <PlayCircle className="w-4 h-4" />
              {ar ? 'نجحت محاكاة تسجيل Google دون استخدام حساب جديد' : 'Simulated Google sign-in — no new account created'}
            </div>
            <p className="text-xs text-emerald-950 leading-relaxed">
              {ar ? 'هذه شاشة إعداد الحسابات الموجودة حاليًا. جرّبها، أو افتح التصور المقترح الذي يبدأ ببيانات نموذجية جاهزة.' : 'This is the current account setup screen. Try it, or jump to the proposed ready-made sample dashboard.'}
            </p>
            <button type="button" onClick={resetSamples} className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-3 text-sm font-extrabold">
              {ar ? 'عرض التطبيق ببيانات تجريبية جاهزة' : 'View the app with ready-made sample data'}
            </button>
          </div>
          <InitialSetupView lang={lang} onBack={() => setStage('login')} onCancel={onExit} onSave={async draft => {
            setAccounts(draft.map((account, index) => ({ ...account, id: index === 0 ? 'sim_cash' : 'sim_account_' + index })));
            setTransactions([]); setSampleMode(false); setPage('overview'); setStage('dashboard');
          }} />
        </div>
      )}

      {stage === 'dashboard' && (
        <main className="mx-auto w-full max-w-xl p-4 pb-16 space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-700">My Bucket</p>
              <h1 className="text-xl font-black">{ar ? 'مرحبًا بك في التطبيق 👋' : 'Welcome to My Bucket 👋'}</h1>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-900">
              {ar ? 'تجربة Pro افتراضية' : 'Simulated Pro trial'}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
            <p className="font-extrabold text-sm text-amber-950">{ar ? (sampleMode ? 'هذه مجرد بيانات تجريبية يمكنك تعديلها' : 'أنت تجرب حسابًا افتراضيًا فارغًا') : (sampleMode ? 'These are editable sample records' : 'You are testing an empty sample account')}</p>
            <p className="text-xs text-amber-900 leading-relaxed">{ar ? 'كل التعديلات هنا مؤقتة في ذاكرة الصفحة فقط، ولا تؤثر على حساب الإدارة أو Firebase أو فترة اشتراكك.' : 'All changes stay in this page memory only; nothing affects your admin account, Firebase, or subscription.'}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={resetSamples} className={buttonClass}><RotateCcw className="w-3.5 h-3.5 inline me-1" />{ar ? 'استعادة البيانات النموذجية' : 'Reset sample data'}</button>
              <button type="button" onClick={clearSamples} className={buttonClass}><Trash2 className="w-3.5 h-3.5 inline me-1" />{ar ? 'البدء بحساب فارغ' : 'Start with empty account'}</button>
            </div>
          </div>

          <nav aria-label={ar ? 'أقسام المحاكاة' : 'Simulation sections'} className="flex gap-2 rounded-2xl bg-white border border-slate-200 p-1.5">
            {([
              ['overview', ar ? 'الرئيسية' : 'Home'],
              ['accounts', ar ? 'الحسابات' : 'Accounts'],
              ['transactions', ar ? 'العمليات' : 'Transactions'],
            ] as const).map(([key, title]) => (
              <button type="button" key={key} onClick={() => setPage(key)}
                aria-current={page === key ? 'page' : undefined}
                className={`flex-1 rounded-xl px-2 py-2 text-xs font-extrabold ${page === key ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{title}</button>
            ))}
          </nav>

          {page === 'overview' && (
            <>
              <HomeFinancialOverview accounts={accounts} transactions={transactions} lang={lang} simulation userId="simulator"
                onViewAccounts={() => setPage('accounts')} onViewTransactions={() => setPage('transactions')} />
              <RecentTransactions accounts={accounts} transactions={transactions} categories={INITIAL_CATEGORIES} lang={lang}
                onViewAll={() => setPage('transactions')} onDeleteTransaction={removeEntry} />
            </>
          )}

          {page === 'accounts' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-700" /><h2 className="font-extrabold">{ar ? 'الأرصدة التجريبية' : 'Sample account balances'}</h2></div>
              <p className="text-xs text-slate-500">{ar ? 'عدّل الأرصدة وشاهد تأثيرها في ملخص الوضع المالي.' : 'Edit balances and see the financial overview update.'}</p>
              {accounts.map(account => (
                <label key={account.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  <span className="text-xs font-bold flex-1">{ar ? account.nameAr : account.name}</span>
                  <input type="number" min="0" step="any" aria-label={ar ? `رصيد ${account.nameAr}` : `${account.name} balance`}
                    className="w-32 max-w-[55%] rounded-lg border border-slate-300 p-2 text-sm" value={account.balance}
                    onChange={e => { const value = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000) setAccounts(prev => prev.map(item => item.id === account.id ? { ...item, balance: value } : item)); }} />
                  <span className="text-[10px] text-slate-500">{account.currency}</span>
                </label>
              ))}
            </section>
          )}

          {page === 'transactions' && (
            <RecentTransactions accounts={accounts} transactions={transactions} categories={INITIAL_CATEGORIES} lang={lang} onDeleteTransaction={removeEntry} />
          )}

          <form onSubmit={addEntry} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-700" /><h2 className="font-extrabold text-sm">{ar ? 'جرّب تسجيل عملية تجريبية' : 'Try adding a sample transaction'}</h2></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold text-slate-700">{ar ? 'نوع العملية' : 'Type'}
                <select className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={type} onChange={event => setType(event.target.value as EntryType)}>
                  <option value="expense">{ar ? 'مصروف' : 'Expense'}</option>
                  <option value="income">{ar ? 'دخل' : 'Income'}</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-700">{ar ? 'المبلغ بالجنيه' : 'Amount (EGP)'}
                <input required type="number" min="0.01" max="1000000000" step="any" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2" />
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-700">{ar ? 'الوصف' : 'Description'}
              <input value={description} onChange={event => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2" placeholder={ar ? 'مثال: وجبة غداء' : 'e.g. Lunch'} />
            </label>
            {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
            <button type="submit" className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-extrabold text-white hover:bg-emerald-800">{ar ? 'أضف العملية التجريبية' : 'Add sample transaction'}</button>
          </form>
          <p className="text-center text-xs text-slate-500">{ar ? 'المحاكاة لا تنشئ مستخدمًا ولا تستهلك Gemini أو Firestore.' : 'The simulator creates no user and uses no Gemini or Firestore writes.'}</p>
        </main>
      )}
    </div>
  );
}
