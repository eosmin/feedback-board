import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * The only escape hatch from the globally-registered `JwtAuthGuard` (TDD §3.4, §11). Declared
 * exceptions: `/health`, the two `/public/*` routes, and `POST /webhooks/stripe`.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
