import { PrismaPg } from '@prisma/adapter-pg';

import { createPrismaClient } from '../../../src/database/create-prisma-client';

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation((options: { connectionString: string }) => ({
    __connectionString: options.connectionString,
  })),
}));

jest.mock('../../../src/generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation((options: unknown) => ({
    __options: options,
    $disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('createPrismaClient', () => {
  it('builds a PrismaClient with a PrismaPg adapter from the given connection string', () => {
    const client = createPrismaClient('postgresql://user:pw@localhost:5432/db');

    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pw@localhost:5432/db',
    });
    expect(client).toBeDefined();
  });
});
