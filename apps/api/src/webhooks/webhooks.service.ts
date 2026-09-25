import { randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Webhook,
  WebhookCreated,
  WebhookDelivery,
  WebhookEvent,
} from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { CreateWebhookDto } from './dto/create-webhook.dto';

/** `crypto.randomBytes(32).toString('hex')` — the exact generation shape TDD §3.5 specifies. */
const SECRET_BYTES = 32;

interface WebhookRow {
  id: string;
  orgId: string;
  targetUrl: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
}

interface WebhookDeliveryRow {
  id: string;
  webhookId: string;
  orgId: string;
  event: string;
  payload: unknown;
  responseStatus: number | null;
  attempt: number;
  createdAt: Date;
}

/**
 * CRUD only — delivery logic lives in `packages/core`'s `WebhookDeliveryService`, run by
 * `apps/worker`'s processor (TDD §3.10). All access goes through `TenantPrismaService`
 * (§3.2, §3.3). The secret is generated here and returned exactly once, in `create()`'s
 * response — every other read (`list()`, e2e re-fetches) omits it by construction, since
 * `webhookSchema` (and this service's own `toWebhook` mapping) never carries the column.
 */
@Injectable()
export class WebhooksService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** `POST /orgs/:orgSlug/webhooks` — the only PRO-gated route in this controller (TDD §11). */
  async create(orgId: string, dto: CreateWebhookDto): Promise<WebhookCreated> {
    const secret = randomBytes(SECRET_BYTES).toString('hex');

    const webhook = await this.tenantPrisma.run((tx) =>
      tx.webhook.create({
        data: { orgId, targetUrl: dto.targetUrl, secret, events: dto.events },
      }),
    );

    return { ...this.toWebhook(webhook), secret };
  }

  /**
   * `GET /orgs/:orgSlug/webhooks` — deliberately not PRO-gated (TDD §11): a downgraded org
   * must still see its (deactivated) rows to render them as disabled with an upgrade prompt.
   */
  async list(): Promise<Webhook[]> {
    const webhooks = await this.tenantPrisma.run((tx) =>
      tx.webhook.findMany({ orderBy: { createdAt: 'asc' } }),
    );

    return webhooks.map((webhook) => this.toWebhook(webhook));
  }

  /**
   * `DELETE /orgs/:orgSlug/webhooks/:id` — not PRO-gated either (TDD §11): a downgraded org
   * must be able to clean up its own rows, and the id it needs comes from the un-gated list.
   */
  async delete(webhookId: string): Promise<void> {
    const existing = await this.tenantPrisma.run((tx) =>
      tx.webhook.findFirst({ where: { id: webhookId }, select: { id: true } }),
    );

    if (existing === null) {
      throw new NotFoundException({ error: 'NOT_FOUND' });
    }

    await this.tenantPrisma.run((tx) => tx.webhook.delete({ where: { id: webhookId } }));
  }

  /**
   * `GET /orgs/:orgSlug/webhooks/:id/deliveries` — the full retry history, one row per attempt,
   * newest first (TDD §3.7). Not PRO-gated, same reasoning as `list()`.
   */
  async listDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    const webhook = await this.tenantPrisma.run((tx) =>
      tx.webhook.findFirst({ where: { id: webhookId }, select: { id: true } }),
    );

    if (webhook === null) {
      throw new NotFoundException({ error: 'NOT_FOUND' });
    }

    const deliveries = await this.tenantPrisma.run((tx) =>
      tx.webhookDelivery.findMany({ where: { webhookId }, orderBy: { createdAt: 'desc' } }),
    );

    return deliveries.map((delivery) => this.toDelivery(delivery));
  }

  private toWebhook(webhook: WebhookRow): Webhook {
    return {
      id: webhook.id,
      orgId: webhook.orgId,
      targetUrl: webhook.targetUrl,
      events: webhook.events as WebhookEvent[],
      isActive: webhook.isActive,
      createdAt: webhook.createdAt.toISOString(),
    };
  }

  private toDelivery(delivery: WebhookDeliveryRow): WebhookDelivery {
    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      orgId: delivery.orgId,
      event: delivery.event as WebhookEvent,
      payload: delivery.payload,
      responseStatus: delivery.responseStatus,
      attempt: delivery.attempt,
      createdAt: delivery.createdAt.toISOString(),
    };
  }
}
