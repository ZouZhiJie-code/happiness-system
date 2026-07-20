import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import {
  buildInterviewIssue,
  type InterviewIssue,
  type InterviewIssueCode
} from "@/features/interview/interview-issue";
import { logger } from "@/server/lib/logger";

interface NormalizeInterviewRespondErrorInput {
  error: unknown;
  requestId: string;
  fallbackCode?: InterviewIssueCode;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function isPrismaWriteError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientInitializationError
  );
}

export function createInterviewRequestId() {
  return `ir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeInterviewRespondError({
  error,
  requestId,
  fallbackCode = "INTERVIEW_RESPOND_FAILED"
}: NormalizeInterviewRespondErrorInput): InterviewIssue {
  if (error instanceof ZodError) {
    return buildInterviewIssue("INTERVIEW_RESPONSE_SCHEMA_ERROR", { requestId });
  }

  const errorMessage = getErrorMessage(error);

  if (errorMessage === "AUTHENTICATION_REQUIRED") {
    return buildInterviewIssue("AUTHENTICATION_REQUIRED", { requestId });
  }

  if (errorMessage === "INVALID_JSON") {
    return buildInterviewIssue("INVALID_RESPOND_REQUEST", { requestId });
  }

  if (errorMessage === "INVALID_RESPOND_REQUEST") {
    return buildInterviewIssue("INVALID_RESPOND_REQUEST", { requestId });
  }

  if (errorMessage === "MESSAGE_TOO_LONG") {
    return buildInterviewIssue("MESSAGE_TOO_LONG", { requestId });
  }

  if (errorMessage === "SESSION_NOT_FOUND") {
    return buildInterviewIssue("SESSION_NOT_FOUND", { requestId });
  }

  if (errorMessage === "SESSION_CONTINUE_UNAVAILABLE" || errorMessage === "SESSION_NEXT_EVENT_UNAVAILABLE") {
    return buildInterviewIssue("SESSION_CHOICE_UNAVAILABLE", { requestId });
  }

  if (errorMessage === "SESSION_EVENT_NOT_FOUND") {
    return buildInterviewIssue("SESSION_EVENT_NOT_FOUND", { requestId });
  }

  if (
    errorMessage === "INTERVIEW_TURN_IN_PROGRESS" ||
    errorMessage === "INTERVIEW_TURN_OUT_OF_DATE" ||
    errorMessage === "INTERVIEW_TURN_NOT_FOUND" ||
    errorMessage === "INTERVIEW_TURN_RETRY_REQUIRED"
  ) {
    return buildInterviewIssue(errorMessage, { requestId });
  }

  if (errorMessage === "INTERVIEW_ACTION_UNSUPPORTED") {
    return buildInterviewIssue("INTERVIEW_ACTION_UNSUPPORTED", { requestId });
  }

  if (errorMessage === "ASSISTANT_ACTION_MISSING") {
    return buildInterviewIssue("ASSISTANT_ACTION_MISSING", { requestId });
  }

  if (isPrismaWriteError(error)) {
    return buildInterviewIssue("INTERVIEW_DB_WRITE_FAILED", { requestId });
  }

  return buildInterviewIssue(fallbackCode, { requestId });
}

export function logInterviewRespondError(input: {
  error: unknown;
  issue: InterviewIssue;
  route: "respond" | "respond/stream";
  sessionId?: string | null;
}) {
  logger.error(
    {
      err: input.error,
      issue: input.issue,
      route: input.route,
      sessionId: input.sessionId
    },
    "Interview response failed."
  );
}
