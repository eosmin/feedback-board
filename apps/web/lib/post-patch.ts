import type { Post } from '@feedback-board/shared';

/**
 * The part of a post a control has just learned from the server. Merged into the list entry that
 * is current when the response lands, so a slow response cannot put back a field (the status, say)
 * that changed while it was in flight.
 */
export type PostPatch = Pick<Post, 'id'> & Partial<Post>;
