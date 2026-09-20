import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

/**
 * Shape mirrors `createOrgSchema` in `packages/shared/src/schemas/org.ts` (TDD §7.1) — the two
 * are validated by hand at review time rather than generated from one another (no codegen
 * bridge for a project this size, YAGNI).
 *
 * The reserved-slug rule (`RESERVED_ORG_SLUGS`, TDD §12) has no `class-validator` equivalent —
 * there is no built-in "not in this list" decorator — so it is enforced in `OrgsService` via
 * `orgSlugSchema` from `packages/shared`, the single source of truth for the format, instead of
 * being duplicated here as a second, hand-written check.
 */
export class CreateOrgDto {
  @ApiProperty({ minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  name!: string;

  @ApiProperty({ minLength: 2, maxLength: 50, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
