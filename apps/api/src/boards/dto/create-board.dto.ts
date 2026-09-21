import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Shape mirrors `createBoardSchema` in `packages/shared/src/schemas/board.ts` (TDD §7.1). Board
 * slugs are nested under an org (`@@unique([orgId, slug])`), so unlike `CreateOrgDto` there is
 * no reserved-slug rule to enforce here — only the shared format.
 */
export class CreateBoardDto {
  @ApiProperty({ minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  name!: string;

  @ApiProperty({ minLength: 2, maxLength: 50, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
