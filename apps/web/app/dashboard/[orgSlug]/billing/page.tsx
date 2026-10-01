import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { BillingActions } from '../../../../components/billing/billing-actions';
import { UsageSummary } from '../../../../components/billing/usage-summary';
import { Badge, PageHeader } from '../../../../components/ui';
import { getOrgDetail } from '../../../../lib/org-detail';
import { requireUser } from '../../../../lib/supabase/require-user';

interface BillingPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ success?: string }>;
}

/**
 * `/dashboard/[orgSlug]/billing` (TDD §3.6, §3.9, §12): a Server Component fetches the org
 * detail — plan, role, and usage vs `PLAN_LIMITS` — and the interactive Checkout/Portal buttons
 * live in the `BillingActions` client island (TDD §13 step 19.4). Unlike the org overview page,
 * this route is OWNER-only in the route table (§12); `GET /orgs/:orgSlug` itself has no role
 * requirement (any member can read it), so the page enforces OWNER here with `notFound()`, the
 * same "no dedicated forbidden page" pattern the public board page uses for a missing board.
 * `?success=1` is the redirect target Stripe Checkout returns to (§3.6 step 3) — the page just
 * renders a confirmation banner from it, since the actual plan flip comes from the webhook, not
 * this query param.
 */
export default async function BillingPage({
  params,
  searchParams,
}: BillingPageProps): Promise<ReactElement> {
  const { orgSlug } = await params;
  await requireUser(`/dashboard/${orgSlug}/billing`);
  const { success } = await searchParams;
  const t = await getTranslations('dashboard.billing');

  const org = await getOrgDetail(orgSlug);

  if (org.role !== 'OWNER') {
    notFound();
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader title={t('title')} badge={<Badge>{org.plan}</Badge>} />
      {success === '1' && (
        <p role="status" className="rounded-control border border-green-300 bg-green-50 p-3 text-body text-green-800">
          {t('checkoutSuccess')}
        </p>
      )}
      <UsageSummary usage={org.usage} />
      <BillingActions orgSlug={orgSlug} plan={org.plan} />
    </main>
  );
}
