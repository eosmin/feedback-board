import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { DashboardHeader } from './dashboard-header';

/**
 * The org picker's account bar: the app name where an org page has the org switcher. Rendered by
 * both the page and its loading state, so the bar is on screen from the first frame.
 */
export function PickerHeader(): ReactElement {
  const t = useTranslations('common');

  return (
    <DashboardHeader>
      <span className="block truncate px-2 py-1.5 text-body font-medium text-text">
        {t('appName')}
      </span>
    </DashboardHeader>
  );
}
