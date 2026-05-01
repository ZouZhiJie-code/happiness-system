import { Prisma } from "@prisma/client";
import { z } from "zod";

import { normalizeInterviewRespondError } from "@/server/services/interview/respond-error";

describe("interview respond error normalization", () => {
  it("maps known session and flow errors to actionable issues", () => {
    expect(
      normalizeInterviewRespondError({
        error: new Error("SESSION_NOT_FOUND"),
        requestId: "request-1"
      })
    ).toMatchObject({
      code: "SESSION_NOT_FOUND",
      action: "restart_session",
      requestId: "request-1"
    });

    expect(
      normalizeInterviewRespondError({
        error: new Error("SESSION_NEXT_EVENT_UNAVAILABLE"),
        requestId: "request-2"
      })
    ).toMatchObject({
      code: "SESSION_CHOICE_UNAVAILABLE",
      action: "refresh"
    });
  });

  it("maps validation, schema, and write failures without exposing raw errors", () => {
    expect(
      normalizeInterviewRespondError({
        error: new Error("MESSAGE_TOO_LONG"),
        requestId: "request-3"
      })
    ).toMatchObject({
      code: "MESSAGE_TOO_LONG",
      action: "shorten_input"
    });

    expect(
      normalizeInterviewRespondError({
        error: new z.ZodError([]),
        requestId: "request-4"
      })
    ).toMatchObject({
      code: "INTERVIEW_RESPONSE_SCHEMA_ERROR",
      action: "refresh"
    });

    expect(
      normalizeInterviewRespondError({
        error: new Prisma.PrismaClientKnownRequestError("write failed", {
          code: "P2002",
          clientVersion: "test"
        }),
        requestId: "request-5"
      })
    ).toMatchObject({
      code: "INTERVIEW_DB_WRITE_FAILED",
      action: "retry"
    });
  });
});
