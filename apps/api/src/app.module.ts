import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ExecutionModule } from './execution/execution.module';
import { AttemptsModule } from './attempts/attempts.module';
import { ActivityModule } from './activity/activity.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, AdminModule, ExecutionModule, AttemptsModule, ActivityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
