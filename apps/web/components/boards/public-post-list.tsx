import type { PublicPost } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { PostClassificationBadge } from './post-classification-badge';
import { PostStatusBadge } from './post-status-badge';

interface PublicPostListProps {
  posts: PublicPost[];
}

/**
 * Read-only post list for the public board (TDD §11, §12): no vote button, no comment form, no
 * status-change control — the public API exposes none of that, so there is nothing here to wire
 * up even as a disabled affordance.
 */
export function PublicPostList({ posts }: PublicPostListProps): ReactElement {
  const t = useTranslations('publicBoard');

  if (posts.length === 0) {
    return <p>{t('empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {posts.map((post) => (
        <li key={post.id} className="rounded-lg border border-brand-100 p-4">
          <h2 className="font-medium">{post.title}</h2>
          <p className="mt-1 text-sm">{post.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PostStatusBadge status={post.status} />
            <PostClassificationBadge category={post.aiCategory} priority={post.aiPriority} />
            <span className="text-xs">{t('voteCount', { count: post.voteCount })}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
