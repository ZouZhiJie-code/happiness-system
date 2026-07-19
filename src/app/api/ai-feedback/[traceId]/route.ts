import { NextResponse } from "next/server";

import { feedbackSubmissionSchema } from "@/features/ai-feedback/feedback-config";
import {
  AIFeedbackError,
  getAIResponseFeedback,
  revokeAIResponseFeedbackForUser,
  submitAIResponseFeedback
} from "@/server/services/ai-quality/ai-feedback.service";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

function errorResponse(error: unknown) {
  if (isAuthenticationRequiredError(error)) {
    return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }
  if (error instanceof AIFeedbackError) {
    const status = error.code === "TRACE_NOT_FOUND"
      ? 404
      : error.code === "CONSENT_REQUIRED" || error.code === "AI_QUALITY_PARTICIPATION_REQUIRED"
        ? 409
        : 400;
    return NextResponse.json({ error: error.code }, { status });
  }
  return NextResponse.json({ error: "AI_FEEDBACK_FAILED" }, { status: 500 });
}

export async function GET(request: Request, context: { params: Promise<{ traceId: string }> }) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { traceId } = await context.params;
    return NextResponse.json(await getAIResponseFeedback(traceId, user.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ traceId: string }> }) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const parsed = feedbackSubmissionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_FEEDBACK_REQUEST" }, { status: 400 });
    const { traceId } = await context.params;
    return NextResponse.json(
      await submitAIResponseFeedback({ traceId, userId: user.id, ...parsed.data })
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ traceId: string }> }) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const { traceId } = await context.params;
    return NextResponse.json(await revokeAIResponseFeedbackForUser(traceId, user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
