'use client';

import {
  boardDetailSchema,
  boardPostSchema,
  orgDetailSchema,
  type BoardDetail,
  type BoardPost,
  type OrgDetail,
} from '@feedback-board/shared';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { apiFetch } from '../../lib/api-client';
import { NO_FILTERS, applyBoardFilters, hasActiveFilters } from '../../lib/board-filters';
import type { PostPatch } from '../../lib/post-patch';
import { useBoardUrlState } from '../../lib/use-board-url-state';
import { usePublishBoardLabel } from '../dashboard/board-breadcrumb-label';
import { Button, Dialog, EmptyState, PageHeader, useToast } from '../ui';
import { AiDigestPanel } from './ai-digest-panel';
import { BoardDetailSkeleton } from './board-detail-skeleton';
import { CreatePostForm } from './create-post-form';
import { PostDrawer } from './post-drawer';
import { PostFilters } from './post-filters';
import { PostList } from './post-list';
import { ShareBoardButton } from './share-board-button';

const postListSchema = z.array(boardPostSchema);

function fetchPosts(orgSlug: string, boardSlug: string): Promise<BoardPost[]> {
  return apiFetch(`/orgs/${orgSlug}/boards/${boardSlug}/posts`, postListSchema);
}

interface BoardDetailViewProps {
  orgSlug: string;
  boardSlug: string;
}

/**
 * The interactive admin board view (TDD §12, §13 step 19.3, step 22.11): a dense, filterable post
 * list and a drawer with the full post, its comments and (for OWNER/ADMIN) the status control. A
 * Client Component end to end, unlike the org overview and billing pages — §12's route table marks
 * this one "Client Component (interactive voting/comments)" because every action here is
 * interactive, leaving no meaningful server-rendered read to split into a parent Server Component.
 * Data is therefore fetched client-side on mount rather than passed down as props. Search, sort,
 * filters and the open post live in the URL (`useBoardUrlState`), so a view survives a reload.
 * `org.role` (from `GET /orgs/:orgSlug`, TDD §11) decides whether the AI summary and the status
 * select render — presentation only, the routes' own `@Roles('OWNER', 'ADMIN')` guards are the
 * real enforcement.
 */
export function BoardDetailView({ orgSlug, boardSlug }: BoardDetailViewProps): ReactElement {
  const tCommon = useTranslations('common');
  const t = useTranslations('dashboard.boardDetail');
  const tCreatePost = useTranslations('dashboard.boardDetail.createPost');
  const { toast } = useToast();
  const { filters, selectedPostId, setFilters, setSelectedPostId } = useBoardUrlState();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [posts, setPosts] = useState<BoardPost[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // The breadcrumb waits for this label. If the board cannot be loaded it would wait forever, so
  // the slug stands in for the name.
  usePublishBoardLabel(boardSlug, board?.name ?? (loadFailed ? boardSlug : null));

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [orgResult, boardResult, postsResult] = await Promise.all([
          apiFetch(`/orgs/${orgSlug}`, orgDetailSchema),
          apiFetch(`/orgs/${orgSlug}/boards/${boardSlug}`, boardDetailSchema),
          fetchPosts(orgSlug, boardSlug),
        ]);

        if (!cancelled) {
          setOrg(orgResult);
          setBoard(boardResult);
          setPosts(postsResult);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [orgSlug, boardSlug]);

  /**
   * A created post is not added by hand: the server owns the order (and the author name and
   * comment count the row needs), so the list is read again and replaced. The dialog stays up, with
   * its button pending, until that read lands, so the new row is already in place when it closes.
   * A new post is open and unclassified, so any status, category or priority filter would hide it:
   * the filters are cleared (the sort is kept) so the person sees what they just posted.
   */
  async function handlePostCreated(): Promise<void> {
    try {
      setPosts(await fetchPosts(orgSlug, boardSlug));
      setFilters(NO_FILTERS);
      toast(tCreatePost('success'));
    } catch {
      toast(tCreatePost('refreshFailed'), 'error');
    }
    setDialogOpen(false);
  }

  function handlePostUpdated(patch: PostPatch): void {
    setPosts((current) =>
      current === null
        ? current
        : current.map((post) => (post.id === patch.id ? { ...post, ...patch } : post)),
    );
  }

  function handleCommentAdded(postId: string): void {
    setPosts((current) =>
      current === null
        ? current
        : current.map((post) =>
            post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post,
          ),
    );
  }

  if (loadFailed) {
    // A `<main>` like the loaded and loading states, so nothing shifts.
    return (
      <main>
        <p role="alert" className="text-body text-danger">
          {tCommon('error.generic')}
        </p>
      </main>
    );
  }

  if (org === null || board === null || posts === null) {
    // The route's `loading.tsx` ends once this page mounts, but the data is fetched from here, so
    // keep a skeleton up until it lands instead of a bare line of text on an empty page.
    return <BoardDetailSkeleton />;
  }

  const canManage = org.role === 'OWNER' || org.role === 'ADMIN';
  const visiblePosts = applyBoardFilters(posts, filters);
  // A `?post=` naming a post that is not on this board opens nothing.
  const openPost = posts.find((post) => post.id === selectedPostId) ?? null;

  function clearFilters(): void {
    setFilters(NO_FILTERS);
  }

  return (
    <main>
      <PageHeader
        title={board.name}
        action={
          <div className="flex items-center gap-2">
            <ShareBoardButton orgSlug={orgSlug} boardSlug={boardSlug} isPublic={board.isPublic} />
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {tCreatePost('trigger')}
            </Button>
          </div>
        }
      />
      {canManage && <AiDigestPanel orgSlug={orgSlug} boardSlug={boardSlug} />}
      {posts.length === 0 ? (
        <EmptyState>{t('postsEmpty')}</EmptyState>
      ) : (
        <>
          <PostFilters
            filters={filters}
            onChange={setFilters}
            shown={visiblePosts.length}
            total={posts.length}
          />
          {visiblePosts.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyState>{t('noResults')}</EmptyState>
              {hasActiveFilters(filters) && (
                <Button variant="secondary" onClick={clearFilters}>
                  {t('clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <PostList
              orgSlug={orgSlug}
              posts={visiblePosts}
              onOpen={setSelectedPostId}
              onUpdated={handlePostUpdated}
            />
          )}
        </>
      )}
      <PostDrawer
        orgSlug={orgSlug}
        post={openPost}
        canManage={canManage}
        onClose={() => setSelectedPostId(null)}
        onUpdated={handlePostUpdated}
        onCommentAdded={handleCommentAdded}
      />
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={tCreatePost('title')}
        closeLabel={tCommon('close')}
      >
        <CreatePostForm orgSlug={orgSlug} boardSlug={boardSlug} onCreated={handlePostCreated} />
      </Dialog>
    </main>
  );
}
