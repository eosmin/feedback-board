import type { BoardPost } from '@feedback-board/shared';
import { MessageSquare } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import type { PostPatch } from '../../lib/post-patch';
import { PostClassificationBadge } from './post-classification-badge';
import { PostStatusBadge } from './post-status-badge';
import { VoteButton } from './vote-button';

interface PostRowProps {
  orgSlug: string;
  post: BoardPost;
  onOpen: (postId: string) => void;
  /** Receives the changed fields of a post; the owner merges them into its `BoardPost`. */
  onUpdated: (patch: PostPatch) => void;
}

/**
 * One dense row of the board list: vote chip on the left, then title, a two-line description and
 * the badges and meta line. The whole row opens the drawer, but only the title is the control: its
 * `after` pseudo-element stretches over the row, so the vote chip (a sibling, lifted above it) is
 * never a button nested in a button, and the heading stays a heading for assistive tech.
 */
export function PostRow({ orgSlug, post, onOpen, onUpdated }: PostRowProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail');
  const format = useFormatter();

  return (
    <li className="relative flex gap-3 rounded-control border border-border bg-surface-raised p-4 shadow-surface transition-colors focus-within:border-border-strong hover:border-border-strong">
      <VoteButton orgSlug={orgSlug} post={post} onUpdated={onUpdated} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="text-title text-text">
          <button
            type="button"
            onClick={() => onOpen(post.id)}
            className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-control focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-focus"
          >
            {post.title}
          </button>
        </h2>
        <p className="line-clamp-2 break-words text-body text-text-muted">{post.body}</p>
        <div className="flex flex-wrap items-center gap-2">
          <PostStatusBadge status={post.status} />
          <PostClassificationBadge category={post.aiCategory} priority={post.aiPriority} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
          <span
            className="inline-flex items-center gap-1"
            aria-label={t('commentCountLabel', { count: post.commentCount })}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-hidden="true">{post.commentCount}</span>
          </span>
          <span>
            {t('meta', {
              author: post.authorName,
              date: format.dateTime(new Date(post.createdAt), { dateStyle: 'medium' }),
            })}
          </span>
        </div>
      </div>
    </li>
  );
}
