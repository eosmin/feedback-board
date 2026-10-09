import type { PostCategory, PostPriority } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge } from '../ui';
import type { BadgeTone } from '../ui/badge';

const PRIORITY_TONE: Record<PostPriority, BadgeTone> = {
  LOW: 'priority-low',
  MEDIUM: 'priority-medium',
  HIGH: 'priority-high',
};

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
      {category !== null && <Badge tone="neutral">{tCategory(category)}</Badge>}
      {priority !== null && <Badge tone={PRIORITY_TONE[priority]}>{tPriority(priority)}</Badge>}
    </span>
  );
}
