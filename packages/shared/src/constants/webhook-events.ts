export const WEBHOOK_EVENT = {
  POST_CREATED: 'post.created',
  POST_STATUS_CHANGED: 'post.status_changed',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENT)[keyof typeof WEBHOOK_EVENT];

export const WEBHOOK_EVENTS = Object.values(WEBHOOK_EVENT);
