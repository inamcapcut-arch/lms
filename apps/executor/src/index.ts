import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { CodeExecutionRequest, CodeExecutionResult } from '@alex/shared-types';
import { PrismaClient, EvaluationStatus } from '@alex/database';
import { executeCodeInContainer, SubmissionExecutionResult, verifySandboxRuntime } from './docker.runner';

function cleanDbString(str: string | null | undefined): string | null {
  if (!str) return null;
  return str.replace(/\u0000/g, '').replace(/\x00/g, '');
}

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

const worker = new Worker<CodeExecutionRequest, any>(
  'code-execution',
  async (job) => {
    const submissionId = job.id;
    if (!submissionId) {
      throw new Error('Missing job ID');
    }

    console.log(`Processing job ${submissionId} for language: ${job.data.language}`);
    const { language, code, questionId, isSubmit, customInput } = job.data;

    // 1. Idempotency Check (Only for final submissions)
    let existingCodingSub = null;
    if (isSubmit) {
      try {
        existingCodingSub = await prisma.codingSubmission.findUnique({
          where: { submissionId },
        });

        if (existingCodingSub && existingCodingSub.status !== 'PENDING' && existingCodingSub.status !== 'RUNNING') {
          console.log(`Idempotency check: Job ${submissionId} already evaluated (Status: ${existingCodingSub.status}). Skipping.`);
          return {
            jobId: submissionId,
            status: 'COMPLETED',
            overallStatus: existingCodingSub.status,
            passedCount: existingCodingSub.passedCount,
            failedCount: existingCodingSub.failedCount,
          };
        }
      } catch (err: any) {
        console.error(`Database query failed during idempotency check: ${err.message}`);
        // Fallthrough, try evaluating anyway or raise if connection is dead
      }
    }

    // 2. Setup Test Cases
    let testCases: any[] = [];
    if (customInput) {
      // Run custom testing
      testCases = [{ id: 'custom', input: customInput, expectedOutput: null, weightage: 0 }];
    } else {
      // Fetch test cases, check Redis cache first to avoid DB calls
      const cacheKey = `question:${questionId}:testcases`;
      try {
        const cached = await connection.get(cacheKey);
        if (cached) {
          testCases = JSON.parse(cached);
        } else {
          testCases = await prisma.testCase.findMany({
            where: {
              codingQuestion: {
                questionId: questionId
              }
            },
          });
          if (testCases.length > 0) {
            await connection.set(cacheKey, JSON.stringify(testCases), 'EX', 86400); // cache for 24h
          }
        }
      } catch (err: any) {
        console.error(`Failed to fetch test cases from cache/DB: ${err.message}`);
      }

      // No silent fallback: grading a real submission against placeholder test
      // cases would produce bogus scores. Fail loudly instead so the missing
      // test cases are surfaced and fixed.
      if (testCases.length === 0) {
        console.error(`No test cases found for question ${questionId}. Refusing to grade against placeholders.`);
        throw new Error(`No test cases configured for question ${questionId}.`);
      }
    }

    // Update status in Postgres to RUNNING
    if (isSubmit && existingCodingSub) {
      await prisma.codingSubmission.update({
        where: { id: existingCodingSub.id },
        data: { status: 'RUNNING' },
      }).catch(() => {});
    }

    // 3. Execution in Sandbox
    const isInterpreted = ['python', 'javascript', 'typescript'].includes(language.toLowerCase());
    const timeLimitMs = isInterpreted ? 4000 : 2000;
    const memoryLimitKb = 256 * 1024; // 256MB limit

    const runResult: SubmissionExecutionResult = await executeCodeInContainer(
      submissionId,
      language,
      code,
      testCases,
      timeLimitMs,
      memoryLimitKb
    );

    // 4. Save Results (Hybrid persistence model)
    if (isSubmit) {
      try {
        const codingSub = await prisma.codingSubmission.findUnique({
          where: { submissionId },
          include: { submission: true },
        });

        if (codingSub) {
          const totalWeight = testCases.reduce((sum, tc) => sum + (tc.weightage ?? 10), 0);
          const passedWeight = testCases.reduce((sum, tc, idx) => {
            const tr = runResult.testResults.find(r => r.testCaseId === tc.id);
            return sum + (tr && tr.passed ? (tc.weightage ?? 10) : 0);
          }, 0);

          const question = await prisma.question.findUnique({
            where: { id: questionId },
          });

          const maxMarks = question?.marks ?? 10;
          const scoreAwarded = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * maxMarks) : 0;

          // Convert status string to prisma EvaluationStatus enum
          let dbStatus: EvaluationStatus = EvaluationStatus.SYSTEM_ERROR;
          if (Object.values(EvaluationStatus).includes(runResult.status as any)) {
            dbStatus = runResult.status as EvaluationStatus;
          }

          // Postgres Transaction: Aggregates + Failed Test Cases
          await prisma.$transaction(async (tx) => {
            // Write aggregate specs
            await tx.codingSubmission.update({
              where: { id: codingSub.id },
              data: {
                status: dbStatus,
                compileOutput: cleanDbString(runResult.compileOutput),
                passedCount: runResult.passedCount,
                failedCount: runResult.failedCount,
                executionTimeMs: runResult.executionTimeMs,
                memoryUsedKb: runResult.memoryUsedKb,
              },
            });

            // Update parent submission status
            await tx.submission.update({
              where: { id: codingSub.submissionId },
              data: {
                status: dbStatus === EvaluationStatus.ACCEPTED ? EvaluationStatus.PASSED : EvaluationStatus.FAILED,
                scoreAwarded,
              },
            });

            // Clean existing failures if any (for idempotency retry safety)
            await tx.testCaseResult.deleteMany({
              where: { codingSubmissionId: codingSub.id },
            });

            // Persist failed test case outputs for review
            const failedResults = runResult.testResults.filter(r => !r.passed);
            if (failedResults.length > 0) {
              await tx.testCaseResult.createMany({
                data: failedResults.map(r => ({
                  codingSubmissionId: codingSub.id,
                  testCaseId: r.testCaseId,
                  status: (Object.values(EvaluationStatus).includes(r.status as any) ? r.status : 'SYSTEM_ERROR') as EvaluationStatus,
                  stdout: cleanDbString(r.stdout),
                  stderr: cleanDbString(r.stderr),
                  executionTimeMs: r.executionTimeMs,
                  memoryUsedKb: r.memoryUsedKb,
                })),
              });
            }
          });

          // Write all runs (including passed ones) to Redis cache (24h TTL)
          await connection.set(
            `submission:${submissionId}:details`,
            JSON.stringify(runResult),
            'EX',
            86400
          );
        }
      } catch (err: any) {
        console.error(`Transaction persistence failed: ${err.message}`);
        runResult.status = 'SYSTEM_ERROR';
        runResult.compileOutput = `Database persistence failure: ${err.message}`;
      }
    }

    return {
      jobId: submissionId,
      status: 'COMPLETED',
      userId: job.data.userId,
      overallStatus: runResult.status,
      passedCount: runResult.passedCount,
      failedCount: runResult.failedCount,
      testResults: runResult.testResults,
      compileOutput: runResult.compileOutput,
    };
  },
  { connection: connection as any }
);

worker.on('completed', async (job, result) => {
  console.log(`Job ${job.id} completed successfully.`);
  // Set job output in Redis for REST API polling retrieval
  await connection.set(
    `job:${job.id}`,
    JSON.stringify(result),
    'EX',
    3600 // Expire in 1 hour
  );
});

worker.on('failed', async (job, err) => {
  console.error(`Job ${job?.id} failed with error: ${err.message}`);
  if (job?.id) {
    await connection.set(
      `job:${job.id}`,
      JSON.stringify({
        jobId: job.id,
        status: 'FAILED',
        userId: job.data?.userId,
        error: err.message,
      }),
      'EX',
      3600
    );
  }
});

console.log('Executor Worker starting...');
verifySandboxRuntime()
  .then(() => {
    console.log('Executor Worker started, listening to code-execution queue...');
  })
  .catch((err) => {
    console.error('Executor Worker startup failed due to sandbox runtime verification failure:', err.message);
    process.exit(1);
  });
