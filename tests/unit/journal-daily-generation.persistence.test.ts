import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function prismaBlock(
  source: string,
  kind: "enum" | "model",
  name: string
) {
  const marker = `${kind} ${name} {`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf("\n}", start);
  return end < 0 ? source.slice(start) : source.slice(start, end + 2);
}

describe("journal daily generation persistence", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  );
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260723123000_add_journal_daily_entry_generations/migration.sql"
    ),
    "utf8"
  );
  const model = prismaBlock(schema, "model", "JournalDailyEntryGeneration");

  it("separates daily journal assembly from the optional self insight", () => {
    expect(
      prismaBlock(schema, "enum", "JournalDailyEntryGenerationKind")
    ).toMatch(/daily_journal\s+self_insight/u);
    expect(model).toMatch(
      /operationKind\s+JournalDailyEntryGenerationKind/u
    );
    expect(migration).toContain(
      `CREATE TYPE "JournalDailyEntryGenerationKind" AS ENUM ('daily_journal', 'self_insight')`
    );
  });

  it("freezes source identity and the starting content revision", () => {
    expect(model).toMatch(/sourceSignature\s+String/u);
    expect(model).toMatch(/sourceEntryIds\s+String\[\]\s+@default\(\[\]\)/u);
    expect(model).toMatch(/sourceEventIds\s+String\[\]\s+@default\(\[\]\)/u);
    expect(model).toMatch(/sourceSnapshot\s+Json/u);
    expect(model).toMatch(/baseContentRevision\s+Int\?/u);
    expect(migration).toContain(
      'CONSTRAINT "JournalDailyEntryGeneration_source_count_check"'
    );
    expect(migration).toContain(
      'CONSTRAINT "JournalDailyEntryGeneration_source_signature_check"'
    );
  });

  it("keeps retries idempotent and one operation active per user day", () => {
    expect(model).toMatch(
      /@@unique\(\[userId, entryDate, clientOperationId\]\)/u
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "JournalDailyEntryGeneration_one_processing_per_day"'
    );
    expect(migration).toMatch(
      /ON "JournalDailyEntryGeneration"\("userId", "entryDate"\)\s+WHERE "status" = 'processing'/u
    );
  });

  it("keeps terminal timestamps coherent and cascades with the account", () => {
    expect(migration).toContain(
      'CONSTRAINT "JournalDailyEntryGeneration_status_check"'
    );
    expect(migration).toMatch(
      /"status" = 'completed'[\s\S]*"resultEntryId" IS NOT NULL[\s\S]*"completedAt" IS NOT NULL/u
    );
    expect(migration).toMatch(
      /"status" = 'failed'[\s\S]*"failedAt" IS NOT NULL[\s\S]*"errorCode" IS NOT NULL/u
    );
    expect(migration).toMatch(
      /"status" = 'canceled'[\s\S]*"canceledAt" IS NOT NULL[\s\S]*"errorCode" IS NOT NULL/u
    );
    expect(migration).toMatch(
      /CONSTRAINT "JournalDailyEntryGeneration_userId_fkey"[\s\S]*REFERENCES "User"\("id"\)[\s\S]*ON DELETE CASCADE/u
    );
  });

  it("adds explicit AI trace artifact types for both operations", () => {
    expect(
      prismaBlock(schema, "enum", "AIGenerationArtifactType")
    ).toMatch(/daily_journal\s+daily_journal_insight/u);
    expect(migration).toContain(
      `ALTER TYPE "AIGenerationArtifactType" ADD VALUE 'daily_journal'`
    );
    expect(migration).toContain(
      `ALTER TYPE "AIGenerationArtifactType" ADD VALUE 'daily_journal_insight'`
    );
  });
});
