import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AttemptsGateway } from './attempts.gateway';
import { ActiveAttemptPayload, QuestionData, DraftData } from '@alex/shared-types';
import { ActivityService } from '../activity/activity.service';
import { ActivityType } from '@alex/database';

@Injectable()
export class AttemptsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttemptsService.name);
  private sweeperInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly gateway: AttemptsGateway,
    private readonly activityService: ActivityService,
    @InjectQueue('exam-auto-submit') private readonly autoSubmitQueue: Queue,
    @InjectQueue('code-execution') private readonly codeQueue: Queue,
    @InjectQueue('draft-sync') private readonly draftSyncQueue: Queue,
    @InjectQueue('autosubmit-failed') private readonly failedQueue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.autoSubmitQueue.add(
        'safety-sweep',
        {},
        {
          repeat: {
            every: 30000, // Every 30 seconds
          },
          jobId: 'safety-sweep-job',
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log('Safety sweeper repeatable job registered (every 30s)');
    } catch (err) {
      this.logger.error(`Failed to register safety sweeper repeatable job: ${err.message}`);
    }
  }

  onModuleDestroy() {}

  /**
   * Helper to calculate dynamic seconds remaining for an active attempt
   */
  private calculateSecondsRemaining(expiresAt: Date): number {
    const now = new Date();
    const remainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : 0;
  }

  /**
   * Helper to acquire a distributed Redis lock
   */
  private async acquireLock(attemptId: string, token: string, ttlMs = 30000): Promise<boolean> {
    const lockKey = `lock:attempt:${attemptId}`;
    const client = this.redisService.getClient();
    const result = await client.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  /**
   * Helper to renew a distributed Redis lock
   */
  private async renewLock(attemptId: string, token: string, ttlMs = 30000): Promise<boolean> {
    const lockKey = `lock:attempt:${attemptId}`;
    const client = this.redisService.getClient();
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await client.eval(script, 1, lockKey, token, ttlMs.toString());
    return result === 1;
  }

  /**
   * Helper to release a distributed Redis lock
   */
  private async releaseLock(attemptId: string, token: string): Promise<void> {
    const lockKey = `lock:attempt:${attemptId}`;
    const client = this.redisService.getClient();
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await client.eval(script, 1, lockKey, token);
  }

  /**
   * Start periodic lock renewal
   */
  private startLockRenewal(attemptId: string, token: string, intervalMs = 10000, ttlMs = 30000): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const renewed = await this.renewLock(attemptId, token, ttlMs);
        if (!renewed) {
          this.logger.warn(`Failed to renew lock for attempt ${attemptId}`);
        }
      } catch (err) {
        this.logger.error(`Error renewing lock for attempt ${attemptId}: ${err.message}`);
      }
    }, intervalMs);
  }

  /**
   * Starts an exam attempt
   */
  async startAttempt(userId: string, examId: string): Promise<ActiveAttemptPayload> {
    // 1. Resolve student record
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('User is not registered as a student');
    }

    // 2. Fetch Exam Assignment
    const assignment = await this.prisma.examAssignment.findFirst({
      where: {
        examId,
        studentId: student.id,
      },
      include: {
        exam: {
          include: {
            questions: {
              include: {
                question: {
                  include: {
                    mcqOptions: true,
                    codingQuestion: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this exam');
    }

    if (assignment.status === 'COMPLETED') {
      throw new ForbiddenException('You have already completed this exam');
    }

    // 2b. Only approved/published exams can be started.
    if (assignment.exam.status !== 'PUBLISHED') {
      throw new ForbiddenException('This exam is not yet available');
    }

    // 3. Verify Exam Timeline
    const now = new Date();
    if (now < assignment.exam.startTime) {
      throw new BadRequestException('Exam has not started yet');
    }
    if (now > assignment.exam.endTime) {
      throw new BadRequestException('Exam window has already closed');
    }

    // 4. Check for existing active attempt (and resume if it exists)
    const existingActiveAttempt = await this.prisma.attempt.findFirst({
      where: {
        examAssignmentId: assignment.id,
        status: 'ACTIVE',
      },
      include: {
        drafts: true,
      },
    });

    if (existingActiveAttempt) {
      this.logger.log(`Active attempt already exists for student ${student.id}, resuming instead.`);
      return this.resumeAttempt(userId);
    }

    // 5. Calculate remaining seconds and expiresAt
    const attemptExpiry = new Date(now.getTime() + assignment.exam.durationMinutes * 60 * 1000);
    const expiresAt = attemptExpiry < assignment.exam.endTime ? attemptExpiry : assignment.exam.endTime;
    const durationSeconds = this.calculateSecondsRemaining(expiresAt);

    if (durationSeconds <= 0) {
      throw new BadRequestException('Not enough time remaining to start the exam');
    }

    // 6. DB Transaction to transition assignment & create attempt
    const attempt = await this.prisma.$transaction(async (tx) => {
      // Transition assignment
      await tx.examAssignment.update({
        where: { id: assignment.id },
        data: { status: 'IN_PROGRESS' },
      });

      // Create Attempt
      return tx.attempt.create({
        data: {
          examAssignmentId: assignment.id,
          status: 'ACTIVE',
          startTime: now,
          expiresAt: expiresAt,
        },
      });
    });

    // Populate Redis Metadata cache with 24 hours TTL
    const metadataKey = `attempt:${attempt.id}:metadata`;
    await this.redisService.getClient().hset(metadataKey, {
      status: 'ACTIVE',
      studentId: student.id,
      expiresAt: expiresAt.toISOString(),
    });
    await this.redisService.getClient().expire(metadataKey, 86400); // 24 hours

    // 7. Schedule BullMQ Auto-Submit Job with deterministic jobId and retries
    await this.autoSubmitQueue.add(
      'autosubmit',
      { attemptId: attempt.id },
      {
        delay: durationSeconds * 1000,
        jobId: `autosubmit-${attempt.id}`,
        removeOnComplete: true,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Started attempt ${attempt.id} for student ${student.id}, scheduled auto-submit in ${durationSeconds}s`);

    // Log Activity
    await this.activityService.logActivity(
      ActivityType.EXAM_STARTED,
      `Student started exam "${assignment.exam.title}"`,
      userId,
      { examId: assignment.exam.id, attemptId: attempt.id }
    );

    return this.buildAttemptPayload(attempt, assignment.exam, []);
  }

  /**
   * Resumes the current student's active attempt
   */
  async resumeAttempt(userId: string): Promise<ActiveAttemptPayload> {
    const start = Date.now();
    const client = this.redisService.getClient();

    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('User is not registered as a student');
    }

    const attempt = await this.prisma.attempt.findFirst({
      where: {
        examAssignment: {
          studentId: student.id,
        },
        status: 'ACTIVE',
      },
      include: {
        examAssignment: {
          include: {
            exam: {
              include: {
                questions: {
                  include: {
                    question: {
                      include: {
                        mcqOptions: true,
                        codingQuestion: true,
                      },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('No active exam attempt found');
    }

    const exam = attempt.examAssignment.exam;
    const expiresAt = attempt.expiresAt
      ? new Date(attempt.expiresAt)
      : new Date(Math.min(attempt.startTime.getTime() + exam.durationMinutes * 60 * 1000, exam.endTime.getTime()));
    const secondsRemaining = this.calculateSecondsRemaining(expiresAt);

    if (secondsRemaining <= 0) {
      this.logger.warn(`Active attempt ${attempt.id} was found but has expired. Triggering auto-submit.`);
      await this.autoSubmitAttempt(attempt.id);
      throw new ForbiddenException('Exam time has expired');
    }

    // Cache hit/miss tracking and draft fetch
    const draftsKey = `attempt:${attempt.id}:drafts`;
    const cachedDrafts = await client.hgetall(draftsKey);
    let drafts: any[] = [];

    if (Object.keys(cachedDrafts).length > 0) {
      // Cache Hit
      await client.incr('metrics:cache_hit');
      drafts = Object.entries(cachedDrafts).map(([questionId, draftDataStr]) => ({
        questionId,
        draftData: JSON.parse(draftDataStr),
      }));
    } else {
      // Cache Miss
      await client.incr('metrics:cache_miss');
      const dbDrafts = await this.prisma.draft.findMany({
        where: { attemptId: attempt.id },
      });

      if (dbDrafts.length > 0) {
        const pipeline = client.pipeline();
        for (const draft of dbDrafts) {
          pipeline.hset(draftsKey, draft.questionId, JSON.stringify(draft.draftData));
        }
        pipeline.expire(draftsKey, 86400); // 24 hours
        await pipeline.exec();
      }
      drafts = dbDrafts;
    }

    // Refresh attempt metadata in Redis cache
    const metadataKey = `attempt:${attempt.id}:metadata`;
    await client.hset(metadataKey, {
      status: 'ACTIVE',
      studentId: student.id,
      expiresAt: expiresAt.toISOString(),
    });
    await client.expire(metadataKey, 86400); // 24 hours

    // Track Resume Latency
    const latency = Date.now() - start;
    await client.lpush('metrics:resume_latency', latency.toString());
    await client.ltrim('metrics:resume_latency', 0, 999);

    return this.buildAttemptPayload(attempt, exam, drafts);
  }

  /**
   * Saves or updates a question answer draft
   */
  async saveDraft(
    userId: string,
    attemptId: string,
    questionId: string,
    draftData: any,
    sequenceNumber: number,
    clientTimestamp: number,
    sessionClientId: string,
  ): Promise<void> {
    const start = Date.now();
    const client = this.redisService.getClient();

    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('User is not a student');
    }

    // Load attempt metadata from cache or database
    const metadataKey = `attempt:${attemptId}:metadata`;
    let metadata = await client.hgetall(metadataKey);

    if (Object.keys(metadata).length === 0) {
      const attempt = await this.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          examAssignment: {
            include: { exam: true },
          },
        },
      });

      if (!attempt) {
        throw new NotFoundException('Attempt not found');
      }

      if (attempt.examAssignment.studentId !== student.id) {
        throw new ForbiddenException('Forbidden: Attempt does not belong to you');
      }

      if (attempt.status !== 'ACTIVE') {
        throw new ForbiddenException('Attempt is locked and cannot be modified');
      }

      const expiresAt = attempt.expiresAt
        ? new Date(attempt.expiresAt)
        : new Date(Math.min(attempt.startTime.getTime() + attempt.examAssignment.exam.durationMinutes * 60 * 1000, attempt.examAssignment.exam.endTime.getTime()));

      metadata = {
        status: attempt.status,
        studentId: attempt.examAssignment.studentId,
        expiresAt: expiresAt.toISOString(),
      };
      await client.hset(metadataKey, metadata);
      await client.expire(metadataKey, 86400); // 24 hours
    } else {
      if (metadata.studentId !== student.id) {
        throw new ForbiddenException('Forbidden: Attempt does not belong to you');
      }
      if (metadata.status !== 'ACTIVE') {
        throw new ForbiddenException('Attempt is locked and cannot be modified');
      }
    }

    // Verify session for dual-tab preemption
    const sessionKey = `attempt:${attemptId}:session`;
    const cachedSession = await client.hgetall(sessionKey);
    if (cachedSession && cachedSession.deviceId && cachedSession.deviceId !== sessionClientId) {
      throw new ConflictException('Concurrent session detected. Please refresh.');
    }

    // Verify time limit
    const now = new Date();
    const expiresAt = new Date(metadata.expiresAt);
    const remainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    if (remainingSeconds <= 0) {
      this.logger.warn(`Save draft request rejected: Attempt ${attemptId} has expired. Auto-submitting.`);
      await this.autoSubmitAttempt(attemptId);
      throw new ForbiddenException('Exam time has expired');
    }

    // Sequence checking to avoid out-of-order writes
    const seqKey = `attempt:${attemptId}:seq`;
    const currentSeqStr = await client.hget(seqKey, questionId);
    if (currentSeqStr) {
      const currentSeq = parseInt(currentSeqStr, 10);
      if (sequenceNumber <= currentSeq) {
        this.logger.warn(`Stale draft packet ignored for attempt ${attemptId}, question ${questionId}. Sent: ${sequenceNumber}, Current: ${currentSeq}`);
        return;
      }
    }

    // Write draft to cache
    const draftsKey = `attempt:${attemptId}:drafts`;
    await client.hset(draftsKey, questionId, JSON.stringify(draftData));
    await client.expire(draftsKey, 86400); // 24 hours

    // Update sequence tracking
    await client.hset(seqKey, questionId, sequenceNumber.toString());
    await client.expire(seqKey, 86400); // 24 hours

    // Schedule BullMQ write-back
    const syncPendingKey = `attempt:${attemptId}:sync_pending`;
    const setSuccess = await client.set(syncPendingKey, '1', 'EX', 86400, 'NX');
    if (setSuccess === 'OK') {
      await this.draftSyncQueue.add(
        'sync',
        { attemptId },
        {
          delay: 30000, // 30 seconds debounce delay
          jobId: `sync-${attemptId}`,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }

    // Track latency metric
    const latency = Date.now() - start;
    await client.lpush('metrics:autosave_latency', latency.toString());
    await client.ltrim('metrics:autosave_latency', 0, 999);
  }

  /**
   * Record a student heartbeat to Redis cache
   */
  async saveHeartbeat(
    userId: string,
    attemptId: string,
    deviceId: string,
    browserInfo: string,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('User is not a student');
    }

    // Load attempt metadata from cache or database
    const metadataKey = `attempt:${attemptId}:metadata`;
    let metadata = await client.hgetall(metadataKey);

    if (Object.keys(metadata).length === 0) {
      const attempt = await this.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          examAssignment: true,
        },
      });

      if (!attempt) {
        throw new NotFoundException('Attempt not found');
      }

      if (attempt.examAssignment.studentId !== student.id) {
        throw new ForbiddenException('Forbidden: Attempt does not belong to you');
      }

      if (attempt.status !== 'ACTIVE') {
        throw new ForbiddenException('Attempt is locked and cannot be modified');
      }

      // Populate Redis metadata cache for subsequent calls
      metadata = {
        status: attempt.status,
        studentId: attempt.examAssignment.studentId,
        expiresAt: attempt.expiresAt ? attempt.expiresAt.toISOString() : new Date().toISOString(),
      };
      await client.hset(metadataKey, metadata);
      await client.expire(metadataKey, 86400); // 24 hours
    } else {
      if (metadata.studentId !== student.id) {
        throw new ForbiddenException('Forbidden: Attempt does not belong to you');
      }
      if (metadata.status !== 'ACTIVE') {
        throw new ForbiddenException('Attempt is locked and cannot be modified');
      }
    }

    const heartbeatKey = `attempt:${attemptId}:heartbeat`;
    await client.hset(heartbeatKey, {
      lastSeen: new Date().toISOString(),
      deviceId,
      browserInfo,
    });
    await client.expire(heartbeatKey, 86400); // 24 hours
  }

  /**
   * Syncs Redis drafts and heartbeat records to PostgreSQL database (internal, assumes lock is already held)
   */
  private async syncDraftsInternal(attemptId: string): Promise<void> {
    const client = this.redisService.getClient();

    try {
      const draftsKey = `attempt:${attemptId}:drafts`;
      const draftsMap = await client.hgetall(draftsKey);
      
      const heartbeatKey = `attempt:${attemptId}:heartbeat`;
      const heartbeat = await client.hgetall(heartbeatKey);

      if (Object.keys(draftsMap).length === 0 && Object.keys(heartbeat).length === 0) {
        await client.del(`attempt:${attemptId}:sync_pending`);
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        // 1. Sync Drafts
        for (const [questionId, draftDataStr] of Object.entries(draftsMap)) {
          const draftData = JSON.parse(draftDataStr);
          await tx.draft.upsert({
            where: {
              attemptId_questionId: {
                attemptId: attemptId,
                questionId: questionId,
              },
            },
            create: { attemptId, questionId, draftData },
            update: { draftData, updatedAt: new Date() },
          });
        }

        // 2. Sync Heartbeat
        if (heartbeat && heartbeat.lastSeen) {
          await tx.attempt.update({
            where: { id: attemptId },
            data: {
              lastSeen: new Date(heartbeat.lastSeen as string),
              deviceId: heartbeat.deviceId,
              browserInfo: heartbeat.browserInfo,
            },
          });
        }
      });

      await client.del(`attempt:${attemptId}:sync_pending`);
      await client.incr('metrics:sync_success');
    } catch (err) {
      await client.incr('metrics:sync_failures');
      this.logger.error(`Error syncing drafts/heartbeat for attempt ${attemptId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Syncs Redis drafts and heartbeat records to PostgreSQL database
   */
  async syncDraftsForAttempt(attemptId: string): Promise<void> {
    const token = randomUUID();
    const lockAcquired = await this.acquireLock(attemptId, token, 30000);
    if (!lockAcquired) {
      throw new Error(`Could not acquire sync lock for attempt ${attemptId}`);
    }

    try {
      await this.syncDraftsInternal(attemptId);
    } finally {
      await this.releaseLock(attemptId, token);
    }
  }

  /**
   * Expose operational metrics for health checks and dashboards
   */
  async getMetrics(): Promise<any> {
    const client = this.redisService.getClient();
    const syncFailures = await client.get('metrics:sync_failures') || '0';
    const syncSuccess = await client.get('metrics:sync_success') || '0';
    const cacheHit = await client.get('metrics:cache_hit') || '0';
    const cacheMiss = await client.get('metrics:cache_miss') || '0';

    const autosaveLatencies = await client.lrange('metrics:autosave_latency', 0, -1);
    const avgAutosaveLatency = autosaveLatencies.length > 0
      ? autosaveLatencies.reduce((sum, val) => sum + parseInt(val, 10), 0) / autosaveLatencies.length
      : 0;

    const resumeLatencies = await client.lrange('metrics:resume_latency', 0, -1);
    const avgResumeLatency = resumeLatencies.length > 0
      ? resumeLatencies.reduce((sum, val) => sum + parseInt(val, 10), 0) / resumeLatencies.length
      : 0;

    let dirtyQueueSize = 0;
    try {
      const counts = await this.draftSyncQueue.getJobCounts('waiting', 'active', 'delayed');
      dirtyQueueSize = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
    } catch (err) {
      // Ignored
    }

    const hitRate = (parseInt(cacheHit, 10) + parseInt(cacheMiss, 10)) > 0
      ? parseInt(cacheHit, 10) / (parseInt(cacheHit, 10) + parseInt(cacheMiss, 10))
      : 0;

    return {
      dirtyQueueSize,
      syncFailures: parseInt(syncFailures, 10),
      syncSuccess: parseInt(syncSuccess, 10),
      cacheHitRate: hitRate,
      averageAutosaveLatencyMs: avgAutosaveLatency,
      averageResumeLatencyMs: avgResumeLatency,
    };
  }

  /**
   * Performs manual student-triggered submission
   */
  async submitAttempt(userId: string, attemptId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('User is not a student');
    }

    // Acquire lock with random token to avoid race conditions
    const token = randomUUID();
    const lockAcclaimed = await this.acquireLock(attemptId, token, 30000);
    if (!lockAcclaimed) {
      throw new ConflictException('A submission process is already running for this attempt');
    }

    const lockInterval = this.startLockRenewal(attemptId, token);

    try {
      const attempt = await this.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: { examAssignment: { include: { exam: true } } },
      });

      if (!attempt) {
        throw new NotFoundException('Attempt not found');
      }

      if (attempt.examAssignment.studentId !== student.id) {
        throw new ForbiddenException('Forbidden: Attempt does not belong to you');
      }

      if (attempt.status !== 'ACTIVE') {
        throw new ForbiddenException('Attempt is already submitted or locked');
      }

      // Force synchronous final flush before submission finalization
      await this.syncDraftsInternal(attemptId);

      // Perform transaction to convert drafts
      await this.executeSubmitTransaction(attemptId, 'SUBMITTED');

      // Cancel BullMQ Auto-Submit Job using deterministic jobId
      try {
        const job = await this.autoSubmitQueue.getJob(`autosubmit-${attemptId}`);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        this.logger.warn(`Could not remove BullMQ delayed job for ${attemptId}: ${err.message}`);
      }

      // Cancel BullMQ Sync Job if pending
      try {
        const job = await this.draftSyncQueue.getJob(`sync-${attemptId}`);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        // Ignored
      }

      // Cleanup Redis keys
      const client = this.redisService.getClient();
      await client.del(`attempt:${attemptId}:session`);
      await client.del(`attempt:${attemptId}:drafts`);
      await client.del(`attempt:${attemptId}:metadata`);
      await client.del(`attempt:${attemptId}:seq`);
      await client.del(`attempt:${attemptId}:sync_pending`);
      await client.del(`attempt:${attemptId}:heartbeat`);

      // Socket Emit: Inform all screens of successful submission
      this.gateway.server.to(`attempt_room:${attemptId}`).emit('attempt_submitted', {
        status: 'SUBMITTED',
        message: 'Your exam has been submitted successfully.',
      });

      // Log Activity
      await this.activityService.logActivity(
        ActivityType.EXAM_SUBMITTED,
        `Student submitted exam "${attempt.examAssignment.exam.title}"`,
        userId,
        { examId: attempt.examAssignment.examId, attemptId: attempt.id }
      );

      this.logger.log(`Attempt ${attemptId} successfully submitted manually by student ${student.id}`);
    } finally {
      clearInterval(lockInterval);
      await this.releaseLock(attemptId, token);
    }
  }

  /**
   * Performs backend-triggered auto submission
   */
  async autoSubmitAttempt(attemptId: string): Promise<void> {
    const token = randomUUID();
    const lockAcclaimed = await this.acquireLock(attemptId, token, 30000);
    if (!lockAcclaimed) {
      this.logger.log(`Auto-submit lock rejected for ${attemptId} (already processing)`);
      return;
    }

    const lockInterval = this.startLockRenewal(attemptId, token);

    try {
      const attempt = await this.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: { examAssignment: { include: { exam: true } } },
      });

      if (!attempt || attempt.status !== 'ACTIVE') {
        return; // Already submitted
      }

      // Force synchronous final flush before auto-submit finalization
      await this.syncDraftsInternal(attemptId);

      // Perform transaction
      await this.executeSubmitTransaction(attemptId, 'AUTO_SUBMITTED');

      // Cancel BullMQ Job if triggered from cron fallback
      try {
        const job = await this.autoSubmitQueue.getJob(`autosubmit-${attemptId}`);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        // Ignored
      }

      // Cancel BullMQ Sync Job if pending
      try {
        const job = await this.draftSyncQueue.getJob(`sync-${attemptId}`);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        // Ignored
      }

      // Cleanup Redis keys
      const client = this.redisService.getClient();
      await client.del(`attempt:${attemptId}:session`);
      await client.del(`attempt:${attemptId}:drafts`);
      await client.del(`attempt:${attemptId}:metadata`);
      await client.del(`attempt:${attemptId}:seq`);
      await client.del(`attempt:${attemptId}:sync_pending`);
      await client.del(`attempt:${attemptId}:heartbeat`);

      // Socket Emit: Inform students and force-redirect
      this.gateway.server.to(`attempt_room:${attemptId}`).emit('attempt_expired', {
        status: 'AUTO_SUBMITTED',
        message: 'Your exam time limit has expired. Your answers were auto-submitted.',
      });

      // Log Activity
      const studentRecord = await this.prisma.student.findUnique({
        where: { id: attempt.examAssignment.studentId },
      });
      if (studentRecord) {
        await this.activityService.logActivity(
          ActivityType.EXAM_SUBMITTED,
          `Student exam "${attempt.examAssignment.exam.title}" was auto-submitted`,
          studentRecord.userId,
          { examId: attempt.examAssignment.examId, attemptId: attempt.id }
        );
      }

      this.logger.log(`Attempt ${attemptId} successfully auto-submitted.`);
    } finally {
      clearInterval(lockInterval);
      await this.releaseLock(attemptId, token);
    }
  }

  /**
   * Internal Prisma Transaction to finalize attempt, convert drafts, and push evaluations
   */
  private async executeSubmitTransaction(attemptId: string, targetStatus: 'SUBMITTED' | 'AUTO_SUBMITTED'): Promise<void> {
    const submissionsToQueue = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch attempt and lock
      const attempt = await tx.attempt.findUnique({
        where: { id: attemptId },
      });

      if (!attempt || attempt.status !== 'ACTIVE') {
        throw new Error('Attempt is already inactive or not found');
      }

      // 2. Update status of attempt & assignment
      const updatedAttempt = await tx.attempt.update({
        where: { id: attemptId },
        data: {
          status: targetStatus,
          endTime: new Date(),
        },
      });

      await tx.examAssignment.update({
        where: { id: attempt.examAssignmentId },
        data: {
          status: 'COMPLETED',
        },
      });

      // 3. Read drafts
      const drafts = await tx.draft.findMany({
        where: { attemptId },
      });

      if (drafts.length === 0) {
        // No drafts saved, delete nothing, create no submissions
        return [];
      }

      // 4. Create submissions entries
      const submissionsData = drafts.map((draft) => ({
        attemptId,
        questionId: draft.questionId,
        status: 'PENDING' as const,
        scoreAwarded: 0,
      }));

      // Create them
      await tx.submission.createMany({
        data: submissionsData,
      });

      // Get created submissions with IDs
      const createdSubmissions = await tx.submission.findMany({
        where: { attemptId },
      });

      // 5. Batch fetch all questions and their MCQ options in a single query
      const questionIds = createdSubmissions.map((s) => s.questionId);
      const questions = await tx.question.findMany({
        where: { id: { in: questionIds } },
        include: {
          mcqOptions: true,
        },
      });

      const codingSubmissionsData = [];
      const queueItems = [];
      const mcqUpdates = [];

      for (const sub of createdSubmissions) {
        const question = questions.find((q) => q.id === sub.questionId);
        if (!question) continue;

        const draft = drafts.find((d) => d.questionId === sub.questionId);
        const draftData = draft?.draftData as any;

        // Perform type check strictly based on DB model metadata instead of client payload shape
        if (question.type === 'CODING') {
          codingSubmissionsData.push({
            submissionId: sub.id,
            language: draftData?.language || 'python',
            codeSnippet: draftData?.codeSnippet || '',
          });

          // Prepare list for queuing execution
          queueItems.push({
            submissionId: sub.id,
            questionId: sub.questionId,
            language: draftData?.language || 'python',
            code: draftData?.codeSnippet || '',
          });
        } else if (question.type === 'MCQ') {
          // In-memory option match
          const correctOption = question.mcqOptions.find((opt) => opt.isCorrect);
          const selectedOptionId = draftData?.selectedOptionId;
          const passed = correctOption && selectedOptionId === correctOption.id;
          const marksEarned = passed ? question.marks : 0;

          mcqUpdates.push(
            tx.submission.update({
              where: { id: sub.id },
              data: {
                status: passed ? 'PASSED' : 'FAILED',
                scoreAwarded: marksEarned,
              },
            })
          );
        }
      }

      // Execute MCQ submission updates concurrently inside the transaction
      if (mcqUpdates.length > 0) {
        await Promise.all(mcqUpdates);
      }

      if (codingSubmissionsData.length > 0) {
        await tx.codingSubmission.createMany({
          data: codingSubmissionsData,
        });
      }

      // 6. Delete Drafts
      await tx.draft.deleteMany({
        where: { attemptId },
      });

      return queueItems;
    });

    // Enqueue coding evaluations in BullMQ (outside Prisma transaction to prevent lock holding)
    for (const item of submissionsToQueue) {
      await this.codeQueue.add(
        'execute',
        {
          language: item.language,
          code: item.code,
          questionId: item.questionId,
          isSubmit: true,
        },
        {
          jobId: item.submissionId, // Link queue job to submission ID
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }
  }

  /**
   * Fallback Safety Sweeper
   * Sweeps ACTIVE attempts whose remaining duration has run out by > 10 seconds.
   */
  async runSafetySweeper(): Promise<void> {
    const now = new Date();
    // Sweeps attempts that have expired by more than 10 seconds and are still ACTIVE
    const expiredActiveAttempts = await this.prisma.attempt.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lt: new Date(now.getTime() - 10000), // 10 seconds grace period
        },
      },
      take: 1000,
    });

    if (expiredActiveAttempts.length === 0) return;

    this.logger.warn(
      `Safety Sweeper detected ${expiredActiveAttempts.length} expired active attempts. Enqueuing to auto-submit queue.`,
    );

    for (const attempt of expiredActiveAttempts) {
      try {
        await this.autoSubmitQueue.add(
          'autosubmit',
          { attemptId: attempt.id },
          {
            jobId: `autosubmit-${attempt.id}`,
            removeOnComplete: true,
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        );
      } catch (err) {
        this.logger.error(`Failed to enqueue auto-submit job for attempt ${attempt.id} in safety sweeper: ${err.message}`);
      }
    }
  }

  /**
   * Helper to format active attempt details payload
   */
  private buildAttemptPayload(
    attempt: any,
    exam: any,
    drafts: any[],
  ): ActiveAttemptPayload {
    const expiresAt = attempt.expiresAt
      ? new Date(attempt.expiresAt)
      : new Date(Math.min(attempt.startTime.getTime() + exam.durationMinutes * 60 * 1000, exam.endTime.getTime()));
    const secondsRemaining = this.calculateSecondsRemaining(expiresAt);

    const formattedQuestions: QuestionData[] = exam.questions.map((eq: any) => {
      const q = eq.question;
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        order: eq.order,
        marks: q.marks,
        mcqOptions: q.mcqOptions?.map((o: any) => ({
          id: o.id,
          optionText: o.optionText,
        })),
        codingQuestion: q.codingQuestion
          ? {
              constraints: q.codingQuestion.constraints,
              sampleInput: q.codingQuestion.sampleInput,
              sampleOutput: q.codingQuestion.sampleOutput,
            }
          : undefined,
      };
    });

    const formattedDrafts: DraftData[] = drafts.map((d: any) => ({
      questionId: d.questionId,
      draftData: d.draftData,
    }));

    return {
      attemptId: attempt.id,
      examId: exam.id,
      startTime: attempt.startTime,
      secondsRemaining,
      status: attempt.status,
      questions: formattedQuestions,
      drafts: formattedDrafts,
    };
  }

  async getStudentAssignments(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('User is not registered as a student');
    }

    const assignments = await this.prisma.examAssignment.findMany({
      where: { studentId: student.id },
      include: {
        exam: {
          include: {
            questions: {
              include: { question: true }
            }
          }
        },
        attempts: {
          orderBy: { startTime: 'desc' },
          take: 1
        }
      }
    });

    return assignments.map(a => {
      const activeAttempt = a.attempts[0];
      let status = 'AVAILABLE';
      if (a.status === 'COMPLETED') {
        status = 'COMPLETED';
      } else if (activeAttempt && activeAttempt.status === 'ACTIVE') {
        status = 'IN_PROGRESS';
      } else {
        const now = new Date();
        if (now < a.exam.startTime) {
          status = 'UPCOMING';
        } else if (now > a.exam.endTime) {
          status = 'EXPIRED';
        }
      }

      return {
        id: a.exam.id,
        assignmentId: a.id,
        title: a.exam.title,
        description: a.exam.description,
        durationMinutes: a.exam.durationMinutes,
        startTime: a.exam.startTime,
        endTime: a.exam.endTime,
        questionCount: a.exam.questions.length,
        status,
        timeLeftSeconds: activeAttempt && activeAttempt.expiresAt ? Math.max(0, Math.floor((activeAttempt.expiresAt.getTime() - Date.now()) / 1000)) : 0
      };
    });
  }

  async getStudentResults(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ForbiddenException('User is not registered as a student');
    }

    const completedAssignments = await this.prisma.examAssignment.findMany({
      where: { studentId: student.id, status: 'COMPLETED' },
      include: {
        exam: {
          include: {
            questions: {
              include: { question: true }
            }
          }
        },
        attempts: {
          include: {
            submissions: true
          },
          orderBy: { startTime: 'desc' },
          take: 1
        }
      }
    });

    return completedAssignments.map(a => {
      const attempt = a.attempts[0];
      const totalScore = attempt ? attempt.submissions.reduce((sum, s) => sum + s.scoreAwarded, 0) : 0;
      const totalMaxScore = a.exam.questions.reduce((sum, q) => sum + q.question.marks, 0);

      return {
        id: a.exam.id,
        title: a.exam.title,
        completedAt: attempt ? attempt.endTime || attempt.startTime : new Date(),
        score: totalScore,
        maxScore: totalMaxScore,
        passed: totalScore >= (totalMaxScore * 0.5) // 50% pass threshold
      };
    });
  }
}
