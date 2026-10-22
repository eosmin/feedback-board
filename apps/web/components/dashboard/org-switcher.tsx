'use client';

import type { OrgSummary } from '@feedback-board/shared';
import { ChevronDown, LayoutGrid, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

import { useClickOutside } from '../../lib/use-click-outside';
import { useNavigate } from '../../lib/use-navigate';
import { Dialog, Link } from '../ui';
import { CreateOrgForm } from './create-org-form';

const VISIBLE_ORG_LIMIT = 5;

interface OrgSwitcherProps {
  currentOrgSlug: string;
  currentOrgName: string;
  /** The caller's full org list, fetched once by the server layout (TDD §11 `GET /orgs`). */
  orgs: OrgSummary[];
}

/**
 * Topbar org switcher (TDD.md §13 step 19.7 follow-up), the org crumb of the breadcrumb. Shows at
 * most the first `VISIBLE_ORG_LIMIT` orgs, then "All organizations" — a link to the full picker
 * at `/dashboard`, which already lists every org (TDD §12), so this never re-implements
 * pagination. "Create new" reuses the same `CreateOrgForm`/`Dialog` pair `OrgPicker` uses rather
 * than a second copy; on success it navigates straight to the new org instead of appending to a
 * local list, since this component (unlike `OrgPicker`) is not the org list's owner.
 */
export function OrgSwitcher({
  currentOrgSlug,
  currentOrgName,
  orgs,
}: OrgSwitcherProps): ReactElement {
  const t = useTranslations('dashboard.shell.orgSwitcher');
  const tCommon = useTranslations('common');
  const tCreate = useTranslations('dashboard.createOrg');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The layout (and so this component) survives the move to the new org: the pending dialog is
  // closed when the org it was opened from is no longer the current one.
  const [shownOrgSlug, setShownOrgSlug] = useState(currentOrgSlug);
  if (shownOrgSlug !== currentOrgSlug) {
    setShownOrgSlug(currentOrgSlug);
    setDialogOpen(false);
  }

  useClickOutside(containerRef, () => setOpen(false));

  const visibleOrgs = orgs.slice(0, VISIBLE_ORG_LIMIT);

  function handleCreated(org: OrgSummary): void {
    // The dialog stays up, with its button pending, until the new org has rendered: closing it
    // here would leave the old org on screen with nothing to say a navigation is under way.
    navigate.push(`/dashboard/${org.slug}`);
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 min-w-0 items-center gap-1.5 rounded-control px-2 text-body font-medium text-text md:h-auto md:py-1.5 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="truncate">{currentOrgName}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="menu"
          aria-label={t('label')}
          className="absolute left-0 z-40 mt-1 w-64 rounded-control border border-border bg-surface-raised py-1 shadow-popover"
        >
          {visibleOrgs.map((org) => (
            <li key={org.id} role="none">
              <Link
                href={`/dashboard/${org.slug}`}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={org.slug === currentOrgSlug ? 'true' : undefined}
                className={`block truncate px-3 py-1.5 text-body hover:bg-surface ${
                  org.slug === currentOrgSlug ? 'font-medium text-accent-text' : 'text-text'
                }`}
              >
                {org.name}
              </Link>
            </li>
          ))}

          <li role="none" className="mt-1 border-t border-border pt-1">
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-body text-text hover:bg-surface-sunken"
            >
              <LayoutGrid className="h-4 w-4 text-text-subtle" aria-hidden="true" />
              {t('allOrgs')}
            </Link>
          </li>

          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body text-accent-text hover:bg-accent-soft"
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
        // The "create new" menu item that opened the dialog unmounts with the menu.
        fallbackFocusRef={triggerRef}
        title={tCreate('title')}
        closeLabel={tCommon('close')}
      >
        <CreateOrgForm onCreated={handleCreated} navigating={navigate.isPending} />
      </Dialog>
    </div>
  );
}
