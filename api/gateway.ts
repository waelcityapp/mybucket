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

    // Vercel production uses this serverless gateway, not the Express server.ts route.
    if (action === 'appLock.status' || action === 'appLock.enable' || action === 'appLock.verify' || action === 'appLock.disable' || action === 'appLock.change' || action === 'appLock.timeout') {
      const { appLockAction } = await import('../server/appLock.js');
      return res.status(200).json({ ok: true, data: await appLockAction(user.uid, action, payload) });
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
        return res.status(200).json({ ok: true, data: await reserveAiQuota(user.uid, payload.text, true) });
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
        const { readTrialSettings } = await import('../server/trialSettings.js');
        const { proDays, basicDays } = await readTrialSettings();
        return res.status(200).json({ ok: true, data: { proDays, basicDays } });
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
