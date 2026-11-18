import { useEffect, useState } from 'react';
import type { OfferAdStatus, ReviewOfferAd } from '../../data/offerAds';
import { offerAdsRequest } from '../../services/offerAdsClient';
import type { Language } from '../../types';
import { AdCreativeCard } from '../AdCreativeCard';

export function AdminOfferAds({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [status, setStatus] = useState<OfferAdStatus>('pending');
  const [ads, setAds] = useState<ReviewOfferAd[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decision, setDecision] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let active = true;
    setAds(null);
    setError('');
    offerAdsRequest<ReviewOfferAd[]>('admin.ads.list', { status }, true)
      .then(result => { if (active) setAds(result); })
      .catch(() => { if (active) setError(ar ? 'تعذّر تحميل الإعلانات. اضغط تحديث للمحاولة مرة تانية.' : 'Could not load ads. Select Refresh to retry.'); });
    return () => { active = false; };
  }, [status, refresh, ar]);

  const review = async () => {
    if (!decision || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await offerAdsRequest('admin.ads.review', { ...decision, reason }, true);
      setAds(items => items?.filter(ad => ad.id !== decision.id) ?? null);
      setNotice(decision.status === 'approved'
        ? (ar ? 'تمت الموافقة. الإعلان يظهر للجمهور خلال موعد النشر المحدد.' : 'Approved. The ad appears during its publication window.')
        : (ar ? 'تم رفض الإعلان.' : 'The ad was rejected.'));
      setDecision(null);
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : '';
      if (code === 'ad_already_reviewed') {
        setDecision(null);
        setRefresh(value => value + 1);
        setNotice(ar ? 'تم اتخاذ قرار لهذا الإعلان بالفعل.' : 'This ad has already been reviewed.');
      } else {
        setError(code === 'ad_schedule_expired'
          ? (ar ? 'موعد نشر الإعلان انتهى. تقدر ترفضه وتسجل السبب.' : 'The publication window has ended. You can reject the ad and record a reason.')
          : (ar ? 'تعذّر حفظ القرار. حاول مرة تانية.' : 'Could not save the decision. Try again.'));
      }
    } finally { setBusy(false); }
  };

  const labels = { pending: ar ? 'بانتظار الموافقة' : 'Pending', approved: ar ? 'المقبولة' : 'Approved', rejected: ar ? 'المرفوضة' : 'Rejected' };
  const date = (value: number) => new Date(value).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' });
  const button = 'min-h-11 rounded-xl px-3 text-sm font-bold disabled:opacity-50';
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2" aria-label={ar ? 'حالة الإعلان' : 'Ad status'}>
      {(['pending', 'approved', 'rejected'] as const).map(value => <button type="button" key={value} disabled={busy}
        aria-pressed={status === value} onClick={() => { if (status !== value) { setAds(null); setStatus(value); setDecision(null); setNotice(''); } }}
        className={`${button} ${status === value ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>{labels[value]}</button>)}
      <button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)} className={`${button} bg-slate-100 text-slate-700`}>{ar ? 'تحديث' : 'Refresh'}</button>
    </div>
    {notice && <p role="status" className="text-sm font-semibold text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    {ads === null && !error && <p role="status" className="text-sm text-slate-600">{ar ? 'جاري تحميل الإعلانات...' : 'Loading ads…'}</p>}
    {ads?.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">{ar ? 'مفيش إعلانات بالحالة دي حاليًا.' : 'There are no ads with this status.'}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      {ads?.map(ad => <div key={ad.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <AdCreativeCard lang={lang} title={ad.title} description={ad.description} merchant={ad.merchant} contact={ad.contact}
          mediaUrl={ad.media?.url} mediaType={ad.media?.type} poster={ad.media?.poster} />
        <dl className="space-y-1 text-xs text-slate-600">
          <div><dt className="inline font-bold">{ar ? 'وصل في' : 'Received'} </dt><dd className="inline">{date(ad.submittedAt)}</dd></div>
          <div><dt className="inline font-bold">{ar ? 'مدة النشر بتوقيت القاهرة' : 'Publication window, Cairo time'} </dt><dd className="inline">{date(ad.startsAt)} — {date(ad.endsAt)}</dd></div>
        </dl>
        {ad.rejectionReason && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{ad.rejectionReason}</p>}
        {status === 'approved' && ad.startsAt <= Date.now() && ad.endsAt > Date.now() && <a className="inline-block text-sm font-bold text-emerald-700 underline" href={`/offers/ad/${ad.id}`}>{ar ? 'افتح الإعلان المنشور' : 'Open published ad'}</a>}
        {status === 'pending' && (decision?.id === ad.id ? <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-bold">{decision.status === 'approved'
            ? (ar ? 'تأكيد الموافقة على نشر الإعلان في المدة المحددة؟' : 'Confirm approval for the selected publication window?')
            : (ar ? 'تأكيد رفض الإعلان؟' : 'Confirm rejection?')}</p>
          {decision.status === 'rejected' && <label className="block text-xs font-bold">{ar ? 'سبب الرفض (اختياري)' : 'Rejection reason (optional)'}
            <textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" />
          </label>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void review()} className={`${button} ${decision.status === 'approved' ? 'bg-emerald-700' : 'bg-red-700'} text-white`}>{ar ? 'تأكيد القرار' : 'Confirm decision'}</button>
            <button type="button" disabled={busy} onClick={() => setDecision(null)} className={`${button} bg-slate-200 text-slate-800`}>{ar ? 'إلغاء' : 'Cancel'}</button>
          </div>
        </div> : <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || ad.endsAt <= Date.now()} onClick={() => { setReason(''); setDecision({ id: ad.id, status: 'approved' }); }} className={`${button} bg-emerald-700 text-white`}>{ar ? 'موافقة' : 'Approve'}</button>
          <button type="button" disabled={busy} onClick={() => { setReason(''); setDecision({ id: ad.id, status: 'rejected' }); }} className={`${button} bg-red-50 text-red-800`}>{ar ? 'رفض' : 'Reject'}</button>
        </div>)}
      </div>)}
    </div>
  </div>;
}
