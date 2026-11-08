import { useCallback, useEffect, useMemo, useState } from 'react';
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
  installed: boolean;
};
type UserSummary = {
  registeredCount: number;
  registeredCountComplete: boolean;
  installsWithSignedInAccounts: number;
  displayedCount: number;
  note: string;
  users: AppUser[];
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

export function AdminAppUsersView({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [data, setData] = useState<UserSummary | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingUid, setWorkingUid] = useState<string | null>(null);
  const [confirmUid, setConfirmUid] = useState<string | null>(null);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const [typedEmail, setTypedEmail] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'trial' | 'free' | 'disabled' | 'installed'>('all');

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await requestAdmin('admin.users.list') as UserSummary;
      setData(result);
    } catch (err) {
      setError(ar ? 'تعذر قراءة المستخدمين من الخادم. تأكد من إعداد Firebase Admin وصلاحيات الإدارة.' : 'Could not load users from the server. Check Firebase Admin setup and admin permissions.');
      console.warn('Admin user list failed:', err);
    } finally {
      setLoading(false);
    }
  }, [ar]);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = useMemo(() => (data?.users || []).filter(user => {
    const matching = (user.name + ' ' + user.email + ' ' + user.uid).toLowerCase().includes(search.trim().toLowerCase());
    if (!matching) return false;
    if (filter === 'all') return true;
    if (filter === 'disabled') return user.disabled;
    if (filter === 'installed') return user.installed;
    return user.tier === filter;
  }), [data, filter, search]);

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
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><Users className="h-4 w-4 text-emerald-700" />{ar ? 'حسابات مسجلة' : 'Registered accounts'}</div>
          <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{data ? data.registeredCount.toLocaleString('en-US') + (data.registeredCountComplete ? '' : '+') : '—'}</p>
          <p className="mt-1 text-[10px] text-slate-500">{ar ? 'من Firebase Authentication' : 'From Firebase Authentication'}</p>
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

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-black text-slate-900">{ar ? 'قائمة المستخدمين' : 'User directory'}</h3>
        <button type="button" disabled={loading || !!workingUid} onClick={() => void reload()} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">
          <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')}/>{ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-40 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400"/>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? 'بحث بالاسم أو البريد' : 'Search name or email'} className="min-w-0 w-full bg-transparent text-xs outline-none" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700">
          <option value="all">{ar ? 'الكل' : 'All'}</option>
          <option value="paid">{ar ? 'مدفوع' : 'Paid'}</option>
          <option value="trial">{ar ? 'تجربة برو' : 'Pro trial'}</option>
          <option value="free">{ar ? 'مجاني' : 'Free'}</option>
          <option value="disabled">{ar ? 'موقوف' : 'Disabled'}</option>
          <option value="installed">{ar ? 'نسخة مثبتة' : 'Installed'}</option>
        </select>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</p>}
      {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0"/>{notice}</p>}
      {loading && <p className="rounded-xl bg-white p-5 text-center text-xs text-slate-500">{ar ? 'جارٍ تحميل بيانات المستخدمين الحقيقية...' : 'Loading real user records...'}</p>}
      {!loading && data && (
        <>
          <p className="text-[11px] text-slate-500">{ar ? 'المعروض:' : 'Showing:'} {filtered.length} / {data.displayedCount}{data.registeredCount > data.displayedCount ? (ar ? ' (أحدث 200 مستخدم كحد أقصى؛ البحث في المعروض فقط)' : ' (up to 200 recent users; search covers this list only)') : ''}</p>
          {filtered.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-5 text-center text-xs text-slate-500">{ar ? 'لا يوجد مستخدمون يطابقون البحث.' : 'No users match your search.'}</p>}
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
                      {record.online && <span className="text-[10px] text-slate-600">{(record.onlineDevices || []).map(device => deviceLabel(device, ar)).join(ar ? ' و' : ' and ')}</span>}
                    </div>
                    <p className="mt-0.5 break-all text-xs text-slate-600" dir="ltr">{record.email || '—'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">{accountPlan(record, ar)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{ar ? 'إنشاء:' : 'Created:'} {niceDate(record.createdAt, ar)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{ar ? 'آخر ظهور:' : 'Last seen:'} {niceCairoDateTime(record.lastSeenAt, ar)} {record.lastSeenAt && <> · {deviceLabel(record.lastSeenDevice, ar)}</>} {ar ? '(توقيت القاهرة)' : '(Cairo time)'}</p>
                    {record.installed && <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5"/>{ar ? 'تم رصد نسخة مثبتة' : 'Installed-app usage reported'}</p>}
                  </div>
                  {!isOwner && <div className="flex shrink-0 flex-wrap gap-1">
                    <button type="button" disabled={!!workingUid} onClick={() => { setDeleteUid(null); setConfirmUid(activeConfirmation ? null : record.uid); }} className={'flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold disabled:opacity-50 ' + (record.disabled ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
                      {record.disabled ? <UserRoundCheck className="h-3.5 w-3.5"/> : <ShieldBan className="h-3.5 w-3.5"/>}
                      {record.disabled ? (ar ? 'تفعيل' : 'Enable') : (ar ? 'إيقاف' : 'Suspend')}
                    </button>
                    {record.disabled && <button type="button" disabled={!!workingUid} onClick={() => { setConfirmUid(null); setDeleteUid(activeDelete ? null : record.uid); setTypedEmail(''); }} className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>{ar ? 'حذف الهوية' : 'Delete identity'}</button>}
                  </div>}
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
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700"/>
            {ar ? 'تُحدّث حالة الوجود عند فتح الصفحة أو الضغط على تحديث، وقد يتأخر رصد انقطاع الاتصال. نوع الجهاز تقريبي. البيانات للإدارة فقط، ولا تعرض أرصدة المستخدمين أو معاملاتهم.' : 'Presence updates on opening this page or pressing Refresh; disconnect detection may be delayed. Device type is approximate. Financial balances and transactions are not shown.'}
          </div>
        </>
      )}
    </div>
  );
}
