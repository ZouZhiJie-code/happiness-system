import { NextResponse } from "next/server";

import {
  requireGi088EvaluationRequest,
  requireGi088ModelCallAuthorization,
  Gi088AccessError
} from "./access";
import {
  GI088_EVALUATION_MODE,
  createGi088ExecutionFingerprint
} from "./candidate";
import { createGi088PrismaStore } from "./prisma-store";
import { Gi088EvaluationError, Gi088EvaluationService } from "./service";
import { isAuthenticationRequiredError } from "@/server/services/auth/current-user.service";

function errorMessage(code: string) {
  const messages: Record<string, string> = {
    AUTHENTICATION_REQUIRED: "请先登录产品负责人账号。",
    GI088_EVALUATOR_FORBIDDEN: "当前账号不在 GI-088 评测访问名单中。",
    GI088_EVALUATION_NOT_AVAILABLE: "GI-088 评测工作台当前不可用。",
    GI088_EVALUATION_DATABASE_URL_MISSING: "GI-088 独立评测存储尚未配置。",
    GI088_EVALUATION_DATABASE_SCHEMA_MISMATCH: "GI-088 评测存储未使用批准的独立 schema。",
    GI088_EVALUATION_DATABASE_IDENTITY_MISSING: "GI-088 评测数据库身份尚未配置完整。",
    GI088_EVALUATION_DATABASE_IDENTITY_MISMATCH: "GI-088 评测存储与批准的 Preview 数据库身份不一致。",
    GI088_PREVIEW_APP_DATABASE_IDENTITY_MISMATCH: "Preview 登录库与批准的 GI-088 专属数据库身份不一致。",
    GI088_PREVIEW_APP_DATABASE_SCHEMA_MISMATCH: "Preview 登录与评测数据未使用批准的隔离 schema。",
    GI088_MODEL_CALL_AUTHORIZATION_REQUIRED: "当前候选指纹尚未获得模型调用授权。",
    GI088_ARK_API_KEY_MISSING: "当前 Preview 尚未配置 GI-088 使用的火山 Ark 凭证。",
    GI088_ARK_BASE_URL_MISMATCH: "当前 Preview 的火山 Ark 地址与候选冻结配置不一致。",
    GI088_HIGH_ONLY_EVALUATION: "当前批次只运行 Thinking high 轨迹。",
    GI088_COMPARISON_NOT_REQUIRED: "当前批次只运行 Thinking high，无需分支对照。",
    GI088_QUESTION_REVIEWS_REQUIRED: "请先完成 Trace 中全部可见提问的逐轮分类，再结束当前轨迹。",
    GI088_QUESTION_REVIEW_UNAVAILABLE: "当前提问记录已经进入只读状态，无法继续修改分类。",
    GI088_TECHNICAL_RETRY_LIMIT_REACHED: "当前这段原话已经用完恢复机会，系统已经停止继续调用。",
    GI088_MANUAL_AFTER_AUTO_RECOVERY_UNAVAILABLE: "当前这段原话暂时无法再次生成，请读取最新状态后继续。",
    GI088_SMOKE_AUTHORIZATION_ID_REQUIRED: "本次技术冒烟尚未获得独立授权编号。",
    GI088_CONCURRENT_UPDATE: "当前评测试次刚刚发生更新，请刷新后继续。"
  };
  return messages[code] ?? "GI-088 评测请求未能完成。";
}

function gi088ErrorPayload(error: unknown) {
  let code = "GI088_INTERNAL_ERROR";
  let status = 500;
  let retryable = false;
  if (error instanceof Gi088EvaluationError) {
    ({ code, status, retryable } = error);
  } else if (error instanceof Gi088AccessError) {
    ({ code, status } = error);
  } else if (isAuthenticationRequiredError(error)) {
    code = "AUTHENTICATION_REQUIRED";
    status = 401;
  }
  return {
    code,
    status,
    retryable,
    payload: {
      error: { code, message: errorMessage(code), retryable },
      issue: { code, message: errorMessage(code), retryable }
    }
  };
}

export function assertGi088ModelCallsAuthorized() {
  requireGi088ModelCallAuthorization(createGi088ExecutionFingerprint());
}

export function createGi088HttpError(error: unknown) {
  const { status, payload } = gi088ErrorPayload(error);
  if (status >= 500) console.error("GI088_EVALUATION_REQUEST_FAILED", error);
  return NextResponse.json(payload, { status });
}

export async function withGi088Evaluation(
  request: Request,
  action: (context: {
    ownerUserId: string;
    service: Gi088EvaluationService;
  }) => Promise<unknown>
) {
  try {
    const user = await requireGi088EvaluationRequest(request);
    const service = new Gi088EvaluationService({
      store: createGi088PrismaStore(),
      evaluationMode: GI088_EVALUATION_MODE
    });
    return NextResponse.json(
      await action({ ownerUserId: user.id, service }),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return createGi088HttpError(error);
  }
}

export async function withGi088EvaluationStream(
  request: Request,
  action: (context: {
    ownerUserId: string;
    service: Gi088EvaluationService;
    emit: (event: unknown) => void;
  }) => Promise<unknown>
) {
  try {
    const user = await requireGi088EvaluationRequest(request);
    const service = new Gi088EvaluationService({
      store: createGi088PrismaStore(),
      evaluationMode: GI088_EVALUATION_MODE
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const emit = (event: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        void action({ ownerUserId: user.id, service, emit })
          .then((session) => emit({ type: "session", session }))
          .catch((error) => {
            const { status, payload } = gi088ErrorPayload(error);
            if (status >= 500) {
              console.error("GI088_EVALUATION_STREAM_FAILED", error);
            }
            emit({ type: "error", ...payload });
          })
          .finally(() => controller.close());
      }
    });
    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return createGi088HttpError(error);
  }
}
