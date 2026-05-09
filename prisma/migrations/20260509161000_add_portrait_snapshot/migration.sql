-- AlterEnum
ALTER TYPE "AIRequestStage" ADD VALUE 'portrait_synthesis';

-- CreateTable
CREATE TABLE "PortraitSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "dimensionInsights" JSONB NOT NULL,
    "factCount" INTEGER NOT NULL,
    "dataRangeMonths" INTEGER NOT NULL DEFAULT 3,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortraitSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortraitSnapshot_userId_idx" ON "PortraitSnapshot"("userId");

-- AddForeignKey
ALTER TABLE "PortraitSnapshot" ADD CONSTRAINT "PortraitSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
