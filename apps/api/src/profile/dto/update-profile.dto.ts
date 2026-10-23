import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

/**
 * Shape mirrors `updateProfileSchema` in `packages/shared/src/schemas/profile.ts`.
 * The `Matches` refuses a name that is only whitespace; the service stores it trimmed.
 */
export class UpdateProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  name!: string;
}
