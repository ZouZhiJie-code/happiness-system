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

describe("journal daily entry persistence", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  );
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260722233000_add_journal_daily_entries/migration.sql"
    ),
    "utf8"
  );
  const recordCardUpgrade = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260810180000_add_journal_daily_generation_system/migration.sql"
    ),
    "utf8"
  );
  const model = prismaBlock(schema, "model", "JournalDailyEntry");
  const table = migrationTableBlock(migration, "JournalDailyEntry");

  it("creates a separate event-centered daily entry with one entry per user and date", () => {
    expect(prismaBlock(schema, "enum", "JournalDailyEntryStatus")).toMatch(
      /draft\s+saved\s+modified/u
    );
    expect(model).toMatch(/userId\s+String/u);
    expect(model).toMatch(/entryDate\s+DateTime/u);
    expect(model).toMatch(/@@unique\(\[userId, entryDate\]\)/u);
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "JournalDailyEntry_userId_entryDate_key" ON "JournalDailyEntry"("userId", "entryDate")'
    );
    expect(migration).toContain(
      'CREATE INDEX "JournalDailyEntry_userId_status_entryDate_idx" ON "JournalDailyEntry"("userId", "status", "entryDate")'
    );
  });

  it("keeps paired sources and upgrades the minimum from two saved entries to one current record", () => {
    expect(model).toMatch(/sourceEntryIds\s+String\[\]\s+@default\(\[\]\)/u);
    expect(model).toMatch(/sourceEventIds\s+String\[\]\s+@default\(\[\]\)/u);
    expect(model).toMatch(/sourceSignature\s+String/u);
    expect(model).toMatch(/sourceSnapshot\s+Json/u);

    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_source_count_check" CHECK (cardinality("sourceEntryIds") >= 2)'
    );
    expect(recordCardUpgrade).toContain(
      'DROP CONSTRAINT "JournalDailyEntry_source_count_check"'
    );
    expect(recordCardUpgrade).toContain(
      'CHECK (cardinality("sourceEntryIds") >= 1)'
    );
    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_source_pair_count_check" CHECK (cardinality("sourceEntryIds") = cardinality("sourceEventIds"))'
    );
    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_source_entry_ids_nonnull_check" CHECK (array_position("sourceEntryIds", NULL) IS NULL)'
    );
    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_source_event_ids_nonnull_check" CHECK (array_position("sourceEventIds", NULL) IS NULL)'
    );
    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_source_entry_ids_nonempty_check" CHECK (array_position("sourceEntryIds", \'\') IS NULL)'
    );
    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_source_event_ids_nonempty_check" CHECK (array_position("sourceEventIds", \'\') IS NULL)'
    );
    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_source_signature_check" CHECK (length(btrim("sourceSignature")) > 0)'
    );
    expect(table).toContain('"sourceSnapshot" JSONB NOT NULL');
  });

  it("makes draft, saved, and modified revisions mutually coherent without null bypasses", () => {
    expect(table).toContain(
      'CONSTRAINT "JournalDailyEntry_content_revision_check" CHECK ("contentRevision" >= 1)'
    );
    expect(table).toMatch(
      /"status" = 'draft'[\s\S]*"savedRevision" IS NULL[\s\S]*"savedAt" IS NULL/u
    );
    expect(table).toMatch(
      /"status" = 'saved'[\s\S]*"savedRevision" IS NOT NULL[\s\S]*"savedRevision" = "contentRevision"[\s\S]*"savedAt" IS NOT NULL/u
    );
    expect(table).toMatch(
      /"status" = 'modified'[\s\S]*"savedRevision" IS NOT NULL[\s\S]*"savedRevision" >= 1[\s\S]*"savedRevision" < "contentRevision"[\s\S]*"savedAt" IS NOT NULL[\s\S]*"editedAt" IS NOT NULL/u
    );
  });

  it("keeps ownership recoverable through user cascade", () => {
    expect(model).toMatch(
      /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/u
    );
    expect(migration).toMatch(
      /CONSTRAINT "JournalDailyEntry_userId_fkey"[\s\S]*REFERENCES "User"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/u
    );
    expect(prismaBlock(schema, "model", "User")).toMatch(
      /journalDailyEntries\s+JournalDailyEntry\[\]/u
    );
  });

  it("leaves the legacy daily journal table and its data path untouched", () => {
    expect(prismaBlock(schema, "model", "DailyJournalEntry")).not.toMatch(
      /journalEvent|JournalDailyEntry/u
    );
    expect(migration).not.toMatch(/\bDailyJournalEntry\b/u);
    expect(migration).not.toMatch(
      /^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/imu
    );

    const alteredTables = Array.from(
      migration.matchAll(/ALTER TABLE "([^"]+)"/gu),
      (match) => match[1]
    );
    expect(new Set(alteredTables)).toEqual(new Set(["JournalDailyEntry"]));
  });
});
