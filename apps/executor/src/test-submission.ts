import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient, EvaluationStatus } from '@alex/database';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(REDIS_URL);

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- Coding Execution Engine Verification Test Suite ---');
  
  // 1. Ensure basic models exist or create them
  console.log('Setting up seed data in database...');
  let user = await prisma.user.findFirst({ where: { email: 'sandbox-test@alex.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'sandbox-test@alex.com',
        passwordHash: 'hashedpassword',
        role: 'STUDENT',
      }
    });
  }

  let student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    student = await prisma.student.create({
      data: {
        userId: user.id,
        registrationNumber: 'REG-SANDBOX-999',
        batch: '2026',
        department: 'CS',
      }
    });
  }

  let exam = await prisma.exam.findFirst({ where: { title: 'Sandbox Integration Exam' } });
  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        title: 'Sandbox Integration Exam',
        description: 'Verify security and resource constraints',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        durationMinutes: 60,
        createdBy: 'ADMIN-1',
      }
    });
  }

  let examAssignment = await prisma.examAssignment.findFirst({
    where: { studentId: student.id, examId: exam.id }
  });
  if (!examAssignment) {
    examAssignment = await prisma.examAssignment.create({
      data: {
        examId: exam.id,
        studentId: student.id,
        status: 'IN_PROGRESS',
      }
    });
  }

  let attempt = await prisma.attempt.findFirst({
    where: { examAssignmentId: examAssignment.id }
  });
  if (!attempt) {
    attempt = await prisma.attempt.create({
      data: {
        examAssignmentId: examAssignment.id,
        status: 'ACTIVE',
        startTime: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      }
    });
  }

  // Define questions
  const qTypes = [
    { title: 'Python Accepted & Network Check', ext: 'py' },
    { title: 'C++ TLE & Compile Check', ext: 'cpp' }
  ];
  
  const questions: any[] = [];
  for (const qt of qTypes) {
    let q = await prisma.question.findFirst({
      where: { text: qt.title }
    });
    if (!q) {
      q = await prisma.question.create({
        data: {
          type: 'CODING',
          text: qt.title,
          marks: 10,
          difficulty: 'MEDIUM',
        }
      });
      await prisma.codingQuestion.create({
        data: {
          questionId: q.id,
          problemStatement: `Test program for ${qt.title}`,
          constraints: 'None',
          sampleInput: 'Hello',
          sampleOutput: 'Hello',
        }
      });
      // Link question to exam
      await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          questionId: q.id,
          order: questions.length + 1
        }
      });
    }
    
    // Add test cases
    const codingQ = await prisma.codingQuestion.findUnique({ where: { questionId: q.id } });
    if (codingQ) {
      const tcCount = await prisma.testCase.count({ where: { codingQuestionId: codingQ.id } });
      if (tcCount === 0) {
        await prisma.testCase.createMany({
          data: [
            { codingQuestionId: codingQ.id, input: '1\n', expectedOutput: '1\n', isHidden: false, weightage: 5 },
            { codingQuestionId: codingQ.id, input: '2\n', expectedOutput: '2\n', isHidden: true, weightage: 5 }
          ]
        });
      }
    }
    
    questions.push(q);
  }

  // BullMQ Setup
  const queue = new Queue('code-execution', { connection: redis as any });

  // 2. Submit test cases
  const testSubmissions = [
    {
      name: 'Test 1: Python Accepted Submission',
      language: 'python',
      code: `import sys\nval = sys.stdin.read().strip()\nprint(val)`,
      questionId: questions[0].id,
      expectedOutcome: 'ACCEPTED'
    },
    {
      name: 'Test 2: Python Network Isolation Check',
      language: 'python',
      code: `import socket\ntry:\n    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    s.connect(("8.8.8.8", 80))\n    print("Success")\nexcept Exception as e:\n    print("Network Error:", e, file=sys.stderr)`,
      questionId: questions[0].id,
      expectedOutcome: 'RUNTIME_ERROR'
    },
    {
      name: 'Test 3: Python Output Stream Bombing (DoS Protection)',
      language: 'python',
      code: `import sys\n# Generate infinite outputs\nwhile True:\n    sys.stdout.write("A")`,
      questionId: questions[0].id,
      expectedOutcome: 'WRONG_ANSWER'
    },
    {
      name: 'Test 4: Python Memory Limit Exceeded (MLE)',
      language: 'python',
      code: `import sys\n# Allocate 300MB of memory\narr = [0] * (40 * 1024 * 1024)\nprint("allocated")`,
      questionId: questions[0].id,
      expectedOutcome: 'MEMORY_LIMIT_EXCEEDED'
    },
    {
      name: 'Test 5: C++ Time Limit Exceeded (TLE)',
      language: 'cpp',
      code: `#include <iostream>\nint main() {\n    while(true) {}\n    return 0;\n}`,
      questionId: questions[1].id,
      expectedOutcome: 'TIME_LIMIT_EXCEEDED'
    },
    {
      name: 'Test 6: C++ Compilation Error',
      language: 'cpp',
      code: `#include <iostream>\nint main() {\n    invalid_syntax_error;\n    return 0;\n}`,
      questionId: questions[1].id,
      expectedOutcome: 'COMPILATION_ERROR'
    }
  ];

  const jobs: { name: string; jobId: string; expectedOutcome: string }[] = [];

  for (const ts of testSubmissions) {
    console.log(`Submitting ${ts.name}...`);
    
    // Create Submission and CodingSubmission
    const submission = await prisma.submission.create({
      data: {
        attemptId: attempt.id,
        questionId: ts.questionId,
        status: 'PENDING',
        scoreAwarded: 0,
      }
    });

    await prisma.codingSubmission.create({
      data: {
        submissionId: submission.id,
        language: ts.language,
        codeSnippet: ts.code,
        status: 'PENDING',
      }
    });

    // Enqueue
    const jobId = submission.id;
    await queue.add('execute', {
      language: ts.language,
      code: ts.code,
      questionId: ts.questionId,
      isSubmit: true,
    }, {
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    });

    jobs.push({
      name: ts.name,
      jobId,
      expectedOutcome: ts.expectedOutcome
    });
  }

  // 3. Monitor results
  console.log('\nMonitoring execution jobs. Waiting for worker to evaluate...');
  await wait(5000); // Wait 5 seconds for execution

  console.log('\n--- VERIFICATION REPORT RESULTS ---');

  for (const job of jobs) {
    console.log(`\n==========================================`);
    console.log(`Submission: ${job.name}`);
    console.log(`Job ID: ${job.jobId}`);
    console.log(`Expected Outcome: ${job.expectedOutcome}`);

    // Query Database Row
    const dbSub = await prisma.codingSubmission.findUnique({
      where: { submissionId: job.jobId }
    });
    
    const parentSub = await prisma.submission.findUnique({
      where: { id: job.jobId }
    });

    console.log('PostgreSQL Record:');
    if (dbSub) {
      console.log(`  - Status: ${dbSub.status}`);
      console.log(`  - Passed Count: ${dbSub.passedCount}`);
      console.log(`  - Failed Count: ${dbSub.failedCount}`);
      console.log(`  - Max Run Time: ${dbSub.executionTimeMs} ms`);
      console.log(`  - Peak Memory: ${dbSub.memoryUsedKb} KB`);
      console.log(`  - Compile Output: ${dbSub.compileOutput ? dbSub.compileOutput.trim() : 'None'}`);
      console.log(`  - Parent Score Awarded: ${parentSub?.scoreAwarded ?? 0}`);
    } else {
      console.log('  - CodingSubmission record not found!');
    }

    // Query Failures
    const failures = await prisma.testCaseResult.findMany({
      where: { codingSubmissionId: dbSub?.id }
    });
    console.log(`  - Database TestCaseResult rows inserted: ${failures.length}`);
    for (const f of failures) {
      console.log(`    * TC ID: ${f.testCaseId} | Status: ${f.status} | Time: ${f.executionTimeMs}ms | Mem: ${f.memoryUsedKb}KB`);
      if (f.stderr) console.log(`      Stderr: ${f.stderr.trim()}`);
    }

    // Query Redis cache details
    const redisDetails = await redis.get(`submission:${job.jobId}:details`);
    console.log('Redis Cache Details (TTL 24h):');
    if (redisDetails) {
      const details = JSON.parse(redisDetails);
      console.log(`  - Overall Status: ${details.status}`);
      console.log(`  - Test Cases Run: ${details.testResults.length}`);
      for (const tr of details.testResults) {
        console.log(`    * TC ID: ${tr.testCaseId} | Passed: ${tr.passed} | Status: ${tr.status} | Time: ${tr.executionTimeMs}ms`);
        console.log(`      Stdout: ${tr.stdout ? tr.stdout.trim().replace(/\n/g, ' ') : 'None'}`);
        if (tr.stderr) console.log(`      Stderr: ${tr.stderr.trim().replace(/\n/g, ' ')}`);
      }
    } else {
      console.log('  - Redis cache not found!');
    }
  }

  // Cleanup seeded attempt
  console.log('\nCleaning up verification entries...');
  // We can let them remain or delete them
  await queue.close();
  await redis.quit();
  console.log('Test completed successfully.');
}

runTests().catch(err => {
  console.error('Test script failed:', err);
});
