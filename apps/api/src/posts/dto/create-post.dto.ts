import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * Shape mirrors `createPostSchema` in `packages/shared/src/schemas/post.ts` (TDD §7.1).
 * `aiCategory`/`aiPriority` are never accepted from the client — they start `null` and are
 * populated only by the classification job Step 10 adds (TDD §3.8).
 */
export class CreatePostDto {
  @ApiProperty({ minLength: 3, maxLength: 200 })
  @IsString()
  @Length(3, 200)
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 10_000 })
  @IsString()
  @Length(1, 10_000)
  body!: string;
}
