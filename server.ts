import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { interpretNaturalLanguageWithGemini } from './server/geminiService';
import { readGeminiUsage } from './server/geminiUsage';
import { diagnoseGeminiConnection } from './server/geminiDiagnostic';
import { GEMINI_MODEL_OPTIONS, getGeminiAdminSettings, setSelectedGeminiModel } from './server/geminiSettings';
import {
  applyAffiliateCode,
  getOrCreateSubscription,
  selectSubscriptionPlan,
  SubscriptionError,
  verifyAuthenticatedUser,
} from './server/subscriptionService';

dotenv.config();

// In bundled CJS or tsx dev mode, safely resolve directory path
const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  // 1. Health Check Route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Unified authenticated backend gateway for all product operations.
  app.post('/api/gateway', async (req, res) => {
    try {
      const user = await verifyAuthenticatedUser(req);
      const action = req.body?.action;
      const payload = req.body?.payload || {};

      if (typeof action !== 'string') {
        return res.status(400).json({ ok: false, error: 'invalid_gateway_action', message: 'A valid gateway action is required.' });
      }

      switch (action) {
        case 'app.installSeen': {
          const { recordSignedInInstallation } = await import('./server/adminUsers');
          return res.json({ ok: true, data: await recordSignedInInstallation(user.uid, payload) });
        }
        case 'admin.users.list': {
          const { listAppUsers } = await import('./server/adminUsers');
          return res.json({ ok: true, data: await listAppUsers(user) });
        }
        case 'admin.users.setDisabled': {
          const { changeAppUserAccess } = await import('./server/adminUsers');
          return res.json({ ok: true, data: await changeAppUserAccess(user, payload) });
        }
        case 'admin.users.deleteAuth': {
          const { deleteAppUserIdentity } = await import('./server/adminUsers');
          return res.json({ ok: true, data: await deleteAppUserIdentity(user, payload) });
        }
        case 'fx.get': {
          const { getExchangeRateWidget } = await import('./server/exchangeRates');
          return res.json({ ok: true, data: await getExchangeRateWidget(user.uid) });
        }
        case 'fx.select': {
          const { changeExchangeRateWidget } = await import('./server/exchangeRates');
          return res.json({ ok: true, data: await changeExchangeRateWidget(user.uid, payload) });
        }
        case 'admin.aiUsage': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') {
            return res.status(403).json({ ok: false, error: 'admin_only' });
          }
          return res.json({ ok: true, data: await readGeminiUsage() });
        }
        case 'admin.aiDiagnose': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') {
            return res.status(403).json({ ok: false, error: 'admin_only' });
          }
          return res.json({ ok: true, data: await diagnoseGeminiConnection() });
        }
        case 'admin.aiSettings': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
          return res.json({ ok: true, data: await getGeminiAdminSettings() });
        }
        case 'admin.aiSetModel': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
          const id = payload.modelId;
          if (typeof id !== 'string' || !GEMINI_MODEL_OPTIONS.some(m => m.id === id)) return res.status(400).json({ ok: false, error: 'invalid_model_selection' });
          const test = await diagnoseGeminiConnection(id);
          if (!test.success) return res.status(422).json({ ok: false, error: 'model_test_failed', data: test, message: 'Selected Gemini model failed its connectivity test. The active model was not changed.' });
          return res.json({ ok: true, data: await setSelectedGeminiModel(id) });
        }
        case 'feedback.config': {
          const { getFeedbackSettings } = await import('./server/analyzerFeedback');
          return res.json({ ok:true, data:await getFeedbackSettings() });
        }
        case 'feedback.submit': {
          const { submitFeedback } = await import('./server/analyzerFeedback');
          return res.json({ ok:true, data:await submitFeedback(payload, user.uid) });
        }
        case 'admin.feedbackSettings': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ok:false,error:'admin_only'});
          const { updateFeedbackSettings } = await import('./server/analyzerFeedback');
          return res.json({ ok:true, data:await updateFeedbackSettings(payload) });
        }
        case 'admin.feedbackReports': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ok:false,error:'admin_only'});
          const { listFeedbackReports } = await import('./server/analyzerFeedback');
          return res.json({ ok:true, data:await listFeedbackReports() });
        }
        case 'admin.feedbackUpdateStatus': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ok:false,error:'admin_only'});
          const { updateFeedbackStatus } = await import('./server/analyzerFeedback');
          return res.json({ ok:true, data:await updateFeedbackStatus(payload) });
        }
        case 'admin.aiQuota.get': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
          const { readAiDailyLimits } = await import('./server/aiQuota');
          return res.json({ ok: true, data: await readAiDailyLimits() });
        }
        case 'admin.aiQuota.save': {
          if (user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') return res.status(403).json({ ok: false, error: 'admin_only' });
          const { saveAiDailyLimits } = await import('./server/aiQuota');
          return res.json({ ok: true, data: await saveAiDailyLimits(payload, user.uid) });
        }
        case 'ai.quota.reserveLocal': {
          const { reserveAiQuota } = await import('./server/aiQuota');
          return res.json({ ok: true, data: await reserveAiQuota(user.uid, payload.text, true) });
        }
        case 'subscription.get': {
          const subscription = await getOrCreateSubscription(user.uid);
          return res.json({ ok: true, data: { subscription } });
        }
        case 'subscription.applyAffiliate': {
          const subscription = await applyAffiliateCode(user.uid, payload.code);
          return res.json({ ok: true, data: { subscription } });
        }
        case 'subscription.selectPlan': {
          const subscription = await selectSubscriptionPlan(user.uid, payload.plan);
          return res.json({ ok: true, data: { subscription } });
        }
        case 'ai.interpret': {
          const subscription = await getOrCreateSubscription(user.uid);
          const { readTrialSettings } = await import('./server/trialSettings.js');
          const { stageFor } = await import('./src/config/subscriptionPolicy.js');
          const phase = stageFor(subscription, Date.now(), await readTrialSettings());
          if (phase === 'expired') {
            return res.status(403).json({ ok: false, error: 'subscription_expired', message: 'Your free period has ended. Choose a paid plan to continue.' });
          }
          if (phase !== 'pro-trial' || subscription.selectedPlan !== 'pro') {
            return res.status(403).json({ ok: false, error: 'pro_plan_required', message: 'Gemini AI is available on the Pro plan only. Basic uses the local analyzer.' });
          }
          const { text, accounts, categories, currentDateTime, userTimezone, lang, currentProposal, learnedMemory } = payload;
          if (!text || typeof text !== 'string') {
            return res.status(400).json({ ok: false, error: 'invalid_ai_input', message: 'Missing or invalid text.' });
          }
          const { reserveAiQuota } = await import('./server/aiQuota');
          await reserveAiQuota(user.uid, text, false);
          const result = await interpretNaturalLanguageWithGemini({
            text,
            accounts: Array.isArray(accounts) ? accounts : [],
            categories: Array.isArray(categories) ? categories : [],
            currentDateTime: currentDateTime || new Date().toISOString(),
            userTimezone: userTimezone || 'Africa/Cairo',
            lang: lang || 'ar',
            currentProposal,
            learnedMemory: Array.isArray(learnedMemory) ? learnedMemory : [],
          });
          return res.json({ ok: true, data: result });
        }
        default:
          return res.status(404).json({ ok: false, error: 'gateway_action_not_found', message: 'The requested gateway action is not available.' });
      }
    } catch (err: any) {
      const known = err instanceof SubscriptionError ? err : null;
      console.error('Gateway operation error:', known?.code || err?.message || err);
      res.status(known?.statusCode || 500).json({
        ok: false,
        error: known?.code || 'gateway_operation_failed',
        message: known?.message || 'The gateway operation could not be completed.',
      });
    }
  });

  // 3. Vite Middleware (Dev) or Static Assets (Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          ok: false,
          error: 'api_route_not_found',
          message: 'Use the unified /api/gateway endpoint.',
        });
      }
      if (req.method !== 'GET') {
        return res.status(404).end();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
