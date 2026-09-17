/**
 * Category and priority are assigned by the classification job and stay null when it fails or
 * has not run yet; neither is related to the lifecycle status, which is set by a human (TDD §3.8).
 */

export const POST_CATEGORIES = ['BUG', 'FEATURE_REQUEST', 'UX', 'OTHER'] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];

export const POST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export type PostPriority = (typeof POST_PRIORITIES)[number];

export const POST_STATUSES = ['OPEN', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CLOSED'] as const;

export type PostStatus = (typeof POST_STATUSES)[number];
