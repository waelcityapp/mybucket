import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, RefreshCw, Search, ShieldBan, ShieldCheck, Trash2, Users, UserRoundCheck } from 'lucide-react';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';

type AppUser = {
  uid: string;
  name: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  lastSeenAt: string | null;
  online: boolean | null;
  onlineDevices: string[];
  lastSeenDevice: string;
  disabled: boolean;
  tier: 'paid' | 'trial' | 'free' | 'unknown';
  plan: string;
  grant?: { plan: 'basic' | 'pro'; startsAt: string; endsAt: string } | null;
  installed: boolean;
};
type UserSummary = {
  registeredCount: number;
  registeredCountComplete: boolean;
  installsWithSignedInAccounts: number;
  displayedCount: number;
  note: string;
  users: AppUser[];
  nextCursor: string | null;
};
async function requestAdmin(action: string, payload: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('authentication_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result?.ok) throw new Error(result?.error || result?.message || 'request_failed');
  return result.data;
}

function accountPlan(record: AppUser, ar: boolean) {
  if (record.tier === 'paid') {
    const unknown = record.plan.startsWith('Paid —');
    return ar ? 'مدفوع · ' + (unknown ? 'الخطة غير مسجلة' : record.plan) : 'Paid · ' + (unknown ? 'Plan not recorded' : record.plan);
  }
  if (record.tier === 'trial') return ar ? 'فترة تجريبية · ' + record.plan : record.plan;
  if (record.tier === 'free') return ar ? 'انتهت الفترة المجانية' : 'Introductory period ended';
  return ar ? 'لا توجد بيانات اشتراك' : 'Subscription not recorded';
}
function niceDate(input: string | null, ar: boolean) {
  if (!input) return '—';
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? input : new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' }).format(date);
}
function niceCairoDateTime(input: string | null, ar: boolean) {
  if (!input) return ar ? 'لم يُسجّل بعد' : 'Not recorded yet';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return ar ? 'غير متاح' : 'Unavailable';
  return new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', {
    timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}
function deviceLabel(device: string, ar: boolean) {
  return device === 'mobile' ? (ar ? 'موبايل' : 'Mobile') : device === 'computer' ? (ar ? 'كمبيوتر' : 'Computer') : (ar ? 'جهاز غير محدد' : 'Unknown device');
}

export function AdminAppUsersView({ lang, onOpenGrant }: { lang: Language; onOpenGrant: (uid: string) => void }) {
  const ar = lang === 'ar';
  const [data, setData] = useState<UserSummary | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [workingUid, setWorkingUid] = useState<string | null>(null);
  const [confirmUid, setConfirmUid] = useState<string | null>(null);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const [typedEmail, setTypedEmail] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestVersion = useRef(0);
  const searchAfterListOpened = useRef(false);
  const [filter, setFilter] = useState<'all' | 'paid' | 'trial_pro' | 'trial_basic' | 'free' | 'disabled' | 'installed'>('all');

  const invalidate = () => {
    requestVersion.current++;
    setMatchingCount(null); setShowUsers(false); setLoading(false); setError('');
  };
  const query = { search: search.trim(), filter, period, from, to };
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError(''); setMatchingCount(null); setShowUsers(false);
    let cursor: string | null = null, count = 0;
    let summary: { registeredCount: number; installsWithSignedInAccounts: number } | null = null;
    try {
      do {
        const page = await requestAdmin('admin.users.countFiltered', { search: search.trim(), filter, period, from, to, cursor }) as { count: number; nextCursor: string | null; registeredCount: number | null; installsWithSignedInAccounts: number | null };
        if (version !== requestVersion.current) return;
        if (page.registeredCount !== null) summary = { registeredCount: page.registeredCount, installsWithSignedInAccounts: page.installsWithSignedInAccounts || 0 };
        count += page.count; cursor = page.nextCursor;
      } while (cursor);
      if (version === requestVersion.current) {
        setMatchingCount(count);
        if (summary) setData({ ...summary, registeredCountComplete: false, displayedCount: 0, note: '', users: [], nextCursor: null });
      }
    } catch (err) {
      if (version === requestVersion.current) setError(err instanceof Error && err.message === 'directory_needs_sync'
        ? (ar ? 'اضغط «تجهيز دليل المستخدمين» لتحديث الحسابات.' : 'Prepare the user directory first.')
        : err instanceof Error && err.message === 'invalid_date_range'
          ? (ar ? 'تأكد من صحة تاريخ البداية والنهاية وترتيبهما.' : 'Check the start and end dates.')
          : (ar ? 'تعذر حساب العدد. حاول مرة أخرى.' : 'Could not calculate the count.'));
      console.warn('Admin count failed:', err);
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [ar, search, filter, period, from, to]);

  useEffect(() => { void reload(); }, []); // Initial unfiltered count; later searches run only on request.

  // Search the entire directory after typing pauses. Counting stays optional.
  useEffect(() => {
    if (!searchAfterListOpened.current) return;
    const version = requestVersion.current;
    const timer = window.setTimeout(async () => {
      setLoadingMore(true); setError('');
      try {
        const result = await requestAdmin('admin.users.list', { search: search.trim(), filter, period, from, to }) as UserSummary;
        if (version === requestVersion.current) { setData(result); setShowUsers(true); }
      } catch (err) {
        if (version === requestVersion.current) setError(ar ? 'تعذر البحث عن المستخدمين. حاول مرة أخرى.' : 'Could not search users. Please try again.');
        console.warn('Admin user search failed:', err);
      } finally { if (version === requestVersion.current) setLoadingMore(false); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [search]);

  const showList = async () => {
    const version = requestVersion.current;
    setLoadingMore(true); setError('');
    try {
      const result = await requestAdmin('admin.users.list', query) as UserSummary;
      if (version === requestVersion.current) { setData(result); setShowUsers(true); searchAfterListOpened.current = true; }
    } catch (err) {
      if (version === requestVersion.current) setError(ar ? 'تعذر عرض المستخدمين. حاول مرة أخرى.' : 'Could not load users.');
      console.warn('Admin user list failed:', err);
    } finally { setLoadingMore(false); }
  };
  const loadMore = async () => {
    if (!data?.nextCursor || loadingMore) return;
    const version = requestVersion.current;
    setLoadingMore(true); setError('');
    try {
      const page = await requestAdmin('admin.users.list', { ...query, cursor: data.nextCursor }) as UserSummary;
      if (version === requestVersion.current) setData(previous => previous ? { ...page, users: [...previous.users, ...page.users] } : page);
    } catch (err) {
      if (version === requestVersion.current) setError(ar ? 'تعذر تحميل المزيد. اضغط تحديث وحاول مجددًا.' : 'Could not load more. Refresh and try again.');
      console.warn('Load more failed:', err);
    } finally { setLoadingMore(false); }
  };

  const syncDirectory = async () => {
    if (syncing) return;
    setSyncing(true); setSyncProgress(0); setNotice(''); setError('');
    let token: string | undefined;
    let examined = 0;
    let verified = 0;
    try {
      do {
        const page = await requestAdmin('admin.directory.backfill', token ? { pageToken: token } : {}) as { examined: number; verified: number; nextPageToken: string | null };
        examined += page.examined;
        verified += page.verified;
        setSyncProgress(examined);
        token = page.nextPageToken || undefined;
      } while (token);
      const result = await requestAdmin('admin.directory.count') as { count: number };
      setNotice(ar
        ? `تمت مراجعة ${examined} حسابًا، وتطابقت بيانات ${verified} منها عند الفحص. عدد سجلات الدليل ${result.count}. قد تتغير الحسابات أثناء الفحص.`
        : `Reviewed ${examined} accounts; ${verified} matched at verification. The directory contains ${result.count} records. Accounts can change during the check.`);
      await reload();
    } catch (err) {
      setError(ar ? `تعذرت إكمال المزامنة بعد مراجعة ${examined} حسابًا. يمكنك إعادة المحاولة؛ الحسابات التي لم تتغير لن تُكتب مجددًا.` : `Synchronization stopped after ${examined} accounts. You can retry; unchanged records will not be rewritten.`);
      console.warn('Directory sync failed:', err);
    } finally { setSyncing(false); }
  };

  const filtered = data?.users || [];

  const changeStatus = async (record: AppUser) => {
    if (workingUid) return;
    setWorkingUid(record.uid); setNotice(''); setError('');
    try {
      await requestAdmin('admin.users.setDisabled', { uid: record.uid, disabled: !record.disabled });
      setConfirmUid(null);
      setNotice(ar ? (record.disabled ? 'تمت إعادة تفعيل الحساب.' : 'تم تعطيل الحساب وإبطال جلسات التحديث.') : (record.disabled ? 'User re-enabled.' : 'User disabled and refresh tokens revoked.'));
      await reload();
    } catch (e) {
      setError(ar ? 'تعذر تغيير حالة الحساب؛ لم يتم تأكيد نجاح العملية. أعد تحميل القائمة للتحقق.' : 'Could not confirm access change. Reload to check the actual state.');
      console.warn('User access change failed:', e);
    } finally { setWorkingUid(null); }
  };

  const deleteAccount = async (record: AppUser) => {
    if (workingUid || typedEmail.trim().toLowerCase() !== record.email.trim().toLowerCase()) return;
    setWorkingUid(record.uid); setError(''); setNotice('');
    try {
      await requestAdmin('admin.users.deleteAuth', { uid: record.uid, confirmEmail: typedEmail.trim() });
      setDeleteUid(null); setTypedEmail('');
      setNotice(ar ? 'تم حذف هوية تسجيل الدخول من Firebase Authentication فقط. لم تُحذف بياناته المالية.' : 'Firebase Authentication identity deleted; financial data was preserved.');
      await reload();
    } catch (e) {
      setError(ar ? 'تعذر تأكيد حذف هوية تسجيل الدخول. أعد تحميل القائمة قبل المحاولة مرة أخرى.' : 'Could not confirm identity deletion. Refresh before retrying.');
      console.warn('User identity removal failed:', e);
    } finally { setWorkingUid(null); }
  };

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <button type="button" onClick={() => { if (auth.currentUser?.uid) onOpenGrant(auth.currentUser.uid); }} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">
        {ar ? 'إدارة منحة حسابي' : 'Manage my grant'}
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><Users className="h-4 w-4 text-emerald-700" />{ar ? 'حسابات مسجلة' : 'Registered accounts'}</div>
          <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{data ? data.registeredCount.toLocaleString('en-US') : '—'}</p>
          <p className="mt-1 text-[10px] text-slate-500">{ar ? 'في دليل الإدارة' : 'In admin directory'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><Download className="h-4 w-4 text-emerald-700" />{ar ? 'مستخدمو النسخة المثبتة' : 'Installed-app users'}</div>
          <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{data ? data.installsWithSignedInAccounts.toLocaleString('en-US') : '—'}</p>
          <p className="mt-1 text-[10px] text-slate-500">{ar ? 'تسجيل يبدأ من هذا الإصدار؛ حساب واحد لكل مستخدم' : 'Tracking starts this version; one per account'}</p>
        </div>
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
        {ar ? 'عدد التثبيتات ليس عدد الأجهزة أو كل من ثبّت التطبيق منذ البداية؛ هو عدد الحسابات التي أبلغت عن تثبيت التطبيق أو استخدمته من الأيقونة بعد تشغيل التتبع. لا نعرض تقديرات كأنها أرقام مؤكدة.' : 'The installed-app figure counts signed-in accounts reporting an installation or a standalone launch since tracking began. It does not count devices or all older installs.'}
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
        <p>{ar ? 'تجهيز دليل مختصر للحسابات الحالية والجديدة، تمهيدًا للبحث في جميع المستخدمين.' : 'Prepare a compact account directory for future search across all users.'}</p>
        <button type="button" onClick={() => void syncDirectory()} disabled={syncing} className="mt-2 rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">
          {syncing ? (ar ? `جارٍ التجهيز: ${syncProgress}` : `Preparing: ${syncProgress}`) : (ar ? 'تجهيز دليل المستخدمين' : 'Prepare user directory')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-black text-slate-900">{ar ? 'قائمة المستخدمين' : 'User directory'}</h3>
        <button type="button" disabled={loading || !!workingUid} onClick={() => void reload()} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">
          <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')}/>{ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-40 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400"/>
          <input type="search" value={search} onChange={e => { searchAfterListOpened.current = true; invalidate(); setLoadingMore(false); setSearch(e.target.value); }} placeholder={ar ? 'بحث بالاسم أو البريد' : 'Search name or email'} className="min-w-0 w-full bg-transparent text-xs outline-none" />
        </div>
        <select aria-label={ar ? 'تاريخ التسجيل' : 'Registration period'} value={period} onChange={e => { invalidate(); setPeriod(e.target.value as typeof period); }} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700">
          <option value="all">{ar ? 'كل التواريخ' : 'All dates'}</option>
          <option value="today">{ar ? 'اليوم' : 'Today'}</option>
          <option value="week">{ar ? 'هذا الأسبوع' : 'This week'}</option>
          <option value="month">{ar ? 'هذا الشهر' : 'This month'}</option>
          <option value="custom">{ar ? 'فترة مخصصة' : 'Custom range'}</option>
        </select>
        <select value={filter} onChange={e => { invalidate(); setFilter(e.target.value as typeof filter); }} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700">
          <option value="all">{ar ? 'الكل' : 'All'}</option>
          <option value="paid">{ar ? 'مسجّل كمدفوع' : 'Recorded as paid'}</option>
          <option value="trial_pro">{ar ? 'فترة Pro التجريبية (حسب المدة)' : 'Pro trial period (by duration)'}</option>
          <option value="trial_basic">{ar ? 'فترة Basic التجريبية (حسب المدة)' : 'Basic trial period (by duration)'}</option>
          <option value="free">{ar ? 'انتهت التجربة' : 'Trial ended'}</option>
          <option value="disabled">{ar ? 'موقوف' : 'Disabled'}</option>
          <option value="installed">{ar ? 'نسخة مثبتة' : 'Installed'}</option>
        </select>
      </div>

      {period === 'custom' && <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700">
        <label>{ar ? 'من' : 'From'} <input aria-label={ar ? 'من تاريخ' : 'From date'} type="date" value={from} onChange={e => { invalidate(); setFrom(e.target.value); }} className="rounded-lg border border-slate-200 bg-white p-2" /></label>
        <label>{ar ? 'إلى' : 'To'} <input aria-label={ar ? 'إلى تاريخ' : 'To date'} type="date" value={to} onChange={e => { invalidate(); setTo(e.target.value); }} className="rounded-lg border border-slate-200 bg-white p-2" /></label>
      </div>}
      <div className="rounded-xl border border-emerald-100 bg-white p-3 text-xs text-slate-700">
        <p>{ar ? 'الفترة حسب تاريخ تسجيل الحساب · بتوقيت القاهرة' : 'Period uses registration date · Cairo time'}</p>
        <p className="mt-2 text-sm font-bold">{ar ? 'عدد الحسابات المطابقة:' : 'Matching accounts:'} {loading ? (ar ? 'جارٍ الحساب...' : 'Calculating...') : matchingCount === null ? '—' : matchingCount.toLocaleString('en-US')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={loading || (period === 'custom' && (!from || !to))} onClick={() => void reload()} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">{ar ? 'احسب العدد' : 'Calculate count'}</button>
          <button type="button" disabled={loading || loadingMore || matchingCount === null || matchingCount === 0} onClick={() => void showList()} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 font-bold text-emerald-800 disabled:opacity-50">{ar ? 'عرض المستخدمين' : 'Show users'}</button>
          <button type="button" onClick={() => { invalidate(); setSearch(''); setFilter('all'); setPeriod('all'); setFrom(''); setTo(''); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold">{ar ? 'مسح الفلاتر' : 'Clear filters'}</button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{ar ? 'فلاتر التجربة تصنّف الحساب حسب مدة التسجيل، ولا تثبت الخطة التي اختارها المستخدم. فلاتر الاشتراك قد تقرأ سجل اشتراك لكل حساب مطابق. «مسجّل كمدفوع» حالة اشتراك وليست إثبات دفع. المنح وتواريخ الدفع غير متاحة حتى تجهيز سجلاتها.' : 'Trial filters classify the account by registration duration, not the plan chosen by the user. Subscription filters may read one record per account. Recorded as paid is not proof of payment. Grants and payment dates are not available yet.'}</p>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</p>}
      {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0"/>{notice}</p>}
      {loading && <p className="rounded-xl bg-white p-5 text-center text-xs text-slate-500">{ar ? 'جارٍ تحميل بيانات المستخدمين الحقيقية...' : 'Loading real user records...'}</p>}
      {!loading && loadingMore && !showUsers && <p role="status" className="rounded-xl bg-white p-5 text-center text-xs text-slate-500">{ar ? 'جارٍ البحث في المستخدمين...' : 'Searching users...'}</p>}
      {!loading && showUsers && data && (
        <>
          <p className="text-[11px] text-slate-500">{ar ? 'المعروض:' : 'Showing:'} {filtered.length} {ar ? '· الأحدث أولًا · توقيت القاهرة' : '· newest first · Cairo time'}</p>
          {filtered.length === 0 && !data.nextCursor && <p className="rounded-xl border border-slate-200 bg-white p-5 text-center text-xs text-slate-500">{ar ? 'لا يوجد مستخدمون يطابقون البحث.' : 'No users match your search.'}</p>}
          {filtered.length === 0 && data.nextCursor && <p className="text-xs text-slate-500">{ar ? 'لا توجد نتيجة في هذه الدفعة؛ اضغط عرض المزيد للمتابعة.' : 'No matches in this batch; load more to continue.'}</p>}
          <div className="space-y-2.5">
            {filtered.map(record => {
              const isOwner = record.email.trim().toLowerCase() === 'waelvts@gmail.com';
              const activeConfirmation = confirmUid === record.uid;
              const activeDelete = deleteUid === record.uid;
              return <article key={record.uid} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="break-words text-sm font-black text-slate-900">{record.name || (ar ? 'بدون اسم' : 'Unnamed user')}</p>
                      {isOwner && <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">{ar ? 'المدير' : 'Owner'}</span>}
                      {record.disabled && <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{ar ? 'موقوف' : 'Disabled'}</span>}
                      <span className={'rounded-lg px-2 py-0.5 text-[10px] font-semibold ' + (record.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>{record.online === null ? (ar ? 'حالة الوجود غير متاحة' : 'Presence unavailable') : record.online ? (ar ? 'نشط الآن' : 'Online now') : (ar ? 'غير متصل' : 'Offline')}</span>
                    </div>
                    <p className="mt-0.5 break-all text-xs text-slate-600" dir="ltr">{record.email || '—'}</p>
                    {record.online && <p className="mt-1 text-[11px] font-medium text-emerald-700">{ar ? 'الأجهزة المتصلة: ' : 'Connected devices: '}{(record.onlineDevices || []).map(device => deviceLabel(device, ar)).join(ar ? ' و' : ' and ')}</p>}
                    {(!record.grant || record.tier === 'paid') && <p className="mt-1 text-xs font-semibold text-slate-700">{accountPlan(record, ar)}</p>}
                    {record.grant && <p className="mt-1 text-xs font-bold text-emerald-800">{ar ? 'منحة مجانية' : 'Free grant'} · {record.grant.plan === 'pro' ? 'Pro' : 'Basic'} · {ar ? 'حتى' : 'through'} {new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo', dateStyle: 'medium' }).format(new Date(Date.parse(record.grant.endsAt) - 1))}</p>}
                    <p className="mt-1 text-[11px] text-slate-500">{ar ? 'إنشاء:' : 'Created:'} {niceDate(record.createdAt, ar)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{ar ? 'آخر ظهور:' : 'Last seen:'} {niceCairoDateTime(record.lastSeenAt, ar)} {record.online === false && record.lastSeenAt && <> · {deviceLabel(record.lastSeenDevice, ar)}</>} {ar ? '(توقيت القاهرة)' : '(Cairo time)'}</p>
                    {record.installed && <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5"/>{ar ? 'تم رصد نسخة مثبتة' : 'Installed-app usage reported'}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <button type="button" disabled={!!workingUid} onClick={() => onOpenGrant(record.uid)} className="rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">{ar ? 'المنحة' : 'Grant'}</button>
                    {!isOwner && <>
                    <button type="button" disabled={!!workingUid} onClick={() => { setDeleteUid(null); setConfirmUid(activeConfirmation ? null : record.uid); }} className={'flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold disabled:opacity-50 ' + (record.disabled ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
                      {record.disabled ? <UserRoundCheck className="h-3.5 w-3.5"/> : <ShieldBan className="h-3.5 w-3.5"/>}
                      {record.disabled ? (ar ? 'تفعيل' : 'Enable') : (ar ? 'إيقاف' : 'Suspend')}
                    </button>
                    {record.disabled && <button type="button" disabled={!!workingUid} onClick={() => { setConfirmUid(null); setDeleteUid(activeDelete ? null : record.uid); setTypedEmail(''); }} className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>{ar ? 'حذف الهوية' : 'Delete identity'}</button>}
                    </>}
                  </div>
                </div>
                {activeConfirmation && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <p>{record.disabled ? (ar ? 'إعادة التفعيل تسمح للمستخدم بتسجيل الدخول من جديد.' : 'Enabling lets the user sign in again.') : (ar ? 'سيتم إيقاف الحساب ومنع تسجيل الدخول الجديد. قد تستمر جلسة مفتوحة مؤقتًا حتى انتهاء صلاحية رمز الدخول.' : 'New sign-ins will be blocked. Existing client sessions may remain briefly until their current ID token expires.')}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={!!workingUid} onClick={() => void changeStatus(record)} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-50">{ar ? 'تأكيد' : 'Confirm'}</button>
                    <button type="button" disabled={!!workingUid} onClick={() => setConfirmUid(null)} className="rounded-lg bg-white px-3 py-2 font-bold text-slate-700">{ar ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                </div>}
                {activeDelete && <div className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-950">
                  <p className="font-bold">{ar ? 'إجراء نهائي: حذف هوية Firebase Authentication. لن تُحذف البيانات المالية من Firestore، ولن نستطيع استرجاع هوية الدخول بعد حذفها. تأكد أنك لا تحتاج إلى إعادة تفعيل هذا الحساب.' : 'Permanent: removes this Firebase Authentication identity only. Firestore financial documents remain. The login identity cannot be restored.'}</p>
                  <p>{ar ? 'للتأكيد اكتب البريد الإلكتروني للمستخدم حرفيًا:' : 'Type the exact user email to confirm:'}</p>
                  <input type="email" value={typedEmail} onChange={e => setTypedEmail(e.target.value)} placeholder={record.email} dir="ltr" className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm outline-none"/>
                  <div className="flex gap-2">
                    <button type="button" disabled={!!workingUid || typedEmail.trim().toLowerCase() !== record.email.trim().toLowerCase()} onClick={() => void deleteAccount(record)} className="rounded-lg bg-rose-700 px-3 py-2 font-bold text-white disabled:opacity-40">{ar ? 'حذف هوية الدخول نهائيًا' : 'Delete login identity'}</button>
                    <button type="button" disabled={!!workingUid} onClick={() => { setDeleteUid(null);setTypedEmail(''); }} className="rounded-lg bg-white px-3 py-2 font-bold text-slate-700">{ar ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                </div>}
              </article>;
            })}
          </div>
          {data.nextCursor && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">{loadingMore ? (ar ? 'جارٍ التحميل...' : 'Loading...') : (ar ? 'عرض المزيد' : 'Load more')}</button>}
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700"/>
            {ar ? 'تُحدّث حالة الوجود عند فتح الصفحة أو الضغط على تحديث، وقد يتأخر رصد انقطاع الاتصال. نوع الجهاز تقريبي. البيانات للإدارة فقط، ولا تعرض أرصدة المستخدمين أو معاملاتهم.' : 'Presence updates on opening this page or pressing Refresh; disconnect detection may be delayed. Device type is approximate. Financial balances and transactions are not shown.'}
          </div>
        </>
      )}
    </div>
  );
}
