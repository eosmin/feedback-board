import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

export interface NavLinkProps {
  href: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const BASE_CLASSNAME =
  'flex items-center gap-2 rounded-control px-2 py-1.5 text-body text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * A sidebar link. Navigation feedback (bar, dimmed content, `cursor: wait`) comes from
 * `NavigationProgress` for every link, so there is no per-link spinner.
 */
export function NavLink({ href, icon, className, children }: NavLinkProps): ReactElement {
  return (
    <Link href={href} className={[BASE_CLASSNAME, className].filter(Boolean).join(' ')}>
      {icon}
      {children}
    </Link>
  );
}
