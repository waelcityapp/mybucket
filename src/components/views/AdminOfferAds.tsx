import { cairoAdTransferTime, normalizeAdTransferReference, isPaidAdPrice, MAX_AD_DAILY_PRICE_EGP, type PaidAdPrices } from '../../utils/adCheckout';
import { useEffect, useState } from 'react';
import type { FreeOfferPolicy, OfferAdStatus, ReviewOfferAd } from '../../data/offerAds';
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

const hiddenAdsKey = 'mybucket.admin.offerAds.hidden';

function readHiddenAds(): Set<string> {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(hiddenAdsKey) ?? '[]');
    return new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function AdminOfferAds({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [receiptErrors, setReceiptErrors] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<OfferAdStatus>('pending');
  const [ads, setAds] = useState<ReviewOfferAd[] | null>(null);
  const [hiddenAds, setHiddenAds] = useState(readHiddenAds);
  const [showHidden, setShowHidden] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decision, setDecision] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [transferReference, setTransferReference] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [receivedTime, setReceivedTime] = useState('');
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
  const [prices, setPrices] = useState<{ featured: string; vip: string } | null>(null);
  const [pricesBusy, setPricesBusy] = useState(false);
  const [pricesError, setPricesError] = useState('');
  const [pricesSaved, setPricesSaved] = useState(false);
  const [pricesAttempt, setPricesAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setPricesError('');
    offerAdsRequest<PaidAdPrices>('admin.ads.prices', {}, true)
      .then(value => { if (active) setPrices({ featured: String(value.featured), vip: String(value.vip) }); })
      .catch(() => { if (active) setPricesError(ar ? 'تعذّر تحميل أسعار الإعلانات.' : 'Could not load ad prices.'); });
    return () => { active = false; };
  }, [pricesAttempt, ar]);

  const savePrices = async () => {
    if (!prices || pricesBusy) return;
    const featured = Number(prices.featured), vip = Number(prices.vip);
    setPricesSaved(false);
    if (!prices.featured.trim() || !prices.vip.trim() || !isPaidAdPrice(featured) || !isPaidAdPrice(vip)) {
      setPricesError(ar ? 'أدخل سعرًا صحيحًا من صفر إلى مليون جنيه لكل نوع.' : 'Enter whole EGP amounts from 0 to 1,000,000.');
      return;
    }
    setPricesBusy(true);
    setPricesError('');
    try {
      const result = await offerAdsRequest<PaidAdPrices>('admin.ads.prices', { featured, vip }, true);
      setPrices({ featured: String(result.featured), vip: String(result.vip) });
      setPricesSaved(true);
    } catch {
      setPricesError(ar ? 'تعذّر حفظ الأسعار. حاول مرة أخرى.' : 'Could not save prices. Try again.');
    } finally {
      setPricesBusy(false);
    }
  };
  const [days, setDays] = useState('');
  const [duration, setDuration] = useState('');
  const [savedPolicy, setSavedPolicy] = useState<FreeOfferPolicy | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState('');
  useEffect(() => {
    let active = true;
    offerAdsRequest<FreeOfferPolicy>('admin.ads.policy', {}, true)
      .then(policy => {
        if (!active) return;
        setDays(String(policy.freeIntervalDays));
        setDuration(String(policy.freeDurationDays));
        setSavedPolicy(policy);
      })
      .catch(() => { if (active) setPolicyMessage(ar ? 'تعذّر تحميل إعدادات الإعلان المجاني.' : 'Could not load free ad settings.'); });
    return () => { active = false; };
  }, [ar]);
  const savePolicy = async () => {
    if (!savedPolicy || policyBusy) return;
    setPolicyBusy(true);
    setPolicyMessage('');
    try {
      const updates: Partial<FreeOfferPolicy> = {};
      if (Number(days) !== savedPolicy.freeIntervalDays) updates.freeIntervalDays = Number(days);
      if (Number(duration) !== savedPolicy.freeDurationDays) updates.freeDurationDays = Number(duration);
      const policy = await offerAdsRequest<FreeOfferPolicy>('admin.ads.policy', updates, true);
      setSavedPolicy(policy);
      setDays(String(policy.freeIntervalDays));
      setDuration(String(policy.freeDurationDays));
      setPolicyMessage(ar ? 'تم حفظ الإعدادات.' : 'Settings saved.');
    } catch {
      setPolicyMessage(ar ? 'تعذّر حفظ الإعدادات.' : 'Could not save settings.');
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
      await offerAdsRequest('admin.ads.review', { ...decision, reason, paymentConfirmed,
        transferReference, receivedAmountEgp: receivedAmount.trim() ? Number(receivedAmount) : null,
        receivedAt: cairoAdTransferTime(receivedTime),
      }, true);
      setAds(items => items?.filter(ad => ad.id !== decision.id) ?? null);
      const ad = ads?.find(item => item.id === decision.id);
      const notice = decision.status === 'approved'
        ? (ad?.payment
          ? (ar ? 'تمت الموافقة. الإعلان يظهر للجمهور خلال موعد النشر المحدد.' : 'Approved. The ad appears during its publication window.')
          : (ar ? 'تمت الموافقة ونشر الإعلان المجاني.' : 'The free ad was approved and published.'))
        : (ad?.requiresVideoCorrection
          ? (ar ? 'تم إرجاع الإعلان للمعلن للتصحيح.' : 'The ad was returned to the advertiser for correction.')
          : (ar ? 'تم رفض الإعلان.' : 'The ad was rejected.'));
      setNotice(notice);
      setDecision(null);
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : '';
      if (code === 'ad_already_reviewed') {
        setDecision(null);
        setRefresh(value => value + 1);
        setNotice(ar ? 'تم اتخاذ قرار لهذا الإعلان بالفعل.' : 'This ad has already been reviewed.');
      } else {
        const errors = {
          reference_already_used: ar ? 'مرجع التحويل مستخدم في طلب آخر.' : 'This transfer reference has already been used.',
          invalid_transfer_reference: ar ? 'أدخل مرجع التحويل من سجل الاستلام.' : 'Enter the transfer reference from the incoming transfers record.',
          ad_transfer_amount_mismatch: ar ? 'المبلغ المستلم لا يطابق مبلغ الطلب.' : 'The received amount does not match the order.',
          ad_legacy_transfer_mismatch: ar ? 'بيانات سجل الاستلام لا تطابق طلب التحويل القديم.' : 'The incoming transfer does not match the legacy request.',
          ad_legacy_transfer_after_cutoff: ar ? 'التحويل لا يسبق أول تغيير للأسعار. الطلب ما زال معلقًا.' : 'The transfer does not predate the first price change. The request is still pending.',
          ad_legacy_transfer_pending: ar ? 'التحويل القديم يظل معلقًا حتى يتم التحقق منه.' : 'The legacy transfer stays pending until it is verified.',
          ad_legacy_transfer_cutoff_unknown: ar ? 'تعذر التحقق من تاريخ بدء الأسعار الجديدة. الطلب ما زال معلقًا.' : 'The first rate change could not be verified. The request is still pending.',
          ad_free_image_only: ar ? 'الإعلان المجاني فيه فيديو. ارجعه للمعلن للتصحيح.' : 'This free ad contains a video. Return it to the advertiser for correction.',
          ad_active_exists: ar ? 'الحساب عنده إعلان مجاني نشط.' : 'This account already has an active free ad.',
          ad_pending_exists: ar ? 'الحساب عنده طلب مجاني تاني قيد المراجعة.' : 'This account has another free ad awaiting review.',
          ad_free_interval: ar ? 'فترة الانتظار من آخر موافقة على إعلان مجاني للحساب لسه ما خلصتش.' : 'The waiting period since this account’s last free ad approval has not passed.',
        };
        setError(Object.hasOwn(errors, code) ? errors[code as keyof typeof errors]
          : (ar ? 'تعذّر حفظ القرار. حاول مرة تانية.' : 'Could not save the decision. Try again.'));
      }
    } finally { setBusy(false); }
  };

  const labels = { pending: ar ? 'بانتظار الموافقة' : 'Pending', approved: ar ? 'المقبولة' : 'Approved', rejected: ar ? 'المرفوضة' : 'Rejected' };
  const date = (value: number) => new Date(value).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' });
  const button = 'min-h-11 rounded-xl px-3 text-sm font-bold disabled:opacity-50';
  const reviewed = status !== 'pending';
  const hasHiddenAds = reviewed && Boolean(ads?.some(ad => hiddenAds.has(ad.id)));
  const visibleAds = ads?.filter(ad => !reviewed || showHidden || !hiddenAds.has(ad.id));

  const toggleHidden = (id: string) => {
    const next = readHiddenAds();
    if (hiddenAds.has(id)) next.delete(id);
    else next.add(id);
    try {
      localStorage.setItem(hiddenAdsKey, JSON.stringify([...next]));
      setHiddenAds(next);
      setNotice('');
    } catch {
      setNotice(ar ? 'تعذّر حفظ التغيير في المتصفح.' : 'Could not save the change in this browser.');
    }
  };

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
    <form onSubmit={event => { event.preventDefault(); void savePrices(); }}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <h3 className="font-extrabold">{ar ? 'إعدادات أسعار الإعلانات' : 'Ad pricing settings'}</h3>
      {!prices && !pricesError && <p role="status" className="text-sm">{ar ? 'جارٍ تحميل الأسعار…' : 'Loading prices…'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(['featured', 'vip'] as const).map(tier => <label key={tier} htmlFor={`ad-price-${tier}`} className="grid gap-1 text-sm font-bold">
          {tier === 'featured' ? (ar ? 'سعر يوم الإعلان المميز (ج.م.)' : 'Featured daily price (EGP)')
            : (ar ? 'سعر يوم إعلان VIP (ج.م.)' : 'VIP daily price (EGP)')}
          <input id={`ad-price-${tier}`} type="number" inputMode="numeric" required min={0} max={MAX_AD_DAILY_PRICE_EGP} step={1}
            value={prices?.[tier] ?? ''} disabled={!prices || pricesBusy}
            onChange={event => { const value = event.target.value; setPrices(current => current && { ...current, [tier]: value }); setPricesSaved(false); setPricesError(''); }}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
        </label>)}
      </div>
      <button type="submit" disabled={!prices || pricesBusy}
        className={`${button} bg-emerald-700 text-white`}>{pricesBusy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ الأسعار' : 'Save prices')}</button>
      {pricesSaved && <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">{ar ? 'تم حفظ الأسعار.' : 'Prices saved.'}</p>}
      {pricesError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
        {pricesError}{!prices && <> <button type="button" onClick={() => setPricesAttempt(n => n + 1)} className="underline">{ar ? 'إعادة المحاولة' : 'Retry'}</button></>}
      </p>}
    </form>
    <form onSubmit={event => { event.preventDefault(); void savePolicy(); }} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold" htmlFor="free-ad-duration">
          {ar ? 'مدة نشر الإعلان المجاني (أيام)' : 'Free ad publication duration (days)'}
          <input id="free-ad-duration" type="number" min="1" max="90" required value={duration} disabled={policyBusy || !savedPolicy}
            onChange={event => setDuration(event.target.value)} className="min-h-11 w-24 rounded-xl border border-slate-200 bg-white px-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        </label>
        <label className="grid gap-1 text-sm font-bold" htmlFor="free-ad-interval">
          {ar ? 'فترة الانتظار من آخر موافقة (أيام)' : 'Waiting period since last approval (days)'}
          <input id="free-ad-interval" type="number" min="1" max="90" required value={days} disabled={policyBusy || !savedPolicy}
            onChange={event => setDays(event.target.value)} className="min-h-11 w-24 rounded-xl border border-slate-200 bg-white px-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        </label>
      </div>
      <button type="submit" disabled={policyBusy || !days || !duration} className={`${button} bg-emerald-700 text-white`}>{ar ? 'حفظ' : 'Save'}</button>
      {policyMessage && <p role="status" className="text-xs text-slate-700 dark:text-slate-300">{policyMessage}</p>}
    </form>
    <div className="flex flex-wrap gap-2" aria-label={ar ? 'حالة الإعلان' : 'Ad status'}>
      {(['pending', 'approved', 'rejected'] as const).map(value => <button type="button" key={value} disabled={busy}
        aria-pressed={status === value} onClick={() => { if (status !== value) { setAds(null); setStatus(value); setShowHidden(false); setDecision(null); setNotice(''); } }}
        className={`${button} ${status === value ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>{labels[value]}</button>)}
      {hasHiddenAds && <button type="button" aria-pressed={showHidden} onClick={() => setShowHidden(value => !value)} className={`${button} bg-slate-100 text-slate-700`}>
        {ar ? 'عرض الإعلانات المخفية' : 'Show hidden ads'}
      </button>}
      <button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)} className={`${button} bg-slate-100 text-slate-700`}>{ar ? 'تحديث' : 'Refresh'}</button>
    </div>
    {notice && <p role="status" className="text-sm font-semibold text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    {ads === null && !error && <p role="status" className="text-sm text-slate-600">{ar ? 'جاري تحميل الإعلانات...' : 'Loading ads…'}</p>}
    {ads?.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">{ar ? 'مفيش إعلانات بالحالة دي حاليًا.' : 'There are no ads with this status.'}</p>}
    {hasHiddenAds && visibleAds?.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">{ar ? 'كل الإعلانات في القائمة دي مخفية.' : 'All ads in this list are hidden.'}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      {visibleAds?.map(ad => <div key={ad.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${ad.payment ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
          {ad.tier === 'vip' ? 'VIP' : ad.payment ? (ar ? 'إعلان مميز' : 'Featured ad') : (ar ? 'إعلان مجاني' : 'Free ad')}
        </span>
          {reviewed && <button type="button"
            className="min-h-11 rounded-lg px-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            aria-label={hiddenAds.has(ad.id) ? (ar ? `إظهار ${ad.title} في لوحة الإدارة` : `Restore ${ad.title} in admin`) : (ar ? `إخفاء ${ad.title} من لوحة الإدارة` : `Hide ${ad.title} from admin`)}
            onClick={() => toggleHidden(ad.id)}>
            {hiddenAds.has(ad.id) ? (ar ? 'إظهار' : 'Restore') : (ar ? 'إخفاء' : 'Hide')}
          </button>}
        </div>
        <AdCreativeCard lang={lang} title={ad.title} description={ad.description} merchant={ad.merchant} contact={ad.contact}
          mediaUrl={ad.media?.url} mediaType={ad.media?.type} poster={ad.media?.poster} />
        <dl className="space-y-1 text-xs text-slate-600">
          <div><dt className="inline font-bold">{ar ? 'وصل في' : 'Received'} </dt><dd className="inline">{date(ad.submittedAt)}</dd></div>
          {(ad.payment || status === 'approved') && <div><dt className="inline font-bold">{ar ? 'مدة النشر بتوقيت القاهرة' : 'Publication window, Cairo time'} </dt><dd className="inline">{date(ad.startsAt)} — {date(ad.endsAt)}</dd></div>}
          {!ad.payment && status === 'pending' && <div>
            <dt className="inline font-bold">{ar ? 'بداية النشر' : 'Publication start'} </dt>
            <dd className="inline">{ar ? 'فور الموافقة' : 'Immediately upon approval'}</dd>
          </div>}
        </dl>
        {ad.payment && <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-900">
          <h3 className="font-extrabold">{ad.legacyTransfer ? (ar ? 'مراجعة استثنائية لتحويل قديم' : 'Legacy transfer review') : (ar ? 'إيصال إنستا باي' : 'InstaPay receipt')}</h3>
          {ad.legacyTransfer && <p>{ar ? 'بيانات المعلن' : 'Advertiser claim'} · <bdi>{ad.legacyTransfer.reference}</bdi> · {date(ad.legacyTransfer.transferredAt)} · {ad.legacyTransfer.amountEgp} EGP</p>}
          {ad.confirmedTransfer && <p>{ar ? 'مرجع التحويل المطابق' : 'Matched transfer reference'} · <bdi>{ad.confirmedTransfer.reference}</bdi></p>}
          <p>{ar ? 'المبلغ المطلوب' : 'Expected amount'} · {new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(ad.payment.amountEgp)}</p>
          <p>{ar ? 'رقم المتابعة' : 'Contact number'} · <bdi>{ad.payment.phone}</bdi></p>
          {ad.payment.amountEgp === 0 && ad.payment.dailyPriceEgp === 0 ? <p>{ar ? 'لا يلزم تحويل لهذا الطلب.' : 'No transfer is due for this ad.'}</p> : ad.payment.receiptUrl ? <details className="space-y-3">
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
        {status === 'pending' && ad.requiresVideoCorrection && <p role="alert" className="text-sm font-semibold text-red-700">
          {ar ? 'الإعلان المجاني فيه فيديو. ارجعه للمعلن عشان يزيل الفيديو أو يستبدله بصورة واحدة.' : 'This free ad contains a video. Return it so the advertiser can remove the video or replace it with one image.'}
        </p>}
        {status === 'pending' && (decision?.id === ad.id ? <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-bold">{decision.status === 'approved'
            ? (ad.payment
              ? (ar ? 'تأكيد الموافقة على نشر الإعلان في المدة المحددة؟' : 'Confirm approval for the selected publication window?')
              : (ar ? 'تأكيد الموافقة والنشر الفوري؟' : 'Approve and publish now?'))
            : (ad.requiresVideoCorrection ? (ar ? 'تأكيد إرجاع الإعلان للتصحيح؟' : 'Return the ad for correction?') : (ar ? 'تأكيد رفض الإعلان؟' : 'Confirm rejection?'))}</p>
          {decision.status === 'approved' && ad.payment && (ad.payment.amountEgp !== 0 || ad.payment.dailyPriceEgp !== 0) && <div className="space-y-2">
            <label className="grid gap-1 text-xs font-bold">{ar ? 'المرجع في سجل الاستلام الفعلي' : 'Reference in the incoming transfer record'}
              <input value={transferReference} maxLength={48} onChange={event => setTransferReference(event.target.value)} dir="ltr" className="min-h-11 rounded-lg border bg-white px-2" />
            </label>
            <label className="grid gap-1 text-xs font-bold">{ar ? 'المبلغ المستلم (ج.م.)' : 'Received amount (EGP)'}
              <input type="number" min={0} step={1} value={receivedAmount} onChange={event => setReceivedAmount(event.target.value)} className="min-h-11 rounded-lg border bg-white px-2" />
            </label>
            {ad.legacyTransfer && <label className="grid gap-1 text-xs font-bold">{ar ? 'وقت الاستلام من السجل، بتوقيت القاهرة' : 'Transfer time in the record, Cairo time'}
              <input type="datetime-local" step={1} value={receivedTime} onChange={event => setReceivedTime(event.target.value)} className="min-h-11 rounded-lg border bg-white px-2" />
            </label>}
            <label className="flex items-start gap-2 text-sm font-bold">
              <input type="checkbox" checked={paymentConfirmed} onChange={event => setPaymentConfirmed(event.target.checked)} />
              {ar ? 'طابقت البيانات مع سجل التحويلات المستلمة، وتأكدت أن التحويل لم يُستخدم في طلب سابق.' : 'I matched the incoming transfer and checked that it has not been used for an earlier order.'}
            </label>
          </div>}
          {decision.status === 'rejected' && <label className="block text-xs font-bold">{ar ? 'سبب الرفض (اختياري)' : 'Rejection reason (optional)'}
            <textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" />
          </label>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (decision.status === 'approved' && !!ad.payment && (ad.payment.amountEgp !== 0 || ad.payment.dailyPriceEgp !== 0) && (!paymentConfirmed || !ad.payment.receiptUrl || !normalizeAdTransferReference(transferReference) || !receivedAmount.trim() || (!!ad.legacyTransfer && cairoAdTransferTime(receivedTime) === null)))} onClick={() => void review()} className={`${button} ${decision.status === 'approved' ? 'bg-emerald-700' : 'bg-red-700'} text-white`}>{ar ? 'تأكيد القرار' : 'Confirm decision'}</button>
            <button type="button" disabled={busy} onClick={() => setDecision(null)} className={`${button} bg-slate-200 text-slate-800`}>{ar ? 'إلغاء' : 'Cancel'}</button>
          </div>
        </div> : <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || ad.requiresVideoCorrection} onClick={() => { setReason(''); setPaymentConfirmed(false); setTransferReference(''); setReceivedAmount(''); setReceivedTime(''); setDecision({ id: ad.id, status: 'approved' }); }} className={`${button} bg-emerald-700 text-white`}>{ar ? 'موافقة' : 'Approve'}</button>
          {!ad.legacyTransfer && <button type="button" disabled={busy} onClick={() => { setReason(''); setPaymentConfirmed(false); setTransferReference(''); setReceivedAmount(''); setReceivedTime(''); setDecision({ id: ad.id, status: 'rejected' }); }} className={`${button} bg-red-50 text-red-800`}>{ad.requiresVideoCorrection ? (ar ? 'إرجاع للتصحيح' : 'Return for correction') : (ar ? 'رفض' : 'Reject')}</button>}
        </div>)}
      </div>)}
    </div>
  </div>;
}
