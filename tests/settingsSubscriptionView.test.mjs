import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsView } from '../src/components/views/SettingsView.tsx';
import { TrialSubscriptionPages } from '../src/components/views/TrialSubscriptionPages.tsx';

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
    onUpdateSubscription: async () => {}, onLogin: noop, onLogout: noop, onOpenMobileLink: noop,
  }));
  assert.match(html, /خطة الاشتراك وفترة التجربة/);
  assert.doesNotMatch(html, /تعذر تأكيد مدة التجربة/);
  assert.doesNotMatch(html, /يرفع مدة التجربة إلى 35/);
  assert.match(html, /لا يغيّر مدة التجربة/);
});

test('a grant remains visible in settings when trial dates come from account registration', () => {
  const granted = { ...sub, grant: { plan: 'pro', startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(now + 86400000).toISOString() } };
  const html = renderToStaticMarkup(React.createElement(SettingsView, {
    lang: 'ar', onSetLanguage: noop, user: null, subscription: granted,
    onUpdateSubscription: async () => {}, onLogin: noop, onLogout: noop, onOpenMobileLink: noop,
  }));
  assert.match(html, /منحة Pro مجانية/);
});

test('a real subscription read error shows a helpful retry instead of stale details', () => {
  const html = renderToStaticMarkup(React.createElement(SettingsView, {
    lang: 'ar', onSetLanguage: noop, user: null, subscription: sub, subscriptionUnavailable: true,
    onRetrySubscription: noop, onUpdateSubscription: async () => {}, onLogin: noop, onLogout: noop, onOpenMobileLink: noop,
  }));
  assert.match(html, /تعذر تحميل حالة اشتراكك/);
  assert.match(html, /إعادة المحاولة/);
  assert.doesNotMatch(html, /خطة الاشتراك وفترة التجربة/);
});

test('trial detail page omits technical record-source language', () => {
  const html = renderToStaticMarkup(React.createElement(TrialSubscriptionPages, {
    lang: 'ar', subscription: sub, error: null, page: 'trial-details', onBack: noop, onSubscription: noop,
  }));
  assert.match(html, /تاريخ تسجيلك/);
  assert.doesNotMatch(html, /لعدم وجود تاريخ تجربة منفصل/);
});
