'use client';

import type { BoardPost } from '@feedback-board/shared';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import type { PostPatch } from '../../lib/post-patch';
import { Drawer } from '../ui';
import { PostClassificationBadge } from './post-classification-badge';
import { PostComments } from './post-comments';
import { PostStatusBadge } from './post-status-badge';
import { PostStatusSelect } from './post-status-select';
import { VoteButton } from './vote-button';

interface PostDrawerProps {
  orgSlug: string;
  /** The open post, or `null` when the drawer is closed. */
  post: BoardPost | null;
  /** OWNER/ADMIN edit the status here; everyone else sees the read-only badge (TDD §11). */
  canManage: boolean;
  onClose: () => void;
  /** Receives the changed fields of a post; the owner merges them into its `BoardPost`. */
  onUpdated: (patch: PostPatch) => void;
  onCommentAdded: (postId: string) => void;
}

/**
 * The full post with its comments, opened from a list row. Full-screen on mobile, a right-hand
 * panel from `sm` up (the `Drawer` primitive). Status is the one editable field, so the `Select`
 * lives here and only for OWNER/ADMIN; the list always shows the badge.
 */
export function PostDrawer({
  orgSlug,
  post,
  canManage,
  onClose,
  onUpdated,
  onCommentAdded,
}: PostDrawerProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  // The close animation outlives `post` becoming `null`; keep drawing the last post until it ends.
  const [lastPost, setLastPost] = useState(post);
  if (post !== null && post !== lastPost) {
    setLastPost(post);
  }
  const shown = post ?? lastPost;

  return (
    <Drawer
      open={post !== null}
      onClose={onClose}
      title={shown?.title ?? ''}
      closeLabel={tCommon('close')}
    >
      {shown !== null && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <PostStatusSelect orgSlug={orgSlug} post={shown} onUpdated={onUpdated} />
            ) : (
              <PostStatusBadge status={shown.status} />
            )}
            <PostClassificationBadge category={shown.aiCategory} priority={shown.aiPriority} />
          </div>
          <div className="flex items-center gap-3">
            <VoteButton orgSlug={orgSlug} post={shown} onUpdated={onUpdated} />
            <p className="text-caption text-text-muted">
              {t('meta', {
                author: shown.authorName,
                date: format.dateTime(new Date(shown.createdAt), { dateStyle: 'medium' }),
              })}
            </p>
          </div>
          <p className="whitespace-pre-wrap break-words text-body text-text">{shown.body}</p>
          <PostComments
            key={shown.id}
            orgSlug={orgSlug}
            postId={shown.id}
            onAdded={() => onCommentAdded(shown.id)}
          />
        </div>
      )}
    </Drawer>
  );
}
