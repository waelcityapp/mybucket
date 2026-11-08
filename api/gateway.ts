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
    const { applyAffiliateCode, getOrCreateSubscription, verifyAuthenticatedUser } = await import('../server/subscriptionService.js');
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
      case 'subscription.get': {
        const subscription = await getOrCreateSubscription(user.uid);
        return res.status(200).json({ ok: true, data: { subscription } });
      }
      case 'subscription.applyAffiliate': {
        const subscription = await applyAffiliateCode(user.uid, payload.code);
        return res.status(200).json({ ok: true, data: { subscription } });
      }
      case 'ai.interpret': {
        const { text, accounts, categories, currentDateTime, userTimezone, lang, currentProposal, learnedMemory } = payload;
        if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
          return res.status(400).json({ ok: false, error: 'invalid_ai_input', message: 'Enter text between 1 and 5000 characters.' });
        }

        const subscription = await getOrCreateSubscription(user.uid);
        const { readTrialSettings } = await import('../server/trialSettings.js');
        const { stageFor } = await import('../src/config/subscriptionPolicy.js');
        const durations = await readTrialSettings();
        const phase = stageFor(subscription, Date.now(), durations);
        if (phase === 'expired') {
          return res.status(403).json({ ok: false, error: 'subscription_expired', message: 'Choose a subscription to continue AI operations.' });
        }

        // Basic users have server-enforced daily quotas. Browser localStorage is
        // retained only for displaying an early warning and is never trusted.
        let aiUsage = null;
        if (phase === 'basic-free') {
          const { isFinancialQueryText } = await import('../src/utils/semanticParser.js');
          const { reserveDailyAiUsage } = await import('../server/aiQuota.js');
          const kind = isFinancialQueryText(text) ? 'inquiry' : 'entry';
          const limit = kind === 'inquiry'
            ? (subscription.dailyAiInquiryLimit ?? 5)
            : (subscription.dailyAiEntryLimit ?? 15);
          aiUsage = await reserveDailyAiUsage(user.uid, kind, limit);
        }

        const { interpretNaturalLanguageWithGemini } = await import('../server/geminiService.js');
        const result = await interpretNaturalLanguageWithGemini({
          text: text.trim(),
          accounts: Array.isArray(accounts) ? accounts : [],
          categories: Array.isArray(categories) ? categories : [],
          currentDateTime: typeof currentDateTime === 'string' ? currentDateTime : new Date().toISOString(),
          userTimezone: typeof userTimezone === 'string' ? userTimezone : 'Africa/Cairo',
          lang: lang === 'en' ? 'en' : 'ar',
          currentProposal: currentProposal as never,
          learnedMemory: Array.isArray(learnedMemory) ? learnedMemory.slice(0, 50) : [],
        });
        return res.status(200).json({ ok: true, data: result, ...(aiUsage ? { usage: aiUsage } : {}) });
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
