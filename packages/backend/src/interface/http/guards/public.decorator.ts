import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — skips the global JwtAuthGuard.
 *
 * Usage:
 *   @Public()
 *   @Post('login')
 *   async login(...) {}
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
