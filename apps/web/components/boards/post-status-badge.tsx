import type { PostStatus } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge } from '../ui';

interface PostStatusBadgeProps {
  status: PostStatus;
}

/**
 * Renders a post's lifecycle status. Shared between the public board (Step 18) and the
 * dashboard board detail (Step 19.3) — the status is part of `postSchema` and `publicPostSchema`
 * alike, so the same badge reads either.
 */
export function PostStatusBadge({ status }: PostStatusBadgeProps): ReactElement {
  const t = useTranslations('publicBoard.status');

  return <Badge>{t(status)}</Badge>;
}
