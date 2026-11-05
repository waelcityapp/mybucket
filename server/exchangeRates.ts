import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../src/types.js';
import { SubscriptionError } from './subscriptionService.js';

const DAILY_CHANGE_LIMIT = 10;
const ALL = new Set<string>(SUPPORTED_CURRENCIES);
const DEFAULT_FROM: CurrencyCode = 'EGP';
const DEFAULT_TO: CurrencyCode = 'USD';

type RateRecord = { day: string; updatedAt: string; base: 'EUR'; rates: Record<string, number>; providerDate: string };
type ChoiceRecord = { day?: string; count?: number; from?: string; to?: string };
const db = () => getAdminFirestore();
const ratesRef = () => db().collection('systemConfigs').doc('dailyExchangeRates');
const choicesRef = (uid: string) => db().collection('users').doc(uid).collection('features').doc('exchangeRates');
const dateInCairo = () => {
  const fields = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const part = (name: string) => fields.find(item => item.type === name)?.value || '';
  return part('year') + '-' + part('month') + '-' + part('day');
};
const safePair = (from: unknown, to: unknown) => {
  if (typeof from !== 'string' || typeof to !== 'string' || !ALL.has(from) || !ALL.has(to)) {
    throw new SubscriptionError(400, 'invalid_currency_pair', 'Choose supported currencies.');
  }
  return { from, to };
};
async function latestRates(): Promise<RateRecord> {
  const today = dateInCairo();
  const ref = ratesRef();
  const snapshot = await ref.get();
  const existing = snapshot.data() as RateRecord | undefined;
  if (existing?.day === today && existing?.rates?.EUR === 1 && existing.rates.USD > 0 && existing.rates.EGP > 0) return existing;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    let response: Response;
    try {
      response = await fetch('https://api.frankfurter.dev/v2/rates?base=EUR', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error('rate_provider_http_' + response.status);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('rate_provider_format');
    const rates: Record<string, number> = { EUR: 1 };
    let providerDate = '';
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { base?: string; quote?: string; rate?: number; date?: string };
      if (row.base !== 'EUR' || !row.quote || !ALL.has(row.quote) || typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate <= 0) continue;
      rates[row.quote] = row.rate;
      if (typeof row.date === 'string' && (!providerDate || row.date > providerDate)) providerDate = row.date;
    }
    if (!rates.EGP || !rates.USD) throw new Error('essential_rates_missing');
    const updated: RateRecord = { day: today, updatedAt: new Date().toISOString(), base: 'EUR', rates, providerDate };
    await ref.set({ ...updated, savedAt: FieldValue.serverTimestamp() });
    return updated;
  } catch (error) {
    console.error('[fx] reference rate fetch failed', error instanceof Error ? error.message : 'unknown');
    if (existing?.rates?.EUR === 1 && existing.rates.USD > 0 && existing.rates.EGP > 0) return existing;
    throw new SubscriptionError(503, 'exchange_rates_unavailable', 'Exchange rates are temporarily unavailable.');
  }
}
function display(data: ChoiceRecord | undefined, rates: RateRecord) {
  const day = dateInCairo();
  const count = data?.day === day ? Math.min(DAILY_CHANGE_LIMIT, Math.max(0, Number(data.count) || 0)) : 0;
  const from = data?.from && ALL.has(data.from) ? data.from : DEFAULT_FROM;
  const to = data?.to && ALL.has(data.to) ? data.to : DEFAULT_TO;
  const a = rates.rates[from];
  const b = rates.rates[to];
  return {
    from, to, count, remaining: Math.max(0, DAILY_CHANGE_LIMIT - count), limit: DAILY_CHANGE_LIMIT,
    rate: from === to ? 1 : a > 0 && b > 0 ? b / a : null,
    rateDate: rates.providerDate, fetchedAt: rates.updatedAt, stale: rates.day !== day,
    source: 'Frankfurter', availableCurrencies: SUPPORTED_CURRENCIES.filter(code => Boolean(rates.rates[code])),
  };
}
export async function getExchangeRateWidget(uid: string) {
  const [rates, selection] = await Promise.all([latestRates(), choicesRef(uid).get()]);
  return display(selection.data() as ChoiceRecord | undefined, rates);
}
export async function changeExchangeRateWidget(uid: string, payload: { from?: unknown; to?: unknown }) {
  const next = safePair(payload?.from, payload?.to);
  const rates = await latestRates();
  if (!rates.rates[next.from] || !rates.rates[next.to]) {
    throw new SubscriptionError(422, 'currency_rate_unavailable', 'No official reference rate is currently available for this pair.');
  }
  const today = dateInCairo();
  const record = await db().runTransaction(async tx => {
    const ref = choicesRef(uid);
    const saved = await tx.get(ref);
    const old = saved.data() as ChoiceRecord | undefined;
    const before = display(old, rates);
    if (before.from === next.from && before.to === next.to) return old;
    if (before.remaining <= 0) throw new SubscriptionError(429, 'exchange_daily_limit', 'Daily currency selection limit reached.');
    const updated = { day: today, count: before.count + 1, from: next.from, to: next.to, updatedAt: FieldValue.serverTimestamp() };
    tx.set(ref, updated);
    return { day: today, count: before.count + 1, from: next.from, to: next.to };
  });
  return display(record, rates);
}
