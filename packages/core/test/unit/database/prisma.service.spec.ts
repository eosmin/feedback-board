import { Test } from '@nestjs/testing';

import { createPrismaClient } from '../../../src/database/create-prisma-client';
import { ADMIN_DATABASE_URL, PrismaService } from '../../../src/database/prisma.service';

jest.mock('../../../src/database/create-prisma-client');

const mockedCreatePrismaClient = createPrismaClient as jest.MockedFunction<
  typeof createPrismaClient
>;

describe('PrismaService', () => {
  let disconnect: jest.Mock;

  beforeEach(() => {
    disconnect = jest.fn().mockResolvedValue(undefined);
    mockedCreatePrismaClient.mockReturnValue({ $disconnect: disconnect } as never);
  });

  it('builds its client from the injected ADMIN_DATABASE_URL, never process.env', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: ADMIN_DATABASE_URL, useValue: 'postgresql://owner:pw@localhost:5432/db' },
        PrismaService,
      ],
    }).compile();

    const service = moduleRef.get(PrismaService);

    expect(service.client).toBeDefined();
    expect(mockedCreatePrismaClient).toHaveBeenCalledWith(
      'postgresql://owner:pw@localhost:5432/db',
    );
  });

  it('disconnects the underlying client on module destroy', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: ADMIN_DATABASE_URL, useValue: 'postgresql://owner:pw@localhost:5432/db' },
        PrismaService,
      ],
    }).compile();

    const service = moduleRef.get(PrismaService);

    await service.onModuleDestroy();

    // Asserting on the `disconnect` mock captured in beforeEach, never on
    // `service.client.$disconnect` — a property access on a typed object is what
    // @typescript-eslint/unbound-method flags, regardless of whether the result is later bound
    // to a local const.
    expect(disconnect).toHaveBeenCalled();
  });
});
