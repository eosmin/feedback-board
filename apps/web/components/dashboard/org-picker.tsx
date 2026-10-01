'use client';

import type { OrgSummary } from '@feedback-board/shared';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { Button, Dialog } from '../ui';
import { CreateOrgForm } from './create-org-form';
import { OrgList } from './org-list';

interface OrgPickerProps {
  /** The orgs fetched server-side by the parent Server Component (TDD §12). */
  initialOrgs: OrgSummary[];
}

/**
 * Client island combining the read-only org list with the creation form (TDD §13 step 19.1).
 * The form opens in a `Dialog` instead of sitting inline (§13 step 19.7 follow-up) — a freshly
 * created org is appended locally so the list reflects it immediately, in addition to
 * `router.refresh()` re-fetching the Server Component's data.
 */
export function OrgPicker({ initialOrgs }: OrgPickerProps): ReactElement {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [orgs, setOrgs] = useState(initialOrgs);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleCreated(org: OrgSummary): void {
    setOrgs((current) => [...current, org]);
    setDialogOpen(false);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('createOrg.trigger')}
        </Button>
      </div>
      <OrgList orgs={orgs} />
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t('createOrg.title')}
        closeLabel={tCommon('close')}
      >
        <CreateOrgForm onCreated={handleCreated} />
      </Dialog>
    </>
  );
}
