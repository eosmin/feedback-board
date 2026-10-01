'use client';

import type { OrgSummary } from '@feedback-board/shared';
import { ChevronDown, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

import { useClickOutside } from '../../lib/use-click-outside';
import { Dialog } from '../ui';
import { CreateOrgForm } from './create-org-form';

const VISIBLE_ORG_LIMIT = 5;

interface OrgSwitcherProps {
  currentOrgSlug: string;
  currentOrgName: string;
  /** The caller's full org list, fetched once by the server layout (TDD §11 `GET /orgs`). */
  orgs: OrgSummary[];
}

/**
 * Topbar org switcher (TDD.md §13 step 19.7 follow-up). Shows at most the first
 * `VISIBLE_ORG_LIMIT` orgs plus, when there are more, a link to the full picker at `/dashboard`
 * — that page already lists every org (TDD §12), so this never re-implements pagination. "Create
 * new" reuses the same `CreateOrgForm`/`Dialog` pair `OrgPicker` uses rather than a second copy;
 * on success it navigates straight to the new org instead of appending to a local list, since
 * this component (unlike `OrgPicker`) is not the org list's owner.
 */
export function OrgSwitcher({ currentOrgSlug, currentOrgName, orgs }: OrgSwitcherProps): ReactElement {
  const t = useTranslations('dashboard.shell.orgSwitcher');
  const tCommon = useTranslations('common');
  const tCreate = useTranslations('dashboard.createOrg');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  const visibleOrgs = orgs.slice(0, VISIBLE_ORG_LIMIT);
  const hasMore = orgs.length > VISIBLE_ORG_LIMIT;

  function handleCreated(org: OrgSummary): void {
    setDialogOpen(false);
    setOpen(false);
    router.push(`/dashboard/${org.slug}`);
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-0 items-center gap-1.5 rounded-control px-2 py-1.5 text-body font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <span className="truncate">{currentOrgName}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="menu"
          aria-label={t('label')}
          className="absolute left-0 z-40 mt-1 w-64 rounded-control border border-zinc-200 bg-white py-1 shadow-popover"
        >
          {visibleOrgs.map((org) => (
            <li key={org.id} role="none">
              <Link
                href={`/dashboard/${org.slug}`}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={org.slug === currentOrgSlug ? 'true' : undefined}
                className={`block truncate px-3 py-1.5 text-body hover:bg-zinc-50 ${
                  org.slug === currentOrgSlug ? 'font-medium text-brand-700' : 'text-zinc-700'
                }`}
              >
                {org.name}
              </Link>
            </li>
          ))}

          {hasMore && (
            <li role="none" className="mt-1 border-t border-zinc-200 pt-1">
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-3 py-1.5 text-body font-medium text-zinc-600 hover:bg-zinc-50"
              >
                {t('viewAll', { count: String(orgs.length - VISIBLE_ORG_LIMIT) })}
              </Link>
            </li>
          )}

          <li role="none" className={hasMore ? '' : 'mt-1 border-t border-zinc-200 pt-1'}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('createNew')}
            </button>
          </li>
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={tCreate('title')}
        closeLabel={tCommon('close')}
      >
        <CreateOrgForm onCreated={handleCreated} />
      </Dialog>
    </div>
  );
}
