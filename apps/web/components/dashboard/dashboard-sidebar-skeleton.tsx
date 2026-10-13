import type { ReactElement } from 'react';

import { Skeleton } from '../ui';
import { SIDEBAR_CLASSNAME } from './dashboard-sidebar';

const NAV_PLACEHOLDERS = 3;

/**
 * The org sidebar while the org detail loads: same box as `DashboardSidebar`, with the org name,
 * plan badge, nav links and the pinned "all organizations" link as placeholders. The role is not
 * known yet, so it follows an OWNER (three links); a MEMBER sees it shrink when the data lands.
 * Hidden from assistive tech: it exposes no navigation, so it must not be a second `nav`
 * landmark next to the real one. Row heights are the real ones (24 px title, 34 px links).
 */
export function DashboardSidebarSkeleton(): ReactElement {
  return (
    <div aria-hidden="true" className={SIDEBAR_CLASSNAME}>
      <div className="mb-3 flex items-center justify-between gap-2 px-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      {Array.from({ length: NAV_PLACEHOLDERS }, (_, index) => (
        <Skeleton key={index} className="h-[34px] w-full" />
      ))}
      <Skeleton className="mt-auto h-[34px] w-full" />
    </div>
  );
}
