import { orgDetailSchema } from '@feedback-board/shared';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { BillingActions } from '../../../../components/billing/billing-actions';
import { UsageSummary } from '../../../../components/billing/usage-summary';
import { serverApiFetch } from '../../../../lib/api-client-server';
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
  await requireUser();
  const { orgSlug } = await params;
  const { success } = await searchParams;
  const t = await getTranslations('dashboard.billing');

  const org = await serverApiFetch(`/orgs/${orgSlug}`, orgDetailSchema);

  if (org.role !== 'OWNER') {
    notFound();
  }

  return (
    <main>
      <h1>{t('title')}</h1>
      {success === '1' && <p role="status">{t('checkoutSuccess')}</p>}
      <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
        {org.plan}
      </span>
      <UsageSummary usage={org.usage} />
      <BillingActions orgSlug={orgSlug} plan={org.plan} />
    </main>
  );
}
