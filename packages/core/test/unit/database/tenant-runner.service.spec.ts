import { TenantRunner } from '../../../src/database/tenant-runner.service';
import type { AppPrismaClient } from '../../../src/database/app-prisma.client';

const VALID_ORG_ID = '11111111-1111-4111-8111-111111111111';

function createMockAppPrismaClient(): {
  client: AppPrismaClient;
  queryRaw: jest.Mock;
  transaction: jest.Mock;
} {
  const queryRaw = jest.fn().mockResolvedValue(undefined);
  const transaction = jest.fn(async (fn: (tx: { $queryRaw: jest.Mock }) => Promise<unknown>) =>
    fn({ $queryRaw: queryRaw }),
  );
  const client = { client: { $transaction: transaction } } as unknown as AppPrismaClient;

  return { client, queryRaw, transaction };
}

describe('TenantRunner', () => {
  it('sets app.org_id via a parameterized set_config before running the callback', async () => {
    const { client, queryRaw } = createMockAppPrismaClient();
    const runner = new TenantRunner(client);
    const fn = jest.fn().mockResolvedValue('result');

    const result = await runner.runAs(VALID_ORG_ID, fn);

    expect(result).toBe('result');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ $queryRaw: queryRaw });
  });

  it('rejects a non-uuid orgId before opening a transaction', async () => {
    const { client, transaction } = createMockAppPrismaClient();
    const runner = new TenantRunner(client);
    const fn = jest.fn();

    await expect(runner.runAs('not-a-uuid', fn)).rejects.toThrow(
      'TenantRunner.runAs: orgId is not a uuid',
    );
    expect(fn).not.toHaveBeenCalled();
    // Asserting on the captured mock variable, never on `client.client.$transaction` — a
    // property access on a typed object is what @typescript-eslint/unbound-method flags,
    // regardless of whether the result is later bound to a local const.
    expect(transaction).not.toHaveBeenCalled();
  });
});
