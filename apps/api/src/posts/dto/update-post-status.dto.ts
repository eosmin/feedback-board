import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { POST_STATUSES } from '@feedback-board/shared';
import type { PostStatus } from '@feedback-board/shared';

/**
 * `PATCH /orgs/:orgSlug/posts/:postId` — status is the only mutable field (TDD §11). Mirrors
 * `updatePostStatusSchema` in `packages/shared/src/schemas/post.ts`. No `@IsEnum` decorator here:
 * `class-validator`'s `@IsEnum` expects a TypeScript `enum`, not a `readonly` string-literal
 * tuple, so `@IsIn` against the same `POST_STATUSES` constant is the one-source-of-truth option.
 */
export class UpdatePostStatusDto {
  @ApiProperty({ enum: POST_STATUSES })
  @IsIn(POST_STATUSES)
  status!: PostStatus;
}
