import { z } from 'zod';

import { refineAiTransportEnv } from '../../../src/ai/ai-transport-env';

const schema = z
  .object({
    AI_GATEWAY_API_KEY: z.string().optional(),
    AI_CUSTOM_BASE_URL: z.string().optional(),
    AI_CUSTOM_API_KEY: z.string().optional(),
  })
  .superRefine(refineAiTransportEnv);

function issues(raw: Record<string, string>): Record<string, string> {
  const result = schema.safeParse(raw);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('refineAiTransportEnv', () => {
  describe('gateway mode (no AI_CUSTOM_BASE_URL)', () => {
    it('accepts the gateway key alone', () => {
      expect(issues({ AI_GATEWAY_API_KEY: 'gw' })).toEqual({});
    });

    it('requires the gateway key', () => {
      expect(issues({})).toEqual({
        AI_GATEWAY_API_KEY: 'required unless AI_CUSTOM_BASE_URL is set',
      });
    });

    it('rejects a custom key, which nothing would read', () => {
      expect(issues({ AI_GATEWAY_API_KEY: 'gw', AI_CUSTOM_API_KEY: 'ck' })).toEqual({
        AI_CUSTOM_API_KEY: 'only used with AI_CUSTOM_BASE_URL; use AI_GATEWAY_API_KEY',
      });
    });
  });

  describe('custom mode (AI_CUSTOM_BASE_URL set)', () => {
    const base = { AI_CUSTOM_BASE_URL: 'https://proxy.example.com/v1' };

    it('accepts the custom key alone', () => {
      expect(issues({ ...base, AI_CUSTOM_API_KEY: 'ck' })).toEqual({});
    });

    it('requires the custom key', () => {
      expect(issues(base)).toEqual({
        AI_CUSTOM_API_KEY: 'required when AI_CUSTOM_BASE_URL is set',
      });
    });

    it('rejects the gateway key, which resolveModel never sends to a custom endpoint', () => {
      expect(issues({ ...base, AI_CUSTOM_API_KEY: 'ck', AI_GATEWAY_API_KEY: 'gw' })).toEqual({
        AI_GATEWAY_API_KEY: 'not used when AI_CUSTOM_BASE_URL is set; use AI_CUSTOM_API_KEY',
      });
    });

    it('reports both problems when only the gateway key was set (the original misconfiguration)', () => {
      expect(issues({ ...base, AI_GATEWAY_API_KEY: 'gw' })).toEqual({
        AI_CUSTOM_API_KEY: 'required when AI_CUSTOM_BASE_URL is set',
        AI_GATEWAY_API_KEY: 'not used when AI_CUSTOM_BASE_URL is set; use AI_CUSTOM_API_KEY',
      });
    });
  });
});
