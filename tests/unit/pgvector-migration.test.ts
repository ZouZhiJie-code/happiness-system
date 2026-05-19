import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("pgvector migration", () => {
  it("documents a deployable 2048-dimension pgvector contract", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260518113000_harden_pgvector_setup/migration.sql"),
      "utf8"
    );

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector;');
    expect(sql).toContain('ALTER TABLE "MemoryFact" ADD COLUMN IF NOT EXISTS "embedding" vector(2048);');
    expect(sql).toContain("2048 dimensions");
    expect(sql).not.toContain("USING ivfflat");
  });
});
