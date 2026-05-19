import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("daily happiness score constraints", () => {
  it("adds db-level 1-10 checks for every score column", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260518120000_add_daily_happiness_score_check_constraints/migration.sql"),
      "utf8"
    );

    expect(sql).toContain('"meaningScore" >= 1');
    expect(sql).toContain('"livingConditionScore" <= 10');
  });
});
