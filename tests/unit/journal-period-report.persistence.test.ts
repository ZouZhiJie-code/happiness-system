import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function block(source: string, kind: "enum" | "model", name: string) {
  const start = source.indexOf(`${kind} ${name} {`);
  const end = source.indexOf("\n}", start);
  return start < 0 || end < 0 ? "" : source.slice(start, end + 2);
}

describe("journal period report persistence", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260811100000_add_journal_period_reports/migration.sql"),
    "utf8"
  );

  it("keeps weekly and monthly reports independent from the existing daily journal table", () => {
    expect(block(schema, "enum", "JournalPeriodKind")).toMatch(/week\s+month/u);
    const report = block(schema, "model", "JournalPeriodReport");
    expect(report).toMatch(/periodKind\s+JournalPeriodKind/u);
    expect(report).toMatch(/periodStart\s+DateTime/u);
    expect(report).toMatch(/periodEnd\s+DateTime/u);
    expect(report).toMatch(/@@unique\(\[userId, periodKind, periodStart\]\)/u);
    expect(report).toMatch(/sourceSignature\s+String/u);
    expect(report).toMatch(/contentRevision\s+Int/u);
    expect(block(schema, "model", "DailyJournalEntry")).not.toMatch(/JournalPeriodReport/u);
  });

  it("persists report revisions and idempotent generation operations", () => {
    expect(block(schema, "model", "JournalPeriodReportRevision")).toMatch(
      /@@unique\(\[reportId, contentRevision, kind\]\)/u
    );
    expect(block(schema, "model", "JournalPeriodReportGeneration")).toMatch(
      /@@unique\(\[userId, periodKind, periodStart, clientOperationId\]\)/u
    );
    expect(migration).toContain('CREATE TABLE "JournalPeriodReport"');
    expect(migration).toContain('CREATE TABLE "JournalPeriodReportRevision"');
    expect(migration).toContain('CREATE TABLE "JournalPeriodReportGeneration"');
    expect(migration).toContain('"JournalPeriodReportGeneration_resultRevisionId_key"');
  });

  it("protects non-empty sources and saved-version coherence in the database", () => {
    expect(migration).toContain('CHECK (cardinality("sourceIds") >= 1)');
    expect(migration).toContain('CHECK (array_position("sourceIds", NULL) IS NULL)');
    expect(migration).toContain('CHECK (array_position("sourceIds", \'\') IS NULL)');
    expect(migration).toMatch(
      /"status" = 'saved'[\s\S]*"savedRevision" = "contentRevision"[\s\S]*"savedAt" IS NOT NULL/u
    );
    expect(migration).toMatch(
      /"status" = 'modified'[\s\S]*"savedRevision" < "contentRevision"[\s\S]*"editedAt" IS NOT NULL/u
    );
  });
});
