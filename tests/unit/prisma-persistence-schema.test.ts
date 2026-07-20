import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("prisma persistence indexes", () => {
  it("declares date-range indexes for session and entry queries", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("@@index([userId, entryDate])");
    expect(schema).toContain("@@index([userId, date])");
    expect(schema).toContain("@@index([userId, status, date])");
    expect(schema).toContain("model AnalyticsEvent");
    expect(schema).toContain("model AdminAuditLog");
    expect(schema).toContain("@@index([eventName, occurredAt])");
    expect(schema).toContain("@@index([adminUsername, createdAt])");
  });

  it("declares ai runtime config enums, models, and migration artifacts", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260525120000_add_ai_runtime_config_tables/migration.sql"),
      "utf8"
    );
    const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    const envPreviewExample = readFileSync(resolve(process.cwd(), ".env.preview.example"), "utf8");
    const envProductionExample = readFileSync(resolve(process.cwd(), ".env.production.example"), "utf8");

    expect(schema).toContain("enum AIRuntimeCapability");
    expect(schema).toContain("enum AIRuntimeProvider");
    expect(schema).toContain("enum AIRuntimeConfigStatus");
    expect(schema).toContain("model AIRuntimeConfig");
    expect(schema).toContain("model AIRuntimeProbe");
    expect(schema).toContain("@@unique([capability, version])");
    expect(schema).toContain("@@index([capability, status, updatedAt])");
    expect(schema).toContain("@@index([status, publishedAt])");
    expect(schema).toContain("@@index([configId, createdAt])");
    expect(schema).toContain("@@index([capability, createdAt])");
    expect(schema).toContain('probes           AIRuntimeProbe[]');
    expect(schema).toContain("apiKeyCiphertext String?");
    expect(schema).toContain("rollbackFromId   String?");

    expect(migration).toContain('CREATE TYPE "AIRuntimeCapability" AS ENUM');
    expect(migration).toContain('CREATE TYPE "AIRuntimeProvider" AS ENUM');
    expect(migration).toContain('CREATE TYPE "AIRuntimeConfigStatus" AS ENUM');
    expect(migration).toContain('CREATE TABLE "AIRuntimeConfig"');
    expect(migration).toContain('CREATE TABLE "AIRuntimeProbe"');
    expect(migration).toContain('CREATE UNIQUE INDEX "AIRuntimeConfig_capability_version_key"');
    expect(migration).toContain('CREATE INDEX "AIRuntimeConfig_capability_status_updatedAt_idx"');
    expect(migration).toContain('CREATE INDEX "AIRuntimeProbe_configId_createdAt_idx"');

    expect(envExample).toContain('AI_RUNTIME_CONFIG_SECRET=""');
    expect(envPreviewExample).toContain('AI_RUNTIME_CONFIG_SECRET=""');
    expect(envProductionExample).toContain('AI_RUNTIME_CONFIG_SECRET=""');
  });

  it("declares end-to-end AI generation lineage and case storage", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260719010000_add_ai_generation_trace/migration.sql"),
      "utf8"
    );
    const evaluationMigration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260719020000_add_ai_evaluation/migration.sql"),
      "utf8"
    );
    const feedbackMigration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260719030000_add_ai_feedback_and_consent/migration.sql"),
      "utf8"
    );
    const optimizationMigration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260719040000_add_ai_optimization_engine/migration.sql"),
      "utf8"
    );
    const qualityDefaultsMigration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260719050000_default_ai_quality_and_candidate_dedupe/migration.sql"),
      "utf8"
    );
    const releaseValidationMigration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260720010000_bind_prompt_release_validation/migration.sql"),
      "utf8"
    );
    const reviewReasonMigration = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260720153000_add_ai_optimization_review_reason/migration.sql"),
      "utf8"
    );

    expect(schema).toContain("model AIGenerationTrace");
    expect(schema).toContain("model AICase");
    expect(schema).toContain("model AIEvaluation");
    expect(schema).toContain("model AIFeedback");
    expect(schema).toContain("model AIFeedbackRevision");
    expect(schema).toContain("model AIOptimizationRun");
    expect(schema).toContain("model AIBadcaseCluster");
    expect(schema).toContain("model AIOptimizationCandidate");
    expect(schema).toContain("model AIOptimizationValidation");
    expect(schema).toContain("model AIFewShotExample");
    expect(schema).toContain("model AIPromptRelease");
    expect(schema).toContain("dedupeKey");
    expect(schema).toContain("aiQualityConsentVersion");
    expect(schema).toContain("feedbackEvaluationPending");
    expect(schema).toContain("generationTraceId String?");
    expect(schema).toContain("currentGenerationTraceId String?");
    expect(schema).toContain("promptVersion");
    expect(schema).toContain("validationId");
    expect(schema).toContain("reviewReason");
    expect(schema).toContain("promptHash");
    expect(schema).toContain("requestMessages");
    expect(schema).toContain("responseText");
    expect(schema).toContain("@@index([userId, createdAt])");
    expect(schema).toContain("@@index([artifactType, dimension, createdAt])");
    expect(schema).toContain("@@index([classification, priority, updatedAt])");

    expect(migration).toContain('CREATE TABLE "AIGenerationTrace"');
    expect(migration).toContain('CREATE TABLE "AICase"');
    expect(migration).toContain('ADD COLUMN "generationTraceId" TEXT');
    expect(migration).toContain('ADD COLUMN "currentGenerationTraceId" TEXT');
    expect(migration).toContain('FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id")');
    expect(evaluationMigration).toContain('CREATE TABLE "AIEvaluation"');
    expect(evaluationMigration).toContain('"dimensionScores" JSONB NOT NULL');
    expect(evaluationMigration).toContain('"deductions" JSONB NOT NULL');
    expect(evaluationMigration).toContain('CREATE UNIQUE INDEX "AIEvaluation_traceId_key"');
    expect(feedbackMigration).toContain('CREATE TABLE "AIFeedback"');
    expect(feedbackMigration).toContain('CREATE TABLE "AIFeedbackRevision"');
    expect(feedbackMigration).toContain('ADD COLUMN "aiQualityConsentVersion" TEXT');
    expect(feedbackMigration).toContain('CREATE UNIQUE INDEX "AIFeedback_traceId_key"');
    expect(optimizationMigration).toContain('CREATE TABLE "AIOptimizationRun"');
    expect(optimizationMigration).toContain('CREATE TABLE "AIBadcaseCluster"');
    expect(optimizationMigration).toContain('CREATE TABLE "AIOptimizationCandidate"');
    expect(optimizationMigration).toContain('CREATE TABLE "AIFewShotExample"');
    expect(optimizationMigration).toContain('CREATE TABLE "AIPromptRelease"');
    expect(optimizationMigration).toContain('CREATE UNIQUE INDEX "AIPromptRelease_promptKey_version_key"');
    expect(qualityDefaultsMigration).toContain('"aiQualityConsentVersion" = \'2026-07-19\'');
    expect(qualityDefaultsMigration).toContain('CREATE UNIQUE INDEX "AIOptimizationCandidate_dedupeKey_key"');
    expect(releaseValidationMigration).toContain('ADD COLUMN "validationId" TEXT');
    expect(releaseValidationMigration).toContain('REFERENCES "AIOptimizationValidation"("id")');
    expect(reviewReasonMigration).toContain('ADD COLUMN "reviewReason" TEXT');
  });
});
