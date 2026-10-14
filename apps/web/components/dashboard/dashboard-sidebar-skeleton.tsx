import type { ReactElement } from 'react';

import { Skeleton } from '../ui';
import { SIDEBAR_CLASSNAME } from './dashboard-sidebar';

const NAV_PLACEHOLDERS = 3;

/**
 * The org sidebar while the org detail loads: same box as `DashboardSidebar`, with the plan badge
 * and nav links as placeholders. The role is not known yet, so it follows an OWNER (three
 * links); a MEMBER sees it shrink when the data lands. Hidden from assistive tech: it exposes no
 * navigation, so it must not be a second `nav` landmark next to the real one. Row heights are the
 * real ones (20 px badge, 34 px links).
 */
export function DashboardSidebarSkeleton(): ReactElement {
  return (
    <div aria-hidden="true" className={SIDEBAR_CLASSNAME}>
      <div className="mb-3 px-2">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {Array.from({ length: NAV_PLACEHOLDERS }, (_, index) => (
        <Skeleton key={index} className="h-[34px] w-full" />
      ))}
    </div>
  );
}
