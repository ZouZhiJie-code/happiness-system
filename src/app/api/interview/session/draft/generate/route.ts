import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  generateDraftRequestSchema,
  generateDraftResponseSchema
} from "@/features/interview/schema/interview.schema";
import { logger } from "@/server/lib/logger";
import { isAuthenticationRequiredError, requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import {
  DraftGenerationError,
  generateInterviewDraft
} from "@/server/services/interview/interview.service";
import { createInterviewRequestId } from "@/server/services/interview/respond-error";

export async function POST(request: Request) {
  const requestId = createInterviewRequestId();
  const body = await request.json();
  const parsed = generateDraftRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_GENERATE_DRAFT_REQUEST" }, { status: 400 });
  }

  try {
    const user = await requireCurrentUserFromRequest(request);
    const result = await generateInterviewDraft(user.id, parsed.data.sessionIds, { requestId });
    const payload = generateDraftResponseSchema.parse(result);

    return NextResponse.json(payload);
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    logger.error(
      {
        err: error,
        sessionIds: parsed.data.sessionIds,
        code: error instanceof DraftGenerationError ? error.code : undefined
      },
      "Draft generation failed."
    );

    if (error instanceof DraftGenerationError) {
      if (error.code === "SESSION_BATCH_UNSUPPORTED") {
        return NextResponse.json(
          { error: error.code, retryable: false, message: "当前只支持基于单个访谈会话生成日志。" },
          { status: 400 }
        );
      }

      if (error.code === "SESSION_NOT_FOUND") {
        return NextResponse.json(
          { error: error.code, retryable: false, message: "当前访谈会话不存在或已失效，请刷新后重试。" },
          { status: 404 }
        );
      }

      if (error.code === "DRAFT_GENERATE_NOT_READY") {
        return NextResponse.json(
          { error: error.code, retryable: false, message: "当前材料还不够生成日志，请先补充当前片段或换一个片段。" },
          { status: 409 }
        );
      }

      if (error.code === "DRAFT_GENERATE_UPSTREAM_ERROR") {
        return NextResponse.json(
          { error: error.code, retryable: true, message: "AI 暂时没能完成整理，请稍后重试。" },
          { status: 502 }
        );
      }

      if (error.code === "DRAFT_GENERATE_DB_ERROR") {
        return NextResponse.json(
          { error: error.code, retryable: true, message: "日志草稿生成后写入失败，请重试。" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: error.code, retryable: error.retryable, message: "日志生成失败，请稍后重试。" },
        { status: 500 }
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "DRAFT_GENERATE_SCHEMA_ERROR", retryable: true, message: "日志草稿格式异常，请重试。" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "DRAFT_GENERATE_UNKNOWN_ERROR", retryable: true, message: "日志生成失败，请稍后重试。" },
      { status: 500 }
    );
  }
}
