-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvaluationStatus" ADD VALUE 'COMPILING';
ALTER TYPE "EvaluationStatus" ADD VALUE 'COMPILATION_ERROR';
ALTER TYPE "EvaluationStatus" ADD VALUE 'RUNNING';
ALTER TYPE "EvaluationStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "EvaluationStatus" ADD VALUE 'WRONG_ANSWER';
ALTER TYPE "EvaluationStatus" ADD VALUE 'TIME_LIMIT_EXCEEDED';
ALTER TYPE "EvaluationStatus" ADD VALUE 'MEMORY_LIMIT_EXCEEDED';
ALTER TYPE "EvaluationStatus" ADD VALUE 'RUNTIME_ERROR';
ALTER TYPE "EvaluationStatus" ADD VALUE 'SYSTEM_ERROR';

-- DropForeignKey
ALTER TABLE "CodingSubmission" DROP CONSTRAINT "CodingSubmission_submissionId_fkey";

-- AlterTable
ALTER TABLE "CodingSubmission" ADD COLUMN     "compileOutput" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "TestCaseResult" (
    "id" TEXT NOT NULL,
    "codingSubmissionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL,
    "stdout" TEXT,
    "stderr" TEXT,
    "executionTimeMs" INTEGER NOT NULL,
    "memoryUsedKb" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCaseResult_codingSubmissionId_idx" ON "TestCaseResult"("codingSubmissionId");

-- CreateIndex
CREATE INDEX "TestCaseResult_testCaseId_idx" ON "TestCaseResult"("testCaseId");

-- AddForeignKey
ALTER TABLE "CodingSubmission" ADD CONSTRAINT "CodingSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseResult" ADD CONSTRAINT "TestCaseResult_codingSubmissionId_fkey" FOREIGN KEY ("codingSubmissionId") REFERENCES "CodingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseResult" ADD CONSTRAINT "TestCaseResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
