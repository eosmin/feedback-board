import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';

import { IS_PUBLIC_KEY } from './public.decorator';
import { JWKS, JWT_ISSUER } from './jwks.provider';
import type { AuthenticatedRequest } from '../database/tenant-prisma.service';

/**
 * Verifies the Supabase-issued JWT via `jose` + Supabase's JWKS endpoint (TDD §2.6.8, §3.4).
 * Registered globally in `AppModule`; `@Public()` is the only escape hatch. Attaches
 * `request.userId` (from `payload.sub`) and `request.userEmail` (from `payload.email`) — no
 * NestJS-issued tokens exist in this system.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWKS) private readonly jwks: JWTVerifyGetKey,
    @Inject(JWT_ISSUER) private readonly issuer: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authorization.slice('Bearer '.length);

    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer });

      if (typeof payload.sub !== 'string') {
        throw new UnauthorizedException();
      }

      request.userId = payload.sub;

      // Assigned only when present rather than `= ... ?? undefined`: `exactOptionalPropertyTypes`
      // (tsconfig.base.json) treats `userEmail?: string` as "absent or string", never "string |
      // undefined present", so explicitly writing `undefined` into it is a type error.
      if (typeof payload.email === 'string') {
        request.userEmail = payload.email;
      }

      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
