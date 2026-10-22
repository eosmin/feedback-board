import NextLink from 'next/link';
import type { ComponentProps, ReactElement } from 'react';

/**
 * `next/link` with prefetching off by default. Every page here is dynamic, so a prefetch only
 * stores the part of the route up to its `loading.tsx`; a click that finds that entry commits the
 * new route before its data arrives and, in this app, paints an empty content area instead of the
 * skeleton until the page lands (reproduced on sidebar, board and org links, worse right after a
 * reload while the prefetches are still in flight). Without it the router waits, keeps the current
 * page dimmed under the progress bar, and shows the destination's skeleton on arrival. Lint blocks
 * `next/link` outside this file so a new link cannot bring the gap back.
 */
export function Link({
  prefetch = false,
  ...props
}: ComponentProps<typeof NextLink>): ReactElement {
  return <NextLink prefetch={prefetch} {...props} />;
}
