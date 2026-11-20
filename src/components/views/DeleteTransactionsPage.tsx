import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import type { FinancialAccount, Language, Transaction, TransactionType } from '../../types';
import { selectTransactionsForDeletion } from '../../utils/transactionDeletion';
import { movementDeltas } from '../../utils/accountLinking';
import { deleteSelectedFinancialTransaction } from '../../lib/firebase';

type Kind = 'all' | TransactionType;
export function DeleteTransactionsPage({ lang, uid, accounts, transactions, ready, onBack }: {
  lang: Language;
  uid: string;
  accounts: FinancialAccount[];
  transactions: Transaction[];
  ready: boolean;
  onBack: () => void;
}) {
  const ar = lang === 'ar';
  const [kind, setKind] = useState<Kind>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [adjust, setAdjust] = useState(false);
  const [review, setReview] = useState<Transaction[] | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState('');
  const selected = useMemo(() => selectTransactionsForDeletion(transactions, kind, from, to), [transactions, kind, from, to]);
  const impacts = useMemo(() => {
    const sums = new Map<string, number>();
    for (const tx of review ?? selected) {
      try {
        for (const [id, amount] of movementDeltas(tx, -1)) sums.set(id, (sums.get(id) ?? 0) + amount);
      } catch {
        sums.set(tx.accountId, sums.get(tx.accountId) ?? 0);
      }
    }
    return [...sums.entries()].map(([id, amount]) => ({ id, amount, account: accounts.find(item => item.id === id) }));
  }, [review, selected, accounts]);
  const Back = ar ? ArrowRight : ArrowLeft;
  const number = (value: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en', { maximumFractionDigits: 2 }).format(value);

  async function remove() {
    if (!review || running) return;
    setRunning(true);
    setResult('');
    let deleted = 0;
    let already = 0;
    try {
      for (const item of review) {
        const outcome = await deleteSelectedFinancialTransaction(uid, item, adjust);
        if (outcome === 'deleted') deleted++;
        else already++;
      }
      setResult(ar ? `تم حذف ${number(deleted)} عملية. ${already ? `كانت ${number(already)} عملية محذوفة بالفعل.` : ''}` : `Deleted ${deleted} transactions. ${already ? `${already} were already deleted.` : ''}`);
      setReview(null);
    } catch {
      setResult(ar
        ? `توقف الحذف بعد حذف ${number(deleted)} عملية. قد تكون العملية التالية تغيّرت أو أن الرصيد لا يسمح بعكسها. راجع العمليات والأرصدة ثم أعد المحاولة للمتبقي.`
        : `Deletion stopped after ${deleted} transactions. The next transaction may have changed or its balance may be insufficient. Review your data and retry the remainder.`);
      setReview(null);
    } finally {
      setRunning(false);
    }
  }

  return <main dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl space-y-4 p-4 pb-24 text-slate-900 dark:text-slate-100">
    <header className="flex items-center gap-3">
      <button disabled={running} onClick={onBack} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700" aria-label={ar ? 'رجوع' : 'Back'}><Back className="size-5" /></button>
      <h1 className="text-xl font-extrabold">{ar ? 'حذف العمليات' : 'Delete transactions'}</h1>
    </header>
    {result && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{result}</p>}
    {!review ? <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <label className="block space-y-2 text-sm font-bold">{ar ? 'نوع العمليات' : 'Transaction type'}
        <select value={kind} onChange={event => setKind(event.target.value as Kind)} className="w-full rounded-xl border border-slate-300 bg-transparent p-3">
          <option value="all">{ar ? 'كل العمليات' : 'All transactions'}</option><option value="income">{ar ? 'الدخل' : 'Income'}</option><option value="expense">{ar ? 'الصرف' : 'Expenses'}</option><option value="transfer">{ar ? 'التحويلات' : 'Transfers'}</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2 text-sm font-bold">{ar ? 'من تاريخ' : 'From'}<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="block w-full rounded-xl border border-slate-300 bg-transparent p-3" /></label>
        <label className="space-y-2 text-sm font-bold">{ar ? 'إلى تاريخ' : 'To'}<input type="date" value={to} onChange={event => setTo(event.target.value)} className="block w-full rounded-xl border border-slate-300 bg-transparent p-3" /></label>
      </div>
      <p className="text-xs text-slate-500">{ar ? 'اترك التاريخين فارغين لاختيار كل الفترات.' : 'Leave both dates empty for all dates.'}</p>
      {from && to && from > to && <p role="alert" className="text-sm text-red-700">{ar ? 'تاريخ البداية يجب أن يسبق تاريخ النهاية.' : 'The start date must be before the end date.'}</p>}
      <fieldset className="space-y-3"><legend className="mb-2 text-sm font-bold">{ar ? 'الأرصدة بعد الحذف' : 'Balances after deletion'}</legend>
        <label className="flex gap-2 text-sm"><input type="radio" name="balance" checked={!adjust} onChange={() => setAdjust(false)} />{ar ? 'الاحتفاظ بالأرصدة الحالية' : 'Keep current balances'}</label>
        <label className="flex gap-2 text-sm"><input type="radio" name="balance" checked={adjust} onChange={() => setAdjust(true)} />{ar ? 'تعديل الأرصدة بإلغاء أثر العمليات' : 'Reverse the effect on balances'}</label>
      </fieldset>
      <p className="text-sm font-bold">{ready ? (ar ? `العمليات المطابقة: ${number(selected.length)}` : `Matching transactions: ${selected.length}`) : (ar ? 'جاري تحميل العمليات...' : 'Loading transactions…')}</p>
      <button disabled={!ready || !selected.length || Boolean(from && to && from > to)} onClick={() => { setResult(''); setReview([...selected]); }} className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-40">{ar ? 'معاينة الحذف' : 'Review deletion'}</button>
    </section> : <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="font-extrabold">{ar ? 'راجع اختيارك' : 'Review your selection'}</h2>
      <p className="text-sm">{ar ? `سيتم حذف ${number(review.length)} عملية.` : `${review.length} transactions will be deleted.`}</p>
      <p className="text-sm font-bold">{adjust ? (ar ? 'سيتم تعديل الأرصدة بإلغاء أثر كل عملية.' : 'Balances will be adjusted to reverse each transaction.') : (ar ? 'ستبقى الأرصدة الحالية كما هي.' : 'Current balances will be kept.')}</p>
      <h3 className="text-sm font-bold">{ar ? 'الحسابات المتأثرة' : 'Affected accounts'}</h3>
      <ul className="space-y-2">{impacts.map(({ id, amount, account }) => <li key={id} className="flex justify-between gap-3 text-sm"><span>{account ? (ar ? account.nameAr : account.name) : id}</span><span dir="ltr">{adjust ? `${amount > 0 ? '+' : ''}${number(amount)} ${account?.currency ?? ''}` : '—'}</span></li>)}</ul>
      {adjust && <p className="text-xs text-slate-500">{ar ? 'التغيير المعروض إجمالي تقديري. قد يتوقف الحذف إذا لم يسمح رصيد حساب بعكس إحدى العمليات.' : 'The displayed change is an estimate. Deletion may stop if an account balance prevents reversing a transaction.'}</p>}
      <button disabled={running} onClick={() => void remove()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 font-bold text-white disabled:opacity-50"><Trash2 className="size-4" />{running ? (ar ? 'جاري الحذف...' : 'Deleting…') : (ar ? 'تأكيد حذف العمليات' : 'Confirm deletion')}</button>
      <button disabled={running} onClick={() => setReview(null)} className="min-h-11 w-full rounded-xl border border-slate-300 font-bold disabled:opacity-50">{ar ? 'رجوع للاختيار' : 'Back to selection'}</button>
    </section>}
  </main>;
}
