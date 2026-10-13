import type { ReactElement } from 'react';

import { PageSkeleton } from '../../../components/ui';

/** The fallback for org pages without a shape of their own (billing, webhooks). */
export default function OrgLoading(): ReactElement {
  return <PageSkeleton />;
}
