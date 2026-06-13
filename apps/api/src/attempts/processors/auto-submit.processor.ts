import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AttemptsService } from '../attempts.service';
import { Logger } from '@nestjs/common';

@Processor('exam-auto-submit', {
  concurrency: parseInt(process.env.AUTO_SUBMIT_CONCURRENCY || '50', 10),
})
export class AutoSubmitProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoSubmitProcessor.name);

  constructor(private readonly attemptsService: AttemptsService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'safety-sweep') {
      this.logger.log(`Processing safety-sweep repeatable job ${job.id}`);
      try {
        await this.attemptsService.runSafetySweeper();
        this.logger.log(`Successfully completed safety-sweep repeatable job ${job.id}`);
      } catch (err) {
        this.logger.error(`Failed safety-sweep repeatable job ${job.id}: ${err.message}`);
        throw err;
      }
      return;
    }

    const { attemptId } = job.data;
    this.logger.log(`Processing auto-submit job ${job.id} for attempt ${attemptId}`);
    try {
      await this.attemptsService.autoSubmitAttempt(attemptId);
      this.logger.log(`Successfully completed auto-submit job ${job.id}`);
    } catch (err) {
      this.logger.error(`Failed auto-submit job ${job.id}: ${err.message}`);
      throw err;
    }
  }
}
