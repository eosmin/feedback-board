import { z } from 'zod';

import { formatEnvIssues } from '../../../src/config/format-env-issues';

const schema = z
  .object({ URL: z.url(), KEY: z.string().min(1).optional() })
  .superRefine((env, ctx) => {
    if (env.KEY === undefined) {
      ctx.addIssue({ code: 'custom', path: ['KEY'], message: 'required in this test' });
    }
  });

function format(raw: Record<string, unknown>): string {
  const result = schema.safeParse(raw);
  if (result.success) throw new Error('expected the parse to fail');
  return formatEnvIssues(result.error);
}

describe('formatEnvIssues', () => {
  it('prints the message of a custom issue', () => {
    expect(format({ URL: 'https://example.com' })).toBe('KEY: required in this test');
  });

  it('prints only the code for every other issue, never the rejected value', () => {
    const out = format({ URL: 'super-secret-not-a-url', KEY: 'k' });

    expect(out).toBe('URL: invalid_format');
    expect(out).not.toContain('super-secret');
  });

  it('joins several issues with "; "', () => {
    expect(format({ URL: 'nope' })).toBe('URL: invalid_format; KEY: required in this test');
  });
});
