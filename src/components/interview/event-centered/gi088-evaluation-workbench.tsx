"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionButton, Card, ConfirmDialog, Divider, SectionHeading, Surface } from "@/components/ui";
import {
  GI088_EVALUATION_VERSION,
  Gi088EvaluationRequestError,
  abortGi088CurrentTask,
  compareGi088Trajectories,
  createGi088ClientOperationId,
  createGi088EvaluationRun,
  downloadGi088EvaluationExport,
  earlyStopGi088EvaluationBatch,
  endGi088Trajectory,
  getGi088EvaluationRuns,
  getGi088EvaluationSession,
  reportGi088OperationEvent,
  reviewGi088Question,
  reviewGi088ProgramIntervention,
  retryGi088Turn,
  runGi088TechnicalSmoke,
  sealGi088EvaluationBatch,
  startGi088HighTrajectory,
  startGi088OffTrajectory,
  submitGi088Turn,
  type Gi088BranchKey,
  type Gi088CallMetadata,
  type Gi088Comparison,
  type Gi088EvaluationIssue,
  type Gi088EvaluationSession,
  type Gi088EarlyStopReasonCode,
  type Gi088Feeling,
  type Gi088GenerationProgress,
  type Gi088IssueAction,
  type Gi088Preference,
  type Gi088ProgramIntervention,
  type Gi088ProgramInterventionReviewOutcome,
  type Gi088ProviderDiagnostics,
  type Gi088QuestionPresence,
  type Gi088QuestionReviewClassification,
  type Gi088Quality,
  type Gi088Semantic,
  type Gi088TaskStatus,
  type Gi088TargetTrigger,
  type Gi088TechnicalSmoke,
  type Gi088Trajectory,
  type Gi088TrajectoryReview,
  type Gi088RunSummary
} from "@/features/interview/event-centered/gi088-evaluation-client";
import {
  Gi088EvaluationStorageError,
  clearGi088EvaluationDraft,
  clearGi088EvaluationDraftsForRun,
  clearGi088EvaluationOutbox,
  clearGi088EvaluationOutboxesForRun,
  createGi088EvaluationContentHash,
  listGi088EvaluationOutboxEntries,
  prepareGi088EvaluationOutbox,
  readGi088EvaluationDraft,
  writeGi088EvaluationDraft,
  type Gi088EvaluationDraftScope,
  type Gi088EvaluationOutboxEntry
} from "@/features/interview/event-centered/gi088-evaluation-storage";
import { createGi088EvaluationSync } from "@/features/interview/event-centered/gi088-evaluation-sync";
import { cn } from "@/lib/utils";

const taskStatusLabel: Record<Gi088TaskStatus, string> = {
  ready: "待开始",
  locked: "等待前项",
  active: "进行中",
  completed: "已完成",
  aborted: "已终止",
  not_run: "未执行"
};

const branchLabel: Record<Gi088BranchKey, string> = {
  off: "Thinking 关闭",
  high: "Thinking 开启"
};

const feelingOptions = [
  ["better", "感觉变好"],
  ["same", "感觉差不多"],
  ["worse", "感觉变差"]
] as const satisfies readonly (readonly [Gi088Feeling, string])[];

const qualityOptions = [
  ["direct_use", "可直接使用"],
  ["minor_issue", "轻微问题"],
  ["quality_failure", "质量失败"],
  ["single_case_blocker", "单例阻断"]
] as const satisfies readonly (readonly [Gi088Quality, string])[];

const preferenceOptions = [
  ["off_better", "关闭更好"],
  ["high_better", "开启更好"],
  ["equivalent", "两者相当"]
] as const satisfies readonly (readonly [Gi088Preference, string])[];

const targetTriggerOptions = [
  ["triggered", "已触发任务目标"],
  ["not_triggered", "未触发任务目标"],
  ["blocked_by_technical_failure", "技术失败阻断判断"]
] as const satisfies readonly (
  readonly [Exclude<Gi088TargetTrigger, "legacy_unknown">, string]
)[];

const earlyStopReasonOptions = [
  ["sufficient_evidence", "证据已经充分"],
  ["technical_friction", "技术问题影响评测"],
  ["mixed", "证据充分且技术问题明显"],
  ["other", "其他原因"]
] as const satisfies readonly (readonly [Gi088EarlyStopReasonCode, string])[];

const questionReviewOptions = [
  ["same_focus_low_burden", "同一焦点，容易回答"],
  ["same_focus_heavy", "同一焦点，但表达偏重"],
  ["multiple_independent_tasks", "包含多个独立回答任务"],
  ["uncertain", "暂时无法判断"]
] as const satisfies readonly (
  readonly [Gi088QuestionReviewClassification, string]
)[];

const questionPresenceOptions = [
  ["present", "包含提问"],
  ["absent", "没有提问"],
  ["uncertain", "暂时无法判断"]
] as const satisfies readonly (readonly [Gi088QuestionPresence, string])[];

const interventionReviewOptions = [
  ["correct", "程序介入正确"],
  ["false_positive", "程序误接管"],
  ["uncertain", "暂时无法判断"]
] as const satisfies readonly (
  readonly [Gi088ProgramInterventionReviewOutcome, string]
)[];

const questionReviewCandidateLabel = {
  none: "常规逐轮复核",
  zero_question_mark: "零问号抽检候选",
  multiple_question_marks: "复合提问复核候选"
} as const;

const targetTriggerLabel: Record<Gi088TargetTrigger, string> = {
  triggered: "已触发任务目标",
  not_triggered: "未触发任务目标",
  blocked_by_technical_failure: "技术失败阻断判断",
  legacy_unknown: "历史评价未记录"
};

const GI088_RECOVERY_TOAST_STORAGE_KEY =
  "daily-light:gi088:auto-recovery-toast:v2";

type PendingOperation = {
  taskId: string;
  branch: Gi088BranchKey;
  kind:
    | "generation"
    | "automatic_empty_content_recovery"
    | "automatic_timeout_recovery"
    | "automatic_stage_transition_recovery"
    | "manual_recovery";
  startedAt: number;
};

type RecoveryToastState = {
  callId: string;
  message: string;
} | null;

function rememberRecoveryToast(callId: string) {
  try {
    window.sessionStorage.setItem(GI088_RECOVERY_TOAST_STORAGE_KEY, callId);
  } catch {
    return;
  }
}

function hasShownRecoveryToast(callId: string) {
  try {
    return window.sessionStorage.getItem(GI088_RECOVERY_TOAST_STORAGE_KEY) === callId;
  } catch {
    return false;
  }
}

function RecoveryToast({ toast }: { toast: RecoveryToastState }) {
  if (!toast) return null;
  return (
    <div
      className="fixed left-1/2 top-[calc(var(--site-header-viewport-offset)+1rem)] z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-paper px-4 py-3 text-sm text-ink shadow-lg motion-reduce:transition-none"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="gi088-recovery-toast"
    >
      {toast.message}
    </div>
  );
}

function PendingGenerationStatus({
  operation
}: {
  operation: PendingOperation;
}) {
  const [takingLonger, setTakingLonger] = useState(false);

  useEffect(() => {
    const elapsed = Date.now() - operation.startedAt;
    const timer = window.setTimeout(
      () => setTakingLonger(true),
      Math.max(0, 10_000 - elapsed)
    );
    return () => window.clearTimeout(timer);
  }, [operation.startedAt]);

  const message =
    operation.kind === "manual_recovery"
      ? "正在按你的确认再次生成；这次结束后不会继续调用。"
    : operation.kind === "automatic_empty_content_recovery"
      ? "刚才只完成了思考，正在继续整理最终回答，请再等一会儿～"
      : operation.kind === "automatic_timeout_recovery"
        ? "这次连接超时，正在自动重试，请再等一会儿～"
      : operation.kind === "automatic_stage_transition_recovery"
        ? "刚才的回应没有顺利完成阶段转换，正在自动整理，请再等一会儿～"
      : takingLonger
          ? operation.branch === "high"
            ? "这次用时较长，系统仍在等待 Thinking high 的可见回答；单次生成最多 60 秒，自动恢复链总计不超过 90 秒。"
            : "这次用时较长，系统仍在等待回应。"
          : operation.branch === "high"
            ? "本页已保留这段原话，正在生成 Thinking high 回应…"
            : "本页已保留这段原话，正在生成回应…";

  return (
    <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]" role="status" aria-live="polite">
      <span className="size-2 rounded-full bg-[var(--amber)]" aria-hidden="true" />
      {message}
    </div>
  );
}

function statusTone(status: Gi088TaskStatus) {
  if (status === "completed") return "bg-[var(--moss-soft)] text-ink/80";
  if (status === "ready" || status === "locked" || status === "not_run") return "bg-paper/45 text-[var(--text-faint)]";
  return "bg-[var(--amber-soft)] text-ink/80";
}

function compactFingerprint(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

function displayStage(stage: Gi088Semantic["stage"]) {
  if (stage === "engage_focus") return "共同聚焦";
  if (stage === "explore_clarify") return "探索澄清";
  if (stage === "deepen_integrate") return "深入整合";
  return "待判断";
}

function displayAction(action: Gi088Semantic["action"]) {
  if (action === "acknowledge") return "承接";
  if (action === "ask") return "提问";
  if (action === "synthesize") return "形成认识";
  if (action === "pause") return "暂停";
  return "待生成";
}

function displayDiagnosticValue(value: number | null | undefined, unit: string) {
  return value === null || value === undefined
    ? "未返回"
    : `${value.toLocaleString("zh-CN")} ${unit}`;
}

function displayTimeoutStage(
  value: Gi088ProviderDiagnostics["timeoutStage"]
) {
  if (value === "headers") return "等待响应头";
  if (value === "body") return "读取正文空闲";
  if (value === "hard_total") return "总时长上限";
  return "未触发";
}

function displayAbortSource(value: Gi088ProviderDiagnostics["abortSource"]) {
  if (value === "deadline") return "服务端截止";
  if (value === "caller") return "调用方取消";
  return "未触发";
}

function callKindLabel(kind: Gi088CallMetadata["kind"]) {
  if (kind === "automatic_retry") return "自动恢复";
  if (kind === "manual_retry") return "人工重试";
  if (kind === "initial") return "首次调用";
  return "继续对话";
}

function recoveryTriggerLabel(
  trigger:
    | "EMPTY_CONTENT"
    | "TIMEOUT"
    | "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
    | "ASK_QUESTION_COUNT_INVALID:2"
    | "UNAUTHORIZED_PAUSE"
) {
  if (trigger === "UNAUTHORIZED_PAUSE") return "未经授权暂停纠正";
  if (trigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE") return "阶段转场纠正";
  if (trigger === "ASK_QUESTION_COUNT_INVALID:2") return "单一问题纠正";
  if (trigger === "TIMEOUT") return "连接超时恢复";
  return "可见回答恢复";
}

function CallTrace({
  call,
  index
}: {
  call: Gi088CallMetadata;
  index: number;
}) {
  return (
    <div className="border-l border-[var(--line-strong)] pl-3" data-call-id={call.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink/85">
          调用 {index + 1} · {callKindLabel(call.kind)}
        </p>
        <span className="font-mono text-[var(--text-faint)]">{call.status}</span>
      </div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-[var(--text-faint)]">
        <dt>配置</dt>
        <dd className="text-ink/80">
          {call.effectiveConfig
            ? `${call.effectiveConfig.branch} · Thinking ${call.effectiveConfig.thinking} · ${call.effectiveConfig.responseFormat}`
            : "沿用当前分支配置"}
        </dd>
        <dt>请求指纹</dt>
        <dd className="break-all font-mono text-ink/80" title={call.requestHash}>
          {call.requestHash ? compactFingerprint(call.requestHash) : "未返回"}
        </dd>
        {call.parentCallId ? (
          <>
            <dt>恢复血缘</dt>
            <dd className="break-all font-mono text-ink/80">
              {compactFingerprint(call.parentCallId)} · {call.retryTrigger} · 第 {call.retryOrdinal} 次
            </dd>
          </>
        ) : null}
        {call.effectiveConfig?.sharedDeadlineMs ? (
          <>
            <dt>自动链时间</dt>
            <dd className="text-ink/80">
              总计 {Math.round(call.effectiveConfig.sharedDeadlineMs / 1_000)} 秒
              {typeof call.effectiveConfig.remainingSharedDeadlineMs === "number"
                ? ` · 本次开始时剩余 ${Math.ceil(call.effectiveConfig.remainingSharedDeadlineMs / 1_000)} 秒`
                : ""}
            </dd>
          </>
        ) : null}
        {call.errorCode ? (
          <>
            <dt>错误</dt>
            <dd className="font-mono text-clay">{call.errorCode}</dd>
          </>
        ) : null}
      </dl>
      <div className="mt-2 flex flex-wrap gap-x-3 text-xs tabular-nums text-[var(--text-faint)]">
        <span>总 Token {call.tokenUsage?.totalTokens ?? "—"}</span>
        <span>耗时 {call.latencyMs ?? "—"} ms</span>
      </div>
      <ProviderDiagnosticsSummary
        diagnostics={call.providerDiagnostics}
        fallbackLatencyMs={call.latencyMs}
      />
    </div>
  );
}

function ProviderDiagnosticsSummary({
  diagnostics,
  fallbackLatencyMs
}: {
  diagnostics?: Gi088ProviderDiagnostics | null;
  fallbackLatencyMs?: number | null;
}) {
  const reasoningStatus = diagnostics?.reasoningPresent === true
    ? "已产生"
    : diagnostics?.reasoningPresent === false
      ? "未产生"
      : "未返回";

  return (
    <dl
      aria-label="供应商安全诊断摘要"
      className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs tabular-nums sm:grid-cols-4"
    >
      <div>
        <dt className="text-[var(--text-faint)]">结束原因</dt>
        <dd className="mt-0.5 font-mono text-ink/85">{diagnostics?.finishReason ?? "未返回"}</dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">推理状态</dt>
        <dd className="mt-0.5 text-ink/85">
          {reasoningStatus} · {diagnostics?.reasoningType ?? "未返回"} · {displayDiagnosticValue(diagnostics?.reasoningLength, "字符")}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">推理 Token</dt>
        <dd className="mt-0.5 text-ink/85">
          {displayDiagnosticValue(diagnostics?.reasoningTokens, "Token")}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">响应头等待</dt>
        <dd className="mt-0.5 text-ink/85">
          {displayDiagnosticValue(diagnostics?.headersLatencyMs, "ms")}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">正文读取</dt>
        <dd className="mt-0.5 text-ink/85">
          {displayDiagnosticValue(diagnostics?.bodyLatencyMs, "ms")}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">总时长</dt>
        <dd className="mt-0.5 text-ink/85">
          {displayDiagnosticValue(diagnostics?.totalLatencyMs ?? diagnostics?.latencyMs ?? fallbackLatencyMs, "ms")}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">超时归因</dt>
        <dd className="mt-0.5 text-ink/85">
          {displayTimeoutStage(diagnostics?.timeoutStage)} · {displayAbortSource(diagnostics?.abortSource)}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">可见内容形态</dt>
        <dd className="mt-0.5 text-ink/85">
          {diagnostics?.contentType ?? "未返回"} · {displayDiagnosticValue(diagnostics?.contentLength, "字符")}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">响应摘要</dt>
        <dd className="mt-0.5 text-ink/85">
          HTTP {diagnostics?.httpStatus ?? "—"} · choices {diagnostics?.choiceCount ?? "—"}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--text-faint)]">响应模型</dt>
        <dd className="mt-0.5 break-all font-mono text-ink/85">
          {diagnostics?.responseModel ?? "未返回"}
        </dd>
      </div>
    </dl>
  );
}

function messageSequenceLabel(messages: Gi088Trajectory["messages"], index: number) {
  const message = messages[index]!;
  const roleIndex = messages.slice(0, index + 1).filter((item) => item.role === message.role).length;
  if (message.role === "user") return `U${roleIndex}`;
  return roleIndex === 1 ? "A0 · 固定开场" : `A${roleIndex - 1}`;
}

function issueFromUnknown(error: unknown): Gi088EvaluationIssue {
  if (error instanceof Gi088EvaluationRequestError) return error.issue;
  if (error instanceof Gi088EvaluationStorageError) {
    return {
      code: error.code,
      message: error.code === "GI088_OUTBOX_UNAVAILABLE"
        ? "浏览器暂时无法安全保存待发送内容。请允许会话存储后重试。"
        : "待发送内容暂时无法写入。请释放浏览器存储空间后重试。",
      retryable: false,
      dataSaved: "no",
      impact: "request",
      action: "reconfirm_submission"
    };
  }
  return {
    code: "GI088_CLIENT_UNEXPECTED",
    message: "工作台遇到意外问题。当前内容仍在服务端保存，请刷新后继续。",
    retryable: true,
    dataSaved: "unknown",
    impact: "request",
    action: "read_latest_state"
  };
}

function runIdOf(session: Gi088EvaluationSession) {
  return session.batch.runId ?? session.batch.id;
}

function isWritableCurrentRun(run: Gi088RunSummary) {
  return run.evaluationVersion === GI088_EVALUATION_VERSION &&
    run.status === "running" &&
    !run.readOnly;
}

function mergeRunSummaries(
  current: Gi088RunSummary[],
  incoming: Gi088RunSummary[]
) {
  const byId = new Map(current.map((run) => [run.runId, run]));
  incoming.forEach((run) => byId.set(run.runId, run));
  return [...byId.values()].sort((left, right) =>
    right.runOrdinal - left.runOrdinal
  );
}

function draftScope(input: Omit<Gi088EvaluationDraftScope, "runId"> & {
  runId: string;
}) {
  return input;
}

function lastAssistantMessageId(trajectory: Gi088Trajectory | null) {
  if (!trajectory) return null;
  return trajectory.dialogueAnchor?.lastAssistantMessageId ??
    [...trajectory.messages].reverse().find((message) =>
      message.role === "assistant"
    )?.id ??
    null;
}

function turnHasActiveServerWork(
  turn: Gi088Trajectory["turns"][number]
) {
  return turn.status === "processing" ||
    turn.recovery?.status === "eligible" ||
    turn.recovery?.status === "retrying" ||
    turn.recovery?.status === "manual_retrying";
}

function sessionHasActiveServerWork(session: Gi088EvaluationSession) {
  return Boolean(session.activeTask && Object.values(
    session.activeTask.branches
  ).some((branch) => branch.turns.some(turnHasActiveServerWork)));
}

function sessionConfirmsOutbox(
  session: Gi088EvaluationSession,
  entry: Gi088EvaluationOutboxEntry
) {
  if (runIdOf(session) !== entry.runId) return false;
  const activeTask = session.activeTask;
  if (!activeTask || activeTask.taskId !== entry.taskId) return false;
  return activeTask.branches[entry.branch].turns.some(
    (turn) => turn.clientTurnId === entry.clientTurnId
  );
}

function clearConfirmedOutboxes(session: Gi088EvaluationSession) {
  for (const entry of listGi088EvaluationOutboxEntries()) {
    if (!sessionConfirmsOutbox(session, entry)) continue;
    try {
      clearGi088EvaluationOutbox(entry);
    } catch {
      continue;
    }
  }
}

function clearRunLocalState(runId: string) {
  clearGi088EvaluationDraftsForRun(runId);
  try {
    clearGi088EvaluationOutboxesForRun(runId);
  } catch {
    return;
  }
}

function TechnicalSmokePanel({
  executionFingerprint,
  highOnly = false
}: {
  executionFingerprint: string;
  highOnly?: boolean;
}) {
  const [runningArm, setRunningArm] = useState<Gi088BranchKey | null>(null);
  const [result, setResult] = useState<Gi088TechnicalSmoke | null>(null);
  const [issue, setIssue] = useState<Gi088EvaluationIssue | null>(null);

  const run = async (arm: Gi088BranchKey) => {
    setRunningArm(arm);
    setIssue(null);
    try {
      setResult(await runGi088TechnicalSmoke(arm));
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setRunningArm(null);
    }
  };

  return (
    <details className="mt-4 border-l-2 border-[var(--amber)] pl-4 text-sm" data-testid="gi088-technical-smoke-panel">
      <summary className="cursor-pointer font-semibold text-ink">技术冒烟 · 仅在单独授权后运行</summary>
      <p className="mt-2 max-w-3xl text-pretty leading-6 text-[var(--text-dim)]">
        {highOnly
          ? "按钮验证 High 配置的部署凭据、结构和持久化。服务器会核对当前执行指纹与授权；结果进入独立冒烟记录，不写入当前正式批次。"
          : "两个按钮分别验证部署凭据、结构和持久化。服务器会核对当前执行指纹与逐臂授权；结果进入独立冒烟记录，不写入当前正式批次。"}
      </p>
      <p className="mt-2 break-all font-mono text-xs text-[var(--text-faint)]">{executionFingerprint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!highOnly ? (
          <ActionButton type="button" variant="secondary" disabled={runningArm !== null} onClick={() => void run("off")}>
            {runningArm === "off" ? "正在运行关闭组…" : "运行关闭组 1 次"}
          </ActionButton>
        ) : null}
        <ActionButton type="button" variant="secondary" disabled={runningArm !== null} onClick={() => void run("high")}>
          {runningArm === "high" ? "正在运行 high…" : "运行 high 1 次"}
        </ActionButton>
      </div>
      {issue ? <div className="mt-3"><InlineIssue issue={issue} /></div> : null}
      {result ? (
        <div className="mt-3 border-l border-[var(--line-strong)] pl-3 text-xs leading-6 text-[var(--text-dim)]" role="status">
          <p className="font-semibold text-ink">{branchLabel[result.arm]} · {result.status}</p>
          <p>总 Token {result.tokenUsage?.totalTokens ?? "未返回"}</p>
          <ProviderDiagnosticsSummary
            diagnostics={result.providerDiagnostics}
            fallbackLatencyMs={result.latencyMs}
          />
          <p className="mt-2 text-[var(--text-faint)]">仅展示可核查的计数与状态，隐藏推理正文保持隔离。</p>
          {result.visible?.response ? <p className="mt-1 whitespace-pre-wrap text-ink/85">{result.visible.response}</p> : null}
          {result.errorCode ? <p className="mt-1 font-mono">{result.errorCode}</p> : null}
          {result.validationIssues.length ? <p className="mt-1 font-mono">{result.validationIssues.join(" · ")}</p> : null}
        </div>
      ) : null}
    </details>
  );
}

const issueActionLabel: Record<Gi088IssueAction, string> = {
  read_latest_state: "读取最新状态",
  return_to_current_task: "回到当前任务",
  reconfirm_submission: "重新确认提交",
  generate_again: "再次生成",
  seal_and_export: "封存并导出",
  none: "知道了"
};

function InlineIssue({
  issue,
  onAction
}: {
  issue: Gi088EvaluationIssue;
  onAction?: (action: Gi088IssueAction) => void;
}) {
  const action = issue.action ?? (issue.retryable ? "read_latest_state" : "none");
  return (
    <div className="border-l-2 border-clay bg-paper/35 px-4 py-3 text-sm" role="alert">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">这一步暂未完成</p>
          <p className="mt-1 text-pretty text-[var(--text-dim)]">
            {issue.message} <span className="font-mono text-xs">{issue.code}</span>
          </p>
          {issue.dataSaved ? (
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              数据状态：{issue.dataSaved === "yes"
                ? "已保存"
                : issue.dataSaved === "no"
                  ? "尚未保存"
                  : issue.dataSaved === "partial"
                    ? "部分已保存"
                    : "暂时无法确认"}
              {issue.requestId ? ` · requestId ${issue.requestId}` : ""}
            </p>
          ) : null}
        </div>
        {action !== "none" || issue.retryable ? (
          <ActionButton
            type="button"
            variant="secondary"
            onClick={() => onAction
              ? onAction(action)
              : window.location.reload()}
          >
            {issueActionLabel[action]}
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  required = false
}: {
  label: string;
  value: T | null;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-xs font-semibold text-[var(--text-dim)]">
        {label}{required ? "（必选）" : ""}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([option, optionLabel]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full border px-3 py-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay",
              value === option
                ? "border-[var(--line-strong)] bg-[var(--amber-soft)] font-semibold text-ink"
                : "border-[var(--line-soft)] bg-paper/45 text-[var(--text-dim)] hover:border-[var(--line-strong)]"
            )}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function TaskRail({
  session,
  onSelect,
  compact = false
}: {
  session: Gi088EvaluationSession;
  onSelect: (taskId: string) => void;
  compact?: boolean;
}) {
  const activeTaskId = session.activeTask?.taskId ?? session.tasks.find((item) => item.status === "ready")?.id;

  return (
    <Card as="aside" className="min-h-0 overflow-hidden p-0" aria-label={`${session.batch.totalTasks} 项真人交互开发评测集`} data-testid="gi088-task-rail">
      <div className="px-5 pb-4 pt-5">
        <SectionHeading
          title="开发评测集"
          hint={`${session.batch.completedTaskCount}/${session.batch.totalTasks}`}
          description="每项都使用真实内容，页面提示只供你触发目标行为。"
        />
      </div>
      <Divider />
      <ol className={cn("px-2 py-2", compact ? "space-y-1" : "space-y-1")}>
        {session.tasks.map((task, index) => {
          const active = task.id === activeTaskId;
          return (
            <li key={task.id}>
              <button
                type="button"
                disabled={task.status === "locked" || task.status === "not_run"}
                onClick={() => onSelect(task.id)}
                className={cn(
                  "relative w-full rounded-[var(--radius-control)] px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-default",
                  active && "bg-[var(--amber-soft)]"
                )}
                aria-current={active ? "step" : undefined}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 min-w-9 shrink-0 items-center justify-center rounded-full border px-1.5 font-mono text-xs",
                      active ? "border-[var(--line-strong)] bg-paper/70 text-ink" : "border-[var(--line-soft)] text-[var(--text-faint)]"
                    )}
                  >
                    {task.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-5 text-ink">{task.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", statusTone(task.status))}>
                        {taskStatusLabel[task.status]}
                      </span>
                      {task.repeatOf ? (
                        <span className="text-xs text-[var(--text-faint)]">复测 {task.repeatOf}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
              {index < session.tasks.length - 1 ? <Divider className="mx-3 hidden xl:block" /> : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function BranchTabs({
  selected,
  activeTask,
  onSelect
}: {
  selected: Gi088BranchKey;
  activeTask: NonNullable<Gi088EvaluationSession["activeTask"]>;
  onSelect: (branch: Gi088BranchKey) => void;
}) {
  const highAvailable = activeTask.branches.high.status !== "not_started";
  return (
    <div className="inline-flex rounded-full border border-[var(--line-soft)] bg-paper/45 p-1" role="group" aria-label="Thinking 对照分支">
      {(["off", "high"] as const).map((branch) => (
        <button
          key={branch}
          type="button"
          disabled={branch === "high" && !highAvailable}
          aria-describedby={branch === "high" && !highAvailable ? "gi088-high-branch-locked" : undefined}
          aria-pressed={selected === branch}
          onClick={() => onSelect(branch)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-not-allowed disabled:opacity-40",
            selected === branch ? "bg-ink text-paper" : "text-[var(--text-dim)] hover:text-ink"
          )}
        >
          {branchLabel[branch]}
        </button>
      ))}
      {!highAvailable ? <span id="gi088-high-branch-locked" className="sr-only">完成并封存 Thinking 关闭分支后开放</span> : null}
    </div>
  );
}

function Conversation({
  trajectory,
  pendingOperation
}: {
  trajectory: Gi088Trajectory;
  pendingOperation: PendingOperation | null;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [followingLatest, setFollowingLatest] = useState(true);

  useEffect(() => {
    const root = viewportRef.current;
    const target = endRef.current;
    if (!root || !target || typeof IntersectionObserver === "undefined") {
      followingRef.current = true;
      setFollowingLatest(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const next = entry.isIntersecting;
        followingRef.current = next;
        setFollowingLatest(next);
      },
      { root, threshold: 0.85 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [trajectory.id]);

  const goToLatest = useCallback((behavior?: ScrollBehavior) => {
    endRef.current?.scrollIntoView?.({
      block: "end",
      behavior:
        behavior ??
        (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth")
    });
  }, []);

  useEffect(() => {
    if (followingRef.current) goToLatest("auto");
  }, [goToLatest, pendingOperation, trajectory.messages.length]);

  if (trajectory.messages.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center text-center text-sm leading-7 text-[var(--text-dim)]">
        这一分支将在前一分支封存后，<br />从同一段 A0＋U1 独立开始。
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="relative h-full overflow-y-auto overscroll-contain px-5 py-6 md:px-6"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={Boolean(pendingOperation)}
      data-testid="gi088-conversation"
    >
      <div className="space-y-5">
      {trajectory.messages.map((message, index) => (
        <article
          key={message.id}
          className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
          data-message-id={message.id}
        >
          <div
            className={cn(
              "max-w-[88%] break-words rounded-[var(--radius-card)] px-4 py-3 text-sm leading-7 md:max-w-[76%]",
              message.role === "user"
                ? "rounded-br-[var(--radius-control)] bg-ink text-paper"
                : "rounded-bl-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/65 text-ink"
            )}
          >
            <p className="mb-1 font-mono text-xs uppercase opacity-60">
              {messageSequenceLabel(trajectory.messages, index)}
            </p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </article>
      ))}
      {pendingOperation ? (
        <PendingGenerationStatus operation={pendingOperation} />
      ) : trajectory.status === "running" && trajectory.pendingTurnId ? (
        <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]" role="status">
          <span className="size-2 rounded-full bg-[var(--amber)]" aria-hidden="true" />
          服务端正在完成这一轮，刷新只会读取当前进度。
        </div>
      ) : null}
      <div ref={endRef} className="h-px" aria-hidden="true" data-testid="gi088-conversation-end" />
      </div>
      {!followingLatest ? (
        <div className="sticky bottom-3 mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => goToLatest()}
            className="rounded-full border border-[var(--line-strong)] bg-paper px-4 py-2 text-xs font-semibold text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            data-testid="gi088-back-to-latest"
          >
            回到最新
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TechnicalFailure({
  runId,
  taskId,
  branch,
  trajectory,
  disabled,
  onUpdated,
  onError,
  onPending,
  allowManualRetry = true
}: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  trajectory: Gi088Trajectory;
  disabled: boolean;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
  allowManualRetry?: boolean;
}) {
  if (trajectory.status !== "technical_failure" || !trajectory.technicalError) return null;
  const failedTurn = [...trajectory.turns].reverse().find((item) => item.status === "technical_failure");
  const turnId = failedTurn?.id;
  const recovery = failedTurn?.recovery;

  if (
    recovery?.status === "eligible" ||
    recovery?.status === "retrying" ||
    recovery?.status === "manual_retrying"
  ) {
    const timeoutRecovery = recovery.trigger === "TIMEOUT";
    const manualRetrying = recovery.status === "manual_retrying";
    return (
      <div className="border-l-2 border-[var(--amber)] pl-4 text-sm leading-6" role="status" aria-live="polite">
        <p className="font-semibold text-ink">
          {manualRetrying
            ? "正在再次生成"
            : timeoutRecovery
              ? "正在恢复连接"
              : "正在恢复可见回答"}
        </p>
        <p className="mt-1 text-[var(--text-dim)]">
          {manualRetrying
            ? "你已确认再次生成。系统继续使用同一段原话、同一 Thinking high 配置和修复前状态；完成后只会提交一条最终回答。"
            : timeoutRecovery
            ? "第一次请求在连接或正文停滞时结束。你的原话已经保留，系统正在用相同 Thinking high 配置自动恢复一次。"
            : "第一次请求只完成了思考。你的原话已经保留，系统正在用相同 Thinking high 配置自动恢复一次。"}
        </p>
        <p className="mt-2 text-xs text-[var(--text-faint)]">自动链最多两次、总计不超过 90 秒；自动恢复仍失败时，你可以主动再次生成一次。</p>
      </div>
    );
  }

  if (recovery?.status === "manual_available") {
    const retryAfterAuto = async () => {
      if (!turnId) return;
      onPending(true);
      try {
        onUpdated(
          await retryGi088Turn({
            runId,
            taskId,
            branch,
            turnId,
            trigger: "manual_after_auto_recovery"
          })
        );
      } catch (error) {
        onError(issueFromUnknown(error));
      } finally {
        onPending(false);
      }
    };
    return (
      <div className="border-l-2 border-clay pl-4 text-sm leading-6" role="alert">
        <p className="font-semibold text-ink">自动恢复仍未完成</p>
        <p className="mt-1 text-[var(--text-dim)]">
          两次调用和你的原话已经保留。你可以主动再生成一次；这次结束后系统会停止当前原话的全部调用。
        </p>
        <ActionButton
          type="button"
          className="mt-3"
          variant="primary"
          disabled={disabled || !turnId}
          onClick={retryAfterAuto}
        >
          再次生成
        </ActionButton>
      </div>
    );
  }

  if (recovery?.status === "exhausted") {
    const timeoutRecovery = recovery.trigger === "TIMEOUT";
    return (
      <div className="border-l-2 border-clay pl-4 text-sm leading-6" role="alert">
        <p className="font-semibold text-ink">
          {timeoutRecovery
            ? "自动重试仍未完成连接"
            : "自动恢复仍未得到可见回答"}
        </p>
        <p className="mt-1 text-[var(--text-dim)]">
          {`最多三次${branch === "high" ? " Thinking high" : " Thinking 关闭"} 调用和你的原话都已保留在 Trace。当前原话的恢复已经结束，你可以结束并评价。`}
        </p>
      </div>
    );
  }

  const retry = async () => {
    if (!turnId) return;
    onPending(true);
    try {
      onUpdated(
        await retryGi088Turn({
          runId,
          taskId,
          branch,
          turnId,
          trigger: "manual_after_auto_recovery"
        })
      );
    } catch (error) {
      onError(issueFromUnknown(error));
    } finally {
      onPending(false);
    }
  };

  return (
    <div className="border-l-2 border-clay pl-4 text-sm leading-6" role="alert">
      <p className="font-semibold text-ink">技术失败已保留</p>
      <p className="mt-1 text-[var(--text-dim)]">{trajectory.technicalError}</p>
      <p className="mt-2 text-[var(--text-dim)]">手动重试会使用相同输入和参数新增一次模型调用，适合处理偶发网络或服务故障。</p>
      {allowManualRetry ? (
        <ActionButton
          type="button"
          className="mt-3"
          variant="secondary"
          disabled={disabled || !turnId || (failedTurn?.calls.length ?? 0) >= 2}
          onClick={retry}
        >
          手动重试这一轮
        </ActionButton>
      ) : null}
    </div>
  );
}

function ProtectedFailure({
  runId,
  taskId,
  branch,
  trajectory,
  disabled,
  onUpdated,
  onError,
  onPending
}: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  trajectory: Gi088Trajectory;
  disabled: boolean;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
}) {
  if (trajectory.status !== "protected_failure") return null;
  const failedTurn = [...trajectory.turns].reverse().find((item) => item.status === "protected_failure");
  const recovery = failedTurn?.recovery;
  const stageTransitionRecovery =
    recovery?.trigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE";
  const singleQuestionRecovery =
    recovery?.trigger === "ASK_QUESTION_COUNT_INVALID:2";
  if (singleQuestionRecovery) {
    return (
      <div className="border-l-2 border-[var(--amber)] pl-4 text-sm leading-6" role="status">
        <p className="font-semibold text-ink">历史 v5 单问号记录</p>
        <p className="mt-1 text-[var(--text-dim)]">
          这条 Trace 保留当时的严格单问号保护与恢复血缘。v6 只观察问号数量，不再为此发起自动调用。
        </p>
      </div>
    );
  }
  if (recovery?.status === "manual_retrying") {
    return (
      <div className="border-l-2 border-[var(--amber)] pl-4 text-sm leading-6" role="status" aria-live="polite">
        <p className="font-semibold text-ink">正在再次生成</p>
        <p className="mt-1 text-[var(--text-dim)]">
          系统沿用原话、Thinking high 配置和修复前状态；完成后只提交一条最终回答。
        </p>
      </div>
    );
  }
  if (recovery?.status === "manual_available" && failedTurn) {
    const retryAfterAuto = async () => {
      onPending(true);
      try {
        onUpdated(
          await retryGi088Turn({
            runId,
            taskId,
            branch,
            turnId: failedTurn.id,
            trigger: "manual_after_auto_recovery"
          })
        );
      } catch (error) {
        onError(issueFromUnknown(error));
      } finally {
        onPending(false);
      }
    };
    return (
      <div className="border-l-2 border-clay pl-4 text-sm leading-6" role="alert">
        <p className="font-semibold text-ink">自动整理仍未通过规则检查</p>
        <p className="mt-1 text-[var(--text-dim)]">
          两次结果和你的原话已经保留。你可以主动再生成一次；完成后当前原话不会继续调用。
        </p>
        <ActionButton
          type="button"
          className="mt-3"
          variant="primary"
          disabled={disabled}
          onClick={retryAfterAuto}
        >
          再次生成
        </ActionButton>
      </div>
    );
  }
  if (
    stageTransitionRecovery &&
    (recovery.status === "eligible" || recovery.status === "retrying")
  ) {
    return (
      <div
        className="border-l-2 border-[var(--amber)] pl-4 text-sm leading-6"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-ink">
          正在自动整理阶段转换
        </p>
        <p className="mt-1 text-[var(--text-dim)]">
          第一次回应留在了机会已经用完的阶段。你的原话已经保留，系统正在沿用当前 Thinking 配置自动纠正一次。
        </p>
        <p className="mt-2 text-xs text-[var(--text-faint)]">
          自动链最多两次；自动整理仍失败时，你可以主动再次生成一次。
        </p>
      </div>
    );
  }
  const questionCountIssue = failedTurn?.validationIssues?.find((issue) =>
    issue.startsWith("ASK_QUESTION_COUNT_INVALID:")
  );
  const questionCount = questionCountIssue
    ? Number(questionCountIssue.split(":").at(-1))
    : null;
  const failureDescription = Number.isFinite(questionCount)
    ? `本轮回应同时提出了 ${questionCount} 个问题，超出“每轮最多一问”的规则。`
    : "本轮回应未通过结构、来源、回答机会、阶段或状态规则检查。";
  const recoveryExhausted = recovery?.status === "exhausted";
  const exhaustedDescription = stageTransitionRecovery
    ? "阶段转换在最终恢复后仍未完成。最多三次调用和你的原话都已保留在 Trace，当前原话已经停止继续调用。"
    : "这是本轮唯一一次自动恢复，系统已经停止后续调用。";
  return (
    <div className="border-l-2 border-clay pl-4 text-sm leading-6" role="alert">
      <p className="font-semibold text-ink">本轮回应未通过规则检查</p>
      <p className="mt-1 text-[var(--text-dim)]">
        {failureDescription}
        {recoveryExhausted
          ? exhaustedDescription
          : "原始结果已经保留，本轮不会自动重试。你可以评价当前轨迹。"}
      </p>
      {failedTurn?.validationIssues?.length ? (
        <p className="mt-2 font-mono text-xs text-[var(--text-faint)]">{failedTurn.validationIssues.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function ReviewForm({
  runId,
  taskId,
  branch,
  targetTriggerPrompt,
  criterion,
  hasTechnicalFailure,
  disabled,
  cancelLabel = "继续聊",
  onCancel,
  onUpdated,
  onError,
  onPending,
  reviewSnapshotFingerprint,
  currentReview,
  reviewSnapshot
}: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  targetTriggerPrompt: string;
  criterion: string;
  hasTechnicalFailure: boolean;
  disabled: boolean;
  cancelLabel?: string;
  onCancel: () => void;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
  reviewSnapshotFingerprint: string;
  currentReview: Gi088TrajectoryReview | null;
  reviewSnapshot: NonNullable<
    NonNullable<Gi088EvaluationSession["activeTask"]>["reviewSnapshot"]
  > | null;
}) {
  const reviewDraftScope = draftScope({
    runId,
    taskId,
    branch,
    form: "trajectory_review",
    turnId: null
  });
  const storedDraft = readGi088EvaluationDraft(reviewDraftScope)?.value;
  const storedReview = storedDraft && typeof storedDraft === "object" &&
    !Array.isArray(storedDraft)
    ? storedDraft
    : null;
  const [feeling, setFeeling] = useState<Gi088Feeling | null>(
    storedReview?.feeling === "better" ||
    storedReview?.feeling === "same" ||
    storedReview?.feeling === "worse"
      ? storedReview.feeling
      : currentReview?.feeling ?? null
  );
  const [quality, setQuality] = useState<Gi088Quality | null>(
    storedReview?.quality === "direct_use" ||
    storedReview?.quality === "minor_issue" ||
    storedReview?.quality === "quality_failure" ||
    storedReview?.quality === "single_case_blocker"
      ? storedReview.quality
      : currentReview?.quality ?? null
  );
  const [targetTrigger, setTargetTrigger] = useState<Exclude<
    Gi088TargetTrigger,
    "legacy_unknown"
  > | null>(
    storedReview?.targetTrigger === "triggered" ||
    storedReview?.targetTrigger === "not_triggered" ||
    storedReview?.targetTrigger === "blocked_by_technical_failure"
      ? storedReview.targetTrigger
      : currentReview?.targetTrigger === "legacy_unknown"
        ? null
        : currentReview?.targetTrigger ?? null
  );
  const [reason, setReason] = useState(
    typeof storedReview?.reason === "string"
      ? storedReview.reason
      : currentReview?.reason ?? ""
  );
  const revisionDraftScope = draftScope({
    runId,
    taskId,
    branch,
    form: "review_revision_reason",
    turnId: "trajectory"
  });
  const [revisionReason, setRevisionReason] = useState(
    readGi088EvaluationDraft<string>(revisionDraftScope)?.value ?? ""
  );
  const saveDraft = (next: {
    feeling: Gi088Feeling | null;
    quality: Gi088Quality | null;
    targetTrigger: Exclude<Gi088TargetTrigger, "legacy_unknown"> | null;
    reason: string;
  }) => writeGi088EvaluationDraft(reviewDraftScope, next);
  const availableTargetTriggerOptions = hasTechnicalFailure
    ? targetTriggerOptions
    : targetTriggerOptions.slice(0, 2);

  const submit = async () => {
    if (
      !feeling ||
      !quality ||
      !targetTrigger ||
      !reason.trim() ||
      (currentReview && !revisionReason.trim())
    ) return;
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        runId,
        taskId,
        branch,
        kind: "trajectory_review",
        baseAssistantMessageId: null,
        content: JSON.stringify({
          feeling,
          quality,
          targetTrigger,
          reason: reason.trim(),
          revisionReason: revisionReason.trim()
        }),
        confirmationFingerprint: reviewSnapshotFingerprint
      });
    } catch (error) {
      onError(issueFromUnknown(error));
      return;
    }
    onPending(true);
    try {
      onUpdated(await endGi088Trajectory({
        runId,
        taskId,
        branch,
        feeling,
        quality,
        targetTrigger,
        reason: reason.trim(),
        reviewSnapshotFingerprint,
        ...(currentReview
          ? { revisionReason: revisionReason.trim() }
          : {}),
        clientOperationId: outbox.clientTurnId
      }));
      clearGi088EvaluationOutbox(outbox);
      clearGi088EvaluationDraft(reviewDraftScope);
      clearGi088EvaluationDraft(revisionDraftScope);
      onCancel();
    } catch (error) {
      onError(issueFromUnknown(error));
    } finally {
      onPending(false);
    }
  };

  return (
    <section className="border-l-2 border-[var(--amber)] pl-4" aria-label="结束本分支并评价">
      <h3 className="text-balance font-display text-xl text-ink">
        {currentReview ? "修改这条轨迹的人工评价" : "聊到这里，你的体验怎样？"}
      </h3>
      <p className="mt-1 text-pretty text-xs leading-5 text-[var(--text-dim)]">
        {currentReview
          ? "修改会保留旧结论、新结论和本次修改原因；对话与调用 Trace 保持只读。"
          : "封存后这一分支会进入只读状态，另一分支仍保持独立。"}
      </p>
      <div className="mt-4 border-l border-[var(--line-strong)] pl-3 text-xs leading-5" aria-label="当前任务目标判定参考">
        <p className="font-semibold text-ink">评测人参考 · 仅页面可见</p>
        <dl className="mt-2 space-y-2 text-[var(--text-dim)]">
          <div>
            <dt className="font-semibold text-ink/85">触发提示</dt>
            <dd className="mt-0.5">{targetTriggerPrompt}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink/85">判定标准</dt>
            <dd className="mt-0.5">{criterion}</dd>
          </div>
        </dl>
        {reviewSnapshot ? (
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line-soft)] pt-3 text-[var(--text-dim)]" aria-label="本次评价提交前证据摘要">
            <div>
              <dt className="inline">可见回应复核 </dt>
              <dd className="inline font-semibold text-ink">
                {reviewSnapshot.questionReviews.filter((item) => item.review).length}/{reviewSnapshot.questionReviews.length}
              </dd>
            </div>
            <div>
              <dt className="inline">程序介入复核 </dt>
              <dd className="inline font-semibold text-ink">
                {reviewSnapshot.programInterventions.filter((item) => item.reviewOutcome).length}/{reviewSnapshot.programInterventions.length}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">
        <ChoiceGroup label="聊完后的感受" value={feeling} options={feelingOptions} onChange={(value) => {
          setFeeling(value);
          saveDraft({ feeling: value, quality, targetTrigger, reason });
        }} disabled={disabled} required />
        <ChoiceGroup label="这条回应轨迹的质量" value={quality} options={qualityOptions} onChange={(value) => {
          setQuality(value);
          saveDraft({ feeling, quality: value, targetTrigger, reason });
        }} disabled={disabled} required />
        <ChoiceGroup
          label="这条轨迹是否真正触发了页面任务目标"
          value={targetTrigger}
          options={availableTargetTriggerOptions}
          onChange={(value) => {
            setTargetTrigger(value);
            saveDraft({ feeling, quality, targetTrigger: value, reason });
          }}
          disabled={disabled}
          required
        />
        <p className="text-xs leading-5 text-[var(--text-faint)]">
          未触发仍可完成体验评价；该轨迹不会计入任务目标覆盖。
        </p>
        <label className="block text-xs font-semibold text-[var(--text-dim)]">
          关键理由（必填）
          <textarea
            value={reason}
            disabled={disabled}
            onChange={(event) => {
              setReason(event.target.value);
              saveDraft({
                feeling,
                quality,
                targetTrigger,
                reason: event.target.value
              });
            }}
            rows={3}
            maxLength={1200}
            required
            aria-describedby={`gi088-review-submit-help-${branch}`}
            placeholder="记录真正影响你判断的回应、追问或收束。"
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[var(--line-strong)] focus:bg-paper/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          />
        </label>
        {currentReview ? (
          <label className="block text-xs font-semibold text-[var(--text-dim)]">
            修改原因（必填）
            <textarea
              value={revisionReason}
              disabled={disabled}
              onChange={(event) => {
                setRevisionReason(event.target.value);
                writeGi088EvaluationDraft(
                  revisionDraftScope,
                  event.target.value
                );
              }}
              rows={2}
              maxLength={1_000}
              required
              placeholder="说明这次修改基于哪条新证据。"
              className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            />
          </label>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          type="button"
          variant="primary"
          disabled={
            disabled ||
            !feeling ||
            !quality ||
            !targetTrigger ||
            !reason.trim() ||
            Boolean(currentReview && !revisionReason.trim())
          }
          aria-describedby={`gi088-review-submit-help-${branch}`}
          onClick={submit}
        >
          {currentReview ? "保存评价修订" : `封存${branchLabel[branch]}分支`}
        </ActionButton>
        <ActionButton type="button" variant="ghost" disabled={disabled} onClick={onCancel}>{cancelLabel}</ActionButton>
      </div>
      <p id={`gi088-review-submit-help-${branch}`} className="mt-2 text-xs leading-5 text-[var(--text-faint)]">
        {currentReview
          ? "完成三项判断、关键理由和修改原因后可保存修订。"
          : "完成三项必选判断并填写关键理由后可封存。"}
      </p>
    </section>
  );
}

function ReadonlyReview({
  review,
  canRevise = false,
  onRevise
}: {
  review: Gi088TrajectoryReview;
  canRevise?: boolean;
  onRevise?: () => void;
}) {
  const feeling = feelingOptions.find(([value]) => value === review.feeling)?.[1];
  const quality = qualityOptions.find(([value]) => value === review.quality)?.[1];
  return (
    <div className="border-l-2 border-moss pl-4 text-sm leading-6">
      <p className="font-semibold text-ink">本分支已封存</p>
      <p className="mt-1 text-[var(--text-dim)]">
        {feeling} · {quality} · {targetTriggerLabel[review.targetTrigger ?? "legacy_unknown"]}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-ink/80">{review.reason}</p>
      {canRevise && onRevise ? (
        <ActionButton type="button" variant="secondary" className="mt-3" onClick={onRevise}>
          修改轨迹评价
        </ActionButton>
      ) : null}
    </div>
  );
}

function ComparisonForm({
  runId,
  taskId,
  comparison,
  disabled,
  onUpdated,
  onError,
  onPending
}: {
  runId: string;
  taskId: string;
  comparison: Gi088Comparison;
  disabled: boolean;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
}) {
  const [preference, setPreference] = useState<Gi088Preference | null>(comparison?.preference ?? null);
  const [reason, setReason] = useState(comparison?.reason ?? "");
  if (comparison) {
    const label = preferenceOptions.find(([value]) => value === comparison.preference)?.[1];
    return (
      <div className="border-l-2 border-moss pl-4 text-sm leading-6">
        <p className="font-semibold text-ink">配置对照已裁决：{label}</p>
        <p className="mt-1 whitespace-pre-wrap text-[var(--text-dim)]">{comparison.reason}</p>
      </div>
    );
  }

  const submit = async () => {
    if (!preference || !reason.trim()) return;
    onPending(true);
    try {
      onUpdated(await compareGi088Trajectories({
        runId,
        taskId,
        preference,
        reason: reason.trim()
      }));
    } catch (error) {
      onError(issueFromUnknown(error));
    } finally {
      onPending(false);
    }
  };

  return (
    <section className="border-l-2 border-[var(--amber)] pl-4" aria-label="两种配置对照裁决">
      <h3 className="text-balance font-display text-xl text-ink">两条轨迹放在一起，你更认可哪一条？</h3>
      <p className="mt-1 text-pretty text-xs leading-5 text-[var(--text-dim)]">结合完整聊天体验判断，统计结果只作为后续复盘证据。</p>
      <div className="mt-4 space-y-4">
        <ChoiceGroup label="配置比较" value={preference} options={preferenceOptions} onChange={setPreference} disabled={disabled} required />
        <label className="block text-xs font-semibold text-[var(--text-dim)]">
          比较理由（必填）
          <textarea
            value={reason}
            disabled={disabled}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={1200}
            required
            placeholder="说明差异发生在哪里，以及它怎样影响你的体验。"
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[var(--line-strong)] focus:bg-paper/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          />
        </label>
      </div>
      <ActionButton type="button" variant="primary" className="mt-4" disabled={disabled || !preference || !reason.trim()} onClick={submit}>
        完成本项评测
      </ActionButton>
    </section>
  );
}

function QuestionReviewEditor({
  runId,
  taskId,
  branch,
  turn,
  disabled,
  onUpdated,
  onError,
  onPending
}: {
  runId: string;
  taskId: string;
  branch: Gi088BranchKey;
  turn: Gi088Trajectory["turns"][number];
  disabled: boolean;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
}) {
  const observation = turn.questionObservation;
  const noteDraftScope = draftScope({
    runId,
    taskId,
    branch,
    form: "question_review_note",
    turnId: turn.id
  });
  const revisionDraftScope = draftScope({
    runId,
    taskId,
    branch,
    form: "review_revision_reason",
    turnId: turn.id
  });
  const storedQuestionDraft = readGi088EvaluationDraft(noteDraftScope)?.value;
  const storedQuestionReview = storedQuestionDraft &&
    typeof storedQuestionDraft === "object" &&
    !Array.isArray(storedQuestionDraft)
      ? storedQuestionDraft
      : null;
  const storedQuestionNote = typeof storedQuestionReview?.note === "string"
    ? storedQuestionReview.note
    : typeof storedQuestionDraft === "string"
      ? storedQuestionDraft
      : null;
  const storedQuestionPresence: Gi088QuestionPresence | null =
    storedQuestionReview?.questionPresence === "present" ||
    storedQuestionReview?.questionPresence === "absent" ||
    storedQuestionReview?.questionPresence === "uncertain"
      ? storedQuestionReview.questionPresence
      : null;
  const storedQuestionClassification: Gi088QuestionReviewClassification | null =
    storedQuestionReview?.classification === "same_focus_low_burden" ||
    storedQuestionReview?.classification === "same_focus_heavy" ||
    storedQuestionReview?.classification === "multiple_independent_tasks" ||
    storedQuestionReview?.classification === "uncertain"
      ? storedQuestionReview.classification
      : null;
  const [questionPresence, setQuestionPresence] =
    useState<Gi088QuestionPresence | null>(
      storedQuestionPresence ?? observation?.review?.questionPresence ??
      observation?.questionPresence ??
      (observation?.review ? "present" : null)
    );
  const [classification, setClassification] =
    useState<Gi088QuestionReviewClassification | null>(
      storedQuestionClassification ?? observation?.review?.classification ?? null
    );
  const [note, setNote] = useState(
    storedQuestionNote ?? observation?.review?.note ?? ""
  );
  const [revisionReason, setRevisionReason] = useState(
    readGi088EvaluationDraft<string>(revisionDraftScope)?.value ?? ""
  );
  const [saving, setSaving] = useState(false);

  const saveQuestionDraft = (next: {
    questionPresence: Gi088QuestionPresence | null;
    classification: Gi088QuestionReviewClassification | null;
    note: string;
  }) => writeGi088EvaluationDraft(noteDraftScope, next);

  useEffect(() => {
    setQuestionPresence(
      storedQuestionPresence ??
      observation?.review?.questionPresence ??
      observation?.questionPresence ??
      (observation?.review ? "present" : null)
    );
    setClassification(
      storedQuestionClassification ??
      observation?.review?.classification ??
      null
    );
    setNote(
      storedQuestionNote ?? observation?.review?.note ?? ""
    );
  }, [
    noteDraftScope.branch,
    noteDraftScope.form,
    noteDraftScope.runId,
    noteDraftScope.taskId,
    noteDraftScope.turnId,
    observation?.questionPresence,
    observation?.review,
    storedQuestionClassification,
    storedQuestionPresence,
    storedQuestionNote
  ]);

  if (!observation) return null;

  const submit = async () => {
    if (!questionPresence ||
      (questionPresence === "present" && !classification) ||
      (observation.review && !revisionReason.trim())) return;
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        runId,
        taskId,
        branch,
        kind: "question_review",
        baseAssistantMessageId: null,
        content: JSON.stringify({
          turnId: turn.id,
          questionPresence,
          classification: questionPresence === "present"
            ? classification
            : null,
          note,
          revisionReason: observation.review
            ? revisionReason.trim()
            : null
        }),
        confirmationFingerprint:
          observation.observationFingerprint ?? turn.id
      });
    } catch (error) {
      onError(issueFromUnknown(error));
      return;
    }
    setSaving(true);
    onPending(true);
    try {
      onUpdated(
        await reviewGi088Question({
          runId,
          taskId,
          branch,
          turnId: turn.id,
          questionPresence,
          ...(questionPresence === "present" && classification
            ? { classification }
            : {}),
          note,
          observationFingerprint:
            observation.observationFingerprint ?? turn.id,
          ...(observation.review
            ? { revisionReason: revisionReason.trim() }
            : {}),
          clientOperationId: outbox.clientTurnId
        })
      );
      clearGi088EvaluationOutbox(outbox);
      clearGi088EvaluationDraft(noteDraftScope);
      clearGi088EvaluationDraft(revisionDraftScope);
    } catch (error) {
      onError(issueFromUnknown(error));
    } finally {
      setSaving(false);
      onPending(false);
    }
  };

  const helpId = `gi088-question-review-help-${turn.id}`;
  return (
    <section
      className="mt-4 border-l-2 border-[var(--amber)] pl-3"
      aria-label="本轮回答焦点人工复核"
      data-testid="gi088-question-review"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-semibold text-ink">回答焦点人工复核</p>
        <span className="text-[var(--text-faint)]">
          {observation.questionMarkCount} 个问号 · {questionReviewCandidateLabel[observation.reviewCandidate]}
        </span>
      </div>
      <p id={helpId} className="mt-1 text-xs leading-5 text-[var(--text-dim)]">
        按用户需要组织几份独立答案判断。问号数量只作观察；结束轨迹前，本轮必须完成分类。
      </p>
      <div className="mt-3 space-y-3">
        <ChoiceGroup
          label="这条可见回应是否包含提问"
          value={questionPresence}
          options={questionPresenceOptions}
          onChange={(value) => {
            setQuestionPresence(value);
            saveQuestionDraft({
              questionPresence: value,
              classification,
              note
            });
          }}
          disabled={disabled || saving}
          required
        />
        {questionPresence === "present" ? (
        <ChoiceGroup
          label="最终人工分类"
          value={classification}
          options={questionReviewOptions}
          onChange={(value) => {
            setClassification(value);
            saveQuestionDraft({ questionPresence, classification: value, note });
          }}
          disabled={disabled || saving}
          required
        />
        ) : null}
        <label className="block text-xs font-semibold text-[var(--text-dim)]">
          复核说明（选填）
          <textarea
            value={note}
            disabled={disabled || saving}
            onChange={(event) => {
              setNote(event.target.value);
              saveQuestionDraft({
                questionPresence,
                classification,
                note: event.target.value
              });
            }}
            rows={2}
            maxLength={1_000}
            aria-describedby={helpId}
            placeholder="记录问句是否共同服务同一回答目标，以及实际回答负担。"
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          />
        </label>
        {observation.review ? (
          <label className="block text-xs font-semibold text-[var(--text-dim)]">
            修改原因（必填）
            <textarea
              value={revisionReason}
              disabled={disabled || saving}
              onChange={(event) => {
                setRevisionReason(event.target.value);
                writeGi088EvaluationDraft(
                  revisionDraftScope,
                  event.target.value
                );
              }}
              rows={2}
              maxLength={1_000}
              placeholder="说明这次修改基于哪条新证据。"
              className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            />
          </label>
        ) : null}
      </div>
      <ActionButton
        type="button"
        variant="secondary"
        className="mt-3"
        disabled={
          disabled ||
          saving ||
          !questionPresence ||
          (questionPresence === "present" && !classification) ||
          Boolean(observation.review && !revisionReason.trim())
        }
        aria-describedby={helpId}
        onClick={submit}
      >
        {observation.review ? "更新本轮分类" : "保存本轮分类"}
      </ActionButton>
      {observation.review ? (
        <p className="mt-2 text-xs text-[var(--text-faint)]" role="status">
          已保存：{observation.review.questionPresence === "absent"
            ? "没有提问"
            : observation.review.questionPresence === "uncertain"
              ? "是否提问暂时无法判断"
              : questionReviewOptions.find(([value]) =>
                  value === observation.review?.classification)?.[1] ?? "包含提问"}
        </p>
      ) : null}
    </section>
  );
}

function TraceLedger({
  taskId,
  branch,
  trajectory,
  session,
  disabled,
  onUpdated,
  onError,
  onPending
}: {
  taskId: string;
  branch: Gi088BranchKey;
  trajectory: Gi088Trajectory;
  session: Gi088EvaluationSession;
  disabled: boolean;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
}) {
  return (
    <Card as="aside" className="min-h-0 overflow-hidden p-0" aria-label="当前分支透明语义 Trace" data-testid="gi088-trace-ledger">
      <div className="px-5 pb-4 pt-5">
        <SectionHeading title="透明 Trace" hint={`${trajectory.turns.length} 轮`} description="显示可核查语义结论；隐藏推理不会读取、保存或展示。" />
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs leading-5">
          <dt className="text-[var(--text-faint)]">配置</dt><dd className="font-semibold text-ink">{trajectory.config.label}</dd>
          <dt className="text-[var(--text-faint)]">模型</dt><dd className="font-mono text-xs text-ink">{session.evaluation.model}</dd>
          <dt className="text-[var(--text-faint)]">温度</dt><dd>{trajectory.config.temperature ?? "N/A"}</dd>
          <dt className="text-[var(--text-faint)]">Reasoning</dt><dd>{trajectory.config.reasoningEffort ?? "关闭"}</dd>
          <dt className="text-[var(--text-faint)]">输出</dt><dd>结构化 JSON · 应用不设 Token 上限 · 质量重试 0</dd>
          <dt className="text-[var(--text-faint)]">空内容恢复</dt><dd>{trajectory.config.automaticEmptyContentRetries ? "Thinking high 最多自动恢复 1 次" : "关闭"}</dd>
          <dt className="text-[var(--text-faint)]">轨迹调用</dt><dd>已使用 {trajectory.config.providerCallsUsed ?? 0} 次，本轨迹不设上限</dd>
          <dt className="text-[var(--text-faint)]">候选指纹</dt><dd title={session.evaluation.candidateFingerprint} className="break-all font-mono text-xs">{compactFingerprint(session.evaluation.candidateFingerprint)}</dd>
        </dl>
      </div>
      <Divider />
      <div className="max-h-[32rem] overflow-y-auto px-5 py-1 xl:max-h-[calc(100dvh-23rem)]">
        {trajectory.turns.length === 0 ? (
          <p className="py-8 text-center text-sm leading-6 text-[var(--text-dim)]">第一轮完成后，这里会显示共同任务、当前探查和原话证据。</p>
        ) : trajectory.turns.map((turn, index) => {
          const semantic = turn.semantic;
          return (
            <section key={turn.id} className="py-4" aria-label={`第 ${index + 1} 轮语义 Trace`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-[var(--text-faint)]">TURN {String(index + 1).padStart(2, "0")}</p>
                <div className="flex gap-1.5">
                  <span className="rounded-full bg-[var(--moss-soft)] px-2 py-0.5 text-xs text-ink/80">{displayStage(semantic?.stage)}</span>
                  <span className="rounded-full bg-[var(--amber-soft)] px-2 py-0.5 text-xs text-ink/80">{displayAction(semantic?.action)}</span>
                </div>
              </div>
              {turn.status === "technical_failure" || turn.status === "protected_failure" ? (
                <p className="mt-3 text-sm text-ink">{turn.status === "technical_failure" ? "本轮技术失败，原始失败已保留。" : "本轮触发程序保护，质量结果已原样保留。"}</p>
              ) : (
                <dl className="mt-3 space-y-3 text-xs leading-5">
                  <div>
                    <dt className="text-[var(--text-faint)]">共同任务</dt>
                    <dd className="mt-0.5 text-ink/85">{semantic?.workingTask?.summary ?? "尚未建立"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-faint)]">当前探查</dt>
                    <dd className="mt-0.5 text-ink/85">{semantic?.nextInquiry?.answerTarget ?? "本轮不提问"}</dd>
                    {semantic?.nextInquiry?.taskEffect ? <dd className="mt-1 text-[var(--text-dim)]">作用：{semantic.nextInquiry.taskEffect}</dd> : null}
                  </div>
                  {semantic?.understandingDelta ? (
                    <div>
                      <dt className="text-[var(--text-faint)]">认识增量</dt>
                      <dd className="mt-0.5 text-ink/85">{semantic.understandingDelta.summary}</dd>
                    </div>
                  ) : null}
                  {semantic?.understandingChange ? (
                    <div>
                      <dt className="text-[var(--text-faint)]">认识变化</dt>
                      <dd className="mt-0.5 text-ink/85">
                        {semantic.understandingChange.kind === "none"
                          ? "本轮无变化"
                          : semantic.understandingChange.summary}
                      </dd>
                    </div>
                  ) : null}
                  {semantic?.pauseReason ? (
                    <div><dt className="text-[var(--text-faint)]">暂停原因</dt><dd className="mt-0.5 text-ink/85">{semantic.pauseReason}</dd></div>
                  ) : null}
                  {turn.stateMaintenance &&
                  (turn.stateMaintenance.workingTaskLineage === "merged" ||
                    turn.stateMaintenance.explicitStop !== "none" ||
                    turn.stateMaintenance.providerFailureAbsorbed ||
                    Boolean(turn.stateMaintenance.sourceCompletion?.reviewCandidate)) ? (
                    <div>
                      <dt className="text-[var(--text-faint)]">程序状态维护</dt>
                      <dd className="mt-0.5 text-ink/85">
                        {turn.stateMaintenance.workingTaskLineage === "merged"
                          ? `已把 ${turn.stateMaintenance.inheritedEvidenceCount} 条历史来源与本轮 ${turn.stateMaintenance.submittedEvidenceCount} 条来源合并为 ${turn.stateMaintenance.effectiveEvidenceCount} 条。`
                          : "本轮状态血缘无需补全。"}
                        {turn.stateMaintenance.explicitStop === "pure"
                          ? " 明确停止由程序直接完成，模型调用 0 次。"
                          : turn.stateMaintenance.explicitStop === "mixed"
                            ? " 本轮包含新内容和停止表达，程序已强制进入暂停。"
                            : ""}
                        {turn.stateMaintenance.providerFailureAbsorbed
                          ? " 生成技术事件保留在调用 Trace 中，停止仍然生效。"
                          : ""}
                        {turn.stateMaintenance.sourceCompletion?.reviewCandidate
                          ? ` 程序已补全 ${turn.stateMaintenance.sourceCompletion.appliedFields.join("、")}，插入来源 ${turn.stateMaintenance.sourceCompletion.insertedEvidenceRefs.join("、")}；本轮进入来源补全复核。`
                          : ""}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[var(--text-faint)]">原话证据</dt>
                    <dd className="mt-1 space-y-1 break-words border-l border-[var(--line-strong)] pl-2 text-[var(--text-dim)]">
                      {turn.evidenceExcerpts.length > 0
                        ? turn.evidenceExcerpts.map((item) => <span key={`${turn.id}-${item.id}`} className="block">{item.id} · “{item.content}”</span>)
                        : <span>暂无证据摘录</span>}
                    </dd>
                  </div>
                </dl>
              )}
              {turn.recovery ? (
                <p className="mt-3 text-xs font-semibold text-ink/85">
                  {recoveryTriggerLabel(turn.recovery.trigger)}：
                  {turn.recovery.status} · 自动 {turn.recovery.automaticRetryCount}/1 · 人工 {turn.recovery.manualRetryCount ?? 0}/1
                  {turn.recovery.automaticDeadlineAt ? " · 自动链总上限 90 秒" : ""}
                </p>
              ) : null}
              <QuestionReviewEditor
                runId={runIdOf(session)}
                taskId={taskId}
                branch={branch}
                turn={turn}
                disabled={disabled}
                onUpdated={onUpdated}
                onError={onError}
                onPending={onPending}
              />
              {turn.calls.length ? (
                <div className="mt-3 space-y-4" aria-label={`第 ${index + 1} 轮调用血缘`}>
                  {turn.calls.map((call, callIndex) => (
                    <CallTrace key={call.id} call={call} index={callIndex} />
                  ))}
                </div>
              ) : null}
              {index < trajectory.turns.length - 1 ? <Divider className="mt-4" /> : null}
            </section>
          );
        })}
      </div>
    </Card>
  );
}

function GateAndMetricsSummary({ session }: { session: Gi088EvaluationSession }) {
  const gate = session.batch.gate;
  const metrics = session.metrics;
  const gateLabel = gate?.status === "no_go"
    ? "本批已 No-Go，仍可继续采集证据"
    : gate?.status === "ready_for_final_review"
      ? "机器门已满足，等待产品负责人最终判断"
      : gate?.status === "legacy_unknown"
        ? "历史运行，机器门状态未知"
        : "机器门等待更多证据";
  return (
    <section
      className="mx-auto mb-4 max-w-[116rem] border-l-2 border-[var(--amber)] pl-4 text-sm"
      aria-label="评测资格与统一指标"
      data-testid="gi088-gate-summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{gateLabel}</p>
        <span className="font-mono text-xs text-[var(--text-faint)]">
          gate={gate?.status ?? "legacy_unknown"}
        </span>
      </div>
      {gate?.reasons.length ? (
        <ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--text-dim)]">
          {gate.reasons.map((reason) => (
            <li key={`${reason.code}:${reason.sourceId}`}>
              {reason.code} · {reason.detail}
            </li>
          ))}
        </ul>
      ) : null}
      {metrics ? (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--text-dim)]">
          <div><dt className="inline">首次可见成功 </dt><dd className="inline font-semibold text-ink">{metrics.firstVisibleSuccessRate === null ? "N/A" : `${Math.round(metrics.firstVisibleSuccessRate * 100)}%`}</dd></div>
          <div><dt className="inline">自动恢复成功 </dt><dd className="inline font-semibold text-ink">{metrics.autoRecoverySuccessCount}</dd></div>
          <div><dt className="inline">最终失败 </dt><dd className="inline font-semibold text-ink">{metrics.finalFailureCount}</dd></div>
          <div><dt className="inline">重复消息 </dt><dd className="inline font-semibold text-ink">{metrics.duplicateMessageCount}</dd></div>
          <div><dt className="inline">程序介入复核 </dt><dd className="inline font-semibold text-ink">{metrics.programInterventionReviewCoverage === null ? "N/A" : `${Math.round(metrics.programInterventionReviewCoverage * 100)}%`}</dd></div>
          <div><dt className="inline">可见回应复核 </dt><dd className="inline font-semibold text-ink">{metrics.visibleQuestionReviewCoverage === null ? "N/A" : `${Math.round(metrics.visibleQuestionReviewCoverage * 100)}%`}</dd></div>
        </dl>
      ) : null}
    </section>
  );
}

function ProgramInterventionReviewEditor({
  runId,
  intervention,
  disabled,
  onUpdated,
  onError,
  onPending
}: {
  runId: string;
  intervention: Gi088ProgramIntervention;
  disabled: boolean;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
}) {
  const scope = draftScope({
    runId,
    taskId: intervention.taskId,
    branch: intervention.branch,
    form: "review_revision_reason",
    turnId: intervention.id
  });
  const [outcome, setOutcome] = useState<Gi088ProgramInterventionReviewOutcome | null>(
    intervention.reviewOutcome
  );
  const [reason, setReason] = useState(
    readGi088EvaluationDraft<string>(scope)?.value ??
      (intervention.reviewOutcome ? "" : intervention.reviewReason ?? "")
  );
  const submit = async () => {
    if (!outcome || !reason.trim()) return;
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        runId,
        taskId: intervention.taskId,
        branch: intervention.branch,
        kind: "program_intervention_review",
        baseAssistantMessageId: null,
        content: JSON.stringify({ outcome, reason: reason.trim() }),
        confirmationFingerprint: intervention.observationFingerprint
      });
    } catch (error) {
      onError(issueFromUnknown(error));
      return;
    }
    onPending(true);
    try {
      onUpdated(await reviewGi088ProgramIntervention({
        runId,
        interventionId: intervention.id,
        observationFingerprint: intervention.observationFingerprint,
        outcome,
        reason: reason.trim(),
        clientOperationId: outbox.clientTurnId
      }));
      clearGi088EvaluationOutbox(outbox);
      clearGi088EvaluationDraft(scope);
    } catch (error) {
      onError(issueFromUnknown(error));
    } finally {
      onPending(false);
    }
  };
  return (
    <section className="border-l-2 border-[var(--line-strong)] pl-3 text-xs" aria-label={`程序介入 ${intervention.interventionType}`}>
      <p className="font-semibold text-ink">{intervention.interventionType}</p>
      <p className="mt-1 text-[var(--text-dim)]">
        {intervention.originalAction ?? "无原始动作"} → {intervention.effectiveAction}
      </p>
      {intervention.evidenceSpan ? (
        <p className="mt-1 text-[var(--text-faint)]">证据：{intervention.evidenceSpan}</p>
      ) : null}
      {intervention.reviewOutcome ? (
        <p className="mt-1 text-[var(--text-dim)]" role="status">
          已保存：{interventionReviewOptions.find(([value]) =>
            value === intervention.reviewOutcome)?.[1]} · {intervention.reviewReason}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">
        <ChoiceGroup
          label="人工复核"
          value={outcome}
          options={interventionReviewOptions}
          onChange={setOutcome}
          disabled={disabled}
          required
        />
        <label className="block font-semibold text-[var(--text-dim)]">
          复核理由（必填）
          <textarea
            value={reason}
            disabled={disabled}
            onChange={(event) => {
              setReason(event.target.value);
              writeGi088EvaluationDraft(scope, event.target.value);
            }}
            rows={2}
            maxLength={1_000}
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          />
        </label>
      </div>
      <ActionButton type="button" variant="secondary" className="mt-3" disabled={disabled || !outcome || !reason.trim()} onClick={submit}>
        {intervention.reviewOutcome ? "更新程序介入复核" : "保存程序介入复核"}
      </ActionButton>
    </section>
  );
}

function EvidenceGovernancePanel({
  session,
  disabled,
  onUpdated,
  onError,
  onPending
}: {
  session: Gi088EvaluationSession;
  disabled: boolean;
  onUpdated: (session: Gi088EvaluationSession) => void;
  onError: (issue: Gi088EvaluationIssue) => void;
  onPending: (value: boolean) => void;
}) {
  const interventions = session.programInterventions ??
    session.activeTask?.reviewSnapshot?.programInterventions ??
    [];
  const revisions = session.reviewRevisions ?? [];
  if (interventions.length === 0 && revisions.length === 0) return null;
  return (
    <details className="mx-auto mb-4 max-w-[116rem] rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/45 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        人工证据治理 · 程序介入 {interventions.length} · 修订 {revisions.length}
      </summary>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4" aria-label="程序介入复核列表">
          {interventions.length ? interventions.map((intervention) => (
            <ProgramInterventionReviewEditor
              key={intervention.id}
              runId={runIdOf(session)}
              intervention={intervention}
              disabled={disabled}
              onUpdated={onUpdated}
              onError={onError}
              onPending={onPending}
            />
          )) : <p className="text-xs text-[var(--text-faint)]">本次运行暂无程序介入。</p>}
        </div>
        <ol className="space-y-3 text-xs" aria-label="人工结论修订历史">
          {revisions.length ? revisions.map((revision) => (
            <li key={revision.id} className="border-l border-[var(--line-strong)] pl-3">
              <p className="font-semibold text-ink">{revision.subjectType} · {revision.subjectId}</p>
              <p className="mt-1 text-[var(--text-dim)]">{revision.reason}</p>
              <p className="mt-1 font-mono text-[var(--text-faint)]">{revision.createdAt}</p>
            </li>
          )) : <li className="text-[var(--text-faint)]">尚无修订记录。</li>}
        </ol>
      </div>
    </details>
  );
}

function WorkspaceReady({
  session,
  runs,
  creatingRun,
  onSession,
  onSelectRun,
  onCreateRun
}: {
  session: Gi088EvaluationSession;
  runs: Gi088RunSummary[];
  creatingRun: boolean;
  onSession: (value: Gi088EvaluationSession) => void;
  onSelectRun: (runId: string) => void;
  onCreateRun: () => void;
}) {
  const runId = runIdOf(session);
  const storedEarlyStopDraft = readGi088EvaluationDraft(draftScope({
    runId,
    taskId: null,
    branch: null,
    form: "early_stop_reason",
    turnId: null
  }))?.value;
  const storedEarlyStop = storedEarlyStopDraft &&
    typeof storedEarlyStopDraft === "object" &&
    !Array.isArray(storedEarlyStopDraft)
      ? storedEarlyStopDraft
      : null;
  const highOnly = session.evaluation.mode === "high_only";
  const nextTask = session.tasks.find((item) => item.status === "ready") ?? session.tasks.find((item) => item.status !== "completed") ?? session.tasks.at(-1)!;
  const currentTask = session.tasks.find((item) => item.id === session.activeTask?.taskId) ?? nextTask;
  const [selectedBranch, setSelectedBranch] = useState<Gi088BranchKey>(
    highOnly ? "high" : (session.activeTask?.activeBranch ?? "off")
  );
  const [draft, setDraft] = useState("");
  const [initialUserMessage, setInitialUserMessage] = useState("");
  const [reviewingBranch, setReviewingBranch] = useState<Gi088BranchKey | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [recoveryToast, setRecoveryToast] = useState<RecoveryToastState>(null);
  const [issue, setIssue] = useState<Gi088EvaluationIssue | null>(null);
  const [sealOpen, setSealOpen] = useState(false);
  const [earlyStopOpen, setEarlyStopOpen] = useState(false);
  const [earlyStopReasonCode, setEarlyStopReasonCode] = useState<Gi088EarlyStopReasonCode | null>(
    storedEarlyStop?.reasonCode === "sufficient_evidence" ||
    storedEarlyStop?.reasonCode === "technical_friction" ||
    storedEarlyStop?.reasonCode === "mixed" ||
    storedEarlyStop?.reasonCode === "other"
      ? storedEarlyStop.reasonCode
      : null
  );
  const [earlyStopReason, setEarlyStopReason] = useState(() =>
    typeof storedEarlyStop?.reason === "string"
      ? storedEarlyStop.reason
      : typeof storedEarlyStopDraft === "string"
        ? storedEarlyStopDraft
        : ""
  );
  const [abortOpen, setAbortOpen] = useState(false);
  const [abortReason, setAbortReason] = useState(() =>
    readGi088EvaluationDraft<string>(draftScope({
      runId,
      taskId: session.activeTask?.taskId ?? null,
      branch: null,
      form: "early_stop_reason",
      turnId: null
    }))?.value ?? ""
  );
  const [abandonRecovery, setAbandonRecovery] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [externalUpdate, setExternalUpdate] = useState(false);
  const [desktopLayout, setDesktopLayout] = useState(false);
  const earlyStopToggleRef = useRef<HTMLElement>(null);
  const syncRef = useRef<ReturnType<typeof createGi088EvaluationSync> | null>(null);
  const recoveryToastTimerRef = useRef<number | null>(null);
  const activePrefixRecoveryCallRef = useRef<string | null>(null);

  const activeTask = session.activeTask;
  const activeTaskId = activeTask?.taskId ?? null;
  const activeTaskBranch = activeTask?.activeBranch ?? null;
  const trajectory = activeTask?.branches[selectedBranch] ?? null;
  const latestTurn = trajectory?.turns.at(-1) ?? null;
  const trajectoryPaused =
    latestTurn?.semantic?.action === "pause" &&
    [
      "valid",
      "complete_after_auto_recovery",
      "complete_after_manual_recovery"
    ].includes(latestTurn.status);
  const unreviewedQuestionCount = trajectory?.turns.filter(
    (turn) => turn.questionObservation && !turn.questionObservation.review
  ).length ?? 0;
  const endReviewHelpId = "gi088-end-review-help";
  const batchComplete = session.batch.completedTaskCount === session.batch.totalTasks;
  const sealed = session.batch.status === "sealed";
  const earlyStopped = session.batch.status === "early_stopped";
  const terminal = sealed || earlyStopped;
  const runReadOnly = terminal || Boolean(session.batch.readOnly);
  const serverProcessing = sessionHasActiveServerWork(session);
  const recoveryActive = Boolean(activeTask && Object.values(
    activeTask.branches
  ).some((branch) => branch.turns.some((turn) =>
    turn.recovery?.status === "eligible" ||
    turn.recovery?.status === "retrying" ||
    turn.recovery?.status === "manual_retrying"
  )));
  const abortBlockedByActiveCall = serverProcessing && !recoveryActive;
  const busy = pending || serverProcessing;

  const showRecoveryToast = useCallback((toast: NonNullable<RecoveryToastState>) => {
    if (recoveryToastTimerRef.current !== null) {
      window.clearTimeout(recoveryToastTimerRef.current);
    }
    setRecoveryToast(toast);
    recoveryToastTimerRef.current = window.setTimeout(() => {
      setRecoveryToast(null);
      recoveryToastTimerRef.current = null;
    }, 6_000);
  }, []);

  const handleGenerationProgress = useCallback(
    (progress: Gi088GenerationProgress) => {
      setPending(true);
      setPendingOperation((current) => ({
        taskId: current?.taskId ?? session.activeTask?.taskId ?? currentTask.id,
        branch: "high",
        kind: progress.type === "recovery_started"
          ? progress.trigger === "TIMEOUT"
            ? "automatic_timeout_recovery"
            : progress.trigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
              ? "automatic_stage_transition_recovery"
              : "automatic_empty_content_recovery"
          : "generation",
        startedAt: current?.startedAt ?? Date.now()
      }));
      if (
        progress.type === "recovery_started" &&
        progress.callId &&
        !hasShownRecoveryToast(progress.callId)
      ) {
        activePrefixRecoveryCallRef.current = progress.callId;
        showRecoveryToast({
          callId: `starting:${progress.callId}`,
          message: progress.trigger === "TIMEOUT"
            ? "这次连接超时，服务端正在自动恢复，请再等一会儿～"
            : progress.trigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
              ? "刚才的回应没有顺利完成阶段转换，服务端正在自动整理。"
              : "刚才只完成了思考，服务端正在继续整理最终回答。"
        });
      }
    },
    [currentTask.id, session.activeTask?.taskId, showRecoveryToast]
  );

  useEffect(() => () => {
    if (recoveryToastTimerRef.current !== null) {
      window.clearTimeout(recoveryToastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (terminal) clearRunLocalState(runId);
  }, [runId, terminal]);

  useEffect(() => {
    const sync = createGi088EvaluationSync();
    syncRef.current = sync;
    const unsubscribe = sync.subscribe((notice) => {
      if (notice.runId === runId) setExternalUpdate(true);
    });
    return () => {
      unsubscribe();
      sync.close();
      syncRef.current = null;
    };
  }, [runId]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 1280px)");
    const sync = () => setDesktopLayout(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const branch = highOnly
      ? "high"
      : (activeTaskBranch ?? "off");
    const entries = listGi088EvaluationOutboxEntries().filter(
      (entry) => entry.runId === runId
    );
    const turnOutbox = entries.find((entry) =>
      entry.kind === "turn" &&
      entry.taskId === activeTaskId &&
      entry.branch === branch
    );
    const startOutbox = entries.find((entry) =>
      entry.kind === "start_task" &&
      entry.taskId === currentTask.id &&
      entry.branch === (highOnly ? "high" : "off")
    );
    const turnScope = draftScope({
      runId,
      taskId: activeTaskId,
      branch: activeTaskId ? branch : null,
      form: "chat_input",
      turnId: null
    });
    const initialScope = draftScope({
      runId,
      taskId: currentTask.id,
      branch: highOnly ? "high" : "off",
      form: "chat_input",
      turnId: null
    });
    const restoredTurnDraft = activeTaskId
      ? readGi088EvaluationDraft<string>(turnScope)?.value ??
        turnOutbox?.content ??
        ""
      : "";
    const restoredInitialDraft = !activeTaskId
      ? readGi088EvaluationDraft<string>(initialScope)?.value ??
        startOutbox?.content ??
        ""
      : "";
    setSelectedBranch(branch);
    setDraft(restoredTurnDraft);
    setInitialUserMessage(restoredInitialDraft);
    setReviewingBranch(null);
    const taskAbortScope = draftScope({
      runId,
      taskId: activeTaskId,
      branch: null,
      form: "early_stop_reason",
      turnId: null
    });
    setAbortReason(
      readGi088EvaluationDraft<string>(taskAbortScope)?.value ?? ""
    );
    setAbortOpen(false);
    setAbandonRecovery(false);
    setIssue(null);
    if (!runReadOnly && (restoredTurnDraft || restoredInitialDraft)) {
      const restoredContent = restoredTurnDraft || restoredInitialDraft;
      void createGi088EvaluationContentHash(JSON.stringify({
        runId,
        taskId: activeTaskId ?? currentTask.id,
        branch,
        form: "chat_input",
        content: restoredContent
      })).then((fingerprint) => reportGi088OperationEvent({
          runId,
          taskId: activeTaskId ?? currentTask.id,
          route: "workbench",
          code: "GI088_DRAFT_RESTORED",
          safeSummary: { form: "chat_input" },
          clientOperationId: `gi088-draft-restored-${fingerprint}`
        }))
        .catch(() => undefined);
    }
  }, [
    currentTask.id,
    highOnly,
    runId,
    runReadOnly,
    activeTaskBranch,
    activeTaskId
  ]);

  const update = useCallback((
    value: Gi088EvaluationSession,
    publish = true
  ) => {
    setIssue(null);
    setExternalUpdate(false);
    clearConfirmedOutboxes(value);
    const activePrefixCallId = activePrefixRecoveryCallRef.current;
    const recoveredTurn = value.activeTask
      ? Object.values(value.activeTask.branches)
          .flatMap((branch) => branch.turns)
          .find((turn) =>
            turn.recovery?.status === "recovered" &&
            turn.recovery.trigger === "EMPTY_CONTENT" &&
            turn.recovery.recoveryCallId === activePrefixCallId
          )
      : null;
    if (activePrefixCallId && recoveredTurn) {
      rememberRecoveryToast(activePrefixCallId);
      activePrefixRecoveryCallRef.current = null;
      showRecoveryToast({
        callId: activePrefixCallId,
        message: "最终回答已经整理完成，可以继续聊了；两次调用都已写入 Trace。"
      });
    }
    onSession(value);
    if (publish) {
      syncRef.current?.publish({
        runId: runIdOf(value),
        taskId: value.activeTask?.taskId ?? null,
        revision: value.batch.revision ?? null
      });
    }
  }, [onSession, showRecoveryToast]);

  const downloadExport = useCallback(
    async (value: Gi088EvaluationSession = session) => {
      setExporting(true);
      try {
        await downloadGi088EvaluationExport({
          evaluationVersion: value.evaluation.version,
          runId: runIdOf(value),
          completedTaskCount: value.batch.completedTaskCount,
          totalTasks: value.batch.totalTasks
        });
      } catch (error) {
        const nextIssue = issueFromUnknown(error);
        setIssue(nextIssue);
        void reportGi088OperationEvent({
          runId: runIdOf(value),
          route: "export",
          code: nextIssue.code,
          safeSummary: { action: "download" }
        }).catch(() => undefined);
      } finally {
        setExporting(false);
      }
    },
    [session]
  );

  const selectTask = useCallback(
    async (taskId: string) => {
      if (pending) return;
      setPending(true);
      setIssue(null);
      try {
        const selectedTask = session.tasks.find((task) => task.id === taskId);
        update(await getGi088EvaluationSession({
          runId,
          ...(selectedTask?.status === "ready" ? {} : { taskId })
        }), false);
      } catch (error) {
        setIssue(issueFromUnknown(error));
      } finally {
        setPending(false);
      }
    },
    [pending, runId, session.tasks, update]
  );

  useEffect(() => {
    if (!activeTask || !serverProcessing) {
      setPendingOperation((current) =>
        current && current.kind !== "generation" ? null : current
      );
      return;
    }
    const activeBranch = activeTask.activeBranch;
    const activeTrajectory = activeTask.branches[activeBranch];
    const activeTurn = [...activeTrajectory.turns].reverse()
      .find(turnHasActiveServerWork);
    const recovery = activeTurn?.recovery;
    setPendingOperation({
      taskId: activeTask.taskId,
      branch: activeBranch,
      kind: recovery?.status === "manual_retrying"
        ? "manual_recovery"
        : recovery?.trigger === "TIMEOUT"
          ? "automatic_timeout_recovery"
          : recovery?.trigger === "NEW_ANSWER_OPPORTUNITY_UNAVAILABLE"
            ? "automatic_stage_transition_recovery"
            : recovery
              ? "automatic_empty_content_recovery"
              : "generation",
      startedAt: recovery?.startedAt
        ? new Date(recovery.startedAt).getTime()
        : Date.now()
    });
    const pollTimer = window.setTimeout(() => {
      void getGi088EvaluationSession({
        runId,
        taskId: activeTask.taskId
      })
        .then((value) => update(value, false))
        .catch((error) => setIssue(issueFromUnknown(error)));
    }, 2_000);
    return () => window.clearTimeout(pollTimer);
  }, [activeTask, runId, serverProcessing, update]);

  const startOff = async () => {
    if (!initialUserMessage.trim()) return;
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        kind: "start_task",
        runId,
        taskId: currentTask.id,
        branch: highOnly ? "high" : "off",
        baseAssistantMessageId: null,
        content: initialUserMessage
      });
    } catch (error) {
      setIssue(issueFromUnknown(error));
      return;
    }
    setPending(true);
    setPendingOperation({
      taskId: currentTask.id,
      branch: highOnly ? "high" : "off",
      kind: "generation",
      startedAt: Date.now()
    });
    setIssue(null);
    try {
      const next = highOnly
        ? await startGi088HighTrajectory({
            runId,
            taskId: currentTask.id,
            initialUserMessage: outbox.content,
            clientTurnId: outbox.clientTurnId,
            baseAssistantMessageId: null
          }, handleGenerationProgress)
        : await startGi088OffTrajectory({
            runId,
            taskId: currentTask.id,
            initialUserMessage: outbox.content,
            clientTurnId: outbox.clientTurnId,
            baseAssistantMessageId: null
          });
      clearGi088EvaluationOutbox(outbox);
      clearGi088EvaluationDraft(draftScope({
        runId,
        taskId: currentTask.id,
        branch: highOnly ? "high" : "off",
        form: "chat_input",
        turnId: null
      }));
      update(next);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  };

  const startHigh = async () => {
    if (!activeTask) return;
    setPending(true);
    setPendingOperation({
      taskId: activeTask.taskId,
      branch: "high",
      kind: "generation",
      startedAt: Date.now()
    });
    setIssue(null);
    try {
      update(await startGi088HighTrajectory({
        runId,
        taskId: activeTask.taskId,
        clientOperationId: createGi088ClientOperationId("start-high"),
        baseAssistantMessageId:
          activeTask.branches.off.dialogueAnchor?.lastAssistantMessageId ?? null
      }, handleGenerationProgress));
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  };

  const sendTurn = async () => {
    if (!activeTask || !trajectory || !draft.trim()) return;
    const baseAssistantMessageId = lastAssistantMessageId(trajectory);
    if (!baseAssistantMessageId) {
      setIssue({
        code: "GI088_TURN_INPUT_INVALID",
        message: "当前所见回复缺少可校验的消息锚点，请先读取最新状态。",
        retryable: false,
        dataSaved: "yes",
        impact: "turn",
        action: "read_latest_state"
      });
      return;
    }
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        kind: "turn",
        runId,
        taskId: activeTask.taskId,
        branch: selectedBranch,
        baseAssistantMessageId,
        content: draft
      });
    } catch (error) {
      setIssue(issueFromUnknown(error));
      return;
    }
    const content = outbox.content;
    setPending(true);
    setPendingOperation({
      taskId: activeTask.taskId,
      branch: selectedBranch,
      kind: "generation",
      startedAt: Date.now()
    });
    setIssue(null);
    setDraft("");
    try {
      const next = await submitGi088Turn({
        runId,
        taskId: activeTask.taskId,
        branch: selectedBranch,
        content,
        clientTurnId: outbox.clientTurnId,
        baseAssistantMessageId
      }, handleGenerationProgress);
      clearGi088EvaluationOutbox(outbox);
      clearGi088EvaluationDraft(draftScope({
        runId,
        taskId: activeTask.taskId,
        branch: selectedBranch,
        form: "chat_input",
        turnId: null
      }));
      update(next);
    } catch (error) {
      setDraft(content);
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
      setPendingOperation(null);
    }
  };

  const seal = async () => {
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        runId,
        taskId: "__run__",
        branch: "high",
        kind: "seal",
        baseAssistantMessageId: null,
        content: "seal",
        confirmationFingerprint: session.batch.revision?.toString() ?? null
      });
    } catch (error) {
      setIssue(issueFromUnknown(error));
      return;
    }
    setPending(true);
    setIssue(null);
    try {
      const next = await sealGi088EvaluationBatch({
        runId,
        clientOperationId: outbox.clientTurnId
      });
      clearGi088EvaluationOutbox(outbox);
      update(next);
      clearRunLocalState(runId);
      setSealOpen(false);
      await downloadExport(next);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
    }
  };

  const earlyStop = async () => {
    if (!earlyStopReasonCode || !earlyStopReason.trim()) return;
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        runId,
        taskId: "__run__",
        branch: "high",
        kind: "early_stop",
        baseAssistantMessageId: null,
        content: JSON.stringify({
          reasonCode: earlyStopReasonCode,
          reason: earlyStopReason.trim()
        }),
        confirmationFingerprint: session.batch.revision?.toString() ?? null
      });
    } catch (error) {
      setIssue(issueFromUnknown(error));
      return;
    }
    setPending(true);
    setIssue(null);
    try {
      const next = await earlyStopGi088EvaluationBatch({
        runId,
        reasonCode: earlyStopReasonCode,
        reason: earlyStopReason.trim(),
        clientOperationId: outbox.clientTurnId
      });
      clearGi088EvaluationOutbox(outbox);
      update(next);
      clearRunLocalState(runId);
      setEarlyStopOpen(false);
      await downloadExport(next);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
    }
  };

  const closeEarlyStop = () => {
    setEarlyStopOpen(false);
    requestAnimationFrame(() => earlyStopToggleRef.current?.focus());
  };

  const abortCurrentTask = async () => {
    if (!activeTask || !abortReason.trim()) return;
    let outbox;
    try {
      outbox = await prepareGi088EvaluationOutbox({
        runId,
        taskId: activeTask.taskId,
        branch: selectedBranch,
        kind: "abort_current_task",
        baseAssistantMessageId: lastAssistantMessageId(trajectory),
        content: abortReason,
        confirmationFingerprint: abandonRecovery
          ? "abandon-recovery"
          : "ordinary-abort"
      });
    } catch (error) {
      setIssue(issueFromUnknown(error));
      return;
    }
    setPending(true);
    setIssue(null);
    try {
      const next = await abortGi088CurrentTask({
        runId,
        taskId: activeTask.taskId,
        reason: outbox.content,
        abandonRecovery,
        clientOperationId: outbox.clientTurnId
      });
      clearGi088EvaluationOutbox(outbox);
      clearGi088EvaluationDraft(draftScope({
        runId,
        taskId: activeTask.taskId,
        branch: null,
        form: "early_stop_reason",
        turnId: null
      }));
      update(next);
      setAbortOpen(false);
      setAbortReason("");
      setAbandonRecovery(false);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
    }
  };

  const readLatest = useCallback(async () => {
    setPending(true);
    try {
      update(await getGi088EvaluationSession({
        runId,
        ...(activeTask ? { taskId: activeTask.taskId } : {})
      }), false);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
    }
  }, [activeTask, runId, update]);

  const returnToCurrentTask = useCallback(async () => {
    setPending(true);
    try {
      update(await getGi088EvaluationSession({ runId }), false);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
    }
  }, [runId, update]);

  const generateAgain = useCallback(async () => {
    if (!activeTask) {
      await readLatest();
      return;
    }
    const orderedBranches = [
      selectedBranch,
      ...(["off", "high"] as const).filter((branch) => branch !== selectedBranch)
    ];
    const candidate = orderedBranches.flatMap((branch) =>
      [...activeTask.branches[branch].turns]
        .reverse()
        .filter((turn) => turn.recovery?.status === "manual_available")
        .map((turn) => ({ branch, turnId: turn.id }))
    )[0];
    if (!candidate) {
      await readLatest();
      return;
    }
    setPending(true);
    try {
      update(await retryGi088Turn({
        runId,
        taskId: activeTask.taskId,
        branch: candidate.branch,
        turnId: candidate.turnId,
        trigger: "manual_after_auto_recovery"
      }));
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setPending(false);
    }
  }, [activeTask, readLatest, runId, selectedBranch, update]);

  const handleIssueAction = useCallback((action: Gi088IssueAction) => {
    if (action === "seal_and_export") {
      if (terminal) void downloadExport();
      else if (batchComplete) setSealOpen(true);
      else void readLatest();
      return;
    }
    if (action === "return_to_current_task") {
      void returnToCurrentTask();
      return;
    }
    if (action === "generate_again") {
      void generateAgain();
      return;
    }
    if (action === "none") return;
    void readLatest();
  }, [batchComplete, downloadExport, generateAgain, readLatest, returnToCurrentTask, terminal]);

  return (
    <>
      <RecoveryToast toast={recoveryToast} />
      <Surface as="section" className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-4 py-5 md:px-6" data-testid="gi088-evaluation-workbench">
        <header className="mx-auto max-w-[116rem]">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="archive-label">
                {highOnly
                  ? "GI-088 · v8r2 评测底座加固"
                  : "GI-088 · 真人交互开发评测集 v4 阶段转场候选"}
              </p>
              <h1 className="mt-3 max-w-4xl text-balance font-display text-3xl leading-tight text-ink md:text-4xl">
                {highOnly ? "持续聊下去，也能随时回看和纠正" : "同一起点，两条真实聊天轨迹"}
              </h1>
              <p className="mt-2 max-w-4xl text-pretty text-sm leading-7 text-[var(--text-dim)]">
                {highOnly
                  ? "12 项任务只运行官方 DeepSeek V4 Pro 的 Thinking high。程序维护确定性来源、礼貌停聊与停止状态；轨迹不设次数上限，单次生成最多 60 秒，自动恢复链总计不超过 90 秒。所有可见提问都要在 Trace 完成人工分类。"
                  : "完成 Thinking 关闭分支，再从相同 A0＋U1 独立开启高 Thinking。任务提示只对你可见，模型只接收真实对话。"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl tabular-nums text-ink">{session.batch.completedTaskCount}<span className="text-base text-[var(--text-faint)]"> / {session.batch.totalTasks}</span></p>
              <p className="mt-1 font-mono text-xs text-[var(--text-faint)]">
                {sealed
                  ? "BATCH SEALED"
                  : earlyStopped
                    ? "BATCH EARLY STOPPED"
                    : "BATCH IN PROGRESS"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                任务目标触发 {session.batch.targetCoverage.triggeredTrajectoryCount} / 已评价 {session.batch.targetCoverage.reviewedTrajectoryCount} 条轨迹
              </p>
            </div>
          </div>
          <div
            className="mt-5 h-1 overflow-hidden rounded-full bg-paper/35"
            role="progressbar"
            aria-label="整批评测进度"
            aria-valuemin={0}
            aria-valuemax={session.batch.totalTasks}
            aria-valuenow={session.batch.completedTaskCount}
          >
            <div className="h-full rounded-full bg-ink" style={{ width: `${(session.batch.completedTaskCount / session.batch.totalTasks) * 100}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3" aria-label="评测运行与导出">
            <label className="text-xs font-semibold text-[var(--text-dim)]">
              当前运行
              <select
                className="mt-1 block rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/65 px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                value={runId}
                disabled={busy}
                onChange={(event) => onSelectRun(event.target.value)}
              >
                {runs.map((run) => (
                  <option key={run.runId} value={run.runId}>
                    #{run.runOrdinal} · {run.status} · {run.completedTaskCount}/{run.totalTasks}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {!runs.some(isWritableCurrentRun) ? (
                <ActionButton type="button" variant="secondary" disabled={creatingRun || busy} onClick={onCreateRun}>
                  {creatingRun ? "正在创建复测" : "创建同候选复测"}
                </ActionButton>
              ) : null}
              <ActionButton type="button" variant="secondary" disabled={exporting} onClick={() => void downloadExport()}>
                {exporting ? "正在校验导出" : "下载已验证 JSON"}
              </ActionButton>
            </div>
          </div>
          {session.batch.readOnly ? (
            <p className="mt-3 border-l-2 border-[var(--line-strong)] pl-3 text-sm text-[var(--text-dim)]" role="status">
              历史只读：{session.batch.readOnlyReason ?? "当前执行指纹与该运行不同，仍可查看和导出。"}
            </p>
          ) : null}
          {externalUpdate ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[var(--amber)] pl-3 text-sm" role="status" aria-live="polite">
              <p>另一标签页已经更新这次运行，请读取最新状态。</p>
              <ActionButton type="button" variant="secondary" disabled={pending} onClick={() => void readLatest()}>
                读取最新状态
              </ActionButton>
            </div>
          ) : null}
          {!highOnly && !runReadOnly ? (
            <TechnicalSmokePanel
              executionFingerprint={session.evaluation.executionFingerprint}
              highOnly={highOnly}
            />
          ) : null}
        </header>

        <Divider className="mx-auto my-5 max-w-[116rem]" />

        <GateAndMetricsSummary session={session} />
        <EvidenceGovernancePanel
          session={session}
          disabled={busy || runReadOnly}
          onUpdated={update}
          onError={setIssue}
          onPending={setPending}
        />

        {!desktopLayout ? <details className="mx-auto mb-4 max-w-[116rem] rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-paper/55 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay">
            查看任务 · {session.batch.completedTaskCount}/{session.batch.totalTasks}
          </summary>
          <div className="mt-3">
            <TaskRail session={session} onSelect={(taskId) => void selectTask(taskId)} compact />
          </div>
        </details> : null}

        <div className="mx-auto grid max-w-[116rem] gap-4 xl:h-[calc(100dvh-var(--site-header-viewport-offset)-12rem)] xl:grid-cols-[18rem_minmax(30rem,1fr)_22rem]">
          {desktopLayout ? <div className="min-h-0">
            <TaskRail session={session} onSelect={(taskId) => void selectTask(taskId)} />
          </div> : null}

          <Card
            as="section"
            className="flex min-h-[36rem] min-w-0 flex-col overflow-hidden p-0 md:min-h-[42rem] xl:min-h-0"
            aria-labelledby="gi088-current-task-title"
            aria-busy={busy}
            data-testid="gi088-dialogue-panel"
          >
            <div className="px-5 pb-4 pt-5 md:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-[var(--text-faint)]">{currentTask.id}{currentTask.repeatOf ? ` · 复测 ${currentTask.repeatOf}` : ""}</p>
                  <h2 id="gi088-current-task-title" className="mt-1 text-balance font-display text-2xl text-ink">{currentTask.title}</h2>
                  <p className="mt-2 max-w-3xl border-l-2 border-[var(--amber)] pl-3 text-pretty text-sm leading-6 text-[var(--text-dim)]">{currentTask.instruction}</p>
                </div>
                {activeTask && !highOnly ? <BranchTabs selected={selectedBranch} activeTask={activeTask} onSelect={setSelectedBranch} /> : null}
              </div>
              {activeTask ? (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-faint)]">
                  <span className="rounded-full bg-[var(--moss-soft)] px-2.5 py-1 text-ink/80">
                    {activeTask.readOnly
                      ? runReadOnly
                        ? "只读回看"
                        : "对话只读 · 评价可修订"
                      : highOnly
                        ? "A0＋U1 已保存"
                        : "A0＋U1 已冻结"}
                  </span>
                  <span>{highOnly ? "仅运行 Thinking high" : "两条分支上下文独立"}</span>
                  <span>已使用 {trajectory?.config.providerCallsUsed ?? 0} 次，本轨迹不设上限；同一段原话最多 3 次调用</span>
                  <span>
                    当前配置：{trajectory?.config.label ?? branchLabel[activeTask.activeBranch]} · 温度 {trajectory?.config.temperature ?? "N/A"} · Reasoning {trajectory?.config.reasoningEffort ?? "关闭"}
                  </span>
                </div>
              ) : null}
            </div>
            <Divider />

            {!activeTask ? (
              <div className="flex min-h-0 flex-1 flex-col px-5 py-6 md:px-6">
                {issue ? <InlineIssue issue={issue} onAction={handleIssueAction} /> : null}
                {terminal ? (
                  <div className="m-auto max-w-xl text-center">
                    <p className="text-balance font-display text-3xl text-ink">
                      {earlyStopped ? "这一批已经提前结束" : "这一批已经封存"}
                    </p>
                    <p className="mt-3 text-pretty text-sm leading-7 text-[var(--text-dim)]">
                      {earlyStopped
                        ? `已完成 ${session.batch.completedTaskCount} 项；其余任务标记为未执行。现有轨迹、Trace 和评价已经进入只读状态。`
                        : "所有轨迹、Trace 和产品裁决进入只读状态，可以导出交给下一条批次迭代任务。"}
                    </p>
                    {session.batch.earlyStop ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-dim)]">
                        提前结束原因：{session.batch.earlyStop.reason}
                      </p>
                    ) : null}
                    <ActionButton
                      type="button"
                      className="mt-5"
                      variant="primary"
                      disabled={exporting}
                      onClick={() => void downloadExport()}
                    >
                      {exporting ? "正在准备完整结果" : "再次下载完整 JSON"}
                    </ActionButton>
                  </div>
                ) : batchComplete ? (
                  <div className="m-auto max-w-xl text-center">
                    <p className="text-balance font-display text-3xl text-ink">{session.batch.totalTasks} 项都已完成</p>
                    <p className="mt-3 text-pretty text-sm leading-7 text-[var(--text-dim)]">封存会让整批进入永久只读状态。确认完成后，再开始一条新的批次迭代任务。</p>
                    <ActionButton type="button" className="mt-5" variant="primary" disabled={pending} onClick={() => setSealOpen(true)}>封存整批结果</ActionButton>
                  </div>
                ) : (
                  <div className="m-auto w-full max-w-2xl">
                    <p className="font-mono text-xs text-[var(--text-faint)]">固定开场 A0</p>
                    <p className="mt-2 text-balance font-display text-2xl text-ink">“此刻你想聊点什么？”</p>
                    <p className="mt-3 text-pretty text-sm leading-7 text-[var(--text-dim)]">
                      {highOnly
                        ? "用一件此刻真实想聊的内容回答。提交后会直接开始 Thinking high 轨迹。"
                        : "用一件此刻真实想聊的内容回答。U1 提交后会同时成为两条分支的冻结起点，后续无法改写。"}
                    </p>
                    <label className="mt-5 block text-xs font-semibold text-[var(--text-dim)]">
                      你的第一段表达 U1
                      <textarea
                        value={initialUserMessage}
                        disabled={busy || runReadOnly}
                        onChange={(event) => {
                          writeGi088EvaluationDraft(draftScope({
                            runId,
                            taskId: currentTask.id,
                            branch: highOnly ? "high" : "off",
                            form: "chat_input",
                            turnId: null
                          }), event.target.value);
                          setInitialUserMessage(event.target.value);
                        }}
                        rows={5}
                        maxLength={4000}
                        autoFocus
                        placeholder="按你平时来 Daily Light 的方式直接说就可以。"
                        className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/60 px-4 py-3 text-base leading-7 text-ink outline-none transition focus:border-[var(--line-strong)] focus:bg-paper/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                      />
                    </label>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <ActionButton type="button" variant="primary" disabled={busy || runReadOnly || !initialUserMessage.trim()} onClick={startOff}>
                        {highOnly ? "开始 Thinking high 评测" : "冻结起点并开始关闭组"}
                      </ActionButton>
                      <span className="text-xs text-[var(--text-faint)]">首次模型调用从这一步发生</span>
                    </div>
                    {session.batch.completedTaskCount > 0 ? (
                      <div className="mt-6 border-t border-[var(--line-soft)] pt-5">
                        <ActionButton
                          ref={earlyStopToggleRef}
                          type="button"
                          variant="ghost"
                          disabled={pending}
                          aria-expanded={earlyStopOpen}
                          aria-controls="gi088-early-stop-form"
                          onClick={() => setEarlyStopOpen((value) => !value)}
                        >
                          {earlyStopOpen ? "收起提前结束" : "提前结束本批"}
                        </ActionButton>
                        {earlyStopOpen ? (
                          <section id="gi088-early-stop-form" className="mt-4" aria-labelledby="gi088-early-stop-title">
                            <h3 id="gi088-early-stop-title" className="font-semibold text-ink">提前结束本批</h3>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">
                              只会封存已完成任务；其余任务标记为未执行。整批随后进入只读状态。
                            </p>
                            <div className="mt-4 space-y-4">
                              <ChoiceGroup
                                label="提前结束原因"
                                value={earlyStopReasonCode}
                                options={earlyStopReasonOptions}
                                onChange={(value) => {
                                  setEarlyStopReasonCode(value);
                                  writeGi088EvaluationDraft(draftScope({
                                    runId,
                                    taskId: null,
                                    branch: null,
                                    form: "early_stop_reason",
                                    turnId: null
                                  }), {
                                    reasonCode: value,
                                    reason: earlyStopReason
                                  });
                                }}
                                disabled={busy || runReadOnly}
                                required
                              />
                              <label className="block text-xs font-semibold text-[var(--text-dim)]">
                                具体说明（必填）
                                <textarea
                                  value={earlyStopReason}
                                  disabled={busy || runReadOnly}
                                  onChange={(event) => {
                                    setEarlyStopReason(event.target.value);
                                    writeGi088EvaluationDraft(draftScope({
                                      runId,
                                      taskId: null,
                                      branch: null,
                                      form: "early_stop_reason",
                                      turnId: null
                                    }), {
                                      reasonCode: earlyStopReasonCode,
                                      reason: event.target.value
                                    });
                                  }}
                                  rows={3}
                                  maxLength={2_000}
                                  required
                                  aria-describedby="gi088-early-stop-help gi088-early-stop-submit-help"
                                  className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                                />
                              </label>
                              <p id="gi088-early-stop-help" className="text-xs leading-5 text-[var(--text-faint)]">
                                说明会进入只读导出，用于解释本批覆盖范围。
                              </p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <ActionButton
                                type="button"
                                variant="primary"
                                disabled={busy || runReadOnly || !earlyStopReasonCode || !earlyStopReason.trim()}
                                aria-describedby="gi088-early-stop-submit-help"
                                onClick={earlyStop}
                              >
                                确认提前结束
                              </ActionButton>
                              <ActionButton type="button" variant="ghost" disabled={busy} onClick={closeEarlyStop}>
                                继续评测
                              </ActionButton>
                            </div>
                            <p id="gi088-early-stop-submit-help" className="mt-2 text-xs leading-5 text-[var(--text-faint)]">
                              选择一个必选原因并填写具体说明后可确认。
                            </p>
                          </section>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : trajectory ? (
              <>
                <div className="min-h-0 flex-1">
                  <Conversation
                    trajectory={trajectory}
                    pendingOperation={
                      pendingOperation?.taskId === activeTask.taskId &&
                      pendingOperation.branch === selectedBranch
                        ? pendingOperation
                        : null
                    }
                  />
                </div>
                <Divider />
                <div className="max-h-[48%] shrink-0 overflow-y-auto overscroll-contain bg-paper/35 px-5 py-4 md:px-6" data-testid="gi088-trajectory-controls">
                  {issue ? <div className="mb-4"><InlineIssue issue={issue} onAction={handleIssueAction} /></div> : null}
                  {unreviewedQuestionCount > 0 ? (
                    <div id={endReviewHelpId} className="mb-4 border-l-2 border-[var(--amber)] pl-4 text-sm leading-6" role="status">
                      <p className="font-semibold text-ink">还有 {unreviewedQuestionCount} 轮提问等待人工分类</p>
                      <p className="mt-1 text-[var(--text-dim)]">可以继续聊天；结束轨迹前，请在右侧 Trace 完成全部回答焦点复核。</p>
                    </div>
                  ) : null}
                  <TechnicalFailure
                    runId={runId}
                    taskId={activeTask.taskId}
                    branch={selectedBranch}
                    trajectory={trajectory}
                    disabled={busy || runReadOnly || reviewingBranch === selectedBranch || Boolean(activeTask.readOnly)}
                    onUpdated={update}
                    onError={setIssue}
                    onPending={setPending}
                    allowManualRetry={!highOnly}
                  />
                  <ProtectedFailure
                    runId={runId}
                    taskId={activeTask.taskId}
                    branch={selectedBranch}
                    trajectory={trajectory}
                    disabled={busy || runReadOnly || Boolean(activeTask.readOnly)}
                    onUpdated={update}
                    onError={setIssue}
                    onPending={setPending}
                  />

                  {trajectory.review && reviewingBranch !== selectedBranch ? (
                    <ReadonlyReview
                      review={trajectory.review}
                      canRevise={!runReadOnly}
                      onRevise={() => setReviewingBranch(selectedBranch)}
                    />
                  ) : null}

                  {!runReadOnly &&
                  reviewingBranch === selectedBranch &&
                  (
                    (!activeTask.readOnly && ["running", "protected_failure", "technical_failure"].includes(trajectory.status)) ||
                    Boolean(trajectory.review && trajectory.status === "completed")
                  ) ? (
                    <ReviewForm
                      runId={runId}
                      taskId={activeTask.taskId}
                      branch={selectedBranch}
                      targetTriggerPrompt={currentTask.targetTriggerPrompt}
                      criterion={currentTask.criterion}
                      hasTechnicalFailure={trajectory.turns.some(
                        (turn) => turn.status === "technical_failure" || turn.calls.some((call) => call.status === "technical_failure")
                      )}
                      disabled={busy}
                      cancelLabel={trajectory.status === "running" ? "继续聊" : "暂不评价"}
                      onCancel={() => setReviewingBranch(null)}
                      onUpdated={update}
                      onError={setIssue}
                      onPending={setPending}
                      reviewSnapshotFingerprint={
                        trajectory.reviewSnapshotFingerprint ??
                        activeTask.reviewSnapshot?.fingerprint ??
                        activeTask.taskId
                      }
                      currentReview={trajectory.review}
                      reviewSnapshot={activeTask.reviewSnapshot ?? null}
                    />
                  ) : null}

                  {!highOnly && selectedBranch === "off" && trajectory.status === "completed" && activeTask.branches.high.status === "not_started" ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-[var(--amber)] pl-4">
                      <div><p className="font-semibold text-ink">关闭组已经封存</p><p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">开启组将从完全相同的 A0＋U1 建立独立上下文。</p></div>
                      <ActionButton type="button" variant="primary" disabled={busy || runReadOnly} onClick={startHigh}>切换并开始 Thinking 开启组</ActionButton>
                    </div>
                  ) : null}

                  {!highOnly && activeTask.branches.off.status === "completed" && activeTask.branches.high.status === "completed" ? (
                    <ComparisonForm
                      runId={runId}
                      taskId={activeTask.taskId}
                      comparison={activeTask.comparison}
                      disabled={busy || runReadOnly}
                      onUpdated={update}
                      onError={setIssue}
                      onPending={setPending}
                    />
                  ) : null}

                  {!runReadOnly && !activeTask.readOnly && trajectory.status === "running" && !trajectoryPaused && reviewingBranch !== selectedBranch ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="min-w-0 flex-1 text-xs font-semibold text-[var(--text-dim)]">
                        继续自然交流
                        <textarea
                          value={draft}
                          disabled={busy || runReadOnly || Boolean(trajectory.pendingTurnId)}
                          onChange={(event) => {
                            writeGi088EvaluationDraft(draftScope({
                              runId,
                              taskId: activeTask.taskId,
                              branch: selectedBranch,
                              form: "chat_input",
                              turnId: null
                            }), event.target.value);
                            setDraft(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                              event.preventDefault();
                              void sendTurn();
                            }
                          }}
                          rows={3}
                          maxLength={4000}
                          placeholder="直接回应 AI。⌘ Enter 发送"
                          className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[var(--line-strong)] focus:bg-paper/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                        />
                      </label>
                      <div className="flex shrink-0 flex-wrap gap-2 pb-0.5 sm:flex-col">
                        <ActionButton type="button" variant="primary" disabled={busy || Boolean(trajectory.pendingTurnId) || !draft.trim()} onClick={sendTurn}>发送</ActionButton>
                        <ActionButton type="button" variant="ghost" disabled={busy || Boolean(trajectory.pendingTurnId) || unreviewedQuestionCount > 0} aria-describedby={unreviewedQuestionCount > 0 ? endReviewHelpId : undefined} onClick={() => setReviewingBranch(selectedBranch)}>结束并评价</ActionButton>
                      </div>
                    </div>
                  ) : null}
                  {!runReadOnly && !activeTask.readOnly && trajectory.status === "running" && trajectoryPaused && reviewingBranch !== selectedBranch ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-[var(--amber)] pl-4" role="status">
                      <div>
                        <p className="font-semibold text-ink">追问已经暂停</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">原话和当前状态已经保留。完成右侧提问分类后，可以结束并评价这条轨迹。</p>
                      </div>
                      <ActionButton
                        type="button"
                        variant="primary"
                        disabled={busy || unreviewedQuestionCount > 0}
                        aria-describedby={unreviewedQuestionCount > 0 ? endReviewHelpId : undefined}
                        onClick={() => setReviewingBranch(selectedBranch)}
                      >
                        结束并评价
                      </ActionButton>
                    </div>
                  ) : null}
                  {!runReadOnly && !activeTask.readOnly && trajectory.status === "protected_failure" &&
                  reviewingBranch !== selectedBranch &&
                  !trajectory.turns.some(
                    (turn) =>
                      turn.recovery?.status === "eligible" ||
                      turn.recovery?.status === "retrying"
                  ) ? (
                    <div className="mt-4">
                      <ActionButton type="button" variant="primary" disabled={busy || unreviewedQuestionCount > 0} aria-describedby={unreviewedQuestionCount > 0 ? endReviewHelpId : undefined} onClick={() => setReviewingBranch(selectedBranch)}>
                        {highOnly ? "评价当前轨迹" : "评价当前分支并继续对照"}
                      </ActionButton>
                    </div>
                  ) : null}
                  {!runReadOnly && !activeTask.readOnly && trajectory.status === "technical_failure" &&
                  reviewingBranch !== selectedBranch &&
                  !trajectory.turns.some(
                    (turn) =>
                      turn.recovery?.status === "eligible" ||
                      turn.recovery?.status === "retrying"
                  ) ? (
                    <div className="mt-3">
                      <ActionButton type="button" variant="primary" disabled={busy || unreviewedQuestionCount > 0} aria-describedby={unreviewedQuestionCount > 0 ? endReviewHelpId : undefined} onClick={() => setReviewingBranch(selectedBranch)}>结束并评价当前技术失败</ActionButton>
                    </div>
                  ) : null}
                  {!runReadOnly && !activeTask.readOnly ? (
                    <section className="mt-5 border-t border-[var(--line-soft)] pt-4" aria-label="安全终止当前任务">
                      <ActionButton
                        type="button"
                        variant="ghost"
                        disabled={pending || abortBlockedByActiveCall}
                        aria-expanded={abortOpen}
                        aria-controls="gi088-abort-task-form"
                        onClick={() => setAbortOpen((value) => !value)}
                      >
                        {abortOpen ? "收起任务终止" : "安全终止当前任务"}
                      </ActionButton>
                      {abortBlockedByActiveCall ? (
                        <p className="mt-2 text-xs text-[var(--text-faint)]" role="status">
                          当前模型调用仍在执行，调用收口后才能终止任务。
                        </p>
                      ) : null}
                      {abortOpen ? (
                        <div id="gi088-abort-task-form" className="mt-3 space-y-3">
                          <h3 className="font-semibold text-ink">终止当前任务并保留部分证据</h3>
                          <p id="gi088-abort-task-help" className="text-xs leading-5 text-[var(--text-dim)]">
                            当前原话、可见回应和 Trace 会保留；本项记为已终止，整批进入 No-Go，后续任务仍可继续。
                          </p>
                          <label className="block text-xs font-semibold text-[var(--text-dim)]">
                            终止原因（必填）
                            <textarea
                              value={abortReason}
                              disabled={pending}
                              onChange={(event) => {
                                setAbortReason(event.target.value);
                                writeGi088EvaluationDraft(draftScope({
                                  runId,
                                  taskId: activeTask.taskId,
                                  branch: null,
                                  form: "early_stop_reason",
                                  turnId: null
                                }), event.target.value);
                              }}
                              rows={3}
                              maxLength={2_000}
                              required
                              aria-describedby="gi088-abort-task-help"
                              className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-paper/55 px-3 py-2 text-sm font-normal leading-6 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                            />
                          </label>
                          {recoveryActive ? (
                            <label className="flex items-start gap-2 text-xs leading-5 text-[var(--text-dim)]">
                              <input
                                type="checkbox"
                                checked={abandonRecovery}
                                disabled={pending}
                                onChange={(event) => setAbandonRecovery(event.target.checked)}
                                className="mt-1"
                              />
                              放弃当前恢复并封存失败；迟到结果只保留安全诊断，不写入对话。
                            </label>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <ActionButton
                              type="button"
                              variant="primary"
                              disabled={
                                pending ||
                                !abortReason.trim() ||
                                (recoveryActive && !abandonRecovery)
                              }
                              onClick={() => void abortCurrentTask()}
                            >
                              确认终止当前任务
                            </ActionButton>
                            <ActionButton type="button" variant="ghost" disabled={pending} onClick={() => setAbortOpen(false)}>
                              继续保留当前任务
                            </ActionButton>
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </>
            ) : null}
          </Card>

          {trajectory ? (
            desktopLayout ? (
              <TraceLedger
                taskId={activeTask!.taskId}
                branch={selectedBranch}
                trajectory={trajectory}
                session={session}
                disabled={busy || runReadOnly}
                onUpdated={update}
                onError={setIssue}
                onPending={setPending}
              />
            ) : (
              <details className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-paper/55 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay">
                  查看 Trace · {trajectory.turns.length} 轮
                </summary>
                <div className="mt-3">
                  <TraceLedger
                    taskId={activeTask!.taskId}
                    branch={selectedBranch}
                    trajectory={trajectory}
                    session={session}
                    disabled={busy || runReadOnly}
                    onUpdated={update}
                    onError={setIssue}
                    onPending={setPending}
                  />
                </div>
              </details>
            )
          ) : (
            <Card as="aside" className="min-h-[22rem] p-5">
              <SectionHeading title="透明 Trace" description="开始评测后持续显示配置、共同任务、当前探查和原话证据。" />
              <Divider className="my-4" />
              <dl className="space-y-3 text-xs leading-5">
                <div><dt className="text-[var(--text-faint)]">模型</dt><dd className="mt-0.5 font-mono text-ink">{session.evaluation.model}</dd></div>
                {!highOnly ? <div><dt className="text-[var(--text-faint)]">关闭组</dt><dd className="mt-0.5 text-ink">Thinking 关闭 · 温度 0.2</dd></div> : null}
                <div><dt className="text-[var(--text-faint)]">开启组</dt><dd className="mt-0.5 text-ink">Thinking 开启 · reasoning high · 温度 N/A</dd></div>
                <div><dt className="text-[var(--text-faint)]">共同输出</dt><dd className="mt-0.5 text-ink">结构化 JSON · 应用不设 Token 上限 · 同一段原话最多三次调用</dd></div>
                <div><dt className="text-[var(--text-faint)]">轨迹调用</dt><dd className="mt-0.5 text-ink">已使用 N 次，本轨迹不设上限</dd></div>
                {highOnly ? <div><dt className="text-[var(--text-faint)]">等待策略</dt><dd className="mt-0.5 text-ink">响应头 15 秒 · 正文空闲 45 秒 · 总时长 60 秒</dd></div> : null}
                <div><dt className="text-[var(--text-faint)]">执行指纹</dt><dd title={session.evaluation.executionFingerprint} className="mt-0.5 font-mono text-ink">{compactFingerprint(session.evaluation.executionFingerprint)}</dd></div>
                <div><dt className="text-[var(--text-faint)]">数据状态</dt><dd className="mt-0.5 text-ink">{terminal ? "只读封存" : "Preview 独立评测存储"}</dd></div>
              </dl>
            </Card>
          )}
        </div>
      </Surface>

      <ConfirmDialog
        open={sealOpen}
        title={`确认封存这 ${session.batch.totalTasks} 项评测？`}
        description="封存后整批轨迹、Trace 和产品裁决进入永久只读状态，页面将无法继续生成或修改。"
        eyebrow="整批停止点"
        confirmLabel="确认封存"
        cancelLabel="继续检查"
        initialFocus="cancel"
        confirmDisabled={pending}
        portal
        onConfirm={seal}
        onCancel={() => setSealOpen(false)}
      />
    </>
  );
}

function LoadingState() {
  return (
    <Surface as="section" className="flex min-h-[calc(100dvh-var(--site-header-viewport-offset))] items-center justify-center rounded-none border-x-0 border-t-0 px-6">
      <div className="text-center" role="status">
        <span className="mx-auto block size-3 rounded-full bg-[var(--amber)]" />
        <p className="mt-4 text-balance font-display text-2xl text-ink">正在恢复评测进度</p>
        <p className="mt-2 text-pretty text-sm text-[var(--text-dim)]">刷新不会重复产生模型请求。</p>
      </div>
    </Surface>
  );
}

export function Gi088EvaluationWorkbench() {
  const [session, setSession] = useState<Gi088EvaluationSession | null>(null);
  const [runs, setRuns] = useState<Gi088RunSummary[]>([]);
  const [issue, setIssue] = useState<Gi088EvaluationIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingRun, setCreatingRun] = useState(false);

  const rememberSession = useCallback((value: Gi088EvaluationSession) => {
    clearConfirmedOutboxes(value);
    setSession(value);
    setRuns((current) => {
      const runId = runIdOf(value);
      const next: Gi088RunSummary = {
        runId,
        runOrdinal: value.batch.runOrdinal ??
          current.find((run) => run.runId === runId)?.runOrdinal ??
          1,
        evaluationVersion: value.evaluation.version,
        status: value.batch.status,
        gateStatus: value.batch.gate?.status ?? "legacy_unknown",
        completedTaskCount: value.batch.completedTaskCount,
        totalTasks: value.batch.totalTasks,
        readOnly: Boolean(value.batch.readOnly),
        createdAt: current.find((run) => run.runId === runId)?.createdAt ?? "",
        updatedAt: current.find((run) => run.runId === runId)?.updatedAt ?? "",
        sealedAt: value.batch.sealedAt
      };
      const withoutCurrent = current.filter((run) => run.runId !== runId);
      return [...withoutCurrent, next].sort((left, right) =>
        right.runOrdinal - left.runOrdinal
      );
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setIssue(null);
    try {
      const response = await getGi088EvaluationRuns();
      setRuns(response.runs);
      const selectedRun = response.runs.find(isWritableCurrentRun) ??
        response.runs[0];
      const next = response.session ?? (selectedRun
        ? await getGi088EvaluationSession({ runId: selectedRun.runId })
        : null);
      if (next) rememberSession(next);
      else setSession(null);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setLoading(false);
    }
  }, [rememberSession]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectRun = useCallback(async (runId: string) => {
    setLoading(true);
    setIssue(null);
    try {
      rememberSession(await getGi088EvaluationSession({ runId }));
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setLoading(false);
    }
  }, [rememberSession]);

  const createRun = useCallback(async () => {
    setCreatingRun(true);
    setIssue(null);
    try {
      const response = await createGi088EvaluationRun();
      if (response.runs.length) {
        setRuns((current) => mergeRunSummaries(current, response.runs));
      }
      const selectedRun = response.runs.find(isWritableCurrentRun) ??
        response.runs[0];
      const next = response.session ?? (selectedRun
        ? await getGi088EvaluationSession({ runId: selectedRun.runId })
        : null);
      if (!next) {
        throw new Gi088EvaluationRequestError({
          code: "GI088_RUN_RESPONSE_INVALID",
          message: "新运行已经请求创建，但返回内容缺少可读取的运行。请重新读取。",
          retryable: true,
          dataSaved: "unknown",
          impact: "run",
          action: "read_latest_state"
        });
      }
      rememberSession(next);
    } catch (error) {
      setIssue(issueFromUnknown(error));
    } finally {
      setCreatingRun(false);
    }
  }, [rememberSession]);

  const workspaceKey = useMemo(() => session
    ? `${runIdOf(session)}:${session.evaluation.executionFingerprint}`
    : "",
  [session]);

  if (loading && !session) return <LoadingState />;

  if (!session) {
    return (
      <Surface as="section" className="flex min-h-[calc(100dvh-var(--site-header-viewport-offset))] items-center justify-center rounded-none border-x-0 border-t-0 px-6">
        <div className="max-w-xl text-center" role={issue ? "alert" : "status"}>
          <p className="text-balance font-display text-3xl text-ink">
            {issue ? "评测工作台暂时无法打开" : "当前候选还没有真人运行"}
          </p>
          <p className="mt-3 text-pretty text-sm leading-7 text-[var(--text-dim)]">
            {issue?.message ?? "创建运行只初始化 12 项任务，模型调用保持为 0。"}
          </p>
          {issue?.code ? <p className="mt-2 font-mono text-xs text-[var(--text-faint)]">{issue.code}</p> : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ActionButton type="button" variant="primary" disabled={creatingRun} onClick={() => void createRun()}>
              {creatingRun ? "正在创建运行" : "创建 0/12 运行"}
            </ActionButton>
            <ActionButton type="button" variant="secondary" disabled={creatingRun} onClick={() => void load()}>重新读取</ActionButton>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <WorkspaceReady
      key={workspaceKey}
      session={session}
      runs={runs}
      creatingRun={creatingRun}
      onSession={rememberSession}
      onSelectRun={(runId) => void selectRun(runId)}
      onCreateRun={() => void createRun()}
    />
  );
}
