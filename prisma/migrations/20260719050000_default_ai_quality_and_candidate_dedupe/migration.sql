-- Default every account into the current AI quality improvement policy version.
UPDATE "User"
SET
  "privacyPolicyVersion" = '2026-07-19',
  "aiQualityConsentVersion" = '2026-07-19',
  "aiQualityConsentAt" = COALESCE("aiQualityConsentAt", "agreedToPrivacyAt", "createdAt"),
  "aiQualityConsentRevokedAt" = NULL;

-- Repeated iteration runs reuse candidates generated from the same evidence set.
ALTER TABLE "AIOptimizationCandidate" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "AIOptimizationCandidate_dedupeKey_key" ON "AIOptimizationCandidate"("dedupeKey");
