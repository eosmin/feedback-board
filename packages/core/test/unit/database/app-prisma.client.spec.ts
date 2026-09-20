import { Test } from '@nestjs/testing';

import { createPrismaClient } from '../../../src/database/create-prisma-client';
import { AppPrismaClient, DATABASE_URL } from '../../../src/database/app-prisma.client';

jest.mock('../../../src/database/create-prisma-client');

const mockedCreatePrismaClient = createPrismaClient as jest.MockedFunction<
  typeof createPrismaClient
>;

describe('AppPrismaClient', () => {
  let disconnect: jest.Mock;

  beforeEach(() => {
    disconnect = jest.fn().mockResolvedValue(undefined);
    mockedCreatePrismaClient.mockReturnValue({ $disconnect: disconnect } as never);
  });

  it('builds its client from the injected DATABASE_URL, never process.env', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: DATABASE_URL, useValue: 'postgresql://app:pw@localhost:5432/db' },
        AppPrismaClient,
      ],
    }).compile();

    const client = moduleRef.get(AppPrismaClient);

    expect(client.client).toBeDefined();
    expect(mockedCreatePrismaClient).toHaveBeenCalledWith('postgresql://app:pw@localhost:5432/db');
  });

  it('disconnects the underlying client on module destroy', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: DATABASE_URL, useValue: 'postgresql://app:pw@localhost:5432/db' },
        AppPrismaClient,
      ],
    }).compile();

    const client = moduleRef.get(AppPrismaClient);

    await client.onModuleDestroy();

    // Asserting on the `disconnect` mock captured in beforeEach, never on
    // `client.client.$disconnect` — see the identical note in prisma.service.spec.ts.
    expect(disconnect).toHaveBeenCalled();
  });
});
