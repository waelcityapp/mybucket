import type { Request } from 'express';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: {
    action?: unknown;
    payload?: Record<string, unknown>;
  };
};

type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed', message: 'Use POST for gateway operations.' });
  }

  try {
    const { applyAffiliateCode, getOrCreateSubscription, selectSubscriptionPlan, verifyAuthenticatedUser } = await import('../server/subscriptionService.js');
    const authorizationHeader = req.headers.authorization;
    const authorization = Array.isArray(authorizationHeader)
      ? authorizationHeader[0] || ''
      : authorizationHeader || '';
    const user = await verifyAuthenticatedUser({
      header: (name: string) => name.toLowerCase() === 'authorization' ? authorization : undefined,
    } as unknown as Request);

    const action = req.body?.action;
    const payload = req.body?.payload || {};

    if (typeof action !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid_gateway_action', message: 'A valid gateway action is required.' });
    }

    switch (action) {
      case 'app.installSeen': {
        const { recordSignedInInstallation } = await import('../server/adminUsers.js');
        return res.status(200).json({ ok: true, data: await recordSignedInInstallation(user.uid, payload) });
      }
      case 'admin.users.list': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { listAppUsers } = await import('../server/adminUsers.js');
        return res.status(200).json({ ok: true, data: await listAppUsers(user) });
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
        // Prepare a server-owned entitlement record from Firebase Auth metadata on
        // each authenticated startup. This does NOT itself enable restrictive rules.
        const { ensureFirestoreAccessRecord } = await import('../server/financialAccess.js');
        const { readTrialSettings } = await import('../server/trialSettings.js');
        const settings = await readTrialSettings();
        await getOrCreateSubscription(user.uid);
        await ensureFirestoreAccessRecord(user.uid);
        return res.status(200).json({ ok: true, data: { proDays: settings.proDays, basicDays: settings.basicDays } });
      }
      case 'admin.subscriptionTrials.get': {
        if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
        const { readTrialSettings } = await import('../server/trialSettings.js');
        return res.status(200).json({ ok: true, data: await readTrialSettings() });
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
        const { saveTrialSettings } = await import('../server/trialSettings.js');
        return res.status(200).json({ ok: true, data: await saveTrialSettings(payload, user.uid) });
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
        const decision = await reserveAiQuota(user.uid, payload.text, true);
        return res.status(200).json({ ok: true, data: decision });
      }
      case 'subscription.get': {
        const subscription = await getOrCreateSubscription(user.uid);
        return res.status(200).json({ ok: true, data: { subscription } });
      }
      case 'subscription.applyAffiliate': {
        const subscription = await applyAffiliateCode(user.uid, payload.code);
        return res.status(200).json({ ok: true, data: { subscription } });
      }
      case 'subscription.selectPlan': {
        const subscription = await selectSubscriptionPlan(user.uid, payload.plan);
        return res.status(200).json({ ok: true, data: { subscription } });
      }
      case 'ai.interpret': {
        const subscription = await getOrCreateSubscription(user.uid);
        if (subscription.status === 'expired') return res.status(403).json({ ok: false, error: 'subscription_expired', message: 'Choose a subscription to continue AI operations.' });
        const { readTrialSettings } = await import('../server/trialSettings.js');
        const { stageFor } = await import('../src/config/subscriptionPolicy.js');
        const phase = stageFor(subscription, Date.now(), await readTrialSettings());
        if (phase !== 'paid' && (phase !== 'pro-trial' || subscription.selectedPlan !== 'pro')) {
          return res.status(403).json({ ok: false, error: 'pro_plan_required', message: 'Gemini AI is available on the Pro plan only. Basic uses the local analyzer.' });
        }
        const { text, accounts, categories, currentDateTime, userTimezone, lang, currentProposal, learnedMemory } = payload;
        if (!text || typeof text !== 'string') {
          return res.status(400).json({ ok: false, error: 'invalid_ai_input', message: 'Missing or invalid text.' });
        }

        const { reserveAiQuota } = await import('../server/aiQuota.js');
        await reserveAiQuota(user.uid, text, false);
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
