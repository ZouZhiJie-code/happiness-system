import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Gi088EvaluationRequestError,
  getGi088EvaluationSession,
  type Gi088IssueAction
} from "@/features/interview/event-centered/gi088-evaluation-client";
import {
  GI088_ERROR_CATALOG,
  createGi088EvaluationIssue
} from "@/server/services/evaluation/gi088/errors";

const PUBLIC_ACTIONS = [
  "read_latest_state",
  "return_to_current_task",
  "reconfirm_submission",
  "generate_again",
  "seal_and_export",
  "none"
] as const satisfies readonly Gi088IssueAction[];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GI-088 typed error catalog", () => {
  it("每个错误码都具备中文原因、数据状态、影响范围和可识别 action", () => {
    const activeActions = new Set<Gi088IssueAction>();
    const allowedActions = new Set<Gi088IssueAction>(PUBLIC_ACTIONS);

    for (const [code, entry] of Object.entries(GI088_ERROR_CATALOG)) {
      const issue = createGi088EvaluationIssue(
        code as keyof typeof GI088_ERROR_CATALOG
      );
      expect(issue).toEqual({ code, ...entry });
      expect(entry.message).toMatch(/[\u3400-\u9fff]/u);
      expect(["yes", "partial", "no", "unknown"]).toContain(
        entry.dataSaved
      );
      expect(["request", "turn", "task", "run", "environment"]).toContain(
        entry.impact
      );
      expect(allowedActions.has(entry.action)).toBe(true);
      expect(typeof entry.retryable).toBe("boolean");
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.status).toBeLessThan(600);
      activeActions.add(entry.action);
    }

    expect([...activeActions].sort()).toEqual([
      "generate_again",
      "read_latest_state",
      "reconfirm_submission",
      "return_to_current_task",
      "seal_and_export"
    ]);
  });

  it.each(PUBLIC_ACTIONS)(
    "客户端完整保留公开 issue.action=%s",
    async (action) => {
      const issue = {
        code: `GI088_ACTION_${action.toUpperCase()}`,
        message: "这是一条用于验证恢复动作解析的中文错误。",
        retryable: action === "read_latest_state",
        dataSaved: "yes",
        impact: "request",
        action
      } as const;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(JSON.stringify({ issue }), {
            status: 409,
            headers: { "content-type": "application/json" }
          })
        )
      );

      await expect(
        getGi088EvaluationSession({ runId: "run-action-contract" })
      ).rejects.toEqual(
        new Gi088EvaluationRequestError(issue)
      );
    }
  );
});
