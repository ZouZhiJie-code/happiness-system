import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { Gi088EvaluationWorkbench } from "@/components/interview/event-centered/gi088-evaluation-workbench";
import type {
  Gi088EvaluationSession,
  Gi088TaskSummary,
  Gi088Trajectory
} from "@/features/interview/event-centered/gi088-evaluation-client";
import {
  GI088_OUTBOX_STORAGE_KEY,
  invalidateGi088OutboxOnContentChange,
  prepareGi088Outbox,
  readGi088Outbox
} from "@/features/interview/event-centered/gi088-evaluation-client";

configure({ asyncUtilTimeout: 5_000 });

const instruction = "请在真实聊天中主动触发：先说两件互相影响的事，再选择其中一边作为当前入口。";
const targetTriggerPrompt = "请在 U1 同时说明两个相互影响的方面，并明确说出当前想先聊哪一个。";
const criterion = "两条分支都要保留两个方面及其相互影响，只把用户选择的一面作为当前入口。";

function tasks(firstStatus: Gi088TaskSummary["status"]): Gi088TaskSummary[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `task-${index + 1}`,
    capabilityId: index < 8 ? `A${index + 1}` : `A${[2, 3, 4, 6][index - 8]}-R`,
    title: index === 0 ? "保留相关整体，选择当前入口" : `评测任务 ${index + 1}`,
    instruction: index === 0 ? instruction : `只供评测人查看的任务说明 ${index + 1}`,
    targetTriggerPrompt: index === 0 ? targetTriggerPrompt : `任务触发提示 ${index + 1}`,
    criterion: index === 0 ? criterion : `任务判定标准 ${index + 1}`,
    repeatOf: index >= 8 ? `A${[2, 3, 4, 6][index - 8]}` : null,
    status: index === 0 ? firstStatus : "locked",
    targetTriggers: { off: null, high: null }
  }));
}

function trajectory(key: "off" | "high", status: Gi088Trajectory["status"]): Gi088Trajectory {
  return {
    id: `trajectory-${key}`,
    config: {
      key,
      label: key === "off" ? "Thinking 关闭" : "Thinking 开启 · high",
      thinking: key === "off" ? "disabled" : "enabled",
      temperature: key === "off" ? 0.2 : null,
      reasoningEffort: key === "high" ? "high" : null,
      automaticEmptyContentRetries: key === "high" ? 1 : 0,
      automaticStageTransitionRetries: 1
    },
    status,
    messages: status === "not_started" ? [] : [
      { id: `a0-${key}`, role: "assistant", content: "此刻你想聊点什么？" },
      { id: `u1-${key}`, role: "user", content: "最近找工作和长期方向都让我有点乱。" },
      { id: `a1-${key}`, role: "assistant", content: "眼前拿到 offer 和长期方向都在影响你。我们先看看目前最卡住你的那一小块是什么？" }
    ],
    semanticState: null,
    turns: status === "not_started" ? [] : [{
      id: `turn-${key}`,
      userMessageId: `u1-${key}`,
      status: "valid",
      semantic: {
        stage: "engage_focus",
        action: "ask",
        workingTask: {
          continuity: "new",
          targetRef: null,
          summary: "弄清眼前求职与长期方向怎样互相影响",
          evidenceRefs: [`u1-${key}`]
        },
        nextInquiry: {
          answerTarget: "目前最卡住的一小块",
          taskEffect: "选择当前入口，同时保留两层共同任务",
          evidenceRefs: [`u1-${key}`]
        }
      },
      visibleText: "眼前拿到 offer 和长期方向都在影响你。我们先看看目前最卡住你的那一小块是什么？",
      evidenceExcerpts: [{ id: `u1-${key}`, content: "找工作和长期方向都让我有点乱" }],
      calls: [{
        id: `call-${key}`,
        attempt: 1,
        kind: "initial",
        status: "valid",
        startedAt: "2026-08-08T00:00:00.000Z",
        completedAt: "2026-08-08T00:00:00.832Z",
        latencyMs: 832,
        tokenUsage: { totalTokens: 418 },
        providerDiagnostics: {
          finishReason: "stop",
          reasoningPresent: key === "high",
          reasoningLength: key === "high" ? 1_280 : 0,
          reasoningTokens: key === "high" ? 96 : 0,
          latencyMs: 832,
          tokenUsage: { totalTokens: 418 },
          upstreamRequestId: `request-${key}`,
          httpStatus: 200,
          responseModel: "deepseek-v4-flash",
          choiceCount: 1,
          contentType: "string",
          contentLength: 42,
          reasoningType: key === "high" ? "string" : "missing",
          headersLatencyMs: 120,
          bodyLatencyMs: 712,
          totalLatencyMs: 832,
          timeoutStage: null,
          abortSource: null
        }
      }]
    }],
    pendingTurnId: null,
    technicalError: null,
    review: null
  };
}

function session(active: boolean): Gi088EvaluationSession {
  return {
    evaluation: {
      id: "gi088-human-eval-v0",
      version: "2026-08-09.gi088-human-eval-v4-stage-transition",
      candidateFingerprint: "a".repeat(64),
      executionFingerprint: "b".repeat(64),
      model: "deepseek-v4-flash"
    },
    batch: {
      id: "batch-1",
      status: "running",
      completedTaskCount: 0,
      totalTasks: 12,
      sealedAt: null,
      earlyStop: null,
      targetCoverage: {
        triggeredTrajectoryCount: 0,
        reviewedTrajectoryCount: 0,
        totalTrajectoryCount: 24
      }
    },
    tasks: tasks(active ? "active" : "ready"),
    activeTask: active ? {
      taskId: "task-1",
      frozenStart: {
        opening: "此刻你想聊点什么？",
        userMessage: "最近找工作和长期方向都让我有点乱。"
      },
      activeBranch: "off",
      branches: {
        off: trajectory("off", "running"),
        high: trajectory("high", "not_started")
      },
      comparison: null
    } : null
  };
}

function highOnlySession(active: boolean): Gi088EvaluationSession {
  const value = session(active);
  value.evaluation = {
    ...value.evaluation,
    id: "gi088_human_eval_v7r2_ark_flash",
    version: "2026-08-10.gi088-human-eval-v7r2-ark-flash",
    model: "deepseek-v4-flash-ga-260731",
    mode: "high_only",
    activeBranches: ["high"]
  };
  value.tasks = value.tasks.slice(0, 2);
  value.batch.totalTasks = 2;
  value.batch.targetCoverage.totalTrajectoryCount = 2;
  if (value.activeTask) {
    value.activeTask.activeBranch = "high";
    value.activeTask.branches.off = trajectory("off", "not_started");
    value.activeTask.branches.high = trajectory("high", "running");
  }
  return value;
}

function highEmptyRecoverySession(
  status: "eligible" | "recovered" | "exhausted"
): Gi088EvaluationSession {
  const value = session(true);
  value.activeTask!.activeBranch = "high";
  value.activeTask!.branches.off.status = "completed";
  value.activeTask!.branches.off.review = {
    feeling: "same",
    quality: "direct_use",
    targetTrigger: "triggered",
    reason: "关闭组完成。"
  };
  const high = trajectory(
    "high",
    status === "recovered" ? "running" : "technical_failure"
  );
  const turn = high.turns[0]!;
  const initialCall = {
    ...turn.calls[0]!,
    id: "high-empty-initial-call",
    status: "technical_failure" as const,
    errorCode: "EMPTY_CONTENT",
    requestHash: "1".repeat(64),
    providerDiagnostics: {
      ...turn.calls[0]!.providerDiagnostics!,
      finishReason: "stop" as const,
      reasoningPresent: true,
      reasoningLength: 1_200,
      reasoningTokens: 320,
      contentType: "string" as const,
      contentLength: 0
    },
    parentCallId: null,
    retryTrigger: null,
    retryOrdinal: null,
    effectiveConfig: {
      branch: "high" as const,
      thinking: "enabled" as const,
      reasoningEffort: "high" as const,
      temperature: null,
      responseFormat: "json_object" as const,
      maxTokensPolicy: "provider_default" as const,
      timeoutMs: 30_000,
      recoveryInstructionVersion: null
    }
  };
  const recoveryCall = {
    ...initialCall,
    id: "high-empty-recovery-call",
    attempt: 2,
    kind: "automatic_retry" as const,
    status: status === "recovered" ? "valid" as const : "technical_failure" as const,
    errorCode: status === "recovered" ? null : "EMPTY_CONTENT",
    requestHash: "2".repeat(64),
    parentCallId: initialCall.id,
    retryTrigger: "EMPTY_CONTENT" as const,
    retryOrdinal: 1,
    effectiveConfig: {
      ...initialCall.effectiveConfig,
      recoveryInstructionVersion:
        "2026-08-09.gi088-empty-content-recovery-instruction-v1"
    }
  };

  high.messages = high.messages.slice(0, status === "recovered" ? 3 : 2);
  high.pendingTurnId = status === "recovered" ? null : turn.id;
  high.technicalError = status === "recovered" ? null : "EMPTY_CONTENT";
  turn.status = status === "recovered"
    ? "complete_after_auto_recovery"
    : "technical_failure";
  turn.visibleText = status === "recovered"
    ? "眼前拿到 offer 和长期方向都在影响你。我们先看看目前最卡住你的那一小块是什么？"
    : null;
  turn.calls = status === "eligible" ? [initialCall] : [initialCall, recoveryCall];
  turn.recovery = {
    status,
    trigger: "EMPTY_CONTENT",
    automaticRetryCount: status === "eligible" ? 0 : 1,
    initialCallId: initialCall.id,
    recoveryCallId: status === "eligible" ? null : recoveryCall.id,
    eligibleAt: "2026-08-09T00:00:00.000Z",
    startedAt: status === "eligible" ? null : "2026-08-09T00:00:01.000Z",
    completedAt: status === "eligible" ? null : "2026-08-09T00:00:02.000Z"
  };
  value.activeTask!.branches.high = high;
  return value;
}

function stageTransitionRecoverySession(
  branch: "off" | "high",
  status: "eligible" | "recovered" | "exhausted"
): Gi088EvaluationSession {
  const value = session(true);
  value.activeTask!.activeBranch = branch;
  if (branch === "high") {
    value.activeTask!.branches.off.status = "completed";
    value.activeTask!.branches.off.review = {
      feeling: "same",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "关闭组完成。"
    };
  }
  const target = trajectory(
    branch,
    status === "recovered" ? "running" : "protected_failure"
  );
  const turn = target.turns[0]!;
  const initialCall = {
    ...turn.calls[0]!,
    id: `${branch}-stage-transition-initial-call`,
    status: "protected_failure" as const,
    errorCode: "MODEL_OUTPUT_PROTECTED",
    requestHash: "3".repeat(64),
    parentCallId: null,
    retryTrigger: null,
    retryOrdinal: null,
    effectiveConfig: {
      branch,
      thinking: branch === "high" ? "enabled" as const : "disabled" as const,
      reasoningEffort: branch === "high" ? "high" as const : null,
      temperature: branch === "off" ? 0.2 : null,
      responseFormat: "json_object" as const,
      maxTokensPolicy: "provider_default" as const,
      timeoutMs: 30_000,
      recoveryInstructionVersion: null
    }
  };
  const recoveryCall = {
    ...initialCall,
    id: `${branch}-stage-transition-recovery-call`,
    attempt: 2,
    kind: "automatic_retry" as const,
    status: status === "recovered" ? "valid" as const : "protected_failure" as const,
    requestHash: "4".repeat(64),
    parentCallId: initialCall.id,
    retryTrigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE" as const,
    retryOrdinal: 1,
    effectiveConfig: {
      ...initialCall.effectiveConfig,
      recoveryInstructionVersion:
        "2026-08-09.gi088-stage-transition-recovery-instruction-v1"
    }
  };

  target.pendingTurnId = status === "eligible" ? turn.id : null;
  target.technicalError = null;
  turn.status = status === "recovered"
    ? "complete_after_auto_recovery"
    : "protected_failure";
  turn.validationIssues = ["NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"];
  turn.calls = status === "eligible" ? [initialCall] : [initialCall, recoveryCall];
  turn.recovery = {
    status,
    trigger: "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE",
    automaticRetryCount: status === "eligible" ? 0 : 1,
    initialCallId: initialCall.id,
    recoveryCallId: status === "eligible" ? null : recoveryCall.id,
    eligibleAt: "2026-08-09T00:00:00.000Z",
    startedAt: status === "eligible" ? null : "2026-08-09T00:00:01.000Z",
    completedAt: status === "eligible" ? null : "2026-08-09T00:00:02.000Z"
  };
  if (status === "recovered") {
    target.messages.push({
      id: `a2-${branch}`,
      role: "assistant",
      content: "我们已经进入更深一层，继续看你刚才打开的具体部分。"
    });
    turn.semantic = { stage: "deepen_integrate", action: "ask" };
    turn.visibleText = "我们已经进入更深一层，继续看你刚才打开的具体部分。";
  }
  value.activeTask!.branches[branch] = target;
  return value;
}

function response(payload: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

describe("Gi088EvaluationWorkbench", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("High-only 页面隐藏关闭模式并从 U1 直接开始 high", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(highOnlySession(false)))
      .mockResolvedValueOnce(response(highOnlySession(true)));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("持续聊下去，也能随时回看和纠正")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "运行关闭组 1 次" })).not.toBeInTheDocument();
    expect(screen.queryByText("Thinking 关闭 · 温度 0.2")).not.toBeInTheDocument();
    expect(screen.getByText("响应头 60 秒 · 正文空闲 60 秒 · 总时长 60 秒")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("按你平时来 Daily Light 的方式直接说就可以。"), {
      target: { value: "最近找工作和长期方向都让我有点乱。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始 Thinking high 评测" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = fetchMock.mock.calls[1]![1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      taskId: "task-1",
      action: "start_high",
      initialUserMessage: "最近找工作和长期方向都让我有点乱。"
    });
  });

  it("只把真实 U1 发给服务端，任务触发说明留在评测页面", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(session(false)))
      .mockResolvedValueOnce(response(session(true)));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("同一起点，两条真实聊天轨迹")).toBeInTheDocument();
    expect(screen.getByText(instruction)).toBeInTheDocument();
    expect(screen.getByText("“此刻你想聊点什么？”")).toBeInTheDocument();
    expect(screen.getByText("Thinking 关闭 · 温度 0.2")).toBeInTheDocument();
    expect(screen.getByText("Thinking 开启 · reasoning high · 温度 N/A")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "整批评测进度" })).toHaveAttribute("aria-valuenow", "0");

    fireEvent.change(screen.getByPlaceholderText("按你平时来 Daily Light 的方式直接说就可以。"), {
      target: { value: "最近找工作和长期方向都让我有点乱。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "冻结起点并开始关闭组" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await screen.findByText("眼前拿到 offer 和长期方向都在影响你。我们先看看目前最卡住你的那一小块是什么？");
    const request = fetchMock.mock.calls[1]![1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      taskId: "task-1",
      action: "start_off",
      initialUserMessage: "最近找工作和长期方向都让我有点乱。"
    });
    expect(JSON.stringify(body)).not.toContain(instruction);
    expect(JSON.stringify(body)).not.toContain(targetTriggerPrompt);
    expect(JSON.stringify(body)).not.toContain(criterion);
  });

  it("同屏展示配置、共同任务、当前探查和用户原话证据", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(session(true)));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("A0＋U1 已冻结")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Thinking 对照分支" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thinking 关闭" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Thinking 开启" })).toBeDisabled();
    expect(screen.getByText(/当前配置：Thinking 关闭 · 温度 0.2 · Reasoning 关闭/u)).toBeInTheDocument();
    expect(screen.getByText(/隐藏推理不会读取、保存或展示/u)).toBeInTheDocument();
    expect(screen.getByText("结构化 JSON · 应用不设 Token 上限 · 质量重试 0")).toBeInTheDocument();
    expect(screen.getByText("弄清眼前求职与长期方向怎样互相影响")).toBeInTheDocument();
    expect(screen.getByText("目前最卡住的一小块")).toBeInTheDocument();
    expect(screen.getByText(/u1-off · “找工作和长期方向都让我有点乱”/u)).toBeInTheDocument();
    expect(screen.getAllByText("deepseek-v4-flash")).toHaveLength(2);
    expect(screen.getByText("总 Token 418")).toBeInTheDocument();
    const diagnostics = screen.getByLabelText("供应商安全诊断摘要");
    expect(diagnostics).toHaveTextContent("stop");
    expect(diagnostics).toHaveTextContent("未产生 · missing · 0 字符");
    expect(diagnostics).toHaveTextContent("0 Token");
    expect(diagnostics).toHaveTextContent("响应头等待120 ms");
    expect(diagnostics).toHaveTextContent("正文读取712 ms");
    expect(diagnostics).toHaveTextContent("超时归因未触发 · 未触发");
    expect(diagnostics).toHaveTextContent("可见内容形态string · 42 字符");
    expect(diagnostics).toHaveTextContent("HTTP 200 · choices 1");
    expect(diagnostics).toHaveTextContent("request-off");
    expect(diagnostics).toHaveTextContent("832 ms");
    expect(screen.getByText("A1")).toBeInTheDocument();

    const taskList = screen.getByTestId("gi088-task-rail").querySelector("ol");
    expect(taskList).toHaveClass("space-y-1");
    expect(screen.getByTestId("gi088-dialogue-panel")).toHaveClass("min-h-[36rem]", "md:min-h-[42rem]", "xl:min-h-0");
  });

  it("任务导航可以只读打开已完成任务，不会改变下一项待开始状态", async () => {
    const boundary = highOnlySession(false);
    boundary.batch.completedTaskCount = 1;
    boundary.tasks[0]!.status = "completed";
    boundary.tasks[1]!.status = "ready";
    const history = highOnlySession(true);
    history.batch.completedTaskCount = 1;
    history.tasks[0]!.status = "completed";
    history.tasks[1]!.status = "ready";
    history.activeTask!.readOnly = true;
    history.activeTask!.branches.high.status = "completed";
    history.activeTask!.branches.high.review = {
      feeling: "better",
      quality: "direct_use",
      targetTrigger: "triggered",
      reason: "第一项完成。"
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(boundary))
      .mockResolvedValueOnce(response(history));

    render(<Gi088EvaluationWorkbench />);
    await screen.findByText("持续聊下去，也能随时回看和纠正");
    const completedButtons = screen.getAllByRole("button", {
      name: /task-1.*保留相关整体/u
    });
    fireEvent.click(completedButtons[0]!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "/api/preview/gi088/session?taskId=task-1"
    );
    expect(await screen.findByText("只读回看")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("直接回应 AI。⌘ Enter 发送"))
      .not.toBeInTheDocument();
  });

  it("规则失败后保留人工评价入口，且不会替产品负责人预选质量结论", async () => {
    const protectedSession = session(true);
    const protectedTrajectory = protectedSession.activeTask!.branches.off;
    protectedTrajectory.status = "protected_failure";
    protectedTrajectory.messages = protectedTrajectory.messages.slice(0, 2);
    protectedTrajectory.turns[0]!.status = "protected_failure";
    protectedTrajectory.turns[0]!.validationIssues = ["ASK_QUESTION_COUNT_INVALID:2"];
    protectedTrajectory.turns[0]!.calls[0]!.status = "protected_failure";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(protectedSession));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("本轮回应未通过规则检查")).toBeInTheDocument();
    expect(screen.getByText(/同时提出了 2 个问题/u)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("直接回应 AI。⌘ Enter 发送")).not.toBeInTheDocument();
    expect(screen.getByTestId("gi088-trajectory-controls")).toHaveClass("max-h-[48%]", "overflow-y-auto");

    fireEvent.click(screen.getByRole("button", { name: "评价当前分支并继续对照" }));

    const targetReference = await screen.findByLabelText(
      "当前任务目标判定参考",
      {},
      { timeout: 5_000 }
    );
    expect(targetReference).toHaveTextContent(targetTriggerPrompt);
    expect(targetReference).toHaveTextContent(criterion);
    expect(screen.getByText("评测人参考 · 仅页面可见")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "质量失败" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "可直接使用" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "已触发任务目标" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "未触发任务目标" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "技术失败阻断判断" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂不评价" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "封存Thinking 关闭分支" })).toBeDisabled();
  });

  it("空内容恢复仍失败后持久说明并停止自动调用", async () => {
    const eligible = highEmptyRecoverySession("eligible");
    const exhausted = highEmptyRecoverySession("exhausted");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(eligible))
      .mockResolvedValueOnce(response(exhausted));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("自动恢复仍未得到可见回答")).toBeInTheDocument();
    expect(screen.getByText(/最多三次 Thinking high 调用/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "手动重试这一轮" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束并评价当前技术失败" })).toBeInTheDocument();
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent("调用 1 · 首次调用");
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent("调用 2 · 自动恢复");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/retry");
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toEqual({
      taskId: "task-1",
      branch: "high",
      turnId: "turn-high",
      trigger: "automatic_empty_content"
    });
  });

  it("空内容恢复期间设置忙碌状态，成功后温和提示并永久保留调用血缘", async () => {
    const eligible = highEmptyRecoverySession("eligible");
    const recovered = highEmptyRecoverySession("recovered");
    let finishRecovery!: (value: Response) => void;
    const recoveryResponse = new Promise<Response>((resolve) => {
      finishRecovery = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(eligible))
      .mockReturnValueOnce(recoveryResponse);

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("正在恢复可见回答")).toBeInTheDocument();
    expect(await screen.findByTestId("gi088-recovery-toast")).toHaveAttribute("role", "status");
    await waitFor(() => expect(screen.getByTestId("gi088-conversation")).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByTestId("gi088-recovery-toast")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("gi088-recovery-toast")).toHaveTextContent("正在自动恢复");

    finishRecovery(response(recovered));

    expect(await screen.findByText(/已经自动恢复出可见回答/u)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("gi088-conversation")).toHaveAttribute("aria-busy", "false"));
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent("调用 1 · 首次调用");
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent("调用 2 · 自动恢复");
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent("EMPTY_CONTENT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["off", "high"] as const)(
    "%s 阶段转场纠正期间保持行内状态与忙碌标记，成功后温和提示",
    async (branch) => {
      const eligible = stageTransitionRecoverySession(branch, "eligible");
      const recovered = stageTransitionRecoverySession(branch, "recovered");
      let finishRecovery!: (value: Response) => void;
      const recoveryResponse = new Promise<Response>((resolve) => {
        finishRecovery = resolve;
      });
      const fetchMock = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(response(eligible))
        .mockReturnValueOnce(recoveryResponse);

      render(<Gi088EvaluationWorkbench />);

      expect(
        await screen.findByText("正在自动整理阶段转换")
      ).toBeInTheDocument();
      const toast = await screen.findByTestId("gi088-recovery-toast");
      expect(toast).toHaveAttribute("role", "status");
      expect(toast).toHaveAttribute("aria-live", "polite");
      expect(toast).toHaveTextContent(
        "刚才的回应没有顺利完成阶段转换，正在自动整理，请再等一会儿～"
      );
      await waitFor(() =>
        expect(screen.getByTestId("gi088-conversation")).toHaveAttribute(
          "aria-busy",
          "true"
        )
      );
      expect(
        screen.queryByRole("button", { name: "评价当前分支并继续对照" })
      ).not.toBeInTheDocument();

      finishRecovery(response(recovered));

      expect(
        await screen.findByText("已经完成阶段转换，可以继续聊了。")
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId("gi088-conversation")).toHaveAttribute(
          "aria-busy",
          "false"
        )
      );
      expect(screen.getByText(/阶段转场纠正：recovered/u)).toBeInTheDocument();
      expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent(
        "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/retry");
      expect(
        JSON.parse(
          String((fetchMock.mock.calls[1]![1] as RequestInit).body)
        )
      ).toEqual({
        taskId: "task-1",
        branch,
        turnId: `turn-${branch}`,
        trigger: "automatic_stage_transition"
      });
    }
  );

  it("High-only 多问句正常提交、逐轮人工分类且不产生恢复调用", async () => {
    const current = highOnlySession(true);
    const turn = current.activeTask!.branches.high.turns[0]!;
    turn.questionObservation = {
      questionMarkCount: 3,
      reviewCandidate: "multiple_question_marks",
      review: null
    };
    const reviewed = structuredClone(current);
    reviewed.activeTask!.branches.high.turns[0]!.questionObservation!.review = {
      classification: "same_focus_low_burden",
      note: "三个问句共同帮助回答同一种卡住感。",
      reviewedAt: "2026-08-09T12:00:00.000Z"
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(current))
      .mockResolvedValueOnce(response(reviewed));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("3 个问号 · 复合提问复核候选")).toBeInTheDocument();
    expect(screen.queryByTestId("gi088-recovery-toast")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束并评价" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "同一焦点，容易回答" }));
    fireEvent.change(screen.getByLabelText("复核说明（选填）"), {
      target: { value: "三个问句共同帮助回答同一种卡住感。" }
    });
    await waitFor(
      () => expect(screen.getByRole("button", { name: "保存本轮分类" })).toBeEnabled(),
      { timeout: 5_000 }
    );
    fireEvent.click(screen.getByRole("button", { name: "保存本轮分类" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), {
      timeout: 5_000
    });
    expect(
      await screen.findByText("已保存：同一焦点，容易回答", {}, { timeout: 5_000 })
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "/api/preview/gi088/question-review"
    );
    expect(
      JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))
    ).toEqual({
      taskId: "task-1",
      branch: "high",
      turnId: "turn-high",
      classification: "same_focus_low_burden",
      note: "三个问句共同帮助回答同一种卡住感。"
    });
    expect(screen.getByRole("button", { name: "结束并评价" })).toBeEnabled();
  });

  it("High-only 连接超时自动恢复时提供 Toast 与持久行内状态", async () => {
    const eligible = highEmptyRecoverySession("eligible");
    const recovered = highEmptyRecoverySession("recovered");
    for (const value of [eligible, recovered]) {
      value.evaluation.mode = "high_only";
      value.evaluation.activeBranches = ["high"];
      value.batch.targetCoverage.totalTrajectoryCount = 4;
      const turn = value.activeTask!.branches.high.turns[0]!;
      turn.recovery!.trigger = "TIMEOUT";
      turn.calls[0]!.errorCode = "TIMEOUT";
      turn.calls[0]!.providerDiagnostics = {
        ...turn.calls[0]!.providerDiagnostics!,
        timeoutStage: "body",
        abortSource: "deadline"
      };
      if (turn.calls[1]) turn.calls[1]!.retryTrigger = "TIMEOUT";
    }
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(eligible))
      .mockResolvedValueOnce(response(recovered));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText(/刚才连接超时，已经自动恢复/u)).toBeInTheDocument();
    expect(screen.getByText(/连接超时恢复：recovered/u)).toBeInTheDocument();
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toMatchObject({
      branch: "high",
      trigger: "automatic_timeout"
    });
  });

  it("阶段转场自动纠正最终失败后保留完整 Trace 并停止调用", async () => {
    const eligible = stageTransitionRecoverySession("off", "eligible");
    const exhausted = stageTransitionRecoverySession("off", "exhausted");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(eligible))
      .mockResolvedValueOnce(response(exhausted));

    render(<Gi088EvaluationWorkbench />);

    expect(
      await screen.findByText(/阶段转换在最终恢复后仍未完成/u)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("gi088-recovery-toast")).not.toBeInTheDocument();
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent(
      "调用 1 · 首次调用"
    );
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent(
      "调用 2 · 自动恢复"
    );
    expect(
      screen.getByRole("button", { name: "评价当前分支并继续对照" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("刷新直接读到已恢复结果时只展示永久 Trace，不重复弹出提示或调用模型", async () => {
    const recovered = highEmptyRecoverySession("recovered");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(recovered));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText(/可见回答恢复：recovered/u)).toBeInTheDocument();
    expect(screen.queryByTestId("gi088-recovery-toast")).not.toBeInTheDocument();
    expect(screen.getByLabelText("第 1 轮调用血缘")).toHaveTextContent("调用 2 · 自动恢复");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/preview/gi088/session");
  });

  it("历史 v7r1 Prefix 事件仍能保持 aria-busy 并显示持续状态", async () => {
    const initial = highOnlySession(true);
    const recovered = highEmptyRecoverySession("recovered");
    recovered.evaluation.mode = "high_only";
    recovered.evaluation.activeBranches = ["high"];
    recovered.tasks = recovered.tasks.slice(0, 2);
    recovered.batch.totalTasks = 2;
    const encoder = new TextEncoder();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "recovery_started",
          trigger: "EMPTY_CONTENT",
          turnId: "turn-high",
          callId: "prefix-call-v7r1"
        }) + "\n"));
      }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(new Response(stream, {
        status: 200,
        headers: { "content-type": "application/x-ndjson" }
      }));

    render(<Gi088EvaluationWorkbench />);
    const composer = await screen.findByPlaceholderText("直接回应 AI。⌘ Enter 发送");
    fireEvent.change(composer, { target: { value: "我想继续说说这个部分。" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "发送" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(
      () => expect(screen.getAllByText(/正在继续整理最终回答/u).length)
        .toBeGreaterThanOrEqual(2),
      { timeout: 5_000 }
    );
    expect(screen.getByTestId("gi088-conversation")).toHaveAttribute("aria-busy", "true");
    streamController.enqueue(encoder.encode(JSON.stringify({
      type: "session",
      session: recovered
    }) + "\n"));
    streamController.close();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("gi088-conversation"))
      .toHaveAttribute("aria-busy", "false"));
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/preview/gi088/session",
      "/api/preview/gi088/turn"
    ]);
  });

  it("恢复调用缺少授权时读取最新状态并停止重复申请", async () => {
    const eligible = highEmptyRecoverySession("eligible");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(eligible))
      .mockResolvedValueOnce(response({
        error: {
          code: "GI088_MODEL_CALL_AUTHORIZATION_REQUIRED",
          message: "当前候选指纹尚未获得模型调用授权。",
          retryable: false
        }
      }, false, 403))
      .mockResolvedValueOnce(response(eligible));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText(/当前候选指纹尚未获得模型调用授权/u)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/preview/gi088/session",
      "/api/preview/gi088/retry",
      "/api/preview/gi088/session"
    ]);
  });

  it("每次发送只调用一次 turn 接口，并保留用户草稿直到请求成功", async () => {
    const updated = session(true);
    updated.activeTask!.branches.off.messages.push(
      { id: "u2-off", role: "user", content: "我现在更担心作品集不够完整。" },
      { id: "a2-off", role: "assistant", content: "那我们先看看作品集缺的部分怎样影响你拿 offer。" }
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(session(true)))
      .mockResolvedValueOnce(response(updated));

    render(<Gi088EvaluationWorkbench />);
    const composer = await screen.findByPlaceholderText("直接回应 AI。⌘ Enter 发送");
    fireEvent.change(composer, { target: { value: "我现在更担心作品集不够完整。" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await screen.findByText("那我们先看看作品集缺的部分怎样影响你拿 offer。");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/turn");
    const body = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({ taskId: "task-1", branch: "off", content: "我现在更担心作品集不够完整。" });
    expect(JSON.stringify(body)).not.toContain(instruction);
  });

  it("接口失败时显示可恢复错误并继续保留真实输入", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(session(true)))
      .mockResolvedValueOnce(response({ error: { code: "GI088_PROVIDER_TIMEOUT", message: "模型请求超时。", retryable: true } }, false, 503));

    render(<Gi088EvaluationWorkbench />);
    const composer = await screen.findByPlaceholderText("直接回应 AI。⌘ Enter 发送");
    fireEvent.change(composer, { target: { value: "这段内容需要保留。" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText(/模型请求超时/u)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByDisplayValue("这段内容需要保留。")).toBeInTheDocument());
  });

  it("先封存关闭组，再从相同 A0＋U1 开启高 Thinking 独立分支", async () => {
    const offCompleted = session(true);
    offCompleted.tasks[0]!.status = "active";
    offCompleted.activeTask!.branches.off.status = "completed";
    offCompleted.activeTask!.branches.off.review = {
      feeling: "same",
      quality: "minor_issue",
      targetTrigger: "not_triggered",
      reason: "方向保留了，提问稍显笼统。"
    };

    const highStarted = structuredClone(offCompleted);
    highStarted.activeTask!.activeBranch = "high";
    highStarted.activeTask!.branches.high = trajectory("high", "running");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(session(true)))
      .mockResolvedValueOnce(response(offCompleted))
      .mockResolvedValueOnce(response(highStarted));

    render(<Gi088EvaluationWorkbench />);
    await screen.findByText("A0＋U1 已冻结");
    fireEvent.click(screen.getByRole("button", { name: "结束并评价" }));
    fireEvent.click(screen.getByRole("button", { name: "感觉差不多" }));
    fireEvent.click(screen.getByRole("button", { name: "轻微问题" }));
    fireEvent.click(screen.getByRole("button", { name: "未触发任务目标" }));
    fireEvent.change(screen.getByPlaceholderText("记录真正影响你判断的回应、追问或收束。"), {
      target: { value: "方向保留了，提问稍显笼统。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "封存Thinking 关闭分支" }));

    expect(await screen.findByRole("button", { name: "切换并开始 Thinking 开启组" })).toBeInTheDocument();
    const endBody = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body)) as Record<string, unknown>;
    expect(endBody).toMatchObject({
      taskId: "task-1",
      branch: "off",
      feeling: "same",
      quality: "minor_issue",
      targetTrigger: "not_triggered",
      reason: "方向保留了，提问稍显笼统。"
    });

    fireEvent.click(screen.getByRole("button", { name: "切换并开始 Thinking 开启组" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Thinking 开启" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("最近找工作和长期方向都让我有点乱。")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2]![0]).toBe("/api/preview/gi088/start-task");
    const startHighBody = JSON.parse(String((fetchMock.mock.calls[2]![1] as RequestInit).body)) as Record<string, unknown>;
    expect(startHighBody).toEqual({ taskId: "task-1", action: "start_high" });
  });

  it("服务端已接收但客户端丢失响应时，手动重试复用同一 clientTurnId", async () => {
    let confirmedId = "";
    const confirmed = session(true);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(session(true)))
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockImplementationOnce(async (_path, init) => {
        const body = JSON.parse(String(init?.body)) as { clientTurnId: string; content: string };
        confirmedId = body.clientTurnId;
        confirmed.activeTask!.branches.off.turns.push({
          id: "turn-recovered",
          clientTurnId: body.clientTurnId,
          userMessageId: "u2-off",
          status: "valid",
          semantic: null,
          visibleText: "我接着和你聊。",
          evidenceExcerpts: [{ id: "u2-off", content: body.content }],
          calls: []
        });
        return response(confirmed);
      });

    render(<Gi088EvaluationWorkbench />);
    const composer = await screen.findByPlaceholderText("直接回应 AI。⌘ Enter 发送");
    fireEvent.change(composer, { target: { value: "这条消息服务端其实已经收到了。" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "发送" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(
      await screen.findByText(/评测工作台暂时无法连接/u, {}, { timeout: 5_000 })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "发送" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(window.sessionStorage.getItem(GI088_OUTBOX_STORAGE_KEY)).toBeNull());
    const firstBody = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body)) as { clientTurnId: string };
    const retryBody = JSON.parse(String((fetchMock.mock.calls[2]![1] as RequestInit).body)) as { clientTurnId: string };
    expect(firstBody.clientTurnId).toBe(retryBody.clientTurnId);
    expect(retryBody.clientTurnId).toBe(confirmedId);
  });

  it("初始 U1 响应丢失后重试仍复用同一 clientTurnId", async () => {
    const confirmed = session(true);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(session(false)))
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockImplementationOnce(async (_path, init) => {
        const body = JSON.parse(String(init?.body)) as { clientTurnId: string };
        confirmed.activeTask!.branches.off.turns[0]!.clientTurnId = body.clientTurnId;
        return response(confirmed);
      });

    render(<Gi088EvaluationWorkbench />);
    const input = await screen.findByPlaceholderText("按你平时来 Daily Light 的方式直接说就可以。");
    fireEvent.change(input, { target: { value: "我想聊聊最近一直拖着没决定的事情。" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "冻结起点并开始关闭组" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "冻结起点并开始关闭组" }));

    expect(
      await screen.findByText(/评测工作台暂时无法连接/u, {}, { timeout: 5_000 })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "冻结起点并开始关闭组" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "冻结起点并开始关闭组" }));
    await screen.findByText("A0＋U1 已冻结");

    const firstBody = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body)) as { clientTurnId: string };
    const retryBody = JSON.parse(String((fetchMock.mock.calls[2]![1] as RequestInit).body)) as { clientTurnId: string };
    expect(firstBody.clientTurnId).toBe(retryBody.clientTurnId);
    expect(window.sessionStorage.getItem(GI088_OUTBOX_STORAGE_KEY)).toBeNull();
  });

  it("刷新只恢复 outbox 草稿，不自动重新发送模型请求", async () => {
    const pending = prepareGi088Outbox({
      kind: "turn",
      batchId: "batch-1",
      taskId: "task-1",
      branch: "off",
      content: "刷新后仍要保留的真实输入。"
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(session(true)));

    const first = render(<Gi088EvaluationWorkbench />);
    expect(await screen.findByDisplayValue("刷新后仍要保留的真实输入。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    first.unmount();

    render(<Gi088EvaluationWorkbench />);
    expect(await screen.findByDisplayValue("刷新后仍要保留的真实输入。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([path]) => path === "/api/preview/gi088/session")).toBe(true);
    expect(readGi088Outbox()?.clientTurnId).toBe(pending.clientTurnId);
  });

  it("刷新读取到服务端已确认的 clientTurnId 时清理 outbox，避免重复显示草稿", async () => {
    const accepted = prepareGi088Outbox({
      kind: "turn",
      batchId: "batch-1",
      taskId: "task-1",
      branch: "off",
      content: "服务端已经确认的输入。"
    });
    const confirmed = session(true);
    confirmed.activeTask!.branches.off.turns[0]!.clientTurnId = accepted.clientTurnId;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(confirmed));

    render(<Gi088EvaluationWorkbench />);

    await screen.findByText("A0＋U1 已冻结");
    expect(window.sessionStorage.getItem(GI088_OUTBOX_STORAGE_KEY)).toBeNull();
    expect(screen.getByPlaceholderText("直接回应 AI。⌘ Enter 发送")).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("任务边界可填写原因提前结束，剩余任务进入未执行且可部分导出", async () => {
    const boundary = session(false);
    boundary.batch.completedTaskCount = 1;
    boundary.batch.targetCoverage = {
      triggeredTrajectoryCount: 1,
      reviewedTrajectoryCount: 2,
      totalTrajectoryCount: 24
    };
    boundary.tasks[0]!.status = "completed";
    boundary.tasks[0]!.targetTriggers = { off: "not_triggered", high: "triggered" };
    boundary.tasks[1]!.status = "ready";

    const stopped = structuredClone(boundary);
    stopped.batch.status = "early_stopped";
    stopped.batch.sealedAt = "2026-08-09T12:00:00.000Z";
    stopped.batch.earlyStop = {
      reasonCode: "mixed",
      reason: "证据已经充分，同时技术失败影响了访谈体验。",
      stoppedAt: "2026-08-09T12:00:00.000Z",
      completedTaskIds: ["task-1"],
      remainingTaskIds: stopped.tasks.slice(1).map((task) => task.id)
    };
    stopped.tasks.slice(1).forEach((task) => {
      task.status = "not_run";
    });

    const createObjectUrl = vi.fn(() => "blob:gi088-export");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(boundary))
      .mockResolvedValueOnce(response(stopped))
      .mockResolvedValueOnce(response({
        exportVersion: "2026-08-09.gi088-readonly-export-v0.5",
        completedTaskIds: ["task-1"]
      }));

    render(<Gi088EvaluationWorkbench />);
    await screen.findByText("同一起点，两条真实聊天轨迹");
    const earlyStopToggle = screen.getByRole("button", { name: "提前结束本批" });
    expect(earlyStopToggle).toHaveAttribute("aria-expanded", "false");
    expect(earlyStopToggle).toHaveAttribute("aria-controls", "gi088-early-stop-form");
    fireEvent.click(earlyStopToggle);

    expect(screen.getByRole("button", { name: "收起提前结束" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "具体说明（必填）" })).toBeRequired();
    expect(screen.getByRole("button", { name: "证据充分且技术问题明显" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "确认提前结束" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "继续评测" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "提前结束本批" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "提前结束本批" }));
    fireEvent.click(screen.getByRole("button", { name: "证据充分且技术问题明显" }));
    fireEvent.change(screen.getByRole("textbox", { name: "具体说明（必填）" }), {
      target: { value: "证据已经充分，同时技术失败影响了访谈体验。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提前结束" }));

    expect(await screen.findByText("这一批已经提前结束")).toBeInTheDocument();
    expect(screen.getByText(/其余任务标记为未执行/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再次下载完整 JSON" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2]![0]).toBe("/api/preview/gi088/export");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:gi088-export");
    expect(screen.getAllByText("未执行")).toHaveLength(11);
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/early-stop");
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toEqual({
      reasonCode: "mixed",
      reason: "证据已经充分，同时技术失败影响了访谈体验。",
      confirmation: true
    });
  });

  it("用户明确修改失败内容后，下一次发送生成新的 clientTurnId", () => {
    const first = prepareGi088Outbox({
      kind: "turn",
      batchId: "batch-1",
      taskId: "task-1",
      branch: "off",
      content: "原内容"
    });
    invalidateGi088OutboxOnContentChange({
      batchId: "batch-1",
      taskId: "task-1",
      branch: "off",
      content: "修改后的内容"
    });
    const second = prepareGi088Outbox({
      kind: "turn",
      batchId: "batch-1",
      taskId: "task-1",
      branch: "off",
      content: "修改后的内容"
    });

    expect(second.clientTurnId).not.toBe(first.clientTurnId);
  });

  it("技术冒烟只调用独立接口，不创建或推进正式评测任务", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(session(false)))
      .mockResolvedValueOnce(response({
        smoke: {
          id: "smoke-off-1",
          executionFingerprint: "b".repeat(64),
          arm: "off",
          status: "valid",
          rawFinalOutput: "{}",
          semantic: null,
          visible: { response: "技术链路正常。" },
          validationIssues: [],
          latencyMs: 320,
          tokenUsage: { totalTokens: 100 },
          providerDiagnostics: {
            finishReason: "length",
            reasoningPresent: true,
            reasoningLength: 1_536,
            reasoningTokens: 64,
            latencyMs: 320,
            tokenUsage: { totalTokens: 100 },
            reasoningType: "string",
            totalLatencyMs: 320
          },
          reasoning_content: "这段隐藏推理正文严禁出现在页面中。",
          errorCode: null,
          completedAt: "2026-08-08T00:00:00.320Z"
        }
      }));

    render(<Gi088EvaluationWorkbench />);

    expect(await screen.findByText("同一起点，两条真实聊天轨迹")).toBeInTheDocument();
    fireEvent.click(screen.getByText("技术冒烟 · 仅在单独授权后运行"));
    fireEvent.click(screen.getByRole("button", { name: "运行关闭组 1 次" }));

    expect(await screen.findByText("技术链路正常。")).toBeInTheDocument();
    const diagnostics = screen.getByLabelText("供应商安全诊断摘要");
    expect(diagnostics).toHaveTextContent("length");
    expect(diagnostics).toHaveTextContent("已产生 · string · 1,536 字符");
    expect(diagnostics).toHaveTextContent("64 Token");
    expect(diagnostics).toHaveTextContent("320 ms");
    expect(screen.getByText("仅展示可核查的计数与状态，隐藏推理正文保持隔离。")).toBeInTheDocument();
    expect(screen.queryByText("这段隐藏推理正文严禁出现在页面中。")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/preview/gi088/smoke");
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toEqual({
      arm: "off",
      confirmation: true
    });
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/preview/gi088/start-task")).toBe(false);
  });
});
