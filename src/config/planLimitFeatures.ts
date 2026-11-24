import { aiDisplayText } from '../utils/aiDisplayText.js';
import type { PlanLimits } from './planLimits.js';

export const PLAN_FEATURE_IDS = ['entries', 'inquiries', 'accounts', 'categories', 'openItems', 'reminders', 'exports'] as const;
export type PlanFeatureId = typeof PLAN_FEATURE_IDS[number];
type FeatureText = { title: string; detail: string };
export type PlanFeatureCopy = Partial<Record<PlanFeatureId, { ar: FeatureText; en: FeatureText; order: number }>>;

export function parsePlanFeatureCopy(value: unknown): PlanFeatureCopy | null {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const copy: PlanFeatureCopy = {};
  for (const id of PLAN_FEATURE_IDS) {
    const item = (value as PlanFeatureCopy)[id];
    if (item === undefined) continue;
    if (!item || !Number.isInteger(item.order) || item.order < 1 || item.order > PLAN_FEATURE_IDS.length) return null;
    const { ar, en, order } = item;
    for (const text of [ar, en]) {
      if (!text || typeof text.title !== 'string' || text.title.length > 80 ||
          typeof text.detail !== 'string' || text.detail.length > 240) return null;
    }
    copy[id] = { ar: { title: ar.title.trim(), detail: ar.detail.trim() }, en: { title: en.title.trim(), detail: en.detail.trim() }, order };
  }
  return copy;
}

export function planLimitFeatures(lang: 'ar' | 'en', limits: PlanLimits, copy: PlanFeatureCopy = {}) {
  const ar = lang === 'ar';
  const format = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format;
  const features = [
    {
      id: 'entries',
      label: ar ? 'تسجيل العمليات' : 'Recording transactions',
      basic: ar ? `${format(limits.basicEntries)} عملية يوميًا إجمالًا، بالصوت أو يدويًا` : `${format(limits.basicEntries)} transactions a day in total, by voice or manually`,
      pro: ar ? `${format(limits.proAiEntries)} محاولة تحليل عمليات بالذكاء الاصطناعي يوميًا، ثم ${format(limits.proAdditionalEntries)} إضافية بالصوت أو يدويًا` : `${format(limits.proAiEntries)} AI transaction analysis attempts a day, then ${format(limits.proAdditionalEntries)} more by voice or manually`,
    },
    {
      id: 'inquiries',
      label: ar ? 'الاستعلام عن فلوسك' : 'Financial queries',
      basic: ar ? `${format(limits.basicInquiries)} يوميًا، بالصوت أو الكتابة` : `${format(limits.basicInquiries)} a day, by voice or text`,
      pro: ar ? `${format(limits.proInquiries)} يوميًا، بالصوت أو الكتابة` : `${format(limits.proInquiries)} a day, by voice or text`,
    },
    {
      id: 'accounts',
      label: ar ? 'الحسابات' : 'Accounts',
      basic: ar ? `${format(limits.basicAccounts)} حسابات قابلة للتعديل` : `${format(limits.basicAccounts)} editable accounts`,
      pro: ar ? `حتى ${format(limits.proAccounts)} حسابات إجمالًا، مع دعم الفيزا وبطاقة الائتمان` : `Up to ${format(limits.proAccounts)} accounts total, including debit and credit cards`,
    },
    {
      id: 'categories',
      label: ar ? 'بنود الصرف' : 'Expense categories',
      basic: ar ? `${format(limits.basicCategories)} بنود تقدر تعدّل أسماءها` : `${format(limits.basicCategories)} categories you can rename`,
      pro: ar ? `حتى ${format(limits.proCategories)} بندًا إجمالًا، مع الإضافة وتعديل الأسماء` : `Up to ${format(limits.proCategories)} total, with the option to add and rename categories`,
    },
    {
      id: 'openItems',
      label: ar ? 'مستحقاتي والتزاماتي' : 'Receivables and obligations',
      basic: ar ? `عدد البنود المفتوحة لكل قسم: ${format(limits.basicOpenItems)}` : `Open items per section: ${format(limits.basicOpenItems)}`,
      pro: ar ? `عدد البنود المفتوحة لكل قسم: ${format(limits.proOpenItems)}` : `Open items per section: ${format(limits.proOpenItems)}`,
    },
    {
      id: 'reminders',
      label: ar ? 'التذكيرات' : 'Reminders',
      basic: ar ? `عدد التذكيرات النشطة إجمالًا: ${format(limits.basicReminders)}` : `Active reminders total: ${format(limits.basicReminders)}`,
      pro: ar ? `عدد التذكيرات النشطة إجمالًا: ${format(limits.proReminders)}` : `Active reminders total: ${format(limits.proReminders)}`,
    },
    {
      id: 'exports',
      label: ar ? 'تصدير البيانات' : 'Data export',
      basic: ar ? 'غير متاح' : 'Unavailable',
      pro: limits.proExports === 0
        ? (ar ? 'غير متاح' : 'Unavailable')
        : (ar ? `${format(limits.proExports)} عمليات تصدير يوميًا إجمالًا لكل الصيغ` : `${format(limits.proExports)} exports a day across all formats`),
    },
  ] satisfies Array<{ id: PlanFeatureId; label: string; basic: string; pro: string }>;
  return features
    .map((feature, index) => ({
      ...feature,
      label: aiDisplayText(copy[feature.id]?.[lang].title || feature.label, lang),
      detail: aiDisplayText(copy[feature.id]?.[lang].detail || '', lang),
      order: copy[feature.id]?.order ?? index + 1,
    }))
    .sort((a, b) => a.order - b.order);
}
