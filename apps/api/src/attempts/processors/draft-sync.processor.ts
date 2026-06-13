import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AttemptsService } from '../attempts.service';
import { Logger } from '@nestjs/common';

@Processor('draft-sync', {
  concurrency: parseInt(process.env.DRAFT_SYNC_CONCURRENCY || '15', 10),
})
export class DraftSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(DraftSyncProcessor.name);

  constructor(private readonly attemptsService: AttemptsService) {
    super();
  }

  async process(job: Job<{ attemptId: string }, any, string>): Promise<any> {
    const { attemptId } = job.data;
    this.logger.log(`Processing draft sync job ${job.id} for attempt ${attemptId}`);
    try {
      await this.attemptsService.syncDraftsForAttempt(attemptId);
      this.logger.log(`Successfully completed draft sync job ${job.id}`);
    } catch (err) {
      this.logger.error(`Failed draft sync job ${job.id}: ${err.message}`);
      throw err;
    }
  }
}
