import { waitUntil } from '@vercel/functions';
import type { Request } from 'express';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: {
    action?: unknown;
    payload?: Record<string, unknown>;
  };
};

type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader?(name: string, value: string): void;
  send?(body: string | Buffer): void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const code = req.query?.offerShare;
    const id = typeof code === 'string' && req.query?.compact === '1'
      ? (await import('../src/utils/offerShare.js')).expandOfferId(code)
      : code;
    if (typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id) && res.setHeader && res.send) {
      const { renderOfferShare, offerShareOrigin } = await import('../server/offerShare.js');
      const image = req.query?.format === 'image';
      try {
        const { body, cacheControl } = await renderOfferShare(id, typeof req.query?.lang === 'string' ? req.query.lang : 'ar',
          offerShareOrigin(typeof req.headers.host === 'string' ? req.headers.host : undefined), image);
        res.setHeader('Content-Type', image ? 'image/jpeg' : 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', cacheControl);
        res.setHeader('X-Robots-Tag', 'noindex');
        res.status(body === null ? 404 : 200);
        return res.send(body ?? '');
      } catch {
        return res.status(503).json({ ok: false, error: 'offer_preview_unavailable' });
      }
    }
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ ok: false });
    try {
      const { purgeExpiredOffers } = await import('../server/offerAds.js');
      const result = await purgeExpiredOffers();
      return res.status(result.failed ? 503 : 200).json(result);
    } catch (error) {
      console.error('Advertisement cleanup failed:', error);
      return res.status(500).json({ ok: false });
    }
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed', message: 'Use POST for gateway operations.' });
  }

  try {
    const { applyAffiliateCode, getOrCreateSubscription, verifyAuthenticatedUser } = await import('../server/subscriptionService.js');
    const authorizationHeader = req.headers.authorization;
    const authorization = Array.isArray(authorizationHeader)
      ? authorizationHeader[0] || ''
      : authorizationHeader || '';
    // Public read-only branding is safe before Google sign-in and uses the existing gateway.
    if (req.body?.action === 'siteVisits.record') {
      const { recordSiteVisit } = await import('../server/siteVisits.js');
      const data = await recordSiteVisit(req.headers.origin, req.headers.host, req.body.payload?.browserId);
      return res.status(200).json({ ok: true, data });
    }

    if (req.body?.action === 'app.identity.get') {
      const { getAppIdentity } = await import('../server/appIdentity.js');
      return res.status(200).json({ ok: true, data: await getAppIdentity() });
    }
    if (req.body?.action === 'subscription.publicPlanLimits') {
      const { readPublishedPlanLimits } = await import('../server/planLimits.js');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, data: await readPublishedPlanLimits() });
    }
    if (req.body?.action === 'subscription.publicBasicTrial') {
      const { readTrialSettings } = await import('../server/trialSettings.js');
      const { basicDays } = await readTrialSettings();
      return res.status(200).json({ ok: true, data: { basicDays } });
    }
    if (req.body?.action === 'ads.demoEngagement') {
      const { readDemoOfferEngagement } = await import('../server/offerAds.js');
      return res.status(200).json({ ok: true, data: await readDemoOfferEngagement() });
    }
    if (req.body?.action === 'ads.view') {
      const { recordOfferCardView } = await import('../server/offerAds.js');
      await recordOfferCardView(req.body.payload || {});
      return res.status(200).json({ ok: true });
    }
    if (req.body?.action === 'ads.list' || req.body?.action === 'ads.detail') {
      const { readPublicOfferAds } = await import('../server/offerAds.js');
      return res.status(200).json({ ok: true, data: await readPublicOfferAds(req.body.action, req.body.payload || {}) });
    }
    if (typeof req.body?.action === 'string' && req.body.action.startsWith('vipPush.')) {
      const { vipPushActions, isVipPushOrigin, vipPushAction } = await import('../server/vipPush.js');
      if (!vipPushActions.has(req.body.action)) return res.status(400).json({ ok: false, error: 'invalid_gateway_action' });
      if (!isVipPushOrigin(req.headers.origin, req.headers.host)) return res.status(403).json({ ok: false, error: 'invalid_origin' });
      res.setHeader?.('Cache-Control', 'no-store');
      const ip = typeof req.headers['x-vercel-forwarded-for'] === 'string' ? req.headers['x-vercel-forwarded-for'].split(',')[0].trim() : '';
      return res.status(200).json({ ok: true, data: await vipPushAction(req.body.action, req.body.payload || {}, ip) });
    }

    const user = await verifyAuthenticatedUser({
      header: (name: string) => name.toLowerCase() === 'authorization' ? authorization : undefined,
    } as unknown as Request);

    const action = req.body?.action;
    const payload = req.body?.payload || {};

    if (typeof action !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid_gateway_action', message: 'A valid gateway action is required.' });
    }

    if (action.startsWith('subscriptionPayment.') || action.startsWith('admin.subscriptionPayment.')) {
      const { subscriptionPayment } = await import('../server/subscriptionPayments.js');
      return res.status(200).json({ ok: true, data: await subscriptionPayment(action, user, payload) });
    }

    if (action === 'admin.identity.signUpload' || action === 'admin.identity.save') {
      if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
      const { signBrandIconUpload, saveAppIdentity } = await import('../server/appIdentity.js');
      const data = action === 'admin.identity.signUpload' ? signBrandIconUpload(payload) : await saveAppIdentity(payload, user.uid);
      return res.status(200).json({ ok: true, data });
    }

    if (action === 'admin.ads.view' || action === 'admin.ads.demoEngagement') {
      if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
      const { recordOfferCardView, readDemoOfferEngagement } = await import('../server/offerAds.js');
      const data = action === 'admin.ads.view' ? await recordOfferCardView(payload) : await readDemoOfferEngagement(true);
      return res.status(200).json({ ok: true, data });
    }
    if (action === 'admin.ads.listWithViews') {
      if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
      const { readPublishedOffers } = await import('../server/offerAds.js');
      return res.status(200).json({ ok: true, data: await readPublishedOffers(true) });
    }
    if (action === 'ads.reactions' || action === 'ads.react') {
      const { readMyOfferReactions, setOfferReaction } = await import('../server/offerAds.js');
      const data = action === 'ads.reactions' ? await readMyOfferReactions(user.uid) : await setOfferReaction(user.uid, payload);
      return res.status(200).json({ ok: true, data });
    }
    if (action === 'ads.mine') {
      const { readMyOfferAds } = await import('../server/offerAds.js');
      return res.status(200).json({ ok: true, data: await readMyOfferAds(user.uid) });
    }
    if (action === 'ads.paidAvailability' || action === 'ads.paidPrices' || action === 'ads.lockPrice' || action === 'ads.resumePayment' || action === 'ads.paymentContact' || action === 'ads.freePolicy' || action === 'ads.freeEligibility' || action === 'ads.prepare' || action === 'ads.submit' || action === 'ads.cancel' || action === 'ads.renewal' || action === 'ads.deleteExpired') {
      const { sendOfferAd } = await import('../server/offerAds.js');
      return res.status(200).json({ ok: true, data: await sendOfferAd(action, user.uid, payload, undefined, user.email?.trim().toLowerCase() === 'waelvts@gmail.com') });
    }
    if (action === 'admin.ads.list' || action === 'admin.ads.review' || action === 'admin.ads.policy' || action === 'admin.ads.uploadStats' || action === 'admin.ads.prices' || /^admin[.]ads[.]edit[.](read|prepare|save)$/.test(action)) {
      if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
      const { reviewOfferAds, editOwnOfferAd } = await import('../server/offerAds.js');
      const data = await (action.startsWith('admin.ads.edit.') ? editOwnOfferAd : reviewOfferAds)(action, user.uid, payload);
      if (action === 'admin.ads.review' && payload.status === 'approved' && typeof payload.id === 'string') {
        const { vipPushKey, deliverVipPush } = await import('../server/vipPush.js');
        if (vipPushKey()) waitUntil(deliverVipPush(undefined, undefined, payload.id).catch(() => console.error('VIP notification delivery failed')));
      }
      return res.status(200).json({ ok: true, data });
    }

    // Vercel production uses this serverless gateway, not the Express server.ts route.
    if (action === 'appLock.status' || action === 'appLock.enable' || action === 'appLock.verify' || action === 'appLock.disable' || action === 'appLock.change' || action === 'appLock.timeout' || action === 'appLock.toggle') {
      const { appLockAction } = await import('../server/appLock.js');
      return res.status(200).json({ ok: true, data: await appLockAction(user.uid, action, payload) });
    }

    if (action === 'reminders.monthSummary') {
      const { monthlyReminderSummary } = await import('../server/reminderService.js');
      return res.status(200).json({ ok: true, data: await monthlyReminderSummary(user.uid) });
    }
    if (action === 'reminders.list' || action === 'reminders.create' || action === 'reminders.update' || action === 'reminders.toggle' || action === 'reminders.delete' || action === 'reminders.alert') {
      const { reminderAction } = await import('../server/reminderService.js');
      const result = await reminderAction(user.uid, action, payload);
      return res.status(200).json({ ok: true, data: result });
    }

    switch (action) {
      case 'app.presence': {
        const { recordPresence } = await import('../server/presence.js');
        await recordPresence(user.uid);
        return res.status(200).json({ ok: true });
      }
      case 'admin.directory.backfill': {
        const { backfillUserDirectory } = await import('../server/userDirectory.js');
        return res.status(200).json({ ok: true, data: await backfillUserDirectory(user, payload.pageToken) });
      }
      case 'admin.directory.count': {
        const { countUserDirectory } = await import('../server/userDirectory.js');
        return res.status(200).json({ ok: true, data: await countUserDirectory(user) });
      }
      case 'app.installSeen': {
        const { recordSignedInInstallation } = await import('../server/adminUsers.js');
        return res.status(200).json({ ok: true, data: await recordSignedInInstallation(user.uid, payload) });
      }
      case 'admin.users.list': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { listAppUsers } = await import('../server/adminUsers.js');
        return res.status(200).json({ ok: true, data: await listAppUsers(user, payload) });
      }
      case 'admin.grant.get': {
        const { getFreeGrant } = await import('../server/grantService.js');
        return res.status(200).json({ ok: true, data: await getFreeGrant(user, payload) });
      }
      case 'admin.grant.set': {
        const { setFreeGrant } = await import('../server/grantService.js');
        return res.status(200).json({ ok: true, data: await setFreeGrant(user, payload) });
      }
      case 'admin.grant.end': {
        const { endFreeGrant } = await import('../server/grantService.js');
        return res.status(200).json({ ok: true, data: await endFreeGrant(user, payload) });
      }
      case 'admin.planLimitsDraft.publish': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { publishPlanLimits } = await import('../server/planLimits.js');
        return res.status(200).json({ ok: true, data: await publishPlanLimits(payload, user.uid) });
      }
      case 'admin.planLimitsDraft.get':
      case 'admin.planLimitsDraft.save': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { readPlanLimitsDraft, savePlanLimitsDraft } = await import('../server/planLimits.js');
        const data = action === 'admin.planLimitsDraft.get'
          ? await readPlanLimitsDraft()
          : await savePlanLimitsDraft(payload, user.uid);
        return res.status(200).json({ ok: true, data });
      }
      case 'admin.aiQuota.get': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { readAiDailyLimits } = await import('../server/aiQuota.js');
        return res.status(200).json({ ok: true, data: await readAiDailyLimits() });
      }
      case 'admin.aiQuota.save': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { saveAiDailyLimits } = await import('../server/aiQuota.js');
        return res.status(200).json({ ok: true, data: await saveAiDailyLimits(payload, user.uid) });
      }
      case 'ai.quota.reserveLocal': {
        const { reserveAiQuota } = await import('../server/aiQuota.js');
        return res.status(200).json({ ok: true, data: await reserveAiQuota(user.uid, payload.text, true, undefined, payload.inquiryRequestId) });
      }
      case 'ai.quota.status': {
        const { readOwnAiQuota } = await import('../server/aiQuota.js');
        return res.status(200).json({ ok: true, data: await readOwnAiQuota(user.uid) });
      }
      case 'admin.users.countFiltered': {
        const { countFilteredUsers } = await import('../server/adminUsers.js');
        return res.status(200).json({ ok: true, data: await countFilteredUsers(user, payload) });
      }
      case 'admin.users.setDisabled': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { changeAppUserAccess } = await import('../server/adminUsers.js');
        return res.status(200).json({ ok: true, data: await changeAppUserAccess(user, payload) });
      }
      case 'admin.users.deleteAuth': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { deleteAppUserIdentity } = await import('../server/adminUsers.js');
        return res.status(200).json({ ok: true, data: await deleteAppUserIdentity(user, payload) });
      }
      case 'fx.get': {
        const { getExchangeRateWidget } = await import('../server/exchangeRates.js');
        return res.status(200).json({ ok: true, data: await getExchangeRateWidget(user.uid) });
      }
      case 'fx.select': {
        const { changeExchangeRateWidget } = await import('../server/exchangeRates.js');
        return res.status(200).json({ ok: true, data: await changeExchangeRateWidget(user.uid, payload) });
      }
      case 'admin.siteVisits.get': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { readSiteVisits } = await import('../server/siteVisits.js');
        return res.status(200).json({ ok: true, data: await readSiteVisits(payload.date) });
      }
      case 'admin.aiUsage': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') {
          return res.status(403).json({ ok: false, error: 'admin_only' });
        }
        const { readGeminiUsage } = await import('../server/geminiUsage.js');
        return res.status(200).json({ ok: true, data: await readGeminiUsage() });
      }
      case 'admin.aiDiagnose': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') {
          return res.status(403).json({ ok: false, error: 'admin_only' });
        }
        const { diagnoseGeminiConnection } = await import('../server/geminiDiagnostic.js');
        return res.status(200).json({ ok: true, data: await diagnoseGeminiConnection() });
      }
      case 'admin.aiSettings': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { getGeminiAdminSettings } = await import('../server/geminiSettings.js');
        return res.status(200).json({ ok: true, data: await getGeminiAdminSettings() });
      }
      case 'admin.aiSetModel': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { GEMINI_MODEL_OPTIONS, setSelectedGeminiModel } = await import('../server/geminiSettings.js');
        const id = payload.modelId;
        if (typeof id !== 'string' || !GEMINI_MODEL_OPTIONS.some(m => m.id === id)) return res.status(400).json({ ok: false, error: 'invalid_model_selection' });
        const { diagnoseGeminiConnection } = await import('../server/geminiDiagnostic.js');
        const test = await diagnoseGeminiConnection(id);
        if (!test.success) return res.status(422).json({ ok: false, error: 'model_test_failed', data: test, message: 'Selected Gemini model failed its connectivity test. The active model was not changed.' });
        return res.status(200).json({ ok: true, data: await setSelectedGeminiModel(id) });
      }
      case 'feedback.config': {
        const { getFeedbackSettings } = await import('../server/analyzerFeedback.js');
        return res.status(200).json({ ok:true, data:await getFeedbackSettings() });
      }
      case 'feedback.submit': {
        const { submitFeedback } = await import('../server/analyzerFeedback.js');
        return res.status(200).json({ ok:true, data:await submitFeedback(payload, user.uid) });
      }
      case 'admin.feedbackSettings': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ok:false,error:'admin_only'});
        const { updateFeedbackSettings } = await import('../server/analyzerFeedback.js');
        return res.status(200).json({ ok:true, data:await updateFeedbackSettings(payload) });
      }
      case 'admin.feedbackReports': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ok:false,error:'admin_only'});
        const { listFeedbackReports } = await import('../server/analyzerFeedback.js');
        return res.status(200).json({ ok:true, data:await listFeedbackReports() });
      }
      case 'admin.feedbackUpdateStatus': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ok:false,error:'admin_only'});
        const { updateFeedbackStatus } = await import('../server/analyzerFeedback.js');
        return res.status(200).json({ ok:true, data:await updateFeedbackStatus(payload) });
      }
      case 'subscription.trialSettings': {
        const { ensureTrialAccess } = await import('../server/trialAccessBootstrap.js');
        const { syncDirectoryUser } = await import('../server/userDirectory.js');
        await syncDirectoryUser(user.uid).catch(error => console.error('[directory] sync failed', error));
        await ensureTrialAccess(user.uid);
        const { readTrialSettings, trialSettingsResponse } = await import('../server/trialSettings.js');
        const { basicDays } = await readTrialSettings();
        return res.status(200).json({ ok: true, data: trialSettingsResponse({ basicDays }) });
      }
      case 'admin.subscriptionTrials.get': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { readTrialSettings, trialSettingsResponse } = await import('../server/trialSettings.js');
        return res.status(200).json({ ok: true, data: trialSettingsResponse(await readTrialSettings()) });
      }
      case 'admin.subscriptionTrials.history': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { listTrialSettingsHistory } = await import('../server/trialSettings.js');
        return res.status(200).json({ ok: true, data: await listTrialSettingsHistory() });
      }
      case 'admin.subscriptionTrials.archiveHistory': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { archiveTrialSettingsHistoryEntry } = await import('../server/trialSettings.js');
        return res.status(200).json({ ok: true, data: await archiveTrialSettingsHistoryEntry(payload.id, user.uid) });
      }
      case 'admin.subscriptionTrials.save': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { saveTrialSettings, trialSettingsResponse } = await import('../server/trialSettings.js');
        return res.status(200).json({ ok: true, data: trialSettingsResponse(await saveTrialSettings(payload, user.uid)) });
      }
      case 'subscription.get': {
        const subscription = await getOrCreateSubscription(user.uid);
        return res.status(200).json({ ok: true, data: { subscription } });
      }
      case 'subscription.applyAffiliate': {
        const subscription = await applyAffiliateCode(user.uid, payload.code);
        return res.status(200).json({ ok: true, data: { subscription } });
      }
      case 'financial.transaction.create': {
        const { saveFinancialTransaction } = await import('../server/financialTransactions.js');
        return res.status(200).json({ ok: true, data: await saveFinancialTransaction(user.uid, payload) });
      }
      case 'financial.accounts.save':
      case 'financial.categories.save':
      case 'financial.categories.initialize': {
        const { saveFinancialCollection } = await import('../server/financialCollections.js');
        return res.status(200).json({ ok: true, data: await saveFinancialCollection(user.uid, action, payload) });
      }
      case 'report.export.reserve': {
        const { reserveReportExport } = await import('../server/reportExport.js');
        return res.status(200).json({ ok: true, data: await reserveReportExport(user.uid, payload.format) });
      }
      case 'ai.interpret': {
        const { text, accounts, categories, currentDateTime, userTimezone, lang, currentProposal, learnedMemory } = payload;
        if (!text || typeof text !== 'string') {
          return res.status(400).json({ ok: false, error: 'invalid_ai_input', message: 'Missing or invalid text.' });
        }

        const { reserveAiQuota } = await import('../server/aiQuota.js');
        const reservation = await reserveAiQuota(user.uid, text, false, undefined, payload.inquiryRequestId);

        const { interpretNaturalLanguageWithGemini } = await import('../server/geminiService.js');
        const result = await interpretNaturalLanguageWithGemini({
          text,
          accounts: Array.isArray(accounts) ? accounts : [],
          categories: Array.isArray(categories) ? categories : [],
          currentDateTime: typeof currentDateTime === 'string' ? currentDateTime : new Date().toISOString(),
          userTimezone: typeof userTimezone === 'string' ? userTimezone : 'Africa/Cairo',
          lang: lang === 'en' ? 'en' : 'ar',
          currentProposal: payload.currentProposal as never,
          learnedMemory: Array.isArray(learnedMemory) ? learnedMemory : [],
        });
        if (reservation.operation === 'entry' && result.intent === 'CREATE_TRANSACTION' && result.transaction) {
          const { issueAiEntryTicket } = await import('../server/financialTransactions.js');
          const entryTicket = await issueAiEntryTicket(user.uid, reservation.day);
          return res.status(200).json({ ok: true, data: { ...result, entryTicket } });
        }
        return res.status(200).json({ ok: true, data: result });
      }
      default:
        return res.status(404).json({ ok: false, error: 'gateway_action_not_found', message: 'The requested gateway action is not available.' });
    }
  } catch (err: unknown) {
    console.error('Gateway operation error:', err);
    const known = err && typeof err === 'object' && 'statusCode' in err && 'code' in err
      ? err as { statusCode: number; code: string; message: string }
      : null;
    return res.status(known?.statusCode || 500).json({
      ok: false,
      error: known?.code || 'gateway_operation_failed',
      message: known?.message || 'The gateway operation could not be completed.',
    });
  }
}
