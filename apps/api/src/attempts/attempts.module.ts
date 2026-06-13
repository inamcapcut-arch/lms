import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '../common/config/jwt.config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { AttemptsGateway } from './attempts.gateway';
import { AutoSubmitProcessor } from './processors/auto-submit.processor';
import { DraftSyncProcessor } from './processors/draft-sync.processor';
import { AutoSubmitEventsListener } from './processors/auto-submit.events';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
    BullModule.registerQueue(
      {
        name: 'exam-auto-submit',
      },
      {
        name: 'code-execution',
      },
      {
        name: 'draft-sync',
      },
      {
        name: 'autosubmit-failed',
      },
    ),
  ],
  controllers: [AttemptsController],
  providers: [
    AttemptsService,
    AttemptsGateway,
    AutoSubmitProcessor,
    DraftSyncProcessor,
    AutoSubmitEventsListener,
  ],
  exports: [AttemptsService, AttemptsGateway],
})
export class AttemptsModule {}
