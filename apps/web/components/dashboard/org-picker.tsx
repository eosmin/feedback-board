'use client';

import type { OrgSummary } from '@feedback-board/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { CreateOrgForm } from './create-org-form';
import { OrgList } from './org-list';

interface OrgPickerProps {
  /** The orgs fetched server-side by the parent Server Component (TDD §12). */
  initialOrgs: OrgSummary[];
}

/**
 * Client island combining the read-only org list with the creation form (TDD §13 step 19.1).
 * A freshly created org is appended locally so the list reflects it immediately, in addition to
 * `router.refresh()` re-fetching the Server Component's data — the "Done when" of this step is
 * that creating an org returns to a list containing it, without requiring a manual reload.
 */
export function OrgPicker({ initialOrgs }: OrgPickerProps): ReactElement {
  const [orgs, setOrgs] = useState(initialOrgs);

  function handleCreated(org: OrgSummary): void {
    setOrgs((current) => [...current, org]);
  }

  return (
    <>
      <OrgList orgs={orgs} />
      <CreateOrgForm onCreated={handleCreated} />
    </>
  );
}
