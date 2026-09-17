import { z } from 'zod';

/**
 * `POST /orgs/:orgSlug/posts/:postId/votes` toggles: the caller is the voter and the post comes
 * from the path, so the request carries no body at all. The response reports the resulting state
 * so the button can render without refetching the post.
 */
export const voteToggleResultSchema = z.object({
  postId: z.uuid(),
  voted: z.boolean(),
  voteCount: z.number().int().nonnegative(),
});

export type VoteToggleResult = z.infer<typeof voteToggleResultSchema>;
