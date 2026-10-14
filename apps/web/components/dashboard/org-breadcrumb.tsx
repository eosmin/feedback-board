'use client';

import type { OrgSummary } from '@feedback-board/shared';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

import { Link, Skeleton } from '../ui';
import { useBoardLabel } from './board-breadcrumb-label';
import { OrgSwitcher } from './org-switcher';

const SECTIONS = ['boards', 'billing', 'webhooks'] as const;
type Section = (typeof SECTIONS)[number];

function isSection(value: string | undefined): value is Section {
  return SECTIONS.some((section) => section === value);
}

interface OrgBreadcrumbProps {
  orgSlug: string;
  orgName: string;
  orgs: OrgSummary[];
}

// Below `md` the crumb is a 44 px tall target: the line height centres the text and, being a block,
// the ellipsis still works.
const CRUMB_CLASSNAME =
  'block h-11 max-w-[14rem] truncate px-1 text-body leading-[2.75rem] md:h-auto md:leading-normal';
const CURRENT_CRUMB_CLASSNAME = `${CRUMB_CLASSNAME} font-medium text-text`;
const LINK_CRUMB_CLASSNAME = `${CRUMB_CLASSNAME} rounded-control text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`;

function Separator(): ReactElement {
  return (
    <li aria-hidden="true" className="hidden shrink-0 sm:block">
      <ChevronRight className="h-4 w-4 text-text-subtle" />
    </li>
  );
}

/**
 * `Org / Section / Board` for the org header. The org crumb is the switcher, which is why the
 * org name is not repeated in the sidebar. The tail is hidden below `sm`: the page's own heading
 * names the board there and the header has no room for it next to the menu and account buttons.
 * The org overview is the boards list, so it shows `Org / Boards`.
 */
export function OrgBreadcrumb({ orgSlug, orgName, orgs }: OrgBreadcrumbProps): ReactElement {
  const t = useTranslations('dashboard.shell');
  const pathname = usePathname();
  const boardLabel = useBoardLabel();

  const base = `/dashboard/${orgSlug}`;
  const [section, item] = pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1).split('/')
    : [];
  // The org overview is the boards list, so it reads `Org / Boards` like a board does
  // (`Org / Boards / Board`); there the section is the current page rather than a link.
  const sectionKey: Section | null = isSection(section)
    ? section
    : pathname === base
      ? 'boards'
      : null;
  const sectionName = sectionKey !== null ? t(`nav.${sectionKey}`) : null;
  const boardName = section === 'boards' && item !== undefined ? item : null;

  return (
    <nav aria-label={t('breadcrumb')} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1">
        <li className="min-w-0">
          <OrgSwitcher currentOrgSlug={orgSlug} currentOrgName={orgName} orgs={orgs} />
        </li>

        {sectionName !== null && (
          <>
            <Separator />
            <li className="hidden shrink-0 sm:block">
              {boardName === null ? (
                <span aria-current="page" className={CURRENT_CRUMB_CLASSNAME}>
                  {sectionName}
                </span>
              ) : (
                <Link href={base} className={LINK_CRUMB_CLASSNAME}>
                  {sectionName}
                </Link>
              )}
            </li>
          </>
        )}

        {boardName !== null && (
          <>
            <Separator />
            <li className="hidden min-w-0 sm:block">
              {boardLabel?.slug === boardName ? (
                <span aria-current="page" className={CURRENT_CRUMB_CLASSNAME}>
                  {boardLabel.name}
                </span>
              ) : (
                <Skeleton className="h-5 w-24" />
              )}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
