/** The complete set of events this product emits; a webhook subscribes to a subset (TDD §3.7). */
export const WEBHOOK_EVENTS = ['post.created', 'post.status_changed'] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
