import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("journal event understanding persistence", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260722153000_add_journal_event_facts_and_understanding/migration.sql"
    ),
    "utf8"
  );

  it("keeps original turns and AI traces directly attached to the stable event", () => {
    expect(schema).toMatch(/model InterviewUserTurn[\s\S]*journalEventId\s+String\?/u);
    expect(schema).toMatch(/model AIGenerationTrace[\s\S]*journalEventId\s+String\?/u);
    expect(migration).toContain('session."mode" = \'event_centered\'');
    expect(migration).not.toMatch(/session\."mode"\s*=\s*'dimension_legacy'/u);
  });

  it("creates immutable fact, evidence and one-claim-per-reply structures", () => {
    expect(schema).toContain("model JournalEventFact {");
    expect(schema).toContain("model JournalEventFactEvidence {");
    expect(schema).toContain("model JournalEventUnderstandingClaim {");
    expect(schema).toMatch(/assistantMessageId\s+String\s+@unique/u);
    expect(schema).toMatch(/confirmedFactId\s+String\?\s+@unique/u);
    expect(schema).toMatch(/confirmedByTurnId\s+String\?\s+@unique/u);
    expect(migration).toContain('CONSTRAINT "JournalEventFact_statement_check"');
    expect(migration).toContain('CONSTRAINT "JournalEventUnderstandingClaim_confirmation_check"');
  });

  it("enforces idempotent evidence and account-lifecycle cascading", () => {
    expect(migration).toContain(
      '"JournalEventFactEvidence_dedupe_key"'
    );
    expect(migration).toMatch(
      /InterviewUserTurn_journalEventId_fkey[\s\S]*ON DELETE CASCADE/u
    );
    expect(migration).toMatch(
      /AIGenerationTrace_journalEventId_fkey[\s\S]*ON DELETE CASCADE/u
    );
  });
});
