import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function prismaBlock(source: string, kind: "enum" | "model", name: string) {
  const marker = `${kind} ${name} {`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf("\n}", start);
  return end < 0 ? source.slice(start) : source.slice(start, end + 2);
}

describe("record-card daily journal generation persistence", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260810180000_add_journal_daily_generation_system/migration.sql"
    ),
    "utf8"
  );

  it("allows a single record and stores paragraph-level source references", () => {
    const entry = prismaBlock(schema, "model", "JournalDailyEntry");
    expect(entry).toMatch(/paragraphs\s+Json/u);
    expect(entry).toMatch(/currentGenerationTraceId\s+String\?\s+@unique/u);
    expect(entry).toMatch(/lastGenerationErrorCode\s+String\?/u);
    expect(migration).toContain('DROP CONSTRAINT "JournalDailyEntry_source_count_check"');
    expect(migration).toContain('CHECK (cardinality("sourceEntryIds") >= 1)');
  });

  it("stores the record card's source-grounded occurrence label", () => {
    expect(prismaBlock(schema, "model", "JournalEventEntry")).toMatch(
      /occurredAtText\s+String\?\s+@db\.VarChar\(32\)/u
    );
    expect(migration).toContain(
      'ALTER TABLE "JournalEventEntry"\n  ADD COLUMN "occurredAtText" VARCHAR(32)'
    );
  });

  it("persists the user's 帮我记 or 陪我聊 entry choice on the interview root", () => {
    expect(prismaBlock(schema, "enum", "InterviewRecordMode")).toMatch(
      /capture\s+chat/u
    );
    expect(prismaBlock(schema, "model", "InterviewSession")).toMatch(
      /recordMode\s+InterviewRecordMode\?/u
    );
    expect(migration).toContain(
      'ADD COLUMN "recordMode" "InterviewRecordMode"'
    );
  });

  it("keeps generated, updated, and user-saved versions immutable", () => {
    const revision = prismaBlock(schema, "model", "JournalDailyEntryRevision");
    expect(prismaBlock(schema, "enum", "JournalDailyEntryRevisionKind")).toMatch(
      /generated\s+updated\s+user_saved/u
    );
    expect(revision).toMatch(/contentRevision\s+Int/u);
    expect(revision).toMatch(/sourceSnapshot\s+Json/u);
    expect(revision).toMatch(/@@unique\(\[entryId, contentRevision, kind\]\)/u);
    expect(migration).toContain('CREATE TABLE "JournalDailyEntryRevision"');
    expect(migration).toContain('FROM "JournalDailyEntry"');
    expect(migration).toContain("WHERE \"status\" IN ('saved', 'draft')");
  });

  it("persists idempotent generation operations and optimistic input versions", () => {
    const generation = prismaBlock(schema, "model", "JournalDailyEntryGeneration");
    expect(generation).toMatch(/clientOperationId\s+String/u);
    expect(generation).toMatch(/expectedSourceSignature\s+String/u);
    expect(generation).toMatch(/expectedContentRevision\s+Int\?/u);
    expect(generation).toMatch(
      /@@unique\(\[userId, entryDate, clientOperationId\]\)/u
    );
    expect(migration).toContain('CREATE TABLE "JournalDailyEntryGeneration"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "JournalDailyEntryGeneration_userId_entryDate_clientOperationId_key"'
    );
  });

  it("leaves legacy five-dimensional journal storage intact", () => {
    expect(prismaBlock(schema, "model", "DailyJournalEntry")).not.toMatch(
      /JournalDailyEntryRevision|JournalDailyEntryGeneration/u
    );
    expect(migration).not.toMatch(/ALTER TABLE "DailyJournalEntry"/u);
    expect(migration).not.toMatch(/DELETE\s+FROM/u);
  });
});
