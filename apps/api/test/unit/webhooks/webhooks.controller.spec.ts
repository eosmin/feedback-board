import { ForbiddenException } from '@nestjs/common';

import { WebhooksController } from '../../../src/webhooks/webhooks.controller';
import type { WebhooksService } from '../../../src/webhooks/webhooks.service';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';
import type { CreateWebhookDto } from '../../../src/webhooks/dto/create-webhook.dto';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const WEBHOOK_ID = '22222222-2222-4222-8222-222222222222';

function buildService(): {
  service: WebhooksService;
  create: jest.Mock;
  list: jest.Mock;
  deleteWebhook: jest.Mock;
  listDeliveries: jest.Mock;
} {
  const create = jest.fn().mockResolvedValue({ id: WEBHOOK_ID, secret: 'abc' });
  const list = jest.fn().mockResolvedValue([]);
  const deleteWebhook = jest.fn().mockResolvedValue(undefined);
  const listDeliveries = jest.fn().mockResolvedValue([]);
  return {
    service: {
      create,
      list,
      delete: deleteWebhook,
      listDeliveries,
    } as unknown as WebhooksService,
    create,
    list,
    deleteWebhook,
    listDeliveries,
  };
}

describe('WebhooksController', () => {
  it('creates a webhook with the orgId OrgGuard attached to the request', async () => {
    const { service, create } = buildService();
    const controller = new WebhooksController(service);
    const request = { orgId: ORG_ID } as AuthenticatedRequest;
    const dto: CreateWebhookDto = {
      targetUrl: 'https://example.com/hook',
      events: ['post.created'],
    };

    await controller.create(request, 'acme', dto);

    expect(create).toHaveBeenCalledWith(ORG_ID, dto);
  });

  it('rejects create when orgId is missing from the request', async () => {
    const { service } = buildService();
    const controller = new WebhooksController(service);
    const request = {} as AuthenticatedRequest;

    await expect(
      controller.create(request, 'acme', {
        targetUrl: 'https://example.com/hook',
        events: ['post.created'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists webhooks via the service', async () => {
    const { service, list } = buildService();
    const controller = new WebhooksController(service);

    await controller.list('acme');

    expect(list).toHaveBeenCalledWith();
  });

  it('deletes a webhook via the service', async () => {
    const { service, deleteWebhook } = buildService();
    const controller = new WebhooksController(service);

    await controller.delete('acme', WEBHOOK_ID);

    expect(deleteWebhook).toHaveBeenCalledWith(WEBHOOK_ID);
  });

  it('lists deliveries via the service', async () => {
    const { service, listDeliveries } = buildService();
    const controller = new WebhooksController(service);

    await controller.listDeliveries('acme', WEBHOOK_ID);

    expect(listDeliveries).toHaveBeenCalledWith(WEBHOOK_ID);
  });
});
