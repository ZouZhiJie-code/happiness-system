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

describe("journal event angle outcome persistence", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260722210000_add_journal_event_angle_outcomes/migration.sql"
    ),
    "utf8"
  );

  const outcomeModel = prismaBlock(schema, "model", "JournalEventAngleOutcome");
  const outcomeFactModel = prismaBlock(
    schema,
    "model",
    "JournalEventAngleOutcomeFact"
  );
  const repairModel = prismaBlock(
    schema,
    "model",
    "JournalEventAngleOutcomeRepair"
  );
  const resolutionModel = prismaBlock(
    schema,
    "model",
    "JournalEventAngleOutcomeRepairResolution"
  );
  const outcomeTable = migrationTableBlock(migration, "JournalEventAngleOutcome");
  const outcomeFactTable = migrationTableBlock(
    migration,
    "JournalEventAngleOutcomeFact"
  );
  const repairTable = migrationTableBlock(
    migration,
    "JournalEventAngleOutcomeRepair"
  );
  const resolutionTable = migrationTableBlock(
    migration,
    "JournalEventAngleOutcomeRepairResolution"
  );

  it("defines four closed enums for angles, outcomes, fact roles and repair decisions", () => {
    expect(prismaBlock(schema, "enum", "JournalEventAngle")).toMatch(
      /feeling\s+thought\s+relationship\s+action/u
    );
    expect(prismaBlock(schema, "enum", "JournalEventAngleOutcomeKind")).toMatch(
      /insight\s+honest_limit/u
    );
    expect(
      prismaBlock(schema, "enum", "JournalEventAngleOutcomeFactRole")
    ).toMatch(/support\s+context/u);
    expect(
      prismaBlock(schema, "enum", "JournalEventAngleOutcomeRepairDecision")
    ).toMatch(/replaced\s+reopened/u);
    expect(schema).not.toContain("enum JournalEventAngleOutcomeRepairStatus");

    expect(migration).toContain(
      `CREATE TYPE "JournalEventAngle" AS ENUM ('feeling', 'thought', 'relationship', 'action')`
    );
    expect(migration).toContain(
      `CREATE TYPE "JournalEventAngleOutcomeKind" AS ENUM ('insight', 'honest_limit')`
    );
    expect(migration).toContain(
      `CREATE TYPE "JournalEventAngleOutcomeFactRole" AS ENUM ('support', 'context')`
    );
    expect(migration).toContain(
      `CREATE TYPE "JournalEventAngleOutcomeRepairDecision" AS ENUM ('replaced', 'reopened')`
    );
    expect(migration).not.toContain('CREATE TYPE "JournalEventAngleOutcomeRepairStatus"');
  });

  it("creates immutable angle outcomes with reply-scoped idempotency", () => {
    for (const field of [
      "eventId",
      "branchSessionId",
      "sourceTurnId",
      "assistantMessageId",
      "generationTraceId"
    ]) {
      expect(outcomeModel).toMatch(new RegExp(`${field}\\s+String`, "u"));
    }
    expect(outcomeModel).toMatch(/angle\s+JournalEventAngle/u);
    expect(outcomeModel).toMatch(/kind\s+JournalEventAngleOutcomeKind/u);
    expect(outcomeModel).toMatch(/statement\s+String/u);
    expect(outcomeModel).toMatch(/requestFingerprint\s+String/u);
    expect(outcomeModel).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/u);
    expect(outcomeModel).toMatch(/@@unique\(\[assistantMessageId, angle\]/u);
    expect(outcomeModel).not.toMatch(/@@unique\(\[sourceTurnId, angle\]/u);

    expect(outcomeTable).toContain('"statement" TEXT NOT NULL');
    expect(outcomeTable).toContain('"requestFingerprint" TEXT NOT NULL');
    expect(outcomeTable).toContain(
      'CONSTRAINT "JournalEventAngleOutcome_statement_check" CHECK (length(btrim("statement")) > 0)'
    );
    expect(outcomeTable).toContain(
      'CONSTRAINT "JournalEventAngleOutcome_requestFingerprint_check" CHECK (length("requestFingerprint") = 64)'
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "[^"]+" ON "JournalEventAngleOutcome"\("assistantMessageId", "angle"\)/u
    );
    expect(migration).not.toMatch(
      /CREATE UNIQUE INDEX "[^"]+" ON "JournalEventAngleOutcome"\("sourceTurnId", "angle"\)/u
    );
  });

  it("creates immutable fact dependencies with one role per outcome and fact", () => {
    expect(outcomeFactModel).toMatch(/outcomeId\s+String/u);
    expect(outcomeFactModel).toMatch(/factId\s+String/u);
    expect(outcomeFactModel).toMatch(/role\s+JournalEventAngleOutcomeFactRole/u);
    expect(outcomeFactModel).toMatch(
      /@@unique\(\[outcomeId, factId\], map: "JournalEventAngleOutcomeFact_dedupe_key"\)/u
    );
    expect(outcomeFactTable).toContain('"role" "JournalEventAngleOutcomeFactRole" NOT NULL');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "JournalEventAngleOutcomeFact_dedupe_key" ON "JournalEventAngleOutcomeFact"("outcomeId", "factId")'
    );
  });

  it("separates immutable repair requirements from path-scoped resolutions", () => {
    for (const field of [
      "eventId",
      "branchSessionId",
      "factRevisionId",
      "pathAnchorMessageId",
      "priorOutcomeId"
    ]) {
      expect(repairModel).toMatch(new RegExp(`${field}\\s+String`, "u"));
    }
    expect(repairModel).toMatch(/angle\s+JournalEventAngle/u);
    expect(repairModel).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/u);
    expect(repairModel).toMatch(
      /@@unique\(\[factRevisionId, priorOutcomeId\], map: "JournalEventAngleOutcomeRepair_revision_outcome_key"\)/u
    );
    expect(repairModel).toMatch(
      /resolutions\s+JournalEventAngleOutcomeRepairResolution\[\]/u
    );
    expect(repairModel).not.toMatch(
      /\b(?:status|replacementOutcomeId|resolvedMessageId|resolutionTraceId|resolutionFingerprint|resolvedAt|updatedAt)\b/u
    );
    expect(repairTable).not.toMatch(
      /"(?:status|replacementOutcomeId|resolvedMessageId|resolutionTraceId|resolutionFingerprint|resolvedAt|updatedAt)"/u
    );

    for (const field of [
      "repairId",
      "branchSessionId",
      "resolvedMessageId",
      "resolutionTraceId"
    ]) {
      expect(resolutionModel).toMatch(new RegExp(`${field}\\s+String`, "u"));
    }
    expect(resolutionModel).toMatch(
      /decision\s+JournalEventAngleOutcomeRepairDecision/u
    );
    expect(resolutionModel).toMatch(/replacementOutcomeId\s+String\?/u);
    expect(resolutionModel).toMatch(/resolutionFingerprint\s+String/u);
    expect(resolutionModel).toMatch(/resolvedAt\s+DateTime/u);
    expect(resolutionModel).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/u);
    expect(resolutionModel).toMatch(/@@unique\(\[repairId, resolvedMessageId\]/u);

    expect(resolutionTable).toContain('"resolutionFingerprint" TEXT NOT NULL');
    expect(resolutionTable).toContain('"resolvedAt" TIMESTAMP(3) NOT NULL');
    expect(resolutionTable).toContain(
      'CONSTRAINT "JournalEventAngleOutcomeRepairResolution_resolutionFingerprint_check" CHECK (length("resolutionFingerprint") = 64)'
    );
    expect(resolutionTable).toMatch(
      /"decision" = 'replaced'[\s\S]*"replacementOutcomeId" IS NOT NULL/u
    );
    expect(resolutionTable).toMatch(
      /"decision" = 'reopened'[\s\S]*"replacementOutcomeId" IS NULL/u
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "[^"]+" ON "JournalEventAngleOutcomeRepairResolution"\("repairId", "resolvedMessageId"\)/u
    );
  });

  it("adds indexes for event, branch, dependency, source, trace and repair lookups", () => {
    for (const indexPattern of [
      /JournalEventAngleOutcome"\("eventId", "angle", "createdAt"\)/u,
      /JournalEventAngleOutcome"\("branchSessionId", "createdAt"\)/u,
      /JournalEventAngleOutcome"\("sourceTurnId"\)/u,
      /JournalEventAngleOutcome"\("generationTraceId"\)/u,
      /JournalEventAngleOutcomeFact"\("factId", "role", "createdAt"\)/u,
      /JournalEventAngleOutcomeRepair"\("eventId", "createdAt"\)/u,
      /JournalEventAngleOutcomeRepair"\("branchSessionId", "createdAt"\)/u,
      /JournalEventAngleOutcomeRepair"\("pathAnchorMessageId"\)/u,
      /JournalEventAngleOutcomeRepair"\("priorOutcomeId"\)/u,
      /JournalEventAngleOutcomeRepairResolution"\("branchSessionId", "createdAt"\)/u,
      /JournalEventAngleOutcomeRepairResolution"\("resolutionTraceId"\)/u,
      /JournalEventAngleOutcomeRepairResolution"\("replacementOutcomeId"\)/u
    ]) {
      expect(migration).toMatch(indexPattern);
    }
  });

  it("cascades owned event data through stable sources", () => {
    for (const [constraint, target] of [
      ["JournalEventAngleOutcome_eventId_fkey", "JournalEvent"],
      ["JournalEventAngleOutcome_branchSessionId_fkey", "InterviewSession"],
      ["JournalEventAngleOutcome_sourceTurnId_fkey", "InterviewUserTurn"],
      ["JournalEventAngleOutcome_assistantMessageId_fkey", "InterviewMessage"],
      ["JournalEventAngleOutcomeFact_outcomeId_fkey", "JournalEventAngleOutcome"],
      ["JournalEventAngleOutcomeFact_factId_fkey", "JournalEventFact"],
      ["JournalEventAngleOutcomeRepair_eventId_fkey", "JournalEvent"],
      ["JournalEventAngleOutcomeRepair_branchSessionId_fkey", "InterviewSession"],
      ["JournalEventAngleOutcomeRepair_factRevisionId_fkey", "JournalEventFactRevision"],
      ["JournalEventAngleOutcomeRepair_pathAnchorMessageId_fkey", "InterviewMessage"],
      ["JournalEventAngleOutcomeRepair_priorOutcomeId_fkey", "JournalEventAngleOutcome"],
      ["JournalEventAngleOutcomeRepairResolution_repairId_fkey", "JournalEventAngleOutcomeRepair"],
      ["JournalEventAngleOutcomeRepairResolution_branchSessionId_fkey", "InterviewSession"],
      ["JournalEventAngleOutcomeRepairResolution_resolvedMessageId_fkey", "InterviewMessage"],
      ["JournalEventAngleOutcomeRepairResolution_replacementOutcomeId_fkey", "JournalEventAngleOutcome"]
    ] as const) {
      expect(migration).toMatch(
        new RegExp(
          `CONSTRAINT "${constraint}"[\\s\\S]*REFERENCES "${target}"\\("id"\\) ON DELETE CASCADE ON UPDATE CASCADE`,
          "u"
        )
      );
    }

    for (const [constraint, target] of [
      ["JournalEventAngleOutcome_generationTraceId_fkey", "AIGenerationTrace"],
      ["JournalEventAngleOutcomeRepairResolution_resolutionTraceId_fkey", "AIGenerationTrace"]
    ] as const) {
      expect(migration).toMatch(
        new RegExp(
          `CONSTRAINT "${constraint}"[\\s\\S]*REFERENCES "${target}"\\("id"\\) ON DELETE SET NULL ON UPDATE CASCADE`,
          "u"
        )
      );
    }
  });

  it("deleting a resolved path reply removes its resolution while retaining repair demand", () => {
    expect(migration).toMatch(
      /CONSTRAINT "JournalEventAngleOutcomeRepairResolution_resolvedMessageId_fkey"[\s\S]*REFERENCES "InterviewMessage"\("id"\) ON DELETE CASCADE/u
    );
    expect(migration).not.toMatch(
      /ALTER TABLE "JournalEventAngleOutcomeRepair"[^;]*FOREIGN KEY \("resolvedMessageId"\)/u
    );
    expect(repairTable).not.toContain('"resolvedMessageId"');
    expect(resolutionTable).toContain('"repairId" TEXT NOT NULL');
  });

  it("exposes bidirectional relations to stable event sources and path resolutions", () => {
    expect(prismaBlock(schema, "model", "JournalEvent")).toMatch(
      /angleOutcomes\s+JournalEventAngleOutcome\[\][\s\S]*angleOutcomeRepairs\s+JournalEventAngleOutcomeRepair\[\]/u
    );
    expect(prismaBlock(schema, "model", "JournalEventFact")).toMatch(
      /angleOutcomeFacts\s+JournalEventAngleOutcomeFact\[\]/u
    );
    expect(prismaBlock(schema, "model", "JournalEventFactRevision")).toMatch(
      /angleOutcomeRepairs\s+JournalEventAngleOutcomeRepair\[\]/u
    );
    expect(prismaBlock(schema, "model", "InterviewMessage")).toMatch(
      /angleOutcomes\s+JournalEventAngleOutcome\[\][\s\S]*JournalEventAngleOutcomeRepair\[\][\s\S]*JournalEventAngleOutcomeRepairResolution\[\]/u
    );
    expect(prismaBlock(schema, "model", "AIGenerationTrace")).toMatch(
      /angleOutcomes\s+JournalEventAngleOutcome\[\][\s\S]*JournalEventAngleOutcomeRepairResolution\[\]/u
    );
    expect(prismaBlock(schema, "model", "InterviewUserTurn")).toMatch(
      /angleOutcomes\s+JournalEventAngleOutcome\[\]/u
    );
    expect(prismaBlock(schema, "model", "InterviewSession")).toMatch(
      /JournalEventAngleOutcomeRepair\[\][\s\S]*JournalEventAngleOutcomeRepairResolution\[\]/u
    );
  });

  it("keeps legacy dimension records untouched and creates no synthetic outcomes", () => {
    expect(migration).not.toMatch(
      /^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)\b/imu
    );
    expect(migration).not.toMatch(/\b(?:ADD|DROP|ALTER)\s+COLUMN\b/iu);

    const alteredTables = Array.from(
      migration.matchAll(/ALTER TABLE "([^"]+)"/gu),
      (match) => match[1]
    );
    expect(new Set(alteredTables)).toEqual(
      new Set([
        "JournalEventAngleOutcome",
        "JournalEventAngleOutcomeFact",
        "JournalEventAngleOutcomeRepair",
        "JournalEventAngleOutcomeRepairResolution"
      ])
    );
    expect(migration).not.toMatch(/dimension_legacy|InterviewEvent|JoyEntry|DailyJournalEntry/u);
  });
});
