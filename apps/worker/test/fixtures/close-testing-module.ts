import type { TestingModule } from '@nestjs/testing';

/**
 * Same rationale as `apps/api/test/fixtures/close-testing-module.ts` — a separate copy, not a
 * shared import, because `apps/worker` and `apps/api` are two different packages with their own
 * `test/` trees, and neither imports from the other (TDD §3.10, §17).
 */
export async function closeTestingModule(moduleRef: TestingModule | undefined): Promise<void> {
  await moduleRef?.close();
}
