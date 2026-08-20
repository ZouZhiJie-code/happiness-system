import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { vi } from "vitest";

import { Gi088EvaluationWorkbench } from "@/components/interview/event-centered/gi088-evaluation-workbench";
import {
  startGi088HighTrajectory,
  startGi088OffTrajectory,
  submitGi088Turn
} from "@/features/interview/event-centered/gi088-evaluation-client";
import type {
  Gi088EvaluationSession,
  Gi088ProgramIntervention,
  Gi088TaskSummary,
  Gi088Trajectory
} from "@/features/interview/event-centered/gi088-evaluation-client";
import {
  GI088_OUTBOX_MAP_STORAGE_KEY,
  readGi088EvaluationDraft,
  writeGi088EvaluationDraft
} from "@/features/interview/event-centered/gi088-evaluation-storage";

const HIGH_LOAD_ASYNC_TIMEOUT_MS = 10_000;
const HIGH_LOAD_TEST_TIMEOUT_MS = 15_000;

function taskList(firstStatus: Gi088TaskSummary["status"]): Gi088TaskSummary[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `A${index + 1}`,
    capabilityId: `A${index + 1}`,
    title: index === 0 ? "事件内沟通负担不误停" : `评测任务 ${index + 1}`,
    instruction: `只供评测人查看的任务说明 ${index + 1}`,
    targetTriggerPrompt: `任务触发提示 ${index + 1}`,
    criterion: `任务判定标准 ${index + 1}`,
    repeatOf: null,
    status: index === 0 ? firstStatus : "locked",
    targetTriggers: { off: null, high: null }
  }));
}

function trajectory(
  status: Gi088Trajectory["status"] = "running",
  options: { processing?: boolean; questionReview?: boolean } = {}
): Gi088Trajectory {
  const messages = status === "not_started"
    ? []
    : [
        { id: "a0-high", role: "assistant" as const, content: "此刻你想聊点什么？" },
        { id: "u1-high", role: "user" as const, content: "跟奶奶解释很累，但我还是想让她理解我。" },
        { id: "a1-high", role: "assistant" as const, content: "你最希望她先理解哪一小部分？" }
      ];
  const turns = status === "not_started"
    ? []
    : [{
        id: "turn-high-1",
        clientTurnId: "client-turn-1",
        userMessageId: "u1-high",
        status: options.processing ? "processing" as const : "valid" as const,
        semantic: {
          stage: "engage_focus" as const,
          action: "ask" as const,
          workingTask: {
            continuity: "new" as const,
            targetRef: null,
            summary: "理解这次沟通负担",
            evidenceRefs: ["u1-high"]
          },
          nextInquiry: {
            answerTarget: "最希望被理解的部分",
            taskEffect: "继续当前共同任务",
            evidenceRefs: ["u1-high"]
          }
        },
        visibleText: options.processing ? null : "你最希望她先理解哪一小部分？",
        evidenceExcerpts: [{ id: "u1-high", content: "跟奶奶解释很累" }],
        calls: [],
        recovery: options.processing ? {
          status: "retrying" as const,
          trigger: "TIMEOUT" as const,
          automaticRetryCount: 1,
          initialCallId: "call-1",
          recoveryCallId: "call-2",
          eligibleAt: "2026-08-10T00:00:00.000Z",
          automaticDeadlineAt: "2026-08-10T00:01:30.000Z",
          startedAt: "2026-08-10T00:00:10.000Z",
          completedAt: null
        } : null,
        questionObservation: options.questionReview ? {
          questionMarkCount: 1,
          reviewCandidate: "none" as const,
          review: null,
          observationFingerprint: "question-fingerprint-1"
        } : null
      }];
  return {
    id: "trajectory-high",
    branch: "high",
    config: {
      key: "high",
      label: "Thinking 开启 · high",
      thinking: "enabled",
      temperature: null,
      reasoningEffort: "high",
      automaticEmptyContentRetries: 1,
      automaticStageTransitionRetries: 1,
      providerCallsUsed: options.processing ? 2 : 1
    },
    status,
    messages,
    semanticState: null,
    turns,
    pendingTurnId: options.processing ? "turn-high-1" : null,
    technicalError: null,
    review: null,
    dialogueAnchor: {
      lastAssistantMessageId: status === "not_started" ? null : "a1-high",
      lastCommittedTurnId: status === "not_started" ? null : "turn-high-1"
    },
    reviewSnapshotFingerprint: "trajectory-fingerprint-1"
  };
}

function evaluationSession(input: {
  active?: boolean;
  processing?: boolean;
  questionReview?: boolean;
  readOnly?: boolean;
  intervention?: Gi088ProgramIntervention;
} = {}): Gi088EvaluationSession {
  const active = input.active ?? true;
  const high = trajectory(active ? "running" : "not_started", {
    processing: input.processing,
    questionReview: input.questionReview
  });
  return {
    evaluation: {
      id: "gi088-human-eval-v8r2",
      version: "2026-08-10.gi088-human-eval-v8r2-foundation-hardening",
      mode: "high_only",
      activeBranches: ["high"],
      candidateFingerprint: "a".repeat(64),
      executionFingerprint: "b".repeat(64),
      model: "deepseek-v4-pro"
    },
    batch: {
      id: "run-1",
      runId: "run-1",
      runOrdinal: 1,
      revision: 3,
      status: "running",
      completedTaskCount: 0,
      totalTasks: 12,
      sealedAt: null,
      earlyStop: null,
      targetCoverage: {
        triggeredTrajectoryCount: 0,
        reviewedTrajectoryCount: 0,
        totalTrajectoryCount: 12
      },
      gate: {
        status: input.intervention?.reviewOutcome === "false_positive"
          ? "no_go"
          : "pending",
        reasons: [],
        frozen: false
      },
      readOnly: input.readOnly ?? false,
      readOnlyReason: input.readOnly ? "execution_fingerprint_mismatch" : null
    },
    tasks: taskList(active ? "active" : "ready"),
    activeTask: active ? {
      taskId: "A1",
      frozenStart: {
        opening: "此刻你想聊点什么？",
        userMessage: "跟奶奶解释很累，但我还是想让她理解我。"
      },
      activeBranch: "high",
      branches: {
        off: trajectory("not_started"),
        high
      },
      comparison: null,
      readOnly: input.readOnly ?? false,
      reviewSnapshot: {
        fingerprint: "trajectory-fingerprint-1",
        trajectoryReview: null,
        questionReviews: [],
        programInterventions: input.intervention ? [input.intervention] : []
      }
    } : null,
    metrics: {
      version: "2026-08-10.gi088-evaluation-metrics-v1",
      eligibleModelSubmissionCount: 1,
      firstVisibleSuccessCount: 1,
      firstVisibleSuccessRate: 1,
      zeroCallControlCount: 0,
      rawTechnicalEventCount: 0,
      autoRecoverySuccessCount: 0,
      finalFailureCount: 0,
      manualThirdGenerationCount: 0,
      consecutiveRecoveryCount: 0,
      duplicateMessageCount: 0,
      programInterventionCount: input.intervention ? 1 : 0,
      programInterventionReviewCoverage: input.intervention ? 0 : null,
      visibleQuestionReviewCoverage: input.questionReview ? 0 : null,
      multipleIndependentTasksCount: 0
    },
    programInterventions: input.intervention ? [input.intervention] : [],
    reviewRevisions: []
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

function installBrowserGlobals() {
  vi.stubGlobal("crypto", webcrypto as unknown as Crypto);
  vi.stubGlobal("matchMedia", undefined);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  });
}

describe("GI-088 v8r2 evaluation workbench", () => {
  beforeEach(() => {
    installBrowserGlobals();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("先读取运行列表，并用显式 runId 呈现当前运行", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(evaluationSession()));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByRole("heading", { name: "持续聊下去，也能随时回看和纠正" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/preview/gi088/runs");
    expect(screen.getByLabelText("当前运行")).toHaveValue("run-1");
    expect(screen.getByTestId("gi088-gate-summary")).toHaveTextContent("gate=pending");
  });

  it("运行列表只返回摘要时，以显式 runId GET session 且不产生写请求", async () => {
    const value = evaluationSession({ active: false });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        runs: [{
          runId: "run-1",
          runOrdinal: 1,
          evaluationVersion: value.evaluation.version,
          collectionStatus: "running",
          gateStatus: "pending",
          createdAt: "2026-08-10T00:00:00.000Z",
          updatedAt: "2026-08-10T00:00:00.000Z",
          sealedAt: null,
          readOnly: false
        }]
      }))
      .mockResolvedValueOnce(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);

    await screen.findByRole("heading", { name: "持续聊下去，也能随时回看和纠正" });
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/preview/gi088/runs",
      "/api/preview/gi088/session?runId=run-1"
    ]);
    expect(fetchMock.mock.calls.every(([, init]) =>
      (init as RequestInit | undefined)?.method === undefined
    )).toBe(true);
  });

  it("显式创建零模型运行并读取返回 session", async () => {
    const created = evaluationSession({ active: false });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ runs: [] }))
      .mockResolvedValueOnce(jsonResponse({
        runs: [{
          runId: "run-1",
          runOrdinal: 1,
          evaluationVersion: created.evaluation.version,
          status: "running",
          gateStatus: "pending",
          completedTaskCount: 0,
          totalTasks: 12,
          readOnly: false,
          createdAt: "2026-08-10T00:00:00.000Z",
          updatedAt: "2026-08-10T00:00:00.000Z",
          sealedAt: null
        }],
        session: created
      }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "创建 0/12 运行" }));

    await screen.findByRole("heading", { name: "持续聊下去，也能随时回看和纠正" });
    const body = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body));
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/runs");
    expect(body.clientOperationId).toMatch(/^gi088-create-run-/u);
  });

  it("历史 running 已只读时仍开放全新 v8r2 复测运行", async () => {
    const historical = evaluationSession({ active: false, readOnly: true });
    historical.evaluation.version = "2026-08-10.gi088-human-eval-v8r1-final12";
    historical.evaluation.mode = "paired";
    historical.batch.id = "run-old";
    historical.batch.runId = "run-old";
    const created = evaluationSession({ active: false });
    created.batch.runOrdinal = 2;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        runs: [{
          runId: "run-old",
          runOrdinal: 1,
          evaluationVersion: historical.evaluation.version,
          collectionStatus: "running",
          gateStatus: "legacy_unknown",
          completedTaskCount: 1,
          totalTasks: 12,
          readOnly: true,
          createdAt: "2026-08-10T00:00:00.000Z",
          updatedAt: "2026-08-10T00:00:00.000Z",
          sealedAt: null
        }]
      }))
      .mockResolvedValueOnce(jsonResponse(historical))
      .mockResolvedValueOnce(jsonResponse({
        created: true,
        runId: "run-1",
        runOrdinal: 2,
        session: created
      }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);

    fireEvent.click(await screen.findByRole("button", {
      name: "创建同候选复测"
    }));
    await waitFor(() => expect(screen.getByLabelText("当前运行"))
      .toHaveValue("run-1"));
    expect(screen.getAllByRole("option").map((option) =>
      (option as HTMLOptionElement).value
    )).toEqual(["run-1", "run-old"]);
    expect(fetchMock.mock.calls[2]![0]).toBe("/api/preview/gi088/runs");
    expect((fetchMock.mock.calls[2]![1] as RequestInit).method).toBe("POST");
  });

  it("turn 同时提交 runId、同一 operation/turn ID 与所见 assistant anchor", async () => {
    const value = evaluationSession();
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "/api/preview/gi088/runs") return jsonResponse(value);
      if (url === "/api/preview/gi088/turn") return jsonResponse(value);
      if (url === "/api/preview/gi088/operation-events") {
        return jsonResponse({ recorded: true });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.change(await screen.findByLabelText("继续自然交流"), {
      target: { value: "我希望她先理解我当时为什么那么累。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) =>
      String(input) === "/api/preview/gi088/turn"
    )).toHaveLength(1));
    const turnCall = fetchMock.mock.calls.find(([input]) =>
      String(input) === "/api/preview/gi088/turn"
    );
    expect(turnCall).toBeDefined();
    const body = JSON.parse(String((turnCall![1] as RequestInit).body));
    expect(body).toMatchObject({
      runId: "run-1",
      taskId: "A1",
      branch: "high",
      baseAssistantMessageId: "a1-high"
    });
    expect(body.clientOperationId).toBe(body.clientTurnId);
    expect(fetchMock.mock.calls.some(([input, init]) =>
      String(input) === "/api/preview/gi088/runs" &&
      (init as RequestInit | undefined)?.method === undefined
    )).toBe(true);
    await waitFor(() => expect(screen.getByLabelText("继续自然交流"))
      .toHaveValue(""));
    expect(screen.getByLabelText("当前运行")).toHaveValue("run-1");
  });

  it("客户端在发请求前拦截旧 off 分支、缺失 U1 与缺失 assistant anchor", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(startGi088OffTrajectory({
      runId: "run-1",
      taskId: "A1",
      initialUserMessage: "旧双分支内容",
      clientTurnId: "operation-1"
    })).rejects.toMatchObject({
      issue: { code: "GI088_HIGH_ONLY_EVALUATION" }
    });
    await expect(startGi088HighTrajectory({
      runId: "run-1",
      taskId: "A1",
      clientOperationId: "operation-2"
    })).rejects.toMatchObject({
      issue: { code: "GI088_START_INPUT_INVALID" }
    });
    await expect(submitGi088Turn({
      runId: "run-1",
      taskId: "A1",
      branch: "high",
      content: "继续聊",
      clientTurnId: "operation-3",
      baseAssistantMessageId: ""
    })).rejects.toMatchObject({
      issue: { code: "GI088_TURN_INPUT_INVALID" }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("流响应丢失后复用 unresolved outbox 的 clientTurnId", async () => {
    const ready = evaluationSession({ active: false });
    const started = evaluationSession();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(ready))
      .mockRejectedValueOnce(new Error("stream lost"))
      .mockResolvedValueOnce(jsonResponse(started));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.change(await screen.findByLabelText("你的第一段表达 U1"), {
      target: { value: "跟奶奶解释很累，但我还是想让她理解我。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始 Thinking high 评测" }));
    await screen.findByText("评测工作台暂时无法连接。当前内容仍在，请恢复网络后读取最新状态。");
    fireEvent.click(screen.getByRole("button", { name: "开始 Thinking high 评测" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const first = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body));
    const second = JSON.parse(String((fetchMock.mock.calls[2]![1] as RequestInit).body));
    expect(Object.keys(first).sort()).toEqual([
      "action",
      "clientOperationId",
      "initialUserMessage",
      "runId",
      "taskId"
    ]);
    expect(first.action).toBe("start_high");
    expect(first.clientOperationId).toBe(second.clientOperationId);
    expect(first.clientOperationId).toMatch(/^gi088-turn-/u);
    expect(window.sessionStorage.getItem(GI088_OUTBOX_MAP_STORAGE_KEY)).toBeNull();
  });

  it("processing 期间每 2 秒只 GET session，不发 automatic retry POST", async () => {
    const pending = evaluationSession({ processing: true });
    const settled = evaluationSession();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(pending))
      .mockResolvedValueOnce(jsonResponse(settled));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    await screen.findByText(/正在自动重试/u);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), {
      timeout: 3_500
    });
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/preview/gi088/runs",
      "/api/preview/gi088/session?runId=run-1&taskId=A1"
    ]);
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ cache: "no-store" });
    expect((fetchMock.mock.calls[1]![1] as RequestInit).method).toBeUndefined();
  }, 5_000);

  it("逐轮复核提交 questionPresence、observation fingerprint 与 operation ID", async () => {
    const value = evaluationSession({ questionReview: true });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(value))
      .mockResolvedValueOnce(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    await screen.findByTestId("gi088-question-review");
    fireEvent.click(screen.getByRole("button", { name: "包含提问" }));
    fireEvent.click(await screen.findByRole("button", { name: "同一焦点，容易回答" }));
    fireEvent.click(screen.getByRole("button", { name: "保存本轮分类" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body));
    expect(body).toMatchObject({
      runId: "run-1",
      turnId: "turn-high-1",
      questionPresence: "present",
      classification: "same_focus_low_burden",
      observationFingerprint: "question-fingerprint-1"
    });
    expect(body.clientOperationId).toMatch(/^gi088-turn-/u);
  });

  it("程序介入支持全量人工复核并绑定 observation fingerprint", async () => {
    const intervention: Gi088ProgramIntervention = {
      id: "intervention-1",
      taskId: "A1",
      branch: "high",
      turnId: "turn-high-1",
      callId: null,
      interventionType: "pure_stop",
      originalAction: "none",
      effectiveAction: "pause",
      evidenceSpan: "今天先到这",
      observationFingerprint: "intervention-fingerprint-1",
      reviewOutcome: null,
      reviewReason: null,
      reviewedAt: null,
      createdAt: "2026-08-10T00:00:00.000Z"
    };
    const value = evaluationSession({ intervention });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(value))
      .mockResolvedValueOnce(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "程序介入正确" }));
    fireEvent.change(screen.getByLabelText("复核理由（必填）"), {
      target: { value: "用户明确停止，程序介入正确。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存程序介入复核" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body));
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/program-intervention-review");
    expect(body).toMatchObject({
      runId: "run-1",
      interventionId: "intervention-1",
      observationFingerprint: "intervention-fingerprint-1",
      outcome: "correct"
    });
    expect(body.clientOperationId).toMatch(/^gi088-turn-/u);
  });

  it("安全终止当前任务保留原因并提交确认", async () => {
    const value = evaluationSession();
    const aborted = evaluationSession({ active: false });
    aborted.tasks[0]!.status = "aborted";
    aborted.batch.gate = {
      status: "no_go",
      reasons: [],
      frozen: false
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(value))
      .mockResolvedValueOnce(jsonResponse(aborted));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "安全终止当前任务" }));
    fireEvent.change(screen.getByLabelText("终止原因（必填）"), {
      target: { value: "页面故障阻断本项，保留现有证据。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认终止当前任务" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body));
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/abort-current-task");
    expect(body).toMatchObject({
      runId: "run-1",
      taskId: "A1",
      confirmation: true,
      abandonRecovery: false
    });
    expect(body.clientOperationId).toMatch(/^gi088-turn-/u);
  });

  it("历史运行保持对话只读，同时全局保留验签下载入口", async () => {
    const value = evaluationSession({ readOnly: true });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText(/历史只读/u)).toBeInTheDocument();
    expect(screen.queryByLabelText("继续自然交流")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载已验证 JSON" })).toBeEnabled();
    expect(screen.getByText("只读回看")).toBeInTheDocument();
    expect(screen.queryByTestId("gi088-technical-smoke-panel"))
      .not.toBeInTheDocument();
  });

  it("历史只读运行恢复本地草稿时不自动写 operation event", async () => {
    const value = evaluationSession({ readOnly: true });
    writeGi088EvaluationDraft({
      runId: "run-1",
      taskId: "A1",
      branch: "high",
      form: "chat_input",
      turnId: null
    }, "历史运行里尚未提交的本地草稿");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText(/历史只读/u)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/preview/gi088/runs");
    expect((fetchMock.mock.calls[0]![1] as RequestInit | undefined)?.method)
      .toBeUndefined();
  });

  it("读取到 run 终态时精确清理该 run 的本地草稿", async () => {
    const scope = {
      runId: "run-1",
      taskId: "A1",
      branch: "high" as const,
      form: "chat_input" as const,
      turnId: null
    };
    writeGi088EvaluationDraft(scope, "已经封存的本地草稿");
    const value = evaluationSession({ active: false, readOnly: true });
    value.batch.status = "sealed";
    value.batch.sealedAt = "2026-08-10T00:10:00.000Z";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("这一批已经封存")).toBeInTheDocument();
    await waitFor(() => expect(readGi088EvaluationDraft(scope)).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("typed issue.action=read_latest_state 只读取最新 session", async () => {
    const value = evaluationSession();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(value))
      .mockResolvedValueOnce(jsonResponse({
        issue: {
          code: "GI088_TURN_OUT_OF_DATE",
          message: "所见对话已经更新，请先读取最新状态。",
          retryable: false,
          dataSaved: "no",
          impact: "turn",
          action: "read_latest_state",
          requestId: "request-1"
        }
      }, 409))
      .mockResolvedValueOnce(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.change(await screen.findByLabelText("继续自然交流"), {
      target: { value: "继续聊这一小块。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    const issueAlert = await screen.findByRole("alert", undefined, {
      timeout: HIGH_LOAD_ASYNC_TIMEOUT_MS
    });
    expect(issueAlert).toHaveTextContent("GI088_TURN_OUT_OF_DATE");
    fireEvent.click(within(issueAlert).getByRole("button", { name: "读取最新状态" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), {
      timeout: HIGH_LOAD_ASYNC_TIMEOUT_MS
    });
    expect(fetchMock.mock.calls[2]![0]).toBe(
      "/api/preview/gi088/session?runId=run-1&taskId=A1"
    );
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({ cache: "no-store" });
    expect((fetchMock.mock.calls[2]![1] as RequestInit).method).toBeUndefined();
  }, HIGH_LOAD_TEST_TIMEOUT_MS);
});
