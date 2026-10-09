import type { PostStatus } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge } from '../ui';
import type { BadgeTone } from '../ui/badge';

interface PostStatusBadgeProps {
  status: PostStatus;
}

const STATUS_TONE: Record<PostStatus, BadgeTone> = {
  OPEN: 'status-open',
  PLANNED: 'status-planned',
  IN_PROGRESS: 'status-in-progress',
  DONE: 'status-done',
  CLOSED: 'status-closed',
};

/**
 * Renders a post's lifecycle status. Shared between the public board (Step 18) and the
 * dashboard board detail (Step 19.3) — the status is part of `postSchema` and `publicPostSchema`
 * alike, so the same badge reads either.
 */
export function PostStatusBadge({ status }: PostStatusBadgeProps): ReactElement {
  const t = useTranslations('publicBoard.status');

  return <Badge tone={STATUS_TONE[status]}>{t(status)}</Badge>;
}
