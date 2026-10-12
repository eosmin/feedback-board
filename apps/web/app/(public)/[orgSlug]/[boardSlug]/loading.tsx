import type { ReactElement } from 'react';

import { PageSkeleton } from '../../../../components/ui';

export default function PublicBoardLoading(): ReactElement {
  return <PageSkeleton className="mx-auto flex max-w-2xl flex-col gap-6 p-6" />;
}
