import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { interpretNaturalLanguageWithGemini } from './server/geminiService';
import {
  applyAffiliateCode,
  getOrCreateSubscription,
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
        case 'subscription.get': {
          const subscription = await getOrCreateSubscription(user.uid);
          return res.json({ ok: true, data: { subscription } });
        }
        case 'subscription.applyAffiliate': {
          const subscription = await applyAffiliateCode(user.uid, payload.code);
          return res.json({ ok: true, data: { subscription } });
        }
        case 'ai.interpret': {
          const { text, accounts, categories, currentDateTime, userTimezone, lang, currentProposal, learnedMemory } = payload;
          if (!text || typeof text !== 'string') {
            return res.status(400).json({ ok: false, error: 'invalid_ai_input', message: 'Missing or invalid text.' });
          }
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
