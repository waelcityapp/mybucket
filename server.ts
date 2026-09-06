import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { interpretNaturalLanguageWithGemini } from './server/geminiService';

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

  // 2. Gemini AI Interpretation Endpoint (Provider-independent API)
  app.post('/api/ai/interpret', async (req, res) => {
    try {
      const { text, accounts, categories, currentDateTime, userTimezone, lang, currentProposal, learnedMemory } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "text" field' });
      }

      const result = await interpretNaturalLanguageWithGemini({
        text,
        accounts: accounts || [],
        categories: categories || [],
        currentDateTime: currentDateTime || new Date().toISOString(),
        userTimezone: userTimezone || 'Africa/Cairo',
        lang: lang || 'ar',
        currentProposal,
        learnedMemory: learnedMemory || [],
      });

      res.json(result);
    } catch (err: any) {
      console.error('AI Interpretation Error:', err);
      res.status(500).json({
        error: err?.message || 'Failed to interpret natural language with AI',
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
