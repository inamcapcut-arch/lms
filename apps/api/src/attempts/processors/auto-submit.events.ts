import { QueueEventsListener, QueueEventsHost, OnQueueEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@QueueEventsListener('exam-auto-submit')
export class AutoSubmitEventsListener extends QueueEventsHost {
  private readonly logger = new Logger(AutoSubmitEventsListener.name);

  constructor(
    @InjectQueue('autosubmit-failed') private readonly failedQueue: Queue,
    @InjectQueue('exam-auto-submit') private readonly autoSubmitQueue: Queue,
  ) {
    super();
  }

  @OnQueueEvent('failed')
  async onFailed(args: { jobId: string; failedReason: string; prev?: string }) {
    this.logger.error(`Job ${args.jobId} failed: ${args.failedReason}`);

    try {
      const job = await this.autoSubmitQueue.getJob(args.jobId);
      if (job) {
        const attemptsMade = job.attemptsMade;
        const maxAttempts = job.opts.attempts || 1;

        if (attemptsMade >= maxAttempts) {
          this.logger.error(`CRITICAL: Auto-submit retries exhausted for job ${args.jobId}. Moving to DLQ.`);
          
          await this.failedQueue.add(
            'failed-auto-submit',
            job.data,
            {
              jobId: `failed:${args.jobId}`,
              removeOnComplete: true,
            }
          );

          // Simulated high-priority alerting (Slack/PagerDuty)
          this.logger.error(`[ALERT] CRITICAL AUTO-SUBMIT FAILURE for attempt: ${job.data.attemptId}`);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to handle DLQ movement for job ${args.jobId}: ${err.message}`);
    }
  }
}
