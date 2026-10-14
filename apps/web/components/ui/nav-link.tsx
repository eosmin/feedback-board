'use client';

import { usePathname } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';

import { Link } from './link';

export interface NavLinkProps {
  href: string;
  icon?: ReactNode;
  className?: string;
  /** Active only on `href` itself, not on the paths below it (a section's index page). */
  end?: boolean;
  /** Further paths, and the paths below them, that also mark this link active. */
  activePaths?: string[];
  children: ReactNode;
}

const BASE_CLASSNAME =
  'flex items-center gap-2 rounded-control px-2 py-1.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const IDLE_CLASSNAME = 'text-text-muted hover:bg-surface-sunken hover:text-text';
const ACTIVE_CLASSNAME = 'bg-accent-soft font-medium text-accent-soft-text';

function isWithin(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * A sidebar link. Navigation feedback (bar, dimmed content, `cursor: progress`) comes from
 * `NavigationProgress` for every link, so there is no per-link spinner.
 */
export function NavLink({
  href,
  icon,
  className,
  end = false,
  activePaths = [],
  children,
}: NavLinkProps): ReactElement {
  const pathname = usePathname();
  const active =
    (end ? pathname === href : isWithin(pathname, href)) ||
    activePaths.some((path) => isWithin(pathname, path));

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[BASE_CLASSNAME, active ? ACTIVE_CLASSNAME : IDLE_CLASSNAME, className]
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
      {children}
    </Link>
  );
}
