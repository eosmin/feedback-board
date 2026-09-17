import { z } from 'zod';

import { slugSchema } from './org';

export const createBoardSchema = z.object({
  name: z.string().trim().min(2).max(60),
  // Board slugs are nested under an org, so the reserved-segment rule of the org slug does not
  // apply here — only the shared format does.
  slug: slugSchema,
  isPublic: z.boolean().default(true),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export const boardSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  name: z.string(),
  slug: z.string(),
  isPublic: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type Board = z.infer<typeof boardSchema>;

/** `GET /orgs/:orgSlug/boards/:boardSlug` — metadata plus the counts the board page renders. */
export const boardDetailSchema = boardSchema.extend({
  postCount: z.number().int().nonnegative(),
});

export type BoardDetail = z.infer<typeof boardDetailSchema>;
