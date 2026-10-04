import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from '../../../src/constants/locales';

describe('SUPPORTED_LOCALES', () => {
  it('ships English and Spanish', () => {
    expect(SUPPORTED_LOCALES.map((locale) => locale.code)).toEqual(['en', 'es']);
  });

  it('includes the default locale', () => {
    expect(isSupportedLocale(DEFAULT_LOCALE)).toBe(true);
  });
});

describe('isSupportedLocale', () => {
  it('accepts a shipped code', () => {
    expect(isSupportedLocale('es')).toBe(true);
  });

  it('rejects an unknown code', () => {
    expect(isSupportedLocale('fr')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isSupportedLocale(undefined)).toBe(false);
  });
});
