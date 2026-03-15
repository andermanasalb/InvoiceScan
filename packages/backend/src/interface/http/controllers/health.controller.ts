import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../guards/public.decorator';

/**
 * HealthController
 *
 * Provides a public liveness probe at GET /api/v1/health.
 * No authentication required — used by load balancers and Docker health checks.
 */
@Controller('api/v1/health')
export class HealthController {
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
