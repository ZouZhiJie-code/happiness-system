import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("pgvector migration", () => {
  it("creates extension and vector indexes explicitly", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260518113000_harden_pgvector_setup/migration.sql"),
      "utf8"
    );

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector;');
    expect(sql).toContain('ALTER TABLE "MemoryFact" ADD COLUMN IF NOT EXISTS "embedding" vector(2048);');
    expect(sql).toMatch(/CREATE INDEX .*MemoryFact.*embedding/);
  });
});
