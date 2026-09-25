import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { webhookPayloadSchema } from '@feedback-board/shared';
import type { WebhookEvent } from '@feedback-board/shared';

/** `responseStatus` is `null` on a network error — the attempt got no HTTP status at all (TDD §3.7). */
export interface WebhookDeliveryResult {
  readonly responseStatus: number | null;
}

const SIGNATURE_HEADER = 'X-FeedbackBoard-Signature';
const EVENT_HEADER = 'X-FeedbackBoard-Event';

/**
 * Signs and sends one outbound webhook delivery (TDD §3.7 step 3). The only caller is
 * `apps/worker`'s `WebhookDeliveryProcessor`, and this still lives in `packages/core` rather
 * than `apps/worker` — the same rule that puts `AiService` here (§3.10): cross-app server logic
 * belongs in the shared package, even with a single consumer today.
 *
 * Holds no state of its own (no client object, no connection pool), so a plain zero-argument
 * `@Injectable()` is enough — unlike `AiService`, this needs no `register()` dynamic module.
 * `fetchImpl` is a method parameter, not a constructor field, for the same reason
 * `resolveModel()` takes one (§2.6.8b): a zero-arg constructor lets Nest instantiate this class
 * by type with no DI wiring, and a constructor-typed `typeof fetch` parameter would otherwise
 * make Nest try (and fail) to resolve a provider for a bare `Function` token.
 */
@Injectable()
export class WebhookDeliveryService {
  async deliver(
    targetUrl: string,
    secret: string,
    event: WebhookEvent,
    data: unknown,
    fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  ): Promise<WebhookDeliveryResult> {
    const payload = webhookPayloadSchema.parse({
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    const body = JSON.stringify(payload);
    const signature = this.sign(secret, body);

    try {
      const response = await fetchImpl(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: `sha256=${signature}`,
          [EVENT_HEADER]: event,
        },
        body,
      });
      return { responseStatus: response.status };
    } catch {
      // Network error — no status was ever received (TDD §3.7's rationale for the nullable column).
      return { responseStatus: null };
    }
  }

  private sign(secret: string, body: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }
}
