import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("database runtime docs", () => {
  it("documents deployment-safe database operations", () => {
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    const runbook = readFileSync(resolve(process.cwd(), "docs/operator-runbook.md"), "utf8");

    expect(readme).toContain("npx prisma migrate deploy");
    expect(readme).toContain("AI_RUNTIME_CONFIG_SECRET");
    expect(readme).toContain("/settings/ai-runtime");
    expect(readme).toContain("如果数据库配置不可用，系统会改用环境变量配置");

    expect(runbook).toContain("pooler");
    expect(runbook).toContain("pgvector");
    expect(runbook).toContain("backup");
    expect(runbook).toContain("AI_RUNTIME_CONFIG_SECRET");
    expect(runbook).toContain("openssl rand -base64 32");
    expect(runbook).toContain("ai.chat.source");
    expect(runbook).toContain("回滚不会原地修改历史记录");
  });
});
