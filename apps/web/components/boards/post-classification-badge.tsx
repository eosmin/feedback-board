import type { PostCategory, PostPriority } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge } from '../ui';

interface PostClassificationBadgeProps {
  category: PostCategory | null;
  priority: PostPriority | null;
}

/**
 * A post's AI category/priority stays `null` until the classification job succeeds, and forever
 * null if it exhausts its retries — a post is fully valid without either (TDD §3.8). This renders
 * nothing at all in that case, never a placeholder or a loading spinner: there is no polling here.
 */
export function PostClassificationBadge({
  category,
  priority,
}: PostClassificationBadgeProps): ReactElement | null {
  const tCategory = useTranslations('publicBoard.category');
  const tPriority = useTranslations('publicBoard.priority');

  if (category === null && priority === null) {
    return null;
  }

  return (
    <span className="inline-flex gap-1">
      {category !== null && <Badge variant="soft">{tCategory(category)}</Badge>}
      {priority !== null && <Badge variant="soft">{tPriority(priority)}</Badge>}
    </span>
  );
}
