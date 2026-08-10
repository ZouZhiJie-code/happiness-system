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

function migrationTableBlock(source: string, table: string) {
  const marker = `CREATE TABLE "${table}" (`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf("\n);", start);
  return end < 0 ? source.slice(start) : source.slice(start, end + 3);
}

describe("journal event entry persistence", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  );
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260722230000_add_journal_event_entries/migration.sql"
    ),
    "utf8"
  );

  const entryModel = prismaBlock(schema, "model", "JournalEventEntry");
  const generationModel = prismaBlock(
    schema,
    "model",
    "JournalEventEntryGeneration"
  );
  const entryTable = migrationTableBlock(migration, "JournalEventEntry");
  const generationTable = migrationTableBlock(
    migration,
    "JournalEventEntryGeneration"
  );

  it("defines closed entry and generation lifecycles and adds the event-journal protocol values", () => {
    expect(prismaBlock(schema, "enum", "JournalEventEntryStatus")).toMatch(
      /draft\s+saved\s+modified/u
    );
    expect(
      prismaBlock(schema, "enum", "JournalEventEntryGenerationStatus")
    ).toMatch(/processing\s+completed\s+failed\s+canceled/u);
    expect(prismaBlock(schema, "enum", "AIGenerationArtifactType")).toMatch(
      /event_journal/u
    );
    expect(prismaBlock(schema, "enum", "InterviewUserTurnAction")).toMatch(
      /generate_event_journal/u
    );

    expect(migration).toContain(
      `CREATE TYPE "JournalEventEntryStatus" AS ENUM ('draft', 'saved', 'modified')`
    );
    expect(migration).toContain(
      `CREATE TYPE "JournalEventEntryGenerationStatus" AS ENUM ('processing', 'completed', 'failed', 'canceled')`
    );
    expect(migration).toContain(
      `ALTER TYPE "AIGenerationArtifactType" ADD VALUE 'event_journal'`
    );
    expect(migration).toContain(
      `ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'generate_event_journal'`
    );
  });

  it("gives every event one stable entry identity and every request one idempotent generation", () => {
    expect(entryModel).toMatch(/id\s+String\s+@id/u);
    expect(entryModel).toMatch(/eventId\s+String\s+@unique/u);
    expect(entryModel).toMatch(/generatedByTurnId\s+String\?\s+@unique/u);
    expect(entryModel).toMatch(/currentGenerationTraceId\s+String\?\s+@unique/u);
    expect(entryModel).toMatch(/generationId\s+String\?\s+@unique/u);

    expect(generationModel).toMatch(/userTurnId\s+String\?\s+@unique/u);
    expect(generationModel).toMatch(/traceId\s+String\?\s+@unique/u);
    expect(generationModel).toMatch(/intendedEntryId\s+String\s+@unique/u);
    expect(generationModel).toMatch(
      /@@unique\(\[eventId, clientOperationId\]\)/u
    );

    for (const index of [
      `CREATE UNIQUE INDEX "JournalEventEntry_eventId_key" ON "JournalEventEntry"("eventId")`,
      `CREATE UNIQUE INDEX "JournalEventEntry_generatedByTurnId_key" ON "JournalEventEntry"("generatedByTurnId")`,
      `CREATE UNIQUE INDEX "JournalEventEntry_currentGenerationTraceId_key" ON "JournalEventEntry"("currentGenerationTraceId")`,
      `CREATE UNIQUE INDEX "JournalEventEntry_generationId_key" ON "JournalEventEntry"("generationId")`,
      `CREATE UNIQUE INDEX "JournalEventEntryGeneration_userTurnId_key" ON "JournalEventEntryGeneration"("userTurnId")`,
      `CREATE UNIQUE INDEX "JournalEventEntryGeneration_traceId_key" ON "JournalEventEntryGeneration"("traceId")`,
      `CREATE UNIQUE INDEX "JournalEventEntryGeneration_intendedEntryId_key" ON "JournalEventEntryGeneration"("intendedEntryId")`,
      `CREATE UNIQUE INDEX "JournalEventEntryGeneration_eventId_clientOperationId_key" ON "JournalEventEntryGeneration"("eventId", "clientOperationId")`
    ]) {
      expect(migration).toContain(index);
    }

    expect(migration).toContain(
      `CREATE UNIQUE INDEX "JournalEventEntryGeneration_one_processing_per_event" ON "JournalEventEntryGeneration"("eventId") WHERE "status" = 'processing'`
    );
  });

  it("freezes a non-empty source snapshot with a sha-256 fingerprint", () => {
    for (const model of [entryModel, generationModel]) {
      expect(model).toMatch(/sourceMessageIds\s+String\[\]\s+@default\(\[\]\)/u);
      expect(model).toMatch(/sourceFactIds\s+String\[\]\s+@default\(\[\]\)/u);
      expect(model).toMatch(
        /sourceAngleOutcomeIds\s+String\[\]\s+@default\(\[\]\)/u
      );
      expect(model).toMatch(/sourceFingerprint\s+String\s+@db\.Char\(64\)/u);
      expect(model).toMatch(/sourceSnapshot\s+Json/u);
    }

    for (const table of [entryTable, generationTable]) {
      expect(table).toContain(
        '"sourceMessageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]'
      );
      expect(table).toContain(
        '"sourceFactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]'
      );
      expect(table).toContain(
        '"sourceAngleOutcomeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]'
      );
      expect(table).toContain('"sourceFingerprint" CHAR(64) NOT NULL');
      expect(table).toContain('"sourceSnapshot" JSONB NOT NULL');
      expect(table).toMatch(
        /CHECK \(cardinality\("sourceMessageIds"\) > 0\)/u
      );
      expect(table).toMatch(/CHECK \(cardinality\("sourceFactIds"\) > 0\)/u);
      expect(table).toMatch(
        /CHECK \(length\("sourceFingerprint"\) = 64\)/u
      );
    }
  });

  it("enforces coherent draft, saved, and modified entry states", () => {
    expect(entryTable).toContain(
      'CONSTRAINT "JournalEventEntry_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 16)'
    );
    expect(entryTable).toContain(
      'CONSTRAINT "JournalEventEntry_content_check" CHECK (length(btrim("content")) > 0)'
    );
    expect(entryTable).toContain(
      'CONSTRAINT "JournalEventEntry_contentRevision_check" CHECK ("contentRevision" >= 1)'
    );
    expect(entryTable).toMatch(
      /"status" = 'draft'[\s\S]*"savedRevision" IS NULL[\s\S]*"savedAt" IS NULL/u
    );
    expect(entryTable).toMatch(
      /"status" = 'saved'[\s\S]*"savedRevision" IS NOT NULL[\s\S]*"savedRevision" = "contentRevision"[\s\S]*"savedAt" IS NOT NULL/u
    );
    expect(entryTable).toMatch(
      /"status" = 'modified'[\s\S]*"savedRevision" IS NOT NULL[\s\S]*"savedRevision" >= 1[\s\S]*"savedRevision" < "contentRevision"[\s\S]*"savedAt" IS NOT NULL[\s\S]*"editedAt" IS NOT NULL/u
    );
  });

  it("enforces mutually exclusive processing, completed, failed, and canceled generation states", () => {
    expect(generationTable).toContain(
      'CONSTRAINT "JournalEventEntryGeneration_attemptCount_check" CHECK ("attemptCount" >= 1)'
    );
    expect(generationTable).toContain(
      'CONSTRAINT "JournalEventEntryGeneration_baseMessageSequence_check" CHECK ("baseMessageSequence" >= 0)'
    );
    expect(generationTable).toMatch(
      /"status" = 'processing'[\s\S]*"completedAt" IS NULL[\s\S]*"failedAt" IS NULL[\s\S]*"canceledAt" IS NULL[\s\S]*"errorCode" IS NULL/u
    );
    expect(generationTable).toMatch(
      /"status" = 'completed'[\s\S]*"completedAt" IS NOT NULL[\s\S]*"failedAt" IS NULL[\s\S]*"canceledAt" IS NULL[\s\S]*"errorCode" IS NULL/u
    );
    expect(generationTable).toMatch(
      /"status" = 'failed'[\s\S]*"completedAt" IS NULL[\s\S]*"failedAt" IS NOT NULL[\s\S]*"canceledAt" IS NULL[\s\S]*"errorCode" IS NOT NULL[\s\S]*length\(btrim\("errorCode"\)\) > 0/u
    );
    expect(generationTable).toMatch(
      /"status" = 'canceled'[\s\S]*"completedAt" IS NULL[\s\S]*"failedAt" IS NULL[\s\S]*"canceledAt" IS NOT NULL[\s\S]*"errorCode" IS NOT NULL[\s\S]*length\(btrim\("errorCode"\)\) > 0/u
    );
  });

  it("cascades event-owned records and preserves audit links when supporting records are removed", () => {
    for (const constraint of [
      "JournalEventEntry_eventId_fkey",
      "JournalEventEntryGeneration_eventId_fkey"
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `CONSTRAINT "${constraint}"[\\s\\S]*REFERENCES "JournalEvent"\\("id"\\) ON DELETE CASCADE ON UPDATE CASCADE`,
          "u"
        )
      );
    }

    for (const [constraint, target] of [
      ["JournalEventEntry_sourceBranchSessionId_fkey", "InterviewSession"],
      ["JournalEventEntry_generatedByTurnId_fkey", "InterviewUserTurn"],
      ["JournalEventEntry_currentGenerationTraceId_fkey", "AIGenerationTrace"],
      ["JournalEventEntry_generationId_fkey", "JournalEventEntryGeneration"],
      ["JournalEventEntryGeneration_branchSessionId_fkey", "InterviewSession"],
      ["JournalEventEntryGeneration_userTurnId_fkey", "InterviewUserTurn"],
      ["JournalEventEntryGeneration_traceId_fkey", "AIGenerationTrace"]
    ] as const) {
      expect(migration).toMatch(
        new RegExp(
          `CONSTRAINT "${constraint}"[\\s\\S]*REFERENCES "${target}"\\("id"\\) ON DELETE SET NULL ON UPDATE CASCADE`,
          "u"
        )
      );
    }
  });

  it("keeps legacy dimension entries and daily journals on their existing storage path", () => {
    expect(prismaBlock(schema, "model", "JoyEntry")).not.toMatch(
      /journalEvent|JournalEvent/u
    );
    expect(prismaBlock(schema, "model", "DailyJournalEntry")).not.toMatch(
      /journalEvent|JournalEvent/u
    );
    expect(migration).not.toMatch(
      /^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/imu
    );
    expect(migration).not.toMatch(/\b(?:JoyEntry|DailyJournalEntry)\b/u);

    const alteredTables = Array.from(
      migration.matchAll(/ALTER TABLE "([^"]+)"/gu),
      (match) => match[1]
    );
    expect(new Set(alteredTables)).toEqual(
      new Set(["JournalEventEntry", "JournalEventEntryGeneration"])
    );
  });
});
