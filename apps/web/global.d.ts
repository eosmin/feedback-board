import messages from './messages/en.json';

/**
 * Turns an unknown or missing message key into a compile error (TDD §2.6.13, §7.8) — this is
 * what makes `pnpm --filter web typecheck` the enforcement mechanism instead of code review.
 */
declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof messages;
    Locale: 'en';
  }
}
