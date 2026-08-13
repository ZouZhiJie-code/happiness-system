ALTER TABLE "InterviewUserTurn"
ADD COLUMN "intentAssessment" JSONB,
ADD COLUMN "intentClassifierVersion" TEXT,
ADD COLUMN "intentDecision" JSONB,
ADD COLUMN "intentAssessedAt" TIMESTAMP(3);
