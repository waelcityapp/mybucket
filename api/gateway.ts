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
    const { applyAffiliateCode, getOrCreateSubscription, verifyAuthenticatedUser } = await import('../server/subscriptionService');
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

        const { interpretNaturalLanguageWithGemini } = await import('../server/geminiService');
        const result = await interpretNaturalLanguageWithGemini({
          text,
          accounts: Array.isArray(accounts) ? accounts : [],
          categories: Array.isArray(categories) ? categories : [],
          currentDateTime: typeof currentDateTime === 'string' ? currentDateTime : new Date().toISOString(),
          userTimezone: typeof userTimezone === 'string' ? userTimezone : 'Africa/Cairo',
          lang: typeof lang === 'string' ? lang : 'ar',
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
