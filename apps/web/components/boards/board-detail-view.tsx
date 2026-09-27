'use client';

import {
  boardDetailSchema,
  orgDetailSchema,
  postSchema,
  type BoardDetail,
  type OrgDetail,
  type Post,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';
import { AiDigestPanel } from './ai-digest-panel';
import { CreatePostForm } from './create-post-form';
import { PostList } from './post-list';

const postListSchema = z.array(postSchema);

interface BoardDetailViewProps {
  orgSlug: string;
  boardSlug: string;
}

/**
 * The interactive admin board view (TDD §12, §13 step 19.3): create post, vote, comment, change
 * status. A Client Component end to end, unlike the org overview and billing pages — §12's route
 * table marks this one "Client Component (interactive voting/comments)" because every action here
 * is interactive, leaving no meaningful server-rendered read to split into a parent Server
 * Component. Data is therefore fetched client-side on mount rather than passed down as props.
 * `org.role` (from `GET /orgs/:orgSlug`, TDD §11) decides whether "Generate AI Summary" renders —
 * presentation only, the route's own `@Roles('OWNER', 'ADMIN')` guard is the real enforcement.
 */
export function BoardDetailView({ orgSlug, boardSlug }: BoardDetailViewProps): ReactElement {
  const tCommon = useTranslations('common');
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const [orgResult, boardResult, postsResult] = await Promise.all([
        apiFetch(`/orgs/${orgSlug}`, orgDetailSchema),
        apiFetch(`/orgs/${orgSlug}/boards/${boardSlug}`, boardDetailSchema),
        apiFetch(`/orgs/${orgSlug}/boards/${boardSlug}/posts`, postListSchema),
      ]);

      if (!cancelled) {
        setOrg(orgResult);
        setBoard(boardResult);
        setPosts(postsResult);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [orgSlug, boardSlug]);

  function handlePostCreated(post: Post): void {
    setPosts((current) => (current === null ? [post] : [...current, post]));
  }

  function handlePostUpdated(updated: Post): void {
    setPosts((current) =>
      current === null ? current : current.map((post) => (post.id === updated.id ? updated : post)),
    );
  }

  if (org === null || board === null || posts === null) {
    return <p>{tCommon('loading')}</p>;
  }

  const canManage = org.role === 'OWNER' || org.role === 'ADMIN';

  return (
    <main>
      <h1>{board.name}</h1>
      <CreatePostForm orgSlug={orgSlug} boardSlug={boardSlug} onCreated={handlePostCreated} />
      {canManage && <AiDigestPanel orgSlug={orgSlug} boardSlug={boardSlug} />}
      <PostList
        orgSlug={orgSlug}
        posts={posts}
        canManage={canManage}
        onUpdated={handlePostUpdated}
      />
    </main>
  );
}
