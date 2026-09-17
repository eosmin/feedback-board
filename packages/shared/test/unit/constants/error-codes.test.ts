import { describe, expect, it } from 'vitest';

import { ERROR_CODES, type ErrorCode } from '../../../src/constants/error-codes';

describe('ERROR_CODES', () => {
  it('carries the validation and plan-limit codes', () => {
    expect(ERROR_CODES.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(ERROR_CODES.PLAN_LIMIT).toBe('PLAN_LIMIT');
  });

  it('maps every key to its own name, so no code can drift from its constant', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });

  it('holds no prose', () => {
    for (const value of Object.values(ERROR_CODES)) {
      expect(value).toMatch(/^[A-Z][A-Z_]*$/);
    }
  });

  it('infers a union of its values', () => {
    const code: ErrorCode = ERROR_CODES.RATE_LIMITED;

    expect(Object.values(ERROR_CODES)).toContain(code);
  });
});
