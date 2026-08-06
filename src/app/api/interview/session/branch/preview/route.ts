import { NextResponse } from "next/server";

import {
  interviewSessionSchema,
  previewInterviewBranchRequestSchema
} from "@/features/interview/schema/interview.schema";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { previewInterviewBranch } from "@/server/repositories/joy-interview.repository";
import {
  createInterviewRequestId,
  logInterviewRespondError,
  normalizeInterviewRespondError
} from "@/server/services/interview/respond-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createInterviewRequestId();
  const startedAt = performance.now();

  try {
    const [user, body] = await Promise.all([
      requireCurrentUserFromRequest(request),
      request.json()
    ]);
    const parsed = previewInterviewBranchRequestSchema.safeParse(body);

    if (!parsed.success) {
      const issue = normalizeInterviewRespondError({
        error: new Error("INVALID_RESPOND_REQUEST"),
        requestId
      });
      return NextResponse.json(
        { error: issue.code, message: issue.message, issue },
        { status: 400 }
      );
    }

    const preview = await previewInterviewBranch({
      userId: user.id,
      ...parsed.data
    });

    return NextResponse.json(
      {
        targetBranchSessionId: preview.targetBranchSessionId,
        session: interviewSessionSchema.parse(preview.session)
      },
      {
        headers: {
          "Server-Timing": `branch-preview;dur=${(performance.now() - startedAt).toFixed(1)}`
        }
      }
    );
  } catch (error) {
    const issue = normalizeInterviewRespondError({ error, requestId });
    logInterviewRespondError({
      error,
      issue,
      route: "branch/preview"
    });

    return NextResponse.json(
      { error: issue.code, message: issue.message, issue },
      {
        status:
          issue.code === "AUTHENTICATION_REQUIRED"
            ? 401
            : issue.code === "SESSION_NOT_FOUND"
              ? 404
              : issue.code === "INTERVIEW_BRANCH_OUT_OF_DATE" ||
                  issue.code === "INTERVIEW_BRANCH_LOCKED_BY_JOURNAL" ||
                  issue.code === "INTERVIEW_REGENERATION_UNAVAILABLE"
                ? 409
                : 500
      }
    );
  }
}
