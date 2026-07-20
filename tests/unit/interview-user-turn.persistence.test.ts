import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("InterviewUserTurn persistence contract", () => {
  it("declares the UserTurn model, message relation, and idempotency constraint", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("model InterviewUserTurn");
    expect(schema).toContain("clientTurnId");
    expect(schema).toContain("baseMessageSequence");
    expect(schema).toContain("attemptCount");
    expect(schema).toContain("@@unique([sessionId, clientTurnId])");
    expect(schema).toContain("userTurnId");
    expect(schema).toContain("userTurn          InterviewUserTurn?");
  });

  it("creates a single-unresolved-turn guard and keeps legacy messages nullable", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260720120000_add_interview_user_turn/migration.sql"
      ),
      "utf8"
    );

    expect(migration).toContain(
      'CREATE UNIQUE INDEX "InterviewUserTurn_sessionId_clientTurnId_key"'
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "InterviewUserTurn_one_unresolved_per_session_key"'
    );
    expect(migration).toContain(
      "WHERE \"status\" IN ('processing', 'failed', 'canceled')"
    );
    expect(migration).toContain(
      'ALTER TABLE "InterviewMessage" ADD COLUMN "userTurnId" TEXT'
    );
  });
});
