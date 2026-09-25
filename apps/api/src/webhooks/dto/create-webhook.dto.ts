import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsUrl } from 'class-validator';
import { WEBHOOK_EVENTS } from '@feedback-board/shared';
import type { WebhookEvent } from '@feedback-board/shared';

/**
 * Shape mirrors `createWebhookSchema` in `packages/shared/src/schemas/webhook.ts` (TDD §7.1).
 * `require_tld: false` on `@IsUrl` is deliberate: the e2e suite's local HTTP listener target
 * (`http://127.0.0.1:<port>/...`) has no TLD, and the default `class-validator` options would
 * reject it as an invalid URL.
 */
export class CreateWebhookDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  targetUrl!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];
}
