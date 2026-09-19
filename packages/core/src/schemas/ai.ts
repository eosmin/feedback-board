import { z } from 'zod';

import { POST_CATEGORIES, POST_PRIORITIES } from '@feedback-board/shared';

/**
 * The `Output.object({ schema })` shape passed to `generateText` for post classification
 * (TDD §3.8). Built from the same enums Prisma and packages/shared use, so the model's output
 * and the `Post.aiCategory`/`Post.aiPriority` columns can never drift apart.
 */
export const postClassificationSchema = z.object({
  category: z.enum(POST_CATEGORIES),
  priority: z.enum(POST_PRIORITIES),
});

export type PostClassification = z.infer<typeof postClassificationSchema>;
