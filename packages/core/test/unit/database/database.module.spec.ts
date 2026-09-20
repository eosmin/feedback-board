import { Test } from '@nestjs/testing';

import { DatabaseModule } from '../../../src/database/database.module';
import { AppPrismaClient } from '../../../src/database/app-prisma.client';
import { PrismaService } from '../../../src/database/prisma.service';
import { TenantRunner } from '../../../src/database/tenant-runner.service';

jest.mock('../../../src/database/create-prisma-client', () => ({
  createPrismaClient: jest.fn().mockReturnValue({
    $disconnect: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('DatabaseModule.forTenant', () => {
  it('registers AppPrismaClient and TenantRunner only', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule.forTenant({ databaseUrl: 'postgresql://app:pw@localhost/db' })],
    }).compile();

    expect(moduleRef.get(AppPrismaClient)).toBeDefined();
    expect(moduleRef.get(TenantRunner)).toBeDefined();
  });

  it('never registers PrismaService — injecting it is a startup DI error, not a runtime bypass', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule.forTenant({ databaseUrl: 'postgresql://app:pw@localhost/db' })],
    }).compile();

    expect(() => moduleRef.get(PrismaService)).toThrow();
  });
});

describe('DatabaseModule.forRoot', () => {
  it('registers both clients and TenantRunner', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost/db',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost/db',
        }),
      ],
    }).compile();

    expect(moduleRef.get(AppPrismaClient)).toBeDefined();
    expect(moduleRef.get(PrismaService)).toBeDefined();
    expect(moduleRef.get(TenantRunner)).toBeDefined();
  });
});
