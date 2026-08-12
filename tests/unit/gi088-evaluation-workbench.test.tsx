import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { writeGi088HelpRecordReceipt } from "@/features/interview/event-centered/gi088-compatibility-receipt";
import { createGi088ExportEnvelope } from "@/server/services/evaluation/gi088/export-v06";

function taskList(firstStatus: Gi088TaskSummary["status"]): Gi088TaskSummary[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `A${index + 1}`,
    evaluationRole: "scored_trajectory" as const,
    capabilityId: `A${index + 1}`,
    title: index === 0 ? "事件内沟通负担不误停" : `评测任务 ${index + 1}`,
    instruction: `只供评测人查看的任务说明 ${index + 1}`,
    targetTriggerPrompt: `任务触发提示 ${index + 1}`,
    criterion: `任务判定标准 ${index + 1}`,
    repeatOf: null,
    status: index === 0 ? firstStatus : "locked",
    targetTriggers: { off: null, high: null },
    compatibilitySmoke: null
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
  compatibility?: boolean;
} = {}): Gi088EvaluationSession {
  const active = input.active ?? true;
  const high = trajectory(active ? "running" : "not_started", {
    processing: input.processing,
    questionReview: input.questionReview
  });
  const tasks = input.compatibility
    ? taskList("locked").slice(0, 6).map((task, index) => ({
        ...task,
        evaluationRole: index >= 4
          ? "compatibility_smoke" as const
          : "scored_trajectory" as const,
        status: index < 4
          ? "completed" as const
          : index === 4
            ? "ready" as const
            : "locked" as const
      }))
    : taskList(active ? "active" : "ready");
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
      completedTaskCount: input.compatibility ? 4 : 0,
      totalTasks: input.compatibility ? 6 : 12,
      sealedAt: null,
      earlyStop: null,
      targetCoverage: {
        triggeredTrajectoryCount: 0,
        reviewedTrajectoryCount: 0,
        totalTrajectoryCount: input.compatibility ? 4 : 12
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
    tasks,
    activeTask: active && !input.compatibility ? {
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

describe("GI-088 evaluation workbench", () => {
  beforeEach(() => {
    installBrowserGlobals();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.localStorage.clear();
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
    expect(screen.getByRole("button", { name: "结束本批后可下载" }))
      .toBeDisabled();
  });

  it("终态导出先显示校验状态，再保留真实的保存 JSON 链接", async () => {
    const value = evaluationSession({ active: false });
    value.batch.status = "early_stopped";
    value.batch.earlyStop = {
      reasonCode: "sufficient_evidence",
      reason: "证据已经足够",
      stoppedAt: "2026-08-11T00:00:00.000Z",
      completedTaskIds: [],
      remainingTaskIds: value.tasks.map((task) => task.id)
    };
    const envelope = createGi088ExportEnvelope({
      payload: { runId: "run-1", tasks: [] }
    });
    let finishExport!: (response: Response) => void;
    const exportResponse = new Promise<Response>((resolve) => {
      finishExport = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(value))
      .mockReturnValueOnce(exportResponse);
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:gi088-terminal")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<Gi088EvaluationWorkbench />);
    const downloadButton = await screen.findByRole("button", {
      name: "下载已验证 JSON"
    });
    await act(async () => {
      downloadButton.click();
      downloadButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("gi088-export-feedback")).toHaveTextContent(
        "正在校验不可变收据并准备文件…"
      );
    }, { timeout: 5_000 });
    expect(screen.getByLabelText("当前运行")).toBeDisabled();
    const exportCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/preview/gi088/export?runId=run-1"
    );
    expect(exportCalls).toHaveLength(1);
    await act(async () => {
      finishExport(jsonResponse(envelope));
    });

    const fallback = await screen.findByRole("link", { name: "保存 JSON" });
    expect(fallback).toHaveAttribute("href", "blob:gi088-terminal");
    expect(fallback).toHaveAttribute("download", expect.stringContaining(
      "run-1-0-of-12.json"
    ));
    expect(exportCalls[0]![0]).toBe("/api/preview/gi088/export?runId=run-1");
  });

  it("兼容冒烟只开放真实帮我记入口与零模型结果登记", async () => {
    const value = evaluationSession({ active: false, compatibility: true });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);
    writeGi088HelpRecordReceipt({
      runId: "run-1",
      taskId: "A5",
      productSessionId: "capture-session-a5",
      recordedAt: "2026-08-11T00:00:00.000Z"
    });

    render(<Gi088EvaluationWorkbench />);

    const entry = await screen.findByRole("link", {
      name: "打开【帮我记】兼容入口"
    });
    expect(entry).toHaveAttribute(
      "href",
      "/interview?mode=event-centered&recordMode=capture&gi088RunId=run-1&gi088TaskId=A5"
    );
    expect(screen.getByText(/已检测到本项真实【帮我记】记录/))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "开始 Thinking high 评测"
    })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: "通过：模式、承接和零追问都符合"
    }));
    fireEvent.change(screen.getByLabelText("观察理由（必填）"), {
      target: { value: "入口显示帮我记，回应零问号，模式保持。" }
    });
    fireEvent.click(screen.getByRole("button", {
      name: "保存本项兼容结果"
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "/api/preview/gi088/compatibility-smoke"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toMatchObject({
      runId: "run-1",
      taskId: "A5",
      outcome: "passed",
      reason: "入口显示帮我记，回应零问号，模式保持。",
      productSessionId: "capture-session-a5"
    });
    expect(fetchMock.mock.calls.every(([path]) =>
      !String(path).includes("/start-task") &&
      !String(path).includes("/turn") &&
      !String(path).includes("/retry")
    )).toBe(true);
  });

  it("v8r3 新批次显示 Ark Flash 与 0/6 兼容任务骨架", async () => {
    const value = evaluationSession({ active: false, compatibility: true });
    value.evaluation.id = "gi088_human_eval_v8r3_skill_ark_flash";
    value.evaluation.version = "2026-08-11.gi088-human-eval-v8r3-skill-ark-flash";
    value.evaluation.model = "deepseek-v4-flash-ga-260731";
    value.batch.completedTaskCount = 0;
    value.batch.totalTasks = 6;
    value.tasks = value.tasks.map((task, index) => ({
      ...task,
      status: index === 0 ? "ready" as const : index < 4 ? "locked" as const : "locked" as const
    }));
    value.tasks[0] = {
      ...value.tasks[4]!,
      id: "A5",
      status: "ready",
      evaluationRole: "compatibility_smoke",
      capabilityId: "help_record_entry_compatibility_smoke",
      title: "帮我记兼容冒烟",
      compatibilitySmoke: null
    };
    value.tasks[4] = {
      ...value.tasks[4]!,
      id: "A1",
      status: "locked",
      evaluationRole: "scored_trajectory",
      capabilityId: "A1",
      title: "事件内沟通负担不误停",
      compatibilitySmoke: null
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);

    expect((await screen.findAllByText(/deepseek-v4-flash-ga-260731/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar", { name: "整批评测进度" }))
      .toHaveAttribute("aria-valuemax", "6");
    expect(screen.getByRole("heading", { name: "帮我记兼容冒烟" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始 Thinking high 评测" })).not.toBeInTheDocument();
  });

  it("兼容冒烟通过结论等待真实帮我记收据，失败结论仍可如实登记", async () => {
    const value = evaluationSession({ active: false, compatibility: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(value)));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText(/等待真实【帮我记】记录/))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {
      name: "通过：模式、承接和零追问都符合"
    }));
    fireEvent.change(screen.getByLabelText("观察理由（必填）"), {
      target: { value: "尚未形成可核验记录。" }
    });
    expect(screen.getByRole("button", { name: "保存本项兼容结果" }))
      .toBeDisabled();

    fireEvent.click(screen.getByRole("button", {
      name: "失败：入口、模式或回应存在问题"
    }));
    expect(screen.getByRole("button", { name: "保存本项兼容结果" }))
      .toBeEnabled();
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
    fireEvent.click(await screen.findByRole("button", { name: "创建 0/6 运行" }));

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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(value))
      .mockResolvedValueOnce(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.change(await screen.findByLabelText("继续自然交流"), {
      target: { value: "我希望她先理解我当时为什么那么累。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) =>
      path === "/api/preview/gi088/turn"
    )).toBe(true));
    const turnCalls = fetchMock.mock.calls.filter(([path]) =>
      path === "/api/preview/gi088/turn"
    );
    expect(turnCalls).toHaveLength(1);
    const body = JSON.parse(String((turnCalls[0]![1] as RequestInit).body));
    expect(body).toMatchObject({
      runId: "run-1",
      taskId: "A1",
      branch: "high",
      baseAssistantMessageId: "a1-high"
    });
    expect(body.clientOperationId).toBe(body.clientTurnId);
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
    let startAttempt = 0;
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      void init;
      if (path === "/api/preview/gi088/runs") {
        return Promise.resolve(jsonResponse(ready));
      }
      if (path === "/api/preview/gi088/start-task") {
        startAttempt += 1;
        return startAttempt === 1
          ? Promise.reject(new Error("stream lost"))
          : Promise.resolve(jsonResponse(started));
      }
      if (path === "/api/preview/gi088/operation-events") {
        return Promise.resolve(jsonResponse({ recorded: true }));
      }
      return Promise.reject(new Error(`unexpected request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.change(await screen.findByLabelText("你的第一段表达 U1"), {
      target: { value: "跟奶奶解释很累，但我还是想让她理解我。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始 Thinking high 评测" }));
    await screen.findByText(
      "评测工作台暂时无法连接。当前内容仍在，请恢复网络后读取最新状态。",
      {},
      { timeout: 5_000 }
    );
    fireEvent.click(screen.getByRole("button", { name: "开始 Thinking high 评测" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([path]) =>
      path === "/api/preview/gi088/start-task"
    )).toHaveLength(2));
    const startCalls = fetchMock.mock.calls.filter(([path]) =>
      path === "/api/preview/gi088/start-task"
    );
    const first = JSON.parse(String((startCalls[0]![1] as RequestInit).body));
    const second = JSON.parse(String((startCalls[1]![1] as RequestInit).body));
    expect(startAttempt).toBe(2);
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
  }, 15_000);

  it("processing 期间每 2 秒只 GET session，不发 automatic retry POST", async () => {
    vi.useFakeTimers();
    const pending = evaluationSession({ processing: true });
    const settled = evaluationSession();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(pending))
      .mockResolvedValueOnce(jsonResponse(settled));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const waitStatus = screen.getByTestId("gi088-authoritative-wait-status");
    expect(waitStatus).toHaveTextContent("正在自动恢复");
    expect(waitStatus).toHaveTextContent("60s / 60s");
    expect(screen.getAllByTestId("gi088-authoritative-wait-status")).toHaveLength(1);
    expect(screen.getAllByRole("status").filter((node) =>
      node.hasAttribute("aria-live")
    )).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/preview/gi088/runs",
      "/api/preview/gi088/session?runId=run-1&taskId=A1"
    ]);
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ cache: "no-store" });
    expect((fetchMock.mock.calls[1]![1] as RequestInit).method).toBeUndefined();
  }, 5_000);

  it("自动恢复收口为 manual_available 后停止等待并开放人工恢复", async () => {
    vi.useFakeTimers();
    const processing = evaluationSession({ processing: true });
    const settled = evaluationSession();
    const high = settled.activeTask!.branches.high;
    const failedTurn = high.turns[0]!;
    high.status = "protected_failure";
    high.pendingTurnId = failedTurn.id;
    failedTurn.status = "protected_failure";
    failedTurn.visibleText = null;
    failedTurn.recovery = {
      status: "manual_available",
      trigger: "TIMEOUT",
      automaticRetryCount: 1,
      initialCallId: "call-1",
      recoveryCallId: "call-2",
      manualRetryCount: 0,
      manualRetryCallId: null,
      eligibleAt: "2026-08-10T00:00:00.000Z",
      automaticDeadlineAt: "2026-08-10T00:01:30.000Z",
      startedAt: "2026-08-10T00:00:10.000Z",
      completedAt: "2026-08-10T00:01:18.000Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(processing))
      .mockResolvedValueOnce(jsonResponse(settled));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("gi088-authoritative-wait-status"))
      .toHaveTextContent("正在自动恢复");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByRole("button", { name: "重新尝试" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "安全终止当前任务" }))
      .toBeEnabled();
    expect(screen.queryByText("当前模型调用仍在执行，调用收口后才能终止任务。"))
      .not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 5_000);

  it("安全终止后点击下一项直接回到可开始状态", async () => {
    const abortedView = evaluationSession();
    abortedView.tasks[0]!.status = "aborted";
    abortedView.tasks[1]!.status = "ready";
    abortedView.activeTask!.readOnly = true;
    const readyView = evaluationSession({ active: false });
    readyView.tasks[0]!.status = "aborted";
    readyView.tasks[1]!.status = "ready";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(abortedView))
      .mockResolvedValueOnce(jsonResponse(readyView));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.click(await screen.findByRole("button", {
      name: "A2 评测任务 2 待开始"
    }));

    expect(await screen.findByLabelText("你的第一段表达 U1")).toBeEnabled();
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "/api/preview/gi088/session?runId=run-1"
    );
  });

  it("正常桌面宽度优先显示主对话，并让任务与 Trace 独立滚动和随时收起", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(evaluationSession()));
    vi.stubGlobal("fetch", fetchMock);

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByRole("button", { name: "查看任务 · 0/12" })).toBeEnabled();
    expect(screen.getByTestId("gi088-dialogue-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("gi088-task-rail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看任务 · 0/12" }));
    expect(screen.getByTestId("gi088-task-scroll")).toHaveClass(
      "flex-1",
      "overflow-y-auto"
    );
    expect(screen.queryByTestId("gi088-trace-ledger")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gi088-gate-summary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: "运行详情 · gate=pending"
    }));
    expect(screen.getByTestId("gi088-gate-summary")).toHaveAttribute("open");
    expect(screen.queryByTestId("gi088-task-rail")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看 Trace · 1 轮" }));

    expect(await screen.findByTestId("gi088-trace-ledger")).toBeInTheDocument();
    expect(screen.queryByTestId("gi088-task-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("gi088-trace-scroll")).toHaveClass(
      "flex-1",
      "overflow-y-auto"
    );
    fireEvent.click(screen.getByRole("button", { name: "专注对话" }));
    expect(screen.queryByTestId("gi088-task-rail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gi088-trace-ledger")).not.toBeInTheDocument();
    expect(screen.getByTestId("gi088-dialogue-panel")).toBeInTheDocument();
  });

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
    fireEvent.click(screen.getByRole("button", { name: "推进当前共同任务" }));
    fireEvent.click(screen.getByRole("button", { name: "保存本轮分类" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body));
    expect(body).toMatchObject({
      runId: "run-1",
      turnId: "turn-high-1",
      questionPresence: "present",
      classification: "same_focus_low_burden",
      valueClassification: "advances_working_task",
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
    fireEvent.change(await screen.findByLabelText(
      "终止原因（必填）",
      {},
      { timeout: 5_000 }
    ), {
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
  }, 15_000);

  it("历史运行保持对话只读，运行结束前不生成首次不可变导出", async () => {
    const value = evaluationSession({ readOnly: true });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(value));
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText(/历史只读/u)).toBeInTheDocument();
    expect(screen.queryByLabelText("继续自然交流")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束本批后可下载" })).toBeDisabled();
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
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      void init;
      if (path === "/api/preview/gi088/runs") {
        return Promise.resolve(jsonResponse(value));
      }
      if (path === "/api/preview/gi088/turn") {
        return Promise.resolve(jsonResponse({
          issue: {
            code: "GI088_TURN_OUT_OF_DATE",
            message: "所见对话已经更新，请先读取最新状态。",
            retryable: false,
            dataSaved: "no",
            impact: "turn",
            action: "read_latest_state",
            requestId: "request-1"
          }
        }, 409));
      }
      if (path === "/api/preview/gi088/session?runId=run-1&taskId=A1") {
        return Promise.resolve(jsonResponse(value));
      }
      if (path === "/api/preview/gi088/operation-events") {
        return Promise.resolve(jsonResponse({ recorded: true }));
      }
      return Promise.reject(new Error(`unexpected request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Gi088EvaluationWorkbench />);

    fireEvent.change(await screen.findByLabelText("继续自然交流"), {
      target: { value: "继续聊这一小块。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    fireEvent.click(await screen.findByRole("button", { name: "读取最新状态" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([path]) =>
      path === "/api/preview/gi088/session?runId=run-1&taskId=A1"
    )).toHaveLength(1));
    const turnCalls = fetchMock.mock.calls.filter(([path]) =>
      path === "/api/preview/gi088/turn"
    );
    const sessionCalls = fetchMock.mock.calls.filter(([path]) =>
      path === "/api/preview/gi088/session?runId=run-1&taskId=A1"
    );
    expect(turnCalls).toHaveLength(1);
    expect(sessionCalls[0]![1]).toMatchObject({ cache: "no-store" });
    expect((sessionCalls[0]![1] as RequestInit).method).toBeUndefined();
  });
});
