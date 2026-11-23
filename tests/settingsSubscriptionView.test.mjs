import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
test.after(() => vite.close());
const { SettingsView } = await vite.ssrLoadModule('/src/components/views/SettingsView.tsx');
const { TrialSubscriptionPages } = await vite.ssrLoadModule('/src/components/views/TrialSubscriptionPages.tsx');
const { requestSubscription, resolveSubscriptionRecords } = await vite.ssrLoadModule('/src/services/subscriptionClient.ts');

const now = Date.now();
const sub = {
  tier: 'trial', trialDatesStored: false, hasAppliedAffiliateCode: false,
  totalTrialDays: 75, trialStartedAt: new Date(now - 86400000).toISOString(),
  trialExpiresAt: new Date(now + 74 * 86400000).toISOString(), isPaid: false,
  dailyExpenseAiLimit: 15, dailyInquiryAiLimit: 5, maxHistoricalQueryDays: 35,
};
const noop = () => {};

test('settings shows the subscription for a valid account-derived trial without a technical warning', () => {
  const html = renderToStaticMarkup(React.createElement(SettingsView, {
    lang: 'ar', onSetLanguage: noop, user: null, subscription: sub,
    onApplyMarketerCode: async () => {}, onLogin: noop, onLogout: noop, onOpenMobileLink: noop,
  }));
  assert.match(html, /خطة الاشتراك وفترة التجربة/);
  assert.doesNotMatch(html, /تعذر تأكيد مدة التجربة/);
  assert.doesNotMatch(html, /يرفع مدة التجربة إلى 35/);
  assert.doesNotMatch(html, /هل حصلت على كود مسوّق لاحقاً/);
  assert.doesNotMatch(html, /تحديث الاستخدام/);
});

test('a grant remains visible in settings when trial dates come from account registration', () => {
  const granted = { ...sub, grant: { plan: 'pro', startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(now + 86400000).toISOString() } };
  const html = renderToStaticMarkup(React.createElement(SettingsView, {
    lang: 'ar', onSetLanguage: noop, user: null, subscription: granted,
    onApplyMarketerCode: async () => {}, onLogin: noop, onLogout: noop, onOpenMobileLink: noop,
  }));
  assert.match(html, /منحة Pro مجانية/);
});

test('a real subscription read error shows a helpful retry instead of stale details', () => {
  const html = renderToStaticMarkup(React.createElement(SettingsView, {
    lang: 'ar', onSetLanguage: noop, user: null, subscription: sub, subscriptionUnavailable: true,
    onRetrySubscription: noop, onApplyMarketerCode: async () => {}, onLogin: noop, onLogout: noop, onOpenMobileLink: noop,
  }));
  assert.match(html, /تعذر تحميل حالة اشتراكك/);
  assert.match(html, /إعادة المحاولة/);
  assert.doesNotMatch(html, /خطة الاشتراك وفترة التجربة/);
});

test('trial detail page omits technical record-source language', t => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: '' } };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const html = renderToStaticMarkup(React.createElement(TrialSubscriptionPages, {
    lang: 'ar', subscription: sub, error: null, page: 'trial-details', onBack: noop, onSubscription: noop,
  }));
  assert.match(html, /تاريخ تسجيلك/);
  assert.doesNotMatch(html, /لعدم وجود تاريخ تجربة منفصل/);
});

test('settings offers a server-verified marketer discount without promising more trial days', () => {
  const html = renderToStaticMarkup(React.createElement(SettingsView, {
    lang: 'ar', onSetLanguage: noop, user: null, subscription: sub,
    onApplyMarketerCode: async () => {}, onLogin: noop, onLogout: noop, onOpenMobileLink: noop,
  }));
  assert.match(html, /تفعيل الخصم/);
  assert.doesNotMatch(html, /يرفع مدة التجربة/);
});

test('legacy trial dates are recomputed and only a confirmed billing code is shown', () => {
  const user = { metadata: { creationTime: sub.trialStartedAt } };
  const legacy = { updatedSubscription: { ...sub, affiliateCode: 'PROTOTYPE', hasAppliedAffiliateCode: true } };
  const normalized = resolveSubscriptionRecords(user, legacy);
  assert.equal(normalized.trialExpiresAt, sub.trialExpiresAt);
  assert.equal(normalized.hasAppliedAffiliateCode, false);
  assert.equal(normalized.affiliateCode, null);
  assert.equal(resolveSubscriptionRecords(user, { ...legacy, affiliateCode: 'SERVER', hasAppliedAffiliateCode: true }).affiliateCode, 'SERVER');
});

test('marketer redemption sends the code to the authenticated gateway', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/gateway');
    assert.equal(options.headers.Authorization, 'Bearer local-test-token');
    assert.deepEqual(JSON.parse(options.body), {
      action: 'subscription.applyAffiliate', payload: { code: 'SERVER' },
    });
    return Response.json({ ok: true, data: { subscription: { affiliateCode: 'SERVER' } } });
  });
  const result = await requestSubscription('subscription.applyAffiliate', { code: 'SERVER' }, {
    getIdToken: async () => 'local-test-token',
  });
  assert.equal(result.affiliateCode, 'SERVER');
});
