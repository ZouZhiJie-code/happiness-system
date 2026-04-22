ALTER TYPE "InterviewSessionStatus" ADD VALUE IF NOT EXISTS 'paused';

ALTER TABLE "InterviewSession" ADD COLUMN "pausedAt" TIMESTAMP(3);
