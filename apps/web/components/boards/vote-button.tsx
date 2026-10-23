'use client';

import { voteToggleResultSchema, type Post } from '@feedback-board/shared';
import { ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { apiFetch } from '../../lib/api-client';
import type { PostPatch } from '../../lib/post-patch';
import { Spinner, useToast } from '../ui';

interface VoteButtonProps {
  orgSlug: string;
  post: Post;
  /** Called with the `voteCount` from the toggle response (TDD §11), and nothing else of the post. */
  onUpdated: (patch: PostPatch) => void;
}

/**
 * Toggles the caller's vote on a post (TDD §11): the endpoint carries no body, and its response
 * reports the resulting `voteCount`, so the button never has to refetch the post to reflect the
 * new count. `Post` carries no per-caller "has voted" flag, so this is a plain toggle rather than
 * a pressed/unpressed control — clicking always flips the caller's own vote. Drawn as the chip on
 * the left of a list row; the accessible name keeps the full "Vote (N)" phrase.
 */
export function VoteButton({ orgSlug, post, onUpdated }: VoteButtonProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick(): Promise<void> {
    setIsSubmitting(true);
    try {
      const result = await apiFetch(
        `/orgs/${orgSlug}/posts/${post.id}/votes`,
        voteToggleResultSchema,
        { method: 'POST' },
      );
      onUpdated({ id: post.id, voteCount: result.voteCount });
    } catch {
      toast(t('voteError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isSubmitting}
      aria-busy={isSubmitting || undefined}
      aria-label={t('voteButton', { count: post.voteCount })}
      className="relative z-10 flex h-14 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-control border border-border-strong bg-surface-raised text-text transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSubmitting ? (
        <Spinner />
      ) : (
        <ChevronUp className="h-4 w-4 text-text-muted" aria-hidden="true" />
      )}
      <span className="text-body font-medium tabular-nums">{post.voteCount}</span>
    </button>
  );
}
