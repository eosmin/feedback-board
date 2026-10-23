import type { BoardPost } from '@feedback-board/shared';
import type { ReactElement } from 'react';

import type { PostPatch } from '../../lib/post-patch';
import { PostRow } from './post-row';

interface PostListProps {
  orgSlug: string;
  posts: BoardPost[];
  onOpen: (postId: string) => void;
  /** Receives the changed fields of a post; the owner merges them into its `BoardPost`. */
  onUpdated: (patch: PostPatch) => void;
}

/**
 * The admin board's post list (TDD §11, §13 step 19.3): every status, not just the ones a public
 * visitor would see — `PublicPostList` (Step 18) is the read-only counterpart with no vote button
 * or drawer. Rows are dense and read-only; the detail, comments and status editing live in the
 * drawer. The empty board and the no-results screens are the caller's: they are different states.
 */
export function PostList({ orgSlug, posts, onOpen, onUpdated }: PostListProps): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {posts.map((post) => (
        <PostRow
          key={post.id}
          orgSlug={orgSlug}
          post={post}
          onOpen={onOpen}
          onUpdated={onUpdated}
        />
      ))}
    </ul>
  );
}
