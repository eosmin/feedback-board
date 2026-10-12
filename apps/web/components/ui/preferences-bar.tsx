import type { ReactElement } from 'react';

import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

/**
 * Theme and language controls for pages that have no dashboard header (login, public boards).
 * Absolute rather than fixed so it scrolls away with the page instead of covering content.
 */
export function PreferencesBar(): ReactElement {
  return (
    <div className="absolute right-4 top-4 z-30 flex items-center gap-1">
      <ThemeToggle />
      <LocaleSwitcher />
    </div>
  );
}
