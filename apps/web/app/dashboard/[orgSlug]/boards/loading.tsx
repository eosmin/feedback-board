import type { ReactElement } from 'react';

import { BoardDetailSkeleton } from '../../../../components/boards/board-detail-skeleton';

export default function BoardDetailLoading(): ReactElement {
  return <BoardDetailSkeleton />;
}
