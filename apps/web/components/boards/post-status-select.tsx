'use client';

import {
  POST_STATUSES,
  postSchema,
  updatePostStatusSchema,
  type Post,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ChangeEvent, ReactElement } from 'react';
import { useState } from 'react';

import { apiFetch } from '../../lib/api-client';

interface PostStatusSelectProps {
  orgSlug: string;
  post: Post;
  /** Called with the full updated post returned by `PATCH` (TDD §11). */
  onUpdated: (post: Post) => void;
}

/**
 * OWNER/ADMIN-only status control (TDD §11, §12) — `PostList` renders `PostStatusBadge`
 * (read-only) instead of this for a plain MEMBER. `status` is validated client-side through
 * `updatePostStatusSchema` before the request, the same shape the API's DTO enforces server-side.
 */
export function PostStatusSelect({
  orgSlug,
  post,
  onUpdated,
}: PostStatusSelectProps): ReactElement {
  const tStatus = useTranslations('publicBoard.status');
  const tLabel = useTranslations('dashboard.boardDetail');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLSelectElement>): Promise<void> {
    const dto = updatePostStatusSchema.parse({ status: event.target.value });
    setIsSubmitting(true);
    try {
      const updated = await apiFetch(`/orgs/${orgSlug}/posts/${post.id}`, postSchema, {
        method: 'PATCH',
        body: dto,
      });
      onUpdated(updated);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <label>
      <span className="sr-only">{tLabel('statusLabel')}</span>
      <select
        value={post.status}
        onChange={(event) => void handleChange(event)}
        disabled={isSubmitting}
      >
        {POST_STATUSES.map((status) => (
          <option key={status} value={status}>
            {tStatus(status)}
          </option>
        ))}
      </select>
    </label>
  );
}
