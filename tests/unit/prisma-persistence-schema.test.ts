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
});
