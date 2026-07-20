ALTER TABLE "AIPromptRelease"
ADD COLUMN "validationId" TEXT;

CREATE INDEX "AIPromptRelease_validationId_idx"
ON "AIPromptRelease"("validationId");

ALTER TABLE "AIPromptRelease"
ADD CONSTRAINT "AIPromptRelease_validationId_fkey"
FOREIGN KEY ("validationId") REFERENCES "AIOptimizationValidation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
