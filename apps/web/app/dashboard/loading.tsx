import type { ReactElement } from 'react';

import { DashboardHeader } from '../../components/dashboard/dashboard-header';
import { PageSkeleton, Skeleton } from '../../components/ui';

/**
 * What the router shows under `/dashboard` for a destination whose own boundary it has not
 * prefetched yet (slow network, early click). It cannot know whether that is the org picker or an
 * org page, so it draws only what both have in common: the account bar (the real controls, with a
 * placeholder where the page puts its own label) and a content skeleton. It has no sidebar on
 * purpose: a sidebar here would show up on the picker, which has none. Inside an org, the layout
 * draws the sidebar placeholder itself as soon as it renders.
 */
export default function DashboardLoading(): ReactElement {
  return (
    <>
      <DashboardHeader>
        <Skeleton className="h-9 w-40" />
      </DashboardHeader>
      <PageSkeleton />
    </>
  );
}
