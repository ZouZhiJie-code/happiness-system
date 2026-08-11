import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("interview record mode persistence", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260811120000_add_interview_record_mode/migration.sql"
    ),
    "utf8"
  );

  it("以显式 capture/chat enum 持久化，并为历史会话保留 chat 回读", () => {
    expect(schema).toMatch(/enum InterviewRecordMode\s*\{\s*capture\s+chat\s*\}/u);
    expect(schema).toMatch(
      /recordMode\s+InterviewRecordMode\s+@default\(chat\)/u
    );
    expect(schema).toContain("@@index([mode, recordMode, userId, entryDate, status])");

    expect(migration).toContain(
      'CREATE TYPE "InterviewRecordMode" AS ENUM (\'capture\', \'chat\')'
    );
    expect(migration).toContain(
      'ADD COLUMN "recordMode" "InterviewRecordMode" NOT NULL DEFAULT \'chat\''
    );
  });

  it("同日允许 capture/chat 并存，同时限制每个模式只有一个活动根", () => {
    expect(migration).toContain(
      'DROP INDEX "InterviewSession_event_centered_active_root_key"'
    );
    expect(migration).toContain(
      'ON "InterviewSession"("userId", "entryDate", "recordMode")'
    );
    expect(migration).toContain('WHERE "mode" = \'event_centered\'');
    expect(migration).toContain('AND "parentSessionId" IS NULL');
    expect(migration).toContain('AND "status" = \'active\'');
  });

  it("帮我记日志保持零推导事实，历史和陪聊日志继续要求事实来源", () => {
    expect(migration).toContain(
      'DROP CONSTRAINT "JournalEventEntry_sourceFacts_check"'
    );
    expect(migration).toContain(
      '"sourceSnapshot"->>\'recordMode\' = \'capture\''
    );
    expect(migration).toContain('cardinality("sourceFactIds") = 0');
    expect(migration).toContain(
      'COALESCE("sourceSnapshot"->>\'recordMode\', \'chat\') <> \'capture\''
    );
    expect(migration).toContain('cardinality("sourceFactIds") > 0');
  });
});
