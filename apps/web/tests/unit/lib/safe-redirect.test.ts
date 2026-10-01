import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from '../../../lib/safe-redirect';

describe('safeRedirectPath', () => {
  it('returns a same-origin relative path unchanged', () => {
    expect(safeRedirectPath('/dashboard/acme', '/dashboard')).toBe('/dashboard/acme');
  });

  it('falls back when next is undefined', () => {
    expect(safeRedirectPath(undefined, '/dashboard')).toBe('/dashboard');
  });

  it('falls back on a protocol-relative open redirect', () => {
    expect(safeRedirectPath('//evil.com', '/dashboard')).toBe('/dashboard');
  });

  it('falls back on an absolute-URL open redirect', () => {
    expect(safeRedirectPath('https://evil.com', '/dashboard')).toBe('/dashboard');
  });

  it('falls back on a leading-backslash open redirect (browsers normalize \\ to /)', () => {
    expect(safeRedirectPath('/\\evil.com', '/dashboard')).toBe('/dashboard');
  });

  it('falls back on a path not starting with /', () => {
    expect(safeRedirectPath('evil.com', '/dashboard')).toBe('/dashboard');
  });
});
