import { useEffect, useState } from 'react';
import type { OfferAdStatus, ReviewOfferAd } from '../../data/offerAds';
import { offerAdsRequest } from '../../services/offerAdsClient';
import type { Language } from '../../types';
import { AdCreativeCard } from '../AdCreativeCard';

type UploadStats = {
  issued: number;
  verified: number;
  bytes: number;
  cancellations: number;
  limitedAccounts: number;
  uploadsPaused: boolean;
};

export function AdminOfferAds({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [receiptErrors, setReceiptErrors] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<OfferAdStatus>('pending');
  const [ads, setAds] = useState<ReviewOfferAd[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decision, setDecision] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [statsBusy, setStatsBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setStatsError(false);
    offerAdsRequest<UploadStats>('admin.ads.uploadStats', {}, true)
      .then(stats => { if (active) setUploadStats(stats); })
      .catch(() => { if (active) setStatsError(true); });
    return () => { active = false; };
  }, [refresh]);
  const setUploadsPaused = async (uploadsPaused: boolean) => {
    setStatsBusy(true);
    setStatsError(false);
    try {
      setUploadStats(await offerAdsRequest<UploadStats>('admin.ads.uploadStats', { uploadsPaused }, true));
    } catch {
      setStatsError(true);
    } finally {
      setStatsBusy(false);
    }
  };
  const [days, setDays] = useState('');
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState('');
  useEffect(() => {
    let active = true;
    offerAdsRequest<{ freeIntervalDays: number }>('admin.ads.policy', {}, true)
      .then(policy => { if (active) setDays(String(policy.freeIntervalDays)); })
      .catch(() => { if (active) setPolicyMessage(ar ? 'تعذّر تحميل مدة الإعلان المجاني.' : 'Could not load the free ad interval.'); });
    return () => { active = false; };
  }, [ar]);
  const savePolicy = async () => {
    setPolicyBusy(true);
    setPolicyMessage('');
    try {
      const policy = await offerAdsRequest<{ freeIntervalDays: number }>('admin.ads.policy', { freeIntervalDays: Number(days) }, true);
      setDays(String(policy.freeIntervalDays));
      setPolicyMessage(ar ? 'تم حفظ المدة.' : 'Interval saved.');
    } catch {
      setPolicyMessage(ar ? 'تعذّر حفظ المدة.' : 'Could not save the interval.');
    } finally { setPolicyBusy(false); }
  };

  useEffect(() => {
    let active = true;
    setAds(null);
    setReceiptErrors({});
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
      await offerAdsRequest('admin.ads.review', { ...decision, reason, paymentConfirmed }, true);
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
          : code === 'ad_free_interval'
            ? (ar ? 'لسه ما مرّتش المدة المطلوبة من آخر إعلان مجاني تمت الموافقة عليه لهذا الحساب.' : 'This account’s free ad interval has not passed since its last approval.')
          : (ar ? 'تعذّر حفظ القرار. حاول مرة تانية.' : 'Could not save the decision. Try again.'));
      }
    } finally { setBusy(false); }
  };

  const labels = { pending: ar ? 'بانتظار الموافقة' : 'Pending', approved: ar ? 'المقبولة' : 'Approved', rejected: ar ? 'المرفوضة' : 'Rejected' };
  const date = (value: number) => new Date(value).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' });
  const button = 'min-h-11 rounded-xl px-3 text-sm font-bold disabled:opacity-50';
  return <div className="space-y-4">
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold">{ar ? 'رفع ملفات الإعلانات اليوم بتوقيت القاهرة' : 'Ad media uploads today, Cairo time'}</h2>
        <button type="button" disabled={statsBusy} onClick={() => setRefresh(value => value + 1)}
          className="text-xs font-bold text-emerald-800 underline">{ar ? 'تحديث الأرقام' : 'Refresh totals'}</button>
      </div>
      {statsError && <p role="alert" className="text-sm text-red-700">{ar ? 'تعذّر تحديث بيانات الرفع. حاول تاني.' : 'Could not update upload information. Try again.'}</p>}
      {!statsError && !uploadStats && <p role="status" className="text-sm text-slate-600">{ar ? 'جاري تحميل ملخص الرفع...' : 'Loading upload summary…'}</p>}
      {uploadStats && <>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {[
            [ar ? 'أذونات الرفع' : 'Upload permits', uploadStats.issued],
            [ar ? 'ملفات مؤكدة' : 'Verified files', uploadStats.verified],
            [ar ? 'إلغاءات' : 'Cancellations', uploadStats.cancellations],
            [ar ? 'حسابات استنفدت الحصة' : 'Accounts at limit', uploadStats.limitedAccounts],
            [ar ? 'حجم الملفات المؤكدة (م.ب)' : 'Verified media (MB)', uploadStats.bytes / 1_000_000],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-2.5">
            <dt className="text-xs text-slate-600">{label}</dt>
            <dd className="mt-1 font-extrabold">{new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB', { maximumFractionDigits: 2 }).format(Number(value))}</dd>
          </div>)}
        </dl>
        {(uploadStats.issued >= 30 || (uploadStats.issued >= 10 && uploadStats.cancellations * 2 >= uploadStats.issued)) &&
          <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{ar ? 'نشاط رفع مرتفع اليوم. راجع أعداد الرفع والإلغاء.' : 'High upload activity today. Check upload and cancellation totals.'}</p>}
        <button type="button" disabled={statsBusy} onClick={() => void setUploadsPaused(!uploadStats.uploadsPaused)}
          className={`${button} ${uploadStats.uploadsPaused ? 'bg-emerald-700 text-white' : 'bg-rose-50 text-rose-800'}`}>
          {uploadStats.uploadsPaused ? (ar ? 'استئناف الرفع الجديد' : 'Resume new uploads') : (ar ? 'إيقاف الرفع الجديد مؤقتًا' : 'Pause new uploads')}
        </button>
      </>}
    </section>
    <form onSubmit={event => { event.preventDefault(); void savePolicy(); }} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <label className="block text-sm font-bold" htmlFor="free-ad-interval">{ar ? 'المدة بين الموافقات على الإعلانات المجانية (أيام)' : 'Days between free ad approvals'}</label>
      <div className="flex flex-wrap gap-2">
        <input id="free-ad-interval" type="number" min="1" max="90" required value={days} disabled={policyBusy}
          onChange={event => setDays(event.target.value)} className="w-24 rounded-xl border border-slate-200 bg-white px-3 text-slate-900" />
        <button type="submit" disabled={policyBusy || !days} className={`${button} bg-emerald-700 text-white`}>{ar ? 'حفظ' : 'Save'}</button>
      </div>
      {policyMessage && <p role="status" className="text-xs text-slate-700">{policyMessage}</p>}
    </form>
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
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${ad.payment ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
          {ad.tier === 'vip' ? 'VIP' : ad.payment ? (ar ? 'إعلان مميز' : 'Featured ad') : (ar ? 'إعلان مجاني' : 'Free ad')}
        </span>
        <AdCreativeCard lang={lang} title={ad.title} description={ad.description} merchant={ad.merchant} contact={ad.contact}
          mediaUrl={ad.media?.url} mediaType={ad.media?.type} poster={ad.media?.poster} />
        <dl className="space-y-1 text-xs text-slate-600">
          <div><dt className="inline font-bold">{ar ? 'وصل في' : 'Received'} </dt><dd className="inline">{date(ad.submittedAt)}</dd></div>
          <div><dt className="inline font-bold">{ar ? 'مدة النشر بتوقيت القاهرة' : 'Publication window, Cairo time'} </dt><dd className="inline">{date(ad.startsAt)} — {date(ad.endsAt)}</dd></div>
        </dl>
        {ad.payment && <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-900">
          <h3 className="font-extrabold">{ar ? 'إيصال إنستا باي' : 'InstaPay receipt'}</h3>
          <p>{ar ? 'المبلغ المطلوب' : 'Expected amount'} · {new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(ad.payment.amountEgp)}</p>
          <p>{ar ? 'رقم المتابعة' : 'Contact number'} · <bdi>{ad.payment.phone}</bdi></p>
          {ad.payment.receiptUrl ? <details className="space-y-3">
            <summary className="min-h-11 cursor-pointer py-3 font-bold text-emerald-800 underline underline-offset-2">
              {ar ? 'عرض صورة الإيصال' : 'Show receipt image'}
            </summary>
            <img src={ad.payment.receiptUrl} loading="lazy" referrerPolicy="no-referrer"
              alt={ar ? 'صورة إيصال تحويل إنستا باي' : 'InstaPay transfer receipt'}
              onError={() => setReceiptErrors(previous => ({ ...previous, [ad.id]: true }))}
              className={receiptErrors[ad.id] ? 'hidden' : 'block h-auto w-full rounded-lg border border-amber-200 bg-white'} />
            {receiptErrors[ad.id] && <p role="alert" className="text-sm font-bold text-rose-700">
              {ar ? 'تعذّر تحميل صورة الإيصال. حدّث قائمة الإعلانات وحاول تاني.' : 'Could not load the receipt image. Refresh the ad list and try again.'}
            </p>}
          </details> : <p role="alert" className="font-bold text-rose-700">{ar ? 'تعذّر الوصول للإيصال.' : 'Receipt unavailable.'}</p>}
        </section>}
        {ad.rejectionReason && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{ad.rejectionReason}</p>}
        {status === 'approved' && ad.startsAt <= Date.now() && ad.endsAt > Date.now() && <a className="inline-block text-sm font-bold text-emerald-700 underline" href={`/offers/ad/${ad.id}`}>{ar ? 'افتح الإعلان المنشور' : 'Open published ad'}</a>}
        {status === 'pending' && (decision?.id === ad.id ? <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-bold">{decision.status === 'approved'
            ? (ar ? 'تأكيد الموافقة على نشر الإعلان في المدة المحددة؟' : 'Confirm approval for the selected publication window?')
            : (ar ? 'تأكيد رفض الإعلان؟' : 'Confirm rejection?')}</p>
          {decision.status === 'approved' && ad.payment && <label className="flex items-start gap-2 text-sm font-bold">
            <input type="checkbox" checked={paymentConfirmed} onChange={event => setPaymentConfirmed(event.target.checked)} />
            {ar ? 'راجعت الإيصال واتأكدت إن التحويل وصل بالمبلغ المطلوب.' : 'I checked the receipt and confirmed the expected transfer was received.'}
          </label>}
          {decision.status === 'rejected' && <label className="block text-xs font-bold">{ar ? 'سبب الرفض (اختياري)' : 'Rejection reason (optional)'}
            <textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" />
          </label>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (decision.status === 'approved' && !!ad.payment && (!paymentConfirmed || !ad.payment.receiptUrl))} onClick={() => void review()} className={`${button} ${decision.status === 'approved' ? 'bg-emerald-700' : 'bg-red-700'} text-white`}>{ar ? 'تأكيد القرار' : 'Confirm decision'}</button>
            <button type="button" disabled={busy} onClick={() => setDecision(null)} className={`${button} bg-slate-200 text-slate-800`}>{ar ? 'إلغاء' : 'Cancel'}</button>
          </div>
        </div> : <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || (!ad.payment && ad.endsAt <= Date.now())} onClick={() => { setReason(''); setPaymentConfirmed(false); setDecision({ id: ad.id, status: 'approved' }); }} className={`${button} bg-emerald-700 text-white`}>{ar ? 'موافقة' : 'Approve'}</button>
          <button type="button" disabled={busy} onClick={() => { setReason(''); setPaymentConfirmed(false); setDecision({ id: ad.id, status: 'rejected' }); }} className={`${button} bg-red-50 text-red-800`}>{ar ? 'رفض' : 'Reject'}</button>
        </div>)}
      </div>)}
    </div>
  </div>;
}
