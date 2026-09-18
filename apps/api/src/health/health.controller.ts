import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export interface HealthStatus {
  readonly status: 'ok';
}

/**
 * Liveness only (TDD §11). It touches no dependency on purpose: a probe that fails when Redis
 * blips restarts a process that was serving fine.
 *
 * Reachable without a token today because `JwtAuthGuard` does not exist yet; it gets its
 * explicit `@Public()` in step 7, when the global guard is registered.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
