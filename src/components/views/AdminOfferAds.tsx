import { cairoAdTransferTime, normalizeAdTransferReference, isPaidAdPrice, MAX_AD_DAILY_PRICE_EGP, type PaidAdPrices } from '../../utils/adCheckout';
import { useEffect, useState } from 'react';
import { type OfferCategorySettings, type FreeOfferPolicy, type OfferAdEditReview, type OfferAdStatus, type ReviewOfferAd, type VipPushCampaign } from '../../data/offerAds';
import { useOfferCategories } from '../../services/offerCategoriesClient';
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

function AdEditRequests({ lang, categories }: { lang: Language; categories: OfferCategorySettings[] | null }) {
  const ar = lang === 'ar';
  const [requests, setRequests] = useState<OfferAdEditReview[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [decision, setDecision] = useState<{ requestId: string; status: 'approved' | 'rejected' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => {
    let active = true;
    setLoadError(false);
    offerAdsRequest<OfferAdEditReview[]>('admin.ads.editRequests.list', {}, true)
      .then(result => { if (active) setRequests(result); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [refresh]);

  const review = async (request: OfferAdEditReview) => {
    if (!decision || decision.requestId !== request.requestId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await offerAdsRequest('admin.ads.editRequests.review', { id: request.original.id, ...decision, reason }, true);
      setRequests(items => items?.filter(item => item.requestId !== request.requestId) ?? []);
      setDecision(null);
      setMessage({ error: false, text: decision.status === 'approved'
        ? (ar ? 'تم قبول التعديل وتحديث الإعلان المنشور.' : 'Edit approved and applied to the published ad.')
        : (ar ? 'تم رفض التعديل. النسخة المنشورة كما هي.' : 'Edit rejected. The published version is unchanged.') });
    } catch (error) {
      if (error instanceof Error && error.message === 'ad_edit_request_unavailable') {
        setDecision(null);
        setRefresh(value => value + 1);
        setMessage({ error: true, text: ar ? 'طلب التعديل لم يعد متاحًا للمراجعة.' : 'This edit request is no longer available.' });
      } else {
        setMessage({ error: true, text: ar ? 'تعذّر حفظ القرار. حاول تاني.' : 'Could not save the decision. Try again.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const control = 'min-h-11 rounded-xl px-3 text-sm font-bold disabled:opacity-50';
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-extrabold">{ar ? 'طلبات تعديل الإعلانات' : 'Ad edit requests'}{requests && ` · ${requests.length.toLocaleString(ar ? 'ar-EG' : 'en')}`}</h2>
      <button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}
        className={`${control} text-emerald-800 underline dark:text-emerald-300`}>{ar ? 'تحديث' : 'Refresh'}</button>
    </div>
    {loadError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{ar ? 'تعذّر تحميل طلبات التعديل.' : 'Could not load edit requests.'}</p>}
    {!loadError && !requests && <p role="status" className="text-sm">{ar ? 'جاري تحميل الطلبات...' : 'Loading requests…'}</p>}
    {!loadError && requests?.length === 0 && <p className="text-sm">{ar ? 'مفيش طلبات تعديل قيد المراجعة.' : 'No edit requests awaiting review.'}</p>}
    {message && <p role={message.error ? 'alert' : 'status'} className={message.error ? 'text-sm text-rose-700 dark:text-rose-300' : 'text-sm'}>{message.text}</p>}
    {requests?.map(request => <article key={request.requestId} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs font-bold">{request.original.tier === 'vip' ? 'VIP' : request.original.tier === 'featured'
        ? (ar ? 'مميز' : 'Featured') : (ar ? 'مجاني' : 'Free')} · {new Date(request.submittedAt).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' })}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {[request.original, request.proposed].map((ad, index) => {
          const category = categories?.find(item => item.id === ad.categorySlug);
          return <div key={index} className="min-w-0 space-y-2">
            <h3 className="text-sm font-bold">{index === 0 ? (ar ? 'النسخة المنشورة' : 'Published version') : (ar ? 'التعديل المقترح' : 'Proposed changes')}</h3>
            <div className="text-slate-900">
              <AdCreativeCard lang={lang} title={ad.title} description={ad.description} merchant={ad.merchant} contact={ad.contact}
                mediaUrl={ad.media?.url} mediaType={ad.media?.type} poster={ad.media?.poster} />
            </div>
            <dl className="space-y-1 text-xs">
              <div><dt className="inline font-bold">{ar ? 'القسم' : 'Category'} </dt><dd className="inline">{category ? (ar ? category.ar : category.en) : ad.categorySlug}</dd></div>
              {[[ar ? 'الاتصال' : 'Phone', ad.callPhone], ['WhatsApp', ad.whatsappPhone], ['Google Maps', ad.mapsUrl]].map(([label, value]) =>
                value && <div key={label}><dt className="inline font-bold">{label} </dt><dd className="inline break-all"><bdi>{value}</bdi></dd></div>)}
            </dl>
          </div>;
        })}
      </div>
      {decision?.requestId === request.requestId ? <div className="space-y-2">
        {decision.status === 'rejected' && <label className="grid gap-1 text-xs font-bold">
          {ar ? 'سبب الرفض (اختياري)' : 'Rejection reason (optional)'}
          <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2}
            className="rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800" />
        </label>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || loadError} onClick={() => void review(request)}
            className={`${control} ${decision.status === 'approved' ? 'bg-emerald-700' : 'bg-rose-700'} text-white`}>
            {decision.status === 'approved' ? (ar ? 'تأكيد ونشر التعديل' : 'Confirm and publish edit') : (ar ? 'تأكيد الرفض' : 'Confirm rejection')}
          </button>
          <button type="button" disabled={busy} onClick={() => setDecision(null)} className={control}>{ar ? 'إلغاء' : 'Cancel'}</button>
        </div>
      </div> : <div className="flex flex-wrap gap-2">
        {(['approved', 'rejected'] as const).map(status => <button type="button" key={status} disabled={busy || loadError}
          onClick={() => { setReason(''); setDecision({ requestId: request.requestId, status }); }}
          className={`${control} ${status === 'approved' ? 'bg-emerald-700 text-white' : 'text-rose-700 dark:text-rose-300'}`}>
          {status === 'approved' ? (ar ? 'قبول التعديل' : 'Approve edit') : (ar ? 'رفض التعديل' : 'Reject edit')}
        </button>)}
      </div>}
    </article>)}
  </section>;
}

function AdCategoriesSettings({ lang, catalog }: { lang: Language; catalog: ReturnType<typeof useOfferCategories> }) {
  const ar = lang === 'ar';
  const { categories, setCategories, categoryError, reloadCategories } = catalog;
  const [selectedId, setSelectedId] = useState('');
  const selected = categories?.find(item => item.id === selectedId);
  const [names, setNames] = useState({ ar: '', en: '' });
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  const select = (id: string) => {
    const item = categories?.find(category => category.id === id);
    setSelectedId(id);
    setNames({ ar: item?.ar ?? '', en: item?.en ?? '' });
    setConfirmArchive(false);
    setFeedback(null);
  };

  const save = async (operation: 'add' | 'rename' | 'archive' | 'restore') => {
    setBusy(true);
    setFeedback(null);
    try {
      const items = await offerAdsRequest<OfferCategorySettings[]>('admin.ads.categories.manage', { operation, id: selectedId, ...names }, true);
      setCategories(items);
      if (operation === 'add') {
        setSelectedId(items.at(-1)?.id ?? '');
        setNames({ ar: names.ar.trim(), en: names.en.trim() });
      }
      setConfirmArchive(false);
      setFeedback({ error: false, text: ar ? 'تم حفظ القسم.' : 'Category saved.' });
    } catch (error) {
      const limitReached = error instanceof Error && error.message === 'ad_category_limit';
      setFeedback({ error: true, text: limitReached
        ? (ar ? 'وصلت للحد الأقصى لعدد الأقسام.' : 'The category limit has been reached.')
        : (ar ? 'تعذّر حفظ القسم. حاول تاني.' : 'Could not save the category. Try again.') });
    } finally { setBusy(false); }
  };

  const field = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800';
  const button = 'min-h-11 rounded-xl px-3 text-sm font-bold disabled:opacity-50';
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <h2 className="font-extrabold">{ar ? 'أقسام الإعلانات' : 'Ad categories'}</h2>
    {categoryError ? <button type="button" onClick={reloadCategories} className="text-sm font-bold underline">{ar ? 'تعذّر تحميل الأقسام. حاول تاني' : 'Could not load categories. Retry'}</button>
      : !categories ? <p role="status" className="text-sm">{ar ? 'جاري تحميل الأقسام…' : 'Loading categories…'}</p>
      : <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(selectedId ? 'rename' : 'add'); }}>
        <label className="grid gap-1 text-sm font-bold">
          {ar ? 'القسم' : 'Category'}
          <select className={field} value={selectedId} disabled={busy} onChange={event => select(event.target.value)}>
            <option value="">{ar ? 'إضافة قسم جديد' : 'Add a category'}</option>
            {categories.slice().sort((a, b) => a[lang].localeCompare(b[lang], lang)).map(item =>
              <option key={item.id} value={item.id}>{item[lang]}{item.archived ? (ar ? ' (ملغى)' : ' (archived)') : ''}</option>)}
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['ar', 'en'] as const).map(language => <label key={language} className="grid gap-1 text-sm font-bold">
            {language === 'ar' ? (ar ? 'الاسم بالعربي' : 'Arabic name') : (ar ? 'الاسم بالإنجليزي' : 'English name')}
            <input className={field} dir={language === 'ar' ? 'rtl' : 'ltr'} value={names[language]} disabled={busy}
              required maxLength={80} onChange={event => setNames(previous => ({ ...previous, [language]: event.target.value }))} />
          </label>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !names.ar.trim() || !names.en.trim()} className={`${button} bg-emerald-700 text-white`}>
            {selectedId ? (ar ? 'حفظ الاسم' : 'Save names') : (ar ? 'إضافة القسم' : 'Add category')}
          </button>
          {selected && !confirmArchive && <button type="button" disabled={busy} className={`${button} border border-slate-300 dark:border-slate-600`}
            onClick={() => selected.archived ? void save('restore') : setConfirmArchive(true)}>
            {selected.archived ? (ar ? 'استعادة القسم' : 'Restore category') : (ar ? 'إلغاء القسم' : 'Archive category')}
          </button>}
        </div>
        {confirmArchive && <div className="space-y-2 text-sm">
          <p>{ar ? 'القسم مش هيظهر عند إنشاء إعلان جديد. الإعلانات المنشورة فيه هتفضل ظاهرة لحد انتهاء مدتها.' : 'New ads cannot use this category. Published ads stay visible until they expire.'}</p>
          <button type="button" disabled={busy} className={`${button} bg-red-700 text-white`} onClick={() => void save('archive')}>{ar ? 'تأكيد إلغاء القسم' : 'Confirm archive'}</button>
          <button type="button" disabled={busy} className={button} onClick={() => setConfirmArchive(false)}>{ar ? 'تراجع' : 'Cancel'}</button>
        </div>}
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className="text-sm">{feedback.text}</p>}
      </form>}
  </section>;
}

export function AdminOfferAds({ lang }: { lang: Language }) {
  const catalog = useOfferCategories();
  const ar = lang === 'ar';
  const campaignLabels: Record<VipPushCampaign['status'], string> = {
    queued: ar ? 'بانتظار بدء الإرسال' : 'Waiting to send',
    sending: ar ? 'جارٍ الإرسال' : 'Sending',
    completed: ar ? 'اكتملت المعالجة' : 'Processing complete',
    completed_with_failures: ar ? 'اكتملت المعالجة مع فشل بعض الإشعارات' : 'Processing complete with delivery failures',
    stopped: ar ? 'توقفت الحملة قبل اكتمال المعالجة' : 'Campaign stopped before processing finished',
  };
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
  const [vipPublishNow, setVipPublishNow] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [transferReference, setTransferReference] = useState('');
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
    const ad = ads?.find(item => item.id === decision.id);
    try {
      await offerAdsRequest('admin.ads.review', { ...decision, reason, publishVipNow: vipPublishNow,
        // Old exceptional transfers still require matching. Regular ads are manually approved by admin.
        ...(ad?.legacyTransfer ? {
          paymentConfirmed, transferReference,
          receivedAmountEgp: paymentConfirmed ? ad.payment?.amountEgp ?? null : null,
          receivedAt: cairoAdTransferTime(receivedTime),
        } : {}),
      }, true);
      setAds(items => items?.filter(item => item.id !== decision.id) ?? null);
      const notice = decision.status === 'approved'
        ? (ad?.payment
          ? (ar ? (ad?.tier === 'vip' ? 'تمت الموافقة ونشر إعلان VIP فورًا.' : 'تمت الموافقة على نشر الإعلان.') : (ad?.tier === 'vip' ? 'VIP ad approved and published immediately.' : 'Ad approved for publication.'))
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
          ad_vip_immediate_confirmation_required: ar ? 'أكّد النشر الفوري للطلب اللي له موعد مستقبلي.' : 'Confirm immediate publication for this previously scheduled request.',
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
    <AdCategoriesSettings lang={lang} catalog={catalog} />
    <AdEditRequests lang={lang} categories={catalog.categories} />
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold">{ar ? 'متابعة رفع ملفات الإعلانات' : 'Ad upload activity'}</h2>
        <button type="button" disabled={statsBusy} onClick={() => setRefresh(value => value + 1)}
          className={`${button} text-emerald-800 underline dark:text-emerald-300`}>{ar ? 'تحديث الأرقام' : 'Refresh totals'}</button>
      </div>
      {statsError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{ar ? 'تعذّر تحديث بيانات الرفع. اضغط «تحديث الأرقام» للمحاولة تاني.' : 'Could not refresh upload data. Select Refresh totals to retry.'}</p>}
      {!statsError && !uploadStats && <p role="status" className="text-sm">{ar ? 'جاري تحميل بيانات الرفع...' : 'Loading upload activity…'}</p>}
      {uploadStats && <>
        <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'الأرقام تخص الملفات اللي اتفتح لها إذن رفع النهارده بتوقيت القاهرة، بما فيها إيصالات الدفع.' : 'Counts include ad files and payment receipts authorized for upload today in Cairo time.'}</p>
        {uploadStats.issued === 0 && !statsError && <p className="text-sm font-semibold">{ar ? 'لسه مفيش ملفات اتفتح لها إذن رفع النهارده.' : 'No uploads have been authorized today.'}</p>}
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {[
            [ar ? 'ملفات سُمح برفعها' : 'Files authorized for upload', uploadStats.issued],
            [ar ? 'ملفات اكتمل رفعها وتأكيدها' : 'Files uploaded and verified', uploadStats.verified],
            [ar ? 'طلبات رفع ملغاة' : 'Cancelled upload requests', uploadStats.cancellations],
            [ar ? 'حسابات وصلت لحد الرفع اليومي' : 'Accounts at the daily limit', uploadStats.limitedAccounts],
            [ar ? 'حجم الملفات المؤكدة (ميجابايت)' : 'Verified files (MB)', uploadStats.bytes / 1_000_000],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
            <dt className="text-xs text-slate-600 dark:text-slate-300">{label}</dt>
            <dd className="mt-1 text-base font-extrabold tabular-nums">{new Intl.NumberFormat(ar ? 'ar-EG-u-nu-latn' : 'en-GB', { maximumFractionDigits: 2 }).format(Number(value))}</dd>
          </div>)}
        </dl>
        {!statsError && (uploadStats.issued >= 30 || (uploadStats.issued >= 10 && uploadStats.cancellations * 2 >= uploadStats.issued)) &&
          <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{ar ? 'نشاط رفع مرتفع اليوم. راجع عدد الملفات والإلغاءات.' : 'High upload activity today. Check file and cancellation totals.'}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-sm font-bold">{uploadStats.uploadsPaused
            ? (ar ? 'رفع ملفات جديدة متوقف مؤقتًا' : 'New uploads are paused')
            : (ar ? 'رفع ملفات جديدة متاح' : 'New uploads are allowed')}</p>
          <button type="button" disabled={statsBusy || statsError} onClick={() => void setUploadsPaused(!uploadStats.uploadsPaused)}
            className={`${button} ${uploadStats.uploadsPaused ? 'bg-emerald-700 text-white' : 'bg-rose-50 text-rose-800'}`}>
            {statsBusy ? (ar ? 'جاري حفظ الحالة…' : 'Saving status…')
              : uploadStats.uploadsPaused ? (ar ? 'استئناف الرفع' : 'Resume uploads') : (ar ? 'إيقاف الرفع الجديد مؤقتًا' : 'Pause new uploads')}
          </button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'الإيقاف يمنع فتح أذونات رفع جديدة. الإعلانات المنشورة تفضل ظاهرة.' : 'Pausing blocks new upload permissions. Published ads remain visible.'}</p>
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
          {(status === 'approved' || (ad.payment && !ad.vipDurationDays)) && <div><dt className="inline font-bold">{ar ? 'مدة النشر بتوقيت القاهرة' : 'Publication window, Cairo time'} </dt><dd className="inline">{date(ad.startsAt)} — {date(ad.endsAt)}</dd></div>}
          {ad.vipDurationDays && status === 'pending' && <div>
            <dt className="inline font-bold">{ar ? 'عدد أيام النشر المطلوبة' : 'Requested publication days'} </dt>
            <dd className="inline">{ad.vipDurationDays} {ar ? (ad.vipDurationDays === 1 ? 'يوم' : 'أيام') : 'days'}</dd>
          </div>}
          {ad.formerVipSchedule && <div>
            <dt className="inline font-bold">{ar ? 'الموعد الأصلي قبل الموافقة' : 'Original schedule before approval'} </dt>
            <dd className="inline">{date(ad.formerVipSchedule.startsAt)} — {date(ad.formerVipSchedule.endsAt)}</dd>
          </div>}
          {!ad.payment && status === 'pending' && <div>
            <dt className="inline font-bold">{ar ? 'بداية النشر' : 'Publication start'} </dt>
            <dd className="inline">{ar ? 'فور الموافقة' : 'Immediately upon approval'}</dd>
          </div>}
        </dl>
        {status === 'approved' && ad.tier === 'vip' && <section className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <h3 className="font-extrabold">{ar ? 'حملة إشعارات VIP' : 'VIP notification campaign'}</h3>
          {ad.vipPushCampaign ? <>
            <p className="font-semibold">{campaignLabels[ad.vipPushCampaign.status]}</p>
            <p>{ar ? 'سجلات الأجهزة التي تمت مراجعتها' : 'Device registrations checked'} · {ad.vipPushCampaign.scannedCount.toLocaleString(ar ? 'ar-EG' : 'en')}</p>
            <p>{ar ? 'فشل الإرسال بعد المحاولات' : 'Failed after retries'} · {ad.vipPushCampaign.failedCount.toLocaleString(ar ? 'ar-EG' : 'en')}</p>
          </> : <p>{ar ? 'لا يوجد سجل حملة لهذا الإعلان.' : 'No campaign is recorded for this ad.'}</p>}
        </section>}
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
            ? (ad.payment && ad.tier !== 'vip'
              ? (ar ? 'تأكيد الموافقة على نشر الإعلان في المدة المحددة؟' : 'Confirm approval for the selected publication window?')
              : (ar ? 'تأكيد الموافقة والنشر الفوري؟' : 'Approve and publish now?'))
            : (ad.requiresVideoCorrection ? (ar ? 'تأكيد إرجاع الإعلان للتصحيح؟' : 'Return the ad for correction?') : (ar ? 'تأكيد رفض الإعلان؟' : 'Confirm rejection?'))}</p>
          {decision.status === 'approved' && ad.tier === 'vip' && !ad.vipDurationDays && ad.startsAt > Date.now() && <label className="flex items-start gap-2 rounded-lg bg-amber-100 p-2 text-sm font-bold">
            <input type="checkbox" checked={vipPublishNow} onChange={event => setVipPublishNow(event.target.checked)} />
            {ar ? 'هذا الطلب له موعد نشر مستقبلي. أؤكد النشر الآن بنفس المدة والمبلغ، مع حفظ الموعد الأصلي.'
              : 'This request had a future start. Confirm publication now with the same duration and amount, keeping the original schedule on record.'}
          </label>}
          {decision.status === 'approved' && ad.payment && !ad.legacyTransfer && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
            {ar ? 'قرار الموافقة والنشر في إيدك. النظام لا يتحقق تلقائيًا من وصول فلوس، وتقدر توافق على إعلان تجريبي بصورة مرفقة من غير تحويل فعلي.' :
              'You decide whether to publish. No automatic bank payment check is performed, and you may approve a test ad with an uploaded image without a real transfer.'}
          </p>}
          {decision.status === 'approved' && ad.payment && !!ad.legacyTransfer && (ad.payment.amountEgp !== 0 || ad.payment.dailyPriceEgp !== 0) && <div className="space-y-2">
            <p className="text-sm font-semibold">
              {ar ? 'المبلغ المطلوب التأكد من وصوله:' : 'Amount to check in your receiving account:'}{' '}
              <span className="font-extrabold">{new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(ad.payment.amountEgp)}</span>
            </p>
            <label className="grid gap-1 text-xs font-bold">
              {ar ? 'رقم عملية التحويل المستلمة' : 'Incoming transfer transaction ID'}
              <input value={transferReference} maxLength={48} onChange={event => setTransferReference(event.target.value)}
                dir="ltr" aria-invalid={Boolean(transferReference.trim()) && !normalizeAdTransferReference(transferReference)}
                aria-describedby="admin-received-transfer-help"
                placeholder={ar ? 'من تفاصيل التحويل في حساب الاستلام' : 'From your receiving account'}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-slate-900" />
            </label>
            <p id="admin-received-transfer-help" className="text-xs leading-5 text-slate-600">
              {ar ? 'انسخ رقم العملية الحقيقي من تفاصيل المبلغ اللي استلمته، مش رقم من عندك. المطلوب 5 إلى 48 حرفًا أو رقمًا.' : 'Copy the real transaction reference from your incoming transfer. Never invent it. The reference must have 5–48 letters or digits.'}
            </p>
            {Boolean(transferReference.trim()) && !normalizeAdTransferReference(transferReference) && <p role="alert" className="text-xs font-bold text-rose-700">
              {ar ? 'رقم العملية غير صالح. اكتب الرقم الحقيقي (5 إلى 48 حرفًا أو رقمًا).' : 'Invalid reference. Use the real 5–48-character transaction ID.'}
            </p>}
            {ad.legacyTransfer && <label className="grid gap-1 text-xs font-bold">{ar ? 'وقت الاستلام من السجل، بتوقيت القاهرة' : 'Transfer time in the record, Cairo time'}
              <input type="datetime-local" step={1} value={receivedTime} onChange={event => setReceivedTime(event.target.value)} className="min-h-11 rounded-lg border bg-white px-2" />
            </label>}
            <label className="flex items-start gap-2 text-sm font-bold">
              <input type="checkbox" checked={paymentConfirmed} onChange={event => setPaymentConfirmed(event.target.checked)} />
              {ar ? 'راجعت حساب الاستلام بنفسي، وتأكدت إن المبلغ الموضح بالأعلى وصل فعلًا وإن التحويل لم يُستخدم في طلب سابق.' : 'I checked the receiving account myself, confirmed that the displayed amount arrived, and that the transaction was not used for an earlier order.'}
            </label>
          </div>}
          {decision.status === 'rejected' && <label className="block text-xs font-bold">{ar ? 'سبب الرفض (اختياري)' : 'Rejection reason (optional)'}
            <textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" />
          </label>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (decision.status === 'approved' && ad.tier === 'vip' && !ad.vipDurationDays && ad.startsAt > Date.now() && !vipPublishNow) || (decision.status === 'approved' && !!ad.legacyTransfer && !!ad.payment && (ad.payment.amountEgp !== 0 || ad.payment.dailyPriceEgp !== 0) && (!paymentConfirmed || !ad.payment.receiptUrl || !normalizeAdTransferReference(transferReference) || cairoAdTransferTime(receivedTime) === null))} onClick={() => void review()} className={`${button} ${decision.status === 'approved' ? 'bg-emerald-700' : 'bg-red-700'} text-white`}>{decision.status === 'approved' ? (ar ? 'تأكيد الموافقة والنشر' : 'Confirm and publish') : (ar ? 'تأكيد الرفض' : 'Confirm rejection')}</button>
            <button type="button" disabled={busy} onClick={() => setDecision(null)} className={`${button} bg-slate-200 text-slate-800`}>{ar ? 'إلغاء' : 'Cancel'}</button>
          </div>
          {decision.status === 'approved' && !!ad.legacyTransfer && !!ad.payment && (ad.payment.amountEgp !== 0 || ad.payment.dailyPriceEgp !== 0) &&
            (!ad.payment.receiptUrl || !normalizeAdTransferReference(transferReference) || !paymentConfirmed || cairoAdTransferTime(receivedTime) === null) &&
            <p role="status" className="text-xs font-semibold text-amber-900">
              {!ad.payment.receiptUrl
                ? (ar ? 'إيصال الدفع غير متاح، ولا يمكن الموافقة قبل مراجعته.' : 'The receipt is unavailable. Review it before approving.')
                : !normalizeAdTransferReference(transferReference)
                  ? (ar ? 'الزر متوقف لحد ما تدخل رقم العملية الحقيقي من سجل الاستلام (5 خانات على الأقل).' : 'Enter a real transaction reference from the receiving account (at least 5 characters).')
                  : ad.legacyTransfer && cairoAdTransferTime(receivedTime) === null
                    ? (ar ? 'اكتب وقت استلام التحويل كما يظهر في السجل.' : 'Enter the recorded incoming transfer time.')
                    : (ar ? 'راجع حساب الاستلام، وبعد التأكد علّم على مربع تأكيد وصول المبلغ.' : 'Verify the incoming payment, then check the confirmation box.')}
            </p>}
        </div> : <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || ad.requiresVideoCorrection} onClick={() => { setReason(''); setPaymentConfirmed(false); setVipPublishNow(false); setTransferReference(''); setReceivedTime(''); setDecision({ id: ad.id, status: 'approved' }); }} className={`${button} bg-emerald-700 text-white`}>{ar ? 'موافقة' : 'Approve'}</button>
          {!ad.legacyTransfer && <button type="button" disabled={busy} onClick={() => { setReason(''); setPaymentConfirmed(false); setVipPublishNow(false); setTransferReference(''); setReceivedTime(''); setDecision({ id: ad.id, status: 'rejected' }); }} className={`${button} bg-red-50 text-red-800`}>{ad.requiresVideoCorrection ? (ar ? 'إرجاع للتصحيح' : 'Return for correction') : (ar ? 'رفض' : 'Reject')}</button>}
        </div>)}
      </div>)}
    </div>
  </div>;
}
