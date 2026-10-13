'use client';

import type { OrgSummary } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { Dialog, EmptyState, PageHeader } from '../ui';
import { CreateOrgButton } from './create-org-button';
import { CreateOrgForm } from './create-org-form';
import { OrgList } from './org-list';

interface OrgPickerProps {
  /** The orgs fetched server-side by the parent Server Component (TDD §12). */
  initialOrgs: OrgSummary[];
}

/**
 * Client island combining the org list with the creation form (TDD §13 step 19.1). The form
 * opens in a `Dialog` instead of sitting inline (§13 step 19.7 follow-up) — a freshly created
 * org is appended locally so the list reflects it immediately, in addition to `router.refresh()`
 * re-fetching the Server Component's data. The create button always lives in the header: moving
 * it into the empty state would unmount it on the first creation and drop focus on `<body>`.
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
      <PageHeader
        title={t('title')}
        action={<CreateOrgButton onClick={() => setDialogOpen(true)} />}
      />
      {orgs.length === 0 ? <EmptyState>{t('empty')}</EmptyState> : <OrgList orgs={orgs} />}
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
