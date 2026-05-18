import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("database runtime docs", () => {
  it("documents deployment-safe database operations", () => {
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    const runbook = readFileSync(resolve(process.cwd(), "docs/operator-runbook.md"), "utf8");

    expect(readme).toContain("npx prisma migrate deploy");

    expect(runbook).toContain("pooler");
    expect(runbook).toContain("pgvector");
    expect(runbook).toContain("backup");
  });
});
