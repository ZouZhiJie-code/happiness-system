-- CreateEnum
CREATE TYPE "MemorySourceType" AS ENUM ('ai_extracted', 'user_added');

-- AlterTable: Add new columns to MemoryFact
ALTER TABLE "MemoryFact" ADD COLUMN "topicTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MemoryFact" ADD COLUMN "sourceType" "MemorySourceType" NOT NULL DEFAULT 'ai_extracted';
ALTER TABLE "MemoryFact" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MemoryFact" ADD COLUMN "evidenceSessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MemoryFact" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MemoryFact_userId_deletedAt_idx" ON "MemoryFact"("userId", "deletedAt");

-- Migrate salience to confidence (copy data if any exists)
UPDATE "MemoryFact" SET "confidence" = "salience" WHERE "salience" != 0;

-- DropColumn: remove old salience column
ALTER TABLE "MemoryFact" DROP COLUMN "salience";
