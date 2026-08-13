import fs from "node:fs";
import path from "node:path";
import { interviewUserTurnSchema } from "@/features/interview/schema/interview.schema";

describe("interview intent persistence contract", () => {
  it("adds nullable intent fields to InterviewUserTurn", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("intentAssessment");
    expect(schema).toContain("intentClassifierVersion");
    expect(schema).toContain("intentDecision");
    expect(schema).toContain("intentAssessedAt");
  });

  it("ships a backward-compatible nullable migration", () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260720210000_add_interview_intent_assessment/migration.sql"
      ),
      "utf8"
    );

    expect(migration).toContain('ADD COLUMN "intentAssessment" JSONB');
    expect(migration).toContain('ADD COLUMN "intentClassifierVersion" TEXT');
    expect(migration).toContain('ADD COLUMN "intentDecision" JSONB');
    expect(migration).toContain('ADD COLUMN "intentAssessedAt" TIMESTAMP(3)');
    expect(migration).not.toContain("NOT NULL");
  });

  it("keeps persisted intent details out of the public SSE turn contract", () => {
    const parsed = interviewUserTurnSchema.parse({
      id: "turn-1",
      clientTurnId: "client-1",
      sessionId: "session-1",
      activeEventId: "event-1",
      action: "reply",
      rawText: "原话",
      inputMode: "text",
      baseMessageSequence: 0,
      status: "processing",
      attemptCount: 1,
      errorCode: null,
      intentAssessment: { version: "interview-intent-v1" },
      intentDecision: { version: "interview-turn-policy-v1" },
      intentClassifierVersion: "interview-intent-v1",
      intentAssessedAt: "2026-07-20T00:00:00.000Z",
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
      completedAt: null
    });

    expect(parsed).not.toHaveProperty("intentAssessment");
    expect(parsed).not.toHaveProperty("intentDecision");
    expect(parsed).not.toHaveProperty("intentClassifierVersion");
    expect(parsed).not.toHaveProperty("intentAssessedAt");
  });
});
