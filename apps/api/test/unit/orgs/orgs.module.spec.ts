import { Test } from '@nestjs/testing';
import { DatabaseModule } from '@feedback-board/core';

import { OrgsModule } from '../../../src/orgs/orgs.module';
import { OrgsController } from '../../../src/orgs/orgs.controller';
import { OrgGuard } from '../../../src/orgs/guards/org.guard';
import { PlanGuard } from '../../../src/orgs/guards/plan.guard';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';

describe('OrgsModule', () => {
  it('compiles and resolves OrgsController and the exported guards', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost:5432/postgres',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost:5432/postgres',
        }),
        OrgsModule,
      ],
    })
      // redisConnectionProvider's factory needs a live ConfigService — this test only cares
      // that DI wiring resolves, not that a real Redis connection opens, so the token is
      // overridden with a stub rather than pulling ConfigModule in as an unrelated dependency.
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      .compile();

    // OrgsController and PlanGuard both depend (transitively, via TenantPrismaService) on the
    // REQUEST token, which makes Nest treat them as request-scoped too — moduleRef.get() only
    // works for singletons, so a scoped provider needs resolve() instead (TDD §3.9's own note
    // that injecting TenantPrismaService propagates its scope up the injection chain).
    await expect(moduleRef.resolve(OrgsController)).resolves.toBeInstanceOf(OrgsController);
    await expect(moduleRef.resolve(PlanGuard)).resolves.toBeInstanceOf(PlanGuard);
    expect(moduleRef.get(OrgGuard)).toBeInstanceOf(OrgGuard);
  });
});
