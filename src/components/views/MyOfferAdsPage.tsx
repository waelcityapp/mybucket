import { followInternalLink } from '../../utils/navigationHistory';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Megaphone, RefreshCw } from 'lucide-react';
import type { Language } from '../../types';
import type { MyOfferAd } from '../../data/offerAds';
import { offerAdsRequest } from '../../services/offerAdsClient';

export function MyOfferAdsPage({ uid, lang, onBack, onNavigate }: { uid: string; lang: Language; onBack: () => void; onNavigate: (path: string) => void }) {
  const ar = lang === 'ar';
  const Back = ar ? ArrowRight : ArrowLeft;
  const [result, setResult] = useState<{ uid: string; ads: MyOfferAd[] } | null>(null);
  const ads = result?.uid === uid ? result.ads : null;
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  useEffect(() => {
    let active = true;
    let loading = false;
    let hasPending = false;
    const load = () => {
      if (loading) return;
      loading = true;
      setError(false);
      offerAdsRequest<MyOfferAd[]>('ads.mine', {}, true)
        .then(items => {
          if (!active) return;
          hasPending = items.some(ad => ad.status === 'pending');
          setResult({ uid, ads: items });
          setNow(Date.now());
        })
        .catch(() => { if (active) setError(true); })
        .finally(() => { loading = false; });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setNow(Date.now());
      if (hasPending) load();
    }, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [revision, uid]);

  const removeAd = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await offerAdsRequest('ads.deleteExpired', { id }, true);
      setResult(previous => previous && { ...previous, ads: previous.ads.filter(ad => ad.id !== id) });
      setConfirmDelete(null);
      setRevision(value => value + 1);
    } catch {
      setDeleteError(true);
    } finally { setDeleting(false); }
  };
  const isExpired = (ad: MyOfferAd) => ad.status === 'approved' && now >= ad.endsAt;
  const visibleAds = ads?.filter(ad => !isExpired(ad) || now < (ad.deleteAfter ?? ad.endsAt + 10 * 86400000)) ?? [];
  const expiredStart = visibleAds.filter(ad => !isExpired(ad)).length;
  const orderedAds = visibleAds.slice().sort((a, b) => Number(isExpired(a)) - Number(isExpired(b)));
  const date = (value: number) => new Date(value).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' });
  return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center gap-3">
        <button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
          onClick={onBack} aria-label={ar ? 'العودة إلى حسابي' : 'Back to my account'}><Back className="size-5" /></button>
        <h1 className="flex-1 text-xl font-extrabold">{ar ? 'إعلاناتي' : 'My ads'}</h1>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-emerald-800 dark:text-emerald-300"
          onClick={() => setRevision(value => value + 1)}><RefreshCw className="size-4" aria-hidden="true" />{ar ? 'تحديث' : 'Refresh'}</button>
      </header>
      {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{ar ? 'تعذّر تحميل إعلاناتك. اضغط تحديث للمحاولة تاني.' : 'Could not load your ads. Select Refresh to try again.'}</p>
        : ads === null && <p role="status" className="text-sm">{ar ? 'جاري تحميل إعلاناتك...' : 'Loading your ads…'}</p>}
      {ads && visibleAds.length === 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="font-bold">{ar ? 'لسه ما أرسلتش إعلانات' : 'You haven’t submitted any ads yet'}</p>
        <a href="/offers/new" onClick={event => followInternalLink(event, onNavigate)} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 underline dark:text-emerald-300">
          <Megaphone className="size-4" aria-hidden="true" />{ar ? 'إنشاء إعلان' : 'Create an ad'}</a>
      </section>}
      {deleteError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{ar ? 'تعذّر إكمال الحذف. جرّب تاني.' : 'Could not complete deletion. Try again.'}</p>}
      {orderedAds.map((ad, index) => {
        const published = ad.status === 'approved' && ad.startsAt <= now && now < ad.endsAt;
        const status = ad.status === 'pending' ? (ar ? 'بانتظار الموافقة' : 'Awaiting approval')
          : ad.status === 'rejected' ? (ar ? 'تم الرفض' : 'Rejected')
          : published ? (ar ? 'تمت الموافقة ونشر الإعلان' : 'Approved and published')
          : ad.startsAt > now ? (ar ? 'تمت الموافقة — في انتظار موعد النشر' : 'Approved — scheduled')
          : (ar ? 'تمت الموافقة — انتهت مدة النشر' : 'Approved — publication ended');
        const expired = isExpired(ad);
        const deleteAfter = ad.deleteAfter ?? ad.endsAt + 10 * 86400000;
        const badge = ad.status === 'rejected' ? 'bg-red-100 text-red-900' : ad.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900';
        return <div key={ad.id} className="space-y-3">
          {expired && index === expiredStart && <h2 className="pt-2 text-sm font-extrabold">{ar ? 'الإعلانات المنتهية' : 'Expired ads'}</h2>}
          <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="break-words text-sm font-semibold">{ad.merchant}</p>
          <h2 className="break-words font-extrabold">{ad.title}</h2>
          <p className={`w-fit rounded-lg px-2.5 py-1 text-xs font-bold ${badge}`}>{status}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'تاريخ الإرسال' : 'Submitted'} · {date(ad.submittedAt)}</p>
          {ad.status === 'approved' && <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'مدة النشر بتوقيت القاهرة' : 'Publication window, Cairo time'} · {date(ad.startsAt)} — {date(ad.endsAt)}</p>}
          {ad.status === 'rejected' && ad.rejectionReason && <p className="whitespace-pre-wrap break-words text-sm">{ad.rejectionReason}</p>}
          {expired && <div className="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
            <p className={`text-xs font-semibold ${deleteAfter - now < 2 * 86400000 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}`}>
              {ar ? 'هيتم حذف الإعلان وملفاته يوم' : 'The ad and its files will be deleted on'} {date(deleteAfter)}
            </p>
            {confirmDelete === ad.id ? <div className="space-y-2">
              <p className="text-sm font-bold">{ar ? 'تحذف الإعلان وكل ملفاته نهائيًا؟' : 'Permanently delete this ad and its files?'}</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={deleting} onClick={() => void removeAd(ad.id)} className="min-h-11 rounded-lg bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-50">{ar ? 'تأكيد الحذف' : 'Confirm deletion'}</button>
                <button type="button" disabled={deleting} onClick={() => setConfirmDelete(null)} className="min-h-11 px-3 text-sm font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              </div>
            </div> : <div className="flex flex-wrap gap-3">
              <a href={`/offers/new?renew=${ad.id}`} onClick={event => followInternalLink(event, onNavigate)} className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white">{ar ? 'إعادة الإرسال للمراجعة' : 'Resubmit for review'}</a>
              <button type="button" disabled={deleting} onClick={() => { setConfirmDelete(ad.id); setDeleteError(false); }} className="min-h-11 px-2 text-sm font-bold text-red-700 dark:text-red-300">{ar ? 'حذف الإعلان' : 'Delete ad'}</button>
            </div>}
          </div>}
          {published && <a href={`/offers/ad/${ad.id}`} onClick={event => followInternalLink(event, onNavigate)} className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline dark:text-emerald-300">{ar ? 'شوف الإعلان المنشور' : 'View published ad'}</a>}
          </article>
        </div>;
      })}
    </div>
  </main>;
}
