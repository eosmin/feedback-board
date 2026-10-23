'use client';

import {
  POST_STATUSES,
  postSchema,
  updatePostStatusSchema,
  type Post,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { apiFetch } from '../../lib/api-client';
import type { PostPatch } from '../../lib/post-patch';
import { Select, useToast } from '../ui';

interface PostStatusSelectProps {
  orgSlug: string;
  post: Post;
  /** Called with the new status from the `PATCH` response (TDD §11). */
  onUpdated: (patch: PostPatch) => void;
}

/**
 * OWNER/ADMIN-only status control (TDD §11, §12), shown in the post drawer where a post is edited;
 * everywhere else, and for a plain MEMBER, the status is the read-only `PostStatusBadge`. `status`
 * is validated client-side through `updatePostStatusSchema` before the request, the same shape the
 * API's DTO enforces server-side.
 */
export function PostStatusSelect({
  orgSlug,
  post,
  onUpdated,
}: PostStatusSelectProps): ReactElement {
  const tStatus = useTranslations('publicBoard.status');
  const t = useTranslations('dashboard.boardDetail');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleChange(value: string): Promise<void> {
    setIsSubmitting(true);
    try {
      const dto = updatePostStatusSchema.parse({ status: value });
      const updated = await apiFetch(`/orgs/${orgSlug}/posts/${post.id}`, postSchema, {
        method: 'PATCH',
        body: dto,
      });
      // Only the status: the rest of this response is as old as the request, and the vote count in
      // particular may have moved since.
      onUpdated({ id: updated.id, status: updated.status });
      toast(t('statusSuccess'));
    } catch {
      toast(t('statusError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Select
      aria-label={t('statusLabel')}
      value={post.status}
      onValueChange={(value) => void handleChange(value)}
      disabled={isSubmitting}
      options={POST_STATUSES.map((status) => ({ value: status, label: tStatus(status) }))}
    />
  );
}
