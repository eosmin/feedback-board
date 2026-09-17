import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const commentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  orgId: z.uuid(),
  authorId: z.uuid(),
  body: z.string(),
  createdAt: z.iso.datetime(),
});

export type Comment = z.infer<typeof commentSchema>;
