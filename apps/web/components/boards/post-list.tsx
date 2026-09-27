import type { Post } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { PostClassificationBadge } from './post-classification-badge';
import { PostComments } from './post-comments';
import { PostStatusBadge } from './post-status-badge';
import { PostStatusSelect } from './post-status-select';
import { VoteButton } from './vote-button';

interface PostListProps {
  orgSlug: string;
  posts: Post[];
  /** OWNER/ADMIN get the status control; everyone else sees the read-only badge (TDD §11). */
  canManage: boolean;
  onUpdated: (post: Post) => void;
}

/**
 * The admin board's post list (TDD §11, §13 step 19.3): every status, not just the ones a public
 * visitor would see — `PublicPostList` (Step 18) is the read-only counterpart with no vote
 * button, status control or comment form. Each entry here carries its own vote button, status
 * control (or badge), classification badge, and comment thread.
 */
export function PostList({ orgSlug, posts, canManage, onUpdated }: PostListProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail');

  if (posts.length === 0) {
    return <p>{t('postsEmpty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {posts.map((post) => (
        <li key={post.id} className="rounded-lg border border-brand-100 p-4">
          <h2 className="font-medium">{post.title}</h2>
          <p className="mt-1 text-sm">{post.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canManage ? (
              <PostStatusSelect orgSlug={orgSlug} post={post} onUpdated={onUpdated} />
            ) : (
              <PostStatusBadge status={post.status} />
            )}
            <PostClassificationBadge category={post.aiCategory} priority={post.aiPriority} />
            <VoteButton orgSlug={orgSlug} post={post} onUpdated={onUpdated} />
          </div>
          <PostComments orgSlug={orgSlug} postId={post.id} />
        </li>
      ))}
    </ul>
  );
}
