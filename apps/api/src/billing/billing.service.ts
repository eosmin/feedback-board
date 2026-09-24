import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Logger, Prisma, PrismaService } from '@feedback-board/core';
import type { Logger as AppLogger, PrismaService as AdminClient } from '@feedback-board/core';
import {
  ERROR_CODES,
  billingSessionSchema,
  type BillingSession,
  type Plan,
  type SubscriptionStatus,
} from '@feedback-board/shared';
import type Stripe from 'stripe';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { TenantPrismaService as TenantPrisma } from '../database/tenant-prisma.service';

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');
export const BILLING_OPTIONS = Symbol('BILLING_OPTIONS');

/** Values taken from the app's validated env by `BillingModule`, never read from `process.env` here. */
export interface BillingOptions {
  readonly proPriceId: string;
  readonly webOrigin: string;
  readonly webhookSecret: string;
}

/**
 * Stripe's own status vocabulary mapped onto ours in the one place §3.6 step 5 asks for.
 * `incomplete_expired` is terminal (the first payment never succeeded within 23 h), so it is
 * stored as CANCELED; `paused` stops invoicing and access but can resume, so it is stored as
 * UNPAID. Anything not listed here throws before the event is claimed, so Stripe retries it.
 */
const STRIPE_STATUS_MAP: Readonly<Record<string, SubscriptionStatus>> = {
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELED',
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  paused: 'UNPAID',
};

/** PAST_DUE keeps PRO while Stripe's retry schedule runs; every other status is FREE. */
const PRO_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE']);

const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

interface SubscriptionSnapshot {
  readonly stripeSubscriptionId: string;
  readonly stripePriceId: string;
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd: Date;
}

type StripeRef = string | { readonly id: string };

function idOf(ref: StripeRef): string {
  return typeof ref === 'string' ? ref : ref.id;
}

export function mapStripeStatus(status: string): SubscriptionStatus {
  const mapped = STRIPE_STATUS_MAP[status];

  if (mapped === undefined) {
    throw new Error(`Unrecognised Stripe subscription status: ${status}`);
  }

  return mapped;
}

export function planForStatus(status: SubscriptionStatus): Plan {
  return PRO_STATUSES.has(status) ? 'PRO' : 'FREE';
}

/**
 * The subscription an event is about, or `null` for an event this app does not act on. Every
 * handled event is reduced to an id and the subscription is re-read from Stripe, so an event
 * delivered out of order still applies the subscription's current state.
 */
export function subscriptionIdOf(event: Stripe.Event): string | null {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      return session.mode === 'subscription' && session.subscription !== null
        ? idOf(session.subscription)
        : null;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return event.data.object.id;
    case 'invoice.payment_failed': {
      const reference = event.data.object.parent?.subscription_details?.subscription;
      return reference === undefined ? null : idOf(reference);
    }
    default:
      return null;
  }
}

function toSnapshot(subscription: Stripe.Subscription): SubscriptionSnapshot {
  const item = subscription.items.data[0];

  if (item === undefined) {
    throw new Error(`Stripe subscription ${subscription.id} has no items`);
  }

  return {
    stripeSubscriptionId: subscription.id,
    stripePriceId: item.price.id,
    status: mapStripeStatus(subscription.status),
    // On the dahlia API the period lives on the item; the subscription object has none (§2.6.7).
    currentPeriodEnd: new Date(item.current_period_end * 1000),
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_CONSTRAINT_CODE
  );
}

/**
 * Two callers with two different database clients, on purpose:
 * - Checkout and Portal run under `/orgs/:orgSlug/*`, so they read and write the org through
 *   `TenantPrismaService`.
 * - The Stripe webhook has no user and no tenant session, so it is the first of the five
 *   admin-client callers (TDD §3.2). It writes `subscriptions`, which is RLS-protected, and that
 *   only works because the admin role holds `BYPASSRLS` (§2.6.11c).
 *
 * Injecting the request-scoped `TenantPrismaService` makes this service — and the webhook
 * controller — request-scoped too; the webhook path never calls it. Every dependency is
 * injected by token with a type-only import (decision D10).
 */
@Injectable()
export class BillingService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @Inject(BILLING_OPTIONS) private readonly options: BillingOptions,
    @Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrisma,
    @Inject(PrismaService) private readonly admin: AdminClient,
    @Inject(Logger) private readonly logger: AppLogger,
  ) {}

  async createCheckoutSession(orgId: string): Promise<BillingSession> {
    const org = await this.tenantPrisma.run((tx) =>
      tx.org.findUniqueOrThrow({
        where: { id: orgId },
        select: { slug: true, stripeCustomerId: true },
      }),
    );

    const customerId = org.stripeCustomerId ?? (await this.createCustomer(orgId));
    const billingUrl = this.billingPageUrl(org.slug);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: orgId,
      line_items: [{ price: this.options.proPriceId, quantity: 1 }],
      success_url: `${billingUrl}?success=1`,
      cancel_url: billingUrl,
    });

    return billingSessionSchema.parse({ url: session.url });
  }

  async createPortalSession(orgId: string): Promise<BillingSession> {
    const org = await this.tenantPrisma.run((tx) =>
      tx.org.findUniqueOrThrow({
        where: { id: orgId },
        select: { slug: true, stripeCustomerId: true },
      }),
    );

    if (org.stripeCustomerId === null) {
      throw new ConflictException({ error: ERROR_CODES.CONFLICT });
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: this.billingPageUrl(org.slug),
    });

    return billingSessionSchema.parse({ url: session.url });
  }

  /** `constructEvent` needs the exact bytes Stripe signed, hence `rawBody` (§2.6.7). */
  verifyWebhookEvent(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event {
    if (rawBody === undefined || signature === undefined) {
      throw new BadRequestException({ error: ERROR_CODES.INVALID_SIGNATURE });
    }

    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, this.options.webhookSecret);
    } catch {
      throw new BadRequestException({ error: ERROR_CODES.INVALID_SIGNATURE });
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const subscriptionId = subscriptionIdOf(event);

    if (subscriptionId === null) {
      return;
    }

    // Network and status mapping happen before the transaction: nothing slow runs while it
    // holds a connection, and an unrecognised status throws before the event is claimed.
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const snapshot = toSnapshot(subscription);
    const customerId = idOf(subscription.customer);

    const org = await this.admin.client.org.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (org === null) {
      this.logger.warn({ eventId: event.id, customerId }, 'Stripe event for an unknown customer');
      return;
    }

    // The P2002 catch wraps $transaction rather than sitting inside it: a unique violation
    // aborts the Postgres transaction, so any statement after it would fail (§3.6).
    try {
      await this.admin.client.$transaction(async (tx) => {
        await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
        await this.applyTransition(tx, org.id, snapshot);
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        this.logger.log({ eventId: event.id }, 'Stripe event already processed');
        return;
      }
      throw error;
    }
  }

  private async applyTransition(
    tx: Prisma.TransactionClient,
    orgId: string,
    snapshot: SubscriptionSnapshot,
  ): Promise<void> {
    const plan = planForStatus(snapshot.status);

    await tx.subscription.upsert({
      where: { orgId },
      create: { orgId, ...snapshot },
      update: snapshot,
    });
    await tx.org.update({ where: { id: orgId }, data: { plan } });

    // Without this the PRO-only webhook feature keeps delivering for a FREE org (§3.7 step 6).
    // Re-upgrading does not re-activate: that is a manual step by design.
    if (plan === 'FREE') {
      await tx.webhook.updateMany({
        where: { orgId, isActive: true },
        data: { isActive: false },
      });
    }
  }

  private async createCustomer(orgId: string): Promise<string> {
    // The idempotency key stops two concurrent first clicks from creating two customers.
    const customer = await this.stripe.customers.create(
      { metadata: { orgId } },
      { idempotencyKey: `org-customer-${orgId}` },
    );

    await this.tenantPrisma.run((tx) =>
      tx.org.update({ where: { id: orgId }, data: { stripeCustomerId: customer.id } }),
    );

    return customer.id;
  }

  private billingPageUrl(orgSlug: string): string {
    return `${this.options.webOrigin}/dashboard/${orgSlug}/billing`;
  }
}
