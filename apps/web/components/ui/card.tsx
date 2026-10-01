import type { ElementType, HTMLAttributes, ReactElement } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** `li` for list entries (org/board/post/webhook rows), `div`/`section` elsewhere. */
  as?: ElementType;
}

/**
 * The bordered, rounded container repeated across every list row and standalone panel (org
 * list, board list, post list, public post list, webhook list, the AI digest panel). `as` lets
 * list rows render a real `<li>` instead of a `<div>` inside a `<ul>`.
 */
export function Card({ as: Component = 'div', className, ...props }: CardProps): ReactElement {
  const classes = ['rounded-control border border-zinc-200 bg-white p-4 shadow-surface', className]
    .filter(Boolean)
    .join(' ');
  return <Component className={classes} {...props} />;
}
