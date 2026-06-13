import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ExecutionModule } from './execution/execution.module';
import { AttemptsModule } from './attempts/attempts.module';
import { ActivityModule } from './activity/activity.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Global rate limiting. Defaults are conservative and env-configurable so they
    // can be tuned for ~5000 concurrent students behind the load balancer.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: parseInt(process.env.THROTTLE_TTL_MS || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '120', 10),
      },
    ]),
    PrismaModule,
    RedisModule,
    AuthModule,
    AdminModule,
    ExecutionModule,
    AttemptsModule,
    ActivityModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
