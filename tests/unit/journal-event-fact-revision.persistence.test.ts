import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("journal event fact revision persistence", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260722180000_add_journal_event_fact_revisions/migration.sql"
    ),
    "utf8"
  );

  it("adds immutable revision batches, targets and result-fact lineage", () => {
    expect(schema).toContain("model JournalEventFactRevision {");
    expect(schema).toContain("model JournalEventFactRevisionTarget {");
    expect(schema).toMatch(/sourceTurnId\s+String\s+@unique/u);
    expect(schema).toMatch(/requestFingerprint\s+String/u);
    expect(schema).toMatch(/createdByRevisionId\s+String\?/u);
    expect(migration).toContain('"requestFingerprint" TEXT NOT NULL');
    expect(migration).toContain('CONSTRAINT "JournalEventFactRevision_quote_check"');
    expect(migration).toContain('"JournalEventFactRevisionTarget_dedupe_key"');
    expect(migration).toContain('ON DELETE CASCADE ON UPDATE CASCADE');
  });

  it("backfills claim state and enforces mutually exclusive terminal states", () => {
    expect(schema).toContain("enum JournalEventUnderstandingClaimStatus");
    expect(schema).toMatch(/status\s+JournalEventUnderstandingClaimStatus\s+@default\(pending\)/u);
    expect(schema).toMatch(/rejectedByRevisionId\s+String\?\s+@unique/u);
    expect(migration).toContain('SET "status" = \'confirmed\'');
    expect(migration).toContain('CONSTRAINT "JournalEventUnderstandingClaim_state_check"');
    expect(migration).toContain('"status" = \'rejected\'');
  });

  it("keeps T1-02 facts without synthetic revision backfill", () => {
    expect(migration).not.toMatch(
      /UPDATE\s+"JournalEventFact"[\s\S]*"createdByRevisionId"/u
    );
    expect(migration).toContain(
      'FOREIGN KEY ("createdByRevisionId") REFERENCES "JournalEventFactRevision"("id") ON DELETE CASCADE'
    );
  });
});
