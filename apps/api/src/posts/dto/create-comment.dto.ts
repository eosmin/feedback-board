import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * Shape mirrors `createCommentSchema` in `packages/shared/src/schemas/comment.ts` (TDD §7.1).
 */
export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 5_000 })
  @IsString()
  @Length(1, 5_000)
  body!: string;
}
