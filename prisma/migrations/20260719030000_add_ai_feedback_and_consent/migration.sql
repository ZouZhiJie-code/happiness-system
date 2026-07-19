-- CreateEnum
CREATE TYPE "AIFeedbackVote" AS ENUM ('upvote', 'downvote');

-- CreateEnum
CREATE TYPE "AIFeedbackStatus" AS ENUM ('active', 'revoked');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "privacyPolicyVersion" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "aiQualityConsentVersion" TEXT,
ADD COLUMN "aiQualityConsentAt" TIMESTAMP(3),
ADD COLUMN "aiQualityConsentRevokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AIGenerationTrace"
ADD COLUMN "feedbackEvaluationPending" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AIFeedback" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "AIFeedbackVote" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT,
    "status" "AIFeedbackStatus" NOT NULL DEFAULT 'active',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "privacyPolicyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AIFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFeedbackRevision" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "vote" "AIFeedbackVote" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT,
    "status" "AIFeedbackStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFeedbackRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIFeedback_traceId_key" ON "AIFeedback"("traceId");

-- CreateIndex
CREATE INDEX "AIFeedback_userId_updatedAt_idx" ON "AIFeedback"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AIFeedback_vote_status_updatedAt_idx" ON "AIFeedback"("vote", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIFeedbackRevision_feedbackId_revision_key" ON "AIFeedbackRevision"("feedbackId", "revision");

-- CreateIndex
CREATE INDEX "AIFeedbackRevision_feedbackId_createdAt_idx" ON "AIFeedbackRevision"("feedbackId", "createdAt");

-- AddForeignKey
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFeedbackRevision" ADD CONSTRAINT "AIFeedbackRevision_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "AIFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
