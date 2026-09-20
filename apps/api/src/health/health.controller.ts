import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';

export interface HealthStatus {
  readonly status: 'ok';
}

/**
 * Liveness only (TDD §11). It touches no dependency on purpose: a probe that fails when Redis
 * blips restarts a process that was serving fine.
 *
 * `@Public()` since step 7, when `JwtAuthGuard` became global — health checks must stay
 * reachable without a token (TDD §3.4).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
