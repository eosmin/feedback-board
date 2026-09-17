import { z } from 'zod';

import { WEBHOOK_EVENTS } from '../constants/webhook-events';

export const createWebhookSchema = z.object({
  targetUrl: z.url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

/**
 * The stored secret is deliberately absent: it is shown once at creation and never rendered
 * again, so the list shape must not be able to carry it (TDD §3.5).
 */
export const webhookSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  targetUrl: z.string(),
  events: z.array(z.enum(WEBHOOK_EVENTS)),
  // Flipped to false by the downgrade handler rather than deleted, so the dashboard can render
  // the row as disabled with an upgrade prompt (TDD §3.7 step 6).
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type Webhook = z.infer<typeof webhookSchema>;

/** The creation response, and the only shape that ever carries the secret. */
export const webhookCreatedSchema = webhookSchema.extend({
  secret: z.string(),
});

export type WebhookCreated = z.infer<typeof webhookCreatedSchema>;

/** One row per delivery attempt, never updated in place (TDD §3.7). */
export const webhookDeliverySchema = z.object({
  id: z.uuid(),
  webhookId: z.uuid(),
  orgId: z.uuid(),
  event: z.enum(WEBHOOK_EVENTS),
  payload: z.unknown(),
  // Null when the attempt never got a response at all — a network error rather than an HTTP one.
  responseStatus: z.number().int().nullable(),
  attempt: z.number().int().positive(),
  createdAt: z.iso.datetime(),
});

export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;

/** The signed body the worker POSTs to the target URL (TDD §3.7 step 3). */
export const webhookPayloadSchema = z.object({
  event: z.enum(WEBHOOK_EVENTS),
  data: z.unknown(),
  timestamp: z.iso.datetime(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
