import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Lightweight health / readiness endpoint for load balancers and orchestrators.
 * Publicly accessible (no JWT guard applied) and excluded from rate limiting.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const result: Record<string, string> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    // Non-blocking best-effort connectivity checks.
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.database = 'up';
    } catch {
      result.database = 'down';
      result.status = 'degraded';
    }

    try {
      const pong = await this.redis.getClient().ping();
      result.redis = pong === 'PONG' ? 'up' : 'down';
      if (result.redis === 'down') result.status = 'degraded';
    } catch {
      result.redis = 'down';
      result.status = 'degraded';
    }

    return result;
  }
}
