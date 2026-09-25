import { NotFoundException } from '@nestjs/common';

import { WebhooksService } from '../../../src/webhooks/webhooks.service';
import type { TenantPrismaService } from '../../../src/database/tenant-prisma.service';
import type { CreateWebhookDto } from '../../../src/webhooks/dto/create-webhook.dto';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const WEBHOOK_ID = '22222222-2222-4222-8222-222222222222';
const DELIVERY_ID = '33333333-3333-4333-8333-333333333333';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function buildTenantPrisma(overrides: {
  create?: jest.Mock;
  findMany?: jest.Mock;
  findFirst?: jest.Mock;
  deleteWebhook?: jest.Mock;
  findManyDeliveries?: jest.Mock;
}): TenantPrismaService {
  const run = jest.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      webhook: {
        create: overrides.create ?? jest.fn(),
        findMany: overrides.findMany ?? jest.fn(),
        findFirst: overrides.findFirst ?? jest.fn(),
        delete: overrides.deleteWebhook ?? jest.fn(),
      },
      webhookDelivery: {
        findMany: overrides.findManyDeliveries ?? jest.fn(),
      },
    };
    return fn(tx);
  });
  return { run } as unknown as TenantPrismaService;
}

describe('WebhooksService', () => {
  it('creates a webhook and returns the secret exactly once, in the creation response', async () => {
    const create = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: WEBHOOK_ID,
        orgId: ORG_ID,
        targetUrl: data.targetUrl,
        events: data.events,
        isActive: true,
        createdAt: CREATED_AT,
      }),
    );
    const service = new WebhooksService(buildTenantPrisma({ create }));
    const dto: CreateWebhookDto = {
      targetUrl: 'https://example.com/hook',
      events: ['post.created'],
    };

    const result = await service.create(ORG_ID, dto);

    // orgId must be passed explicitly: TenantPrismaService.run only sets the app.org_id
    // session variable for RLS visibility, it does not populate insert columns (TDD §3.3).
    expect(create).toHaveBeenCalledWith({
      data: {
        orgId: ORG_ID,
        targetUrl: dto.targetUrl,
        secret: expect.any(String),
        events: dto.events,
      },
    });
    expect(result).toMatchObject({
      id: WEBHOOK_ID,
      orgId: ORG_ID,
      targetUrl: dto.targetUrl,
      events: dto.events,
      isActive: true,
      createdAt: CREATED_AT.toISOString(),
    });
    // The generated secret shape: crypto.randomBytes(32).toString('hex') (TDD §3.5).
    expect(result.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lists webhooks without ever carrying the secret column', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: WEBHOOK_ID,
        orgId: ORG_ID,
        targetUrl: 'https://example.com/hook',
        events: ['post.created'],
        isActive: false,
        createdAt: CREATED_AT,
      },
    ]);
    const service = new WebhooksService(buildTenantPrisma({ findMany }));

    const result = await service.list();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
    expect(result).toEqual([
      {
        id: WEBHOOK_ID,
        orgId: ORG_ID,
        targetUrl: 'https://example.com/hook',
        events: ['post.created'],
        isActive: false,
        createdAt: CREATED_AT.toISOString(),
      },
    ]);
    expect(result[0]).not.toHaveProperty('secret');
  });

  it('deletes an existing webhook', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: WEBHOOK_ID });
    const deleteWebhook = jest.fn().mockResolvedValue(undefined);
    const service = new WebhooksService(buildTenantPrisma({ findFirst, deleteWebhook }));

    await service.delete(WEBHOOK_ID);

    expect(deleteWebhook).toHaveBeenCalledWith({ where: { id: WEBHOOK_ID } });
  });

  it('throws 404 NOT_FOUND when deleting a webhook id that does not resolve within the tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new WebhooksService(buildTenantPrisma({ findFirst }));

    await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists deliveries newest first', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: WEBHOOK_ID });
    const findManyDeliveries = jest.fn().mockResolvedValue([
      {
        id: DELIVERY_ID,
        webhookId: WEBHOOK_ID,
        orgId: ORG_ID,
        event: 'post.created',
        payload: { id: 'post-1' },
        responseStatus: 200,
        attempt: 1,
        createdAt: CREATED_AT,
      },
    ]);
    const service = new WebhooksService(buildTenantPrisma({ findFirst, findManyDeliveries }));

    const result = await service.listDeliveries(WEBHOOK_ID);

    expect(findManyDeliveries).toHaveBeenCalledWith({
      where: { webhookId: WEBHOOK_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([
      {
        id: DELIVERY_ID,
        webhookId: WEBHOOK_ID,
        orgId: ORG_ID,
        event: 'post.created',
        payload: { id: 'post-1' },
        responseStatus: 200,
        attempt: 1,
        createdAt: CREATED_AT.toISOString(),
      },
    ]);
  });

  it('throws 404 NOT_FOUND when listing deliveries for a webhook id that does not resolve within the tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new WebhooksService(buildTenantPrisma({ findFirst }));

    await expect(service.listDeliveries('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
