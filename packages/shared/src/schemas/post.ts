import { z } from 'zod';

import { POST_CATEGORIES, POST_PRIORITIES, POST_STATUSES } from '../constants/post-enums';

export const createPostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(10_000),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

/** `PATCH /orgs/:orgSlug/posts/:postId` — status is the only mutable field (TDD §11). */
export const updatePostStatusSchema = z.object({
  status: z.enum(POST_STATUSES),
});

export type UpdatePostStatusInput = z.infer<typeof updatePostStatusSchema>;

export const postSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  orgId: z.uuid(),
  authorId: z.uuid(),
  title: z.string(),
  body: z.string(),
  status: z.enum(POST_STATUSES),
  voteCount: z.number().int().nonnegative(),
  // Null until the classification job succeeds, and null forever if it exhausts its attempts —
  // a post is fully valid without either (TDD §3.8).
  aiCategory: z.enum(POST_CATEGORIES).nullable(),
  aiPriority: z.enum(POST_PRIORITIES).nullable(),
  createdAt: z.iso.datetime(),
});

export type Post = z.infer<typeof postSchema>;

/**
 * One row of the dashboard board list (`GET /orgs/:orgSlug/boards/:boardSlug/posts`): the post
 * plus what a dense list shows without a request per row. `authorName` is the author's display
 * name, falling back to the local part of their email, so a teammate's address is never shown in
 * full to a plain member.
 */
export const boardPostSchema = postSchema.extend({
  commentCount: z.number().int().nonnegative(),
  authorName: z.string(),
});

export type BoardPost = z.infer<typeof boardPostSchema>;

/** The public board list omits the author: `/public/*` is unauthenticated (TDD §11). */
export const publicPostSchema = postSchema.omit({ authorId: true, orgId: true });

export type PublicPost = z.infer<typeof publicPostSchema>;
