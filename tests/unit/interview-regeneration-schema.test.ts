import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(root, "prisma/migrations/20260720223000_add_interview_response_regeneration/migration.sql"),
  "utf8"
);

describe("访谈重新生成数据契约", () => {
  it("保留根会话、活动分支、检查点和回复版本", () => {
    expect(schema).toMatch(/conversationSchemaVersion\s+Int/u);
    expect(schema).toContain("activeBranchSessionId");
    expect(schema).toContain("model InterviewBranchCheckpoint");
    expect(schema).toContain("model AIResponseRegeneration");
    expect(schema).toContain("@@unique([responseGroupId, responseVersion])");
  });

  it("迁移通过外键、版本唯一键和范围约束保护分支数据", () => {
    expect(migration).toContain("InterviewMessage_responseGroupId_responseVersion_key");
    expect(migration).toContain("InterviewSession_parentSessionId_fkey");
    expect(migration).toContain("AIResponseRegeneration_generatedTraceId_fkey");
    expect(migration).toContain("InterviewMessage_responseVersion_check");
    expect(migration).toContain("AIResponseRegeneration_latencyMs_check");
  });
});
