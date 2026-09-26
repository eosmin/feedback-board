import type { PostStatus } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

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

  return (
    <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
      {t(status)}
    </span>
  );
}
