/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/* Hallmark · genre: editorial · tone: warm-utilitarian · palette: warm-paper-brown · macrostructure: Workbench · design-system: DESIGN.md · contrast: pass · responsive: pass · slop: 58/58 */
"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { AdminAIQualityEvidence } from "@/components/admin/admin-ai-quality-evidence";
import { AdminAIQualityImpact } from "@/components/admin/admin-ai-quality-impact";
import { ActionButton, Card, Divider, Surface } from "@/components/ui";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AdminAIQualityEvidenceItem } from "@/features/ai-quality/admin-evidence";
import {
  getAIQualityExpectedImprovement,
  getAIQualityIssueDescription,
  getAIQualityIssueLabel
} from "@/features/ai-quality/issue-presentation";

export type AIOptimizationCandidateView = {
  id: string;
  path: "system_prompt" | "few_shot" | "engineering";
  status: "draft" | "approved" | "published" | "rejected" | "rolled_back";
  artifactType: "interview_turn" | "dimension_journal" | null;
  dimension: "joy" | "fulfillment" | "reflection" | "improvement" | "gratitude" | null;
  promptKey: string | null;
  title: string;
  rationale: string;
  proposal: unknown;
  evidenceTraceIds: string[];
  riskLevel: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  cluster: { issueCode: string; caseCount: number } | null;
  fewShotExampleCount: number;
  releaseCount: number;
  latestValidation: {
    id: string;
    status: "running" | "passed" | "failed" | "error";
    targetCaseCount: number;
    targetPassedCount: number;
    regressionCaseCount: number;
    regressionPassedCount: number;
    criticalRegressionCount: number;
    averageScoreDelta: number;
    summary: string | null;
    errorCode: string | null;
    completedAt: string | null;
    results: unknown;
  } | null;
};

export type AIOptimizationRunView = {
  id: string;
  status: "running" | "completed" | "failed";
  scannedBad: number;
  scannedGood: number;
  clusterCount: number;
  candidateCount: number;
  summary: string | null;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
};

type CandidateStage = "review" | "validation" | "publish" | "technical" | "observe" | "history";
type QueueFilter = "actionable" | "review" | "validation" | "publish" | "observe" | "history";

type ValidationResult = {
  traceId: string;
  kind: "target" | "regression";
  passed: boolean;
  baselineScore: number | null;
  candidateScore: number | null;
  reason: string;
  candidateOutput: Record<string, unknown>;
};

const PATH_LABEL = {
  system_prompt: "回答规则",
  few_shot: "优质示例",
  engineering: "技术修复"
} as const;

const TECHNICAL_PATH_LABEL = {
  system_prompt: "System Prompt",
  few_shot: "Few-shot",
  engineering: "Engineering"
} as const;

const DIMENSION_LABEL = {
  joy: "开心",
  fulfillment: "充实",
  reflection: "思考",
  improvement: "改进",
  gratitude: "感谢"
} as const;

const ARTIFACT_LABEL = {
  interview_turn: "访谈回复",
  dimension_journal: "日志内容"
} as const;

const RISK_LABEL: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险"
};

const RISK_PRIORITY: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const STAGE_LABEL: Record<CandidateStage, string> = {
  review: "待审核",
  validation: "待验证",
  publish: "待发布",
  technical: "待技术处理",
  observe: "观察中",
  history: "历史记录"
};

const STAGE_PRIORITY: Record<CandidateStage, number> = {
  publish: 0,
  validation: 1,
  technical: 1,
  review: 2,
  observe: 3,
  history: 4
};

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getCandidateStage(candidate: AIOptimizationCandidateView): CandidateStage {
  if (candidate.status === "draft") return "review";
  if (candidate.status === "approved" && candidate.path === "engineering") return "technical";
  if (candidate.status === "approved" && candidate.latestValidation?.status === "passed") return "publish";
  if (candidate.status === "approved") return "validation";
  if (candidate.status === "published") return "observe";
  return "history";
}

function getCandidateIssueLabel(candidate: AIOptimizationCandidateView) {
  if (candidate.path === "few_shot") return "优质回答示例";
  return getAIQualityIssueLabel(candidate.cluster?.issueCode, candidate.artifactType);
}

function getCandidateName(candidate: AIOptimizationCandidateView) {
  return `${candidate.dimension ? DIMENSION_LABEL[candidate.dimension] : "通用"} · ${getCandidateIssueLabel(candidate)}`;
}

function getCandidateExplanation(candidate: AIOptimizationCandidateView) {
  const rationale = candidate.rationale.trim();
  if (rationale) return rationale;
  const issueCode = candidate.cluster?.issueCode;
  return `${getAIQualityIssueDescription(issueCode, candidate.artifactType)}${getAIQualityExpectedImprovement(issueCode)}`;
}

function getProposalText(candidate: AIOptimizationCandidateView) {
  const proposal = readRecord(candidate.proposal);
  if (candidate.path === "system_prompt") {
    return typeof proposal.instructionPatch === "string"
      ? proposal.instructionPatch
      : getAIQualityExpectedImprovement(candidate.cluster?.issueCode);
  }
  if (candidate.path === "few_shot") {
    const count = candidate.fewShotExampleCount || candidate.evidenceTraceIds.length;
    return `将 ${count} 条用户认可且质量稳定的回复加入参考库。AI 遇到相似场景时会参考这些表达方式，当前参考库最多保留 6 条有效示例。`;
  }
  return "由产品技术人员复现问题、修复生成结构或确定性规则，并完成自动化回归检查。";
}

function getFriendlyError(errorCode: string) {
  if (errorCode === "ADMIN_FORBIDDEN") return "当前登录账号没有管理员权限，请重新使用管理员入口登录。";
  if (errorCode === "AUTHENTICATION_REQUIRED") return "登录状态已失效，请重新登录后再试。";
  if (/DATABASE|P1001|P2024/iu.test(errorCode)) return "数据连接暂时不可用，请稍后重新尝试。";
  if (errorCode === "OPTIMIZATION_VALIDATION_REQUIRED") return "这条建议需要先通过上线前验证。";
  if (errorCode === "OPTIMIZATION_VALIDATION_FAILED") return "验证过程暂时未完成，请检查 AI 运行配置后重试。";
  if (errorCode === "ENGINEERING_CANDIDATE_REQUIRES_MANUAL_VALIDATION") return "工程修复建议需要由产品技术人员完成验证。";
  if (errorCode === "OPTIMIZATION_REVIEW_REASON_REQUIRED") return "请填写 4–300 字的退回原因。";
  return "本次操作暂时未完成，请稍后重试。";
}

function getReusedCount(summary: string | null) {
  const match = summary?.match(/复用\s*(\d+)\s*个候选/u);
  return match ? Number(match[1]) : 0;
}

function formatRunResult(run: AIOptimizationRunView) {
  if (run.status === "running") return "系统正在检查，完成后会自动更新结果。";
  if (run.status === "failed") return getFriendlyError(run.errorCode ?? "AI_QUALITY_ITERATION_FAILED");
  const reused = getReusedCount(run.summary);
  const reusedText = reused > 0 ? `另有 ${reused} 条建议已自动合并。` : "";
  return `发现 ${run.scannedBad} 条需改进回复和 ${run.scannedGood} 条优质回复，整理出 ${run.clusterCount} 类问题，形成 ${run.candidateCount} 条新建议。${reusedText}`;
}

function readValidationResults(value: unknown): ValidationResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = readRecord(item);
    if (typeof record.traceId !== "string" || (record.kind !== "target" && record.kind !== "regression")) return [];
    return [{
      traceId: record.traceId,
      kind: record.kind,
      passed: record.passed === true,
      baselineScore: typeof record.baselineScore === "number" ? record.baselineScore : null,
      candidateScore: typeof record.candidateScore === "number" ? record.candidateScore : null,
      reason: typeof record.reason === "string" ? record.reason : "验证结果已记录。",
      candidateOutput: readRecord(record.candidateOutput)
    }];
  });
}

function formatValidationOutput(value: Record<string, unknown>) {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const content = typeof value.content === "string" ? value.content.trim() : "";
  if (content) return [title, content].filter(Boolean).join("\n");
  const summary = typeof value.thinkingSummary === "string" ? value.thinkingSummary.trim() : "";
  const question = typeof value.question === "string" ? value.question.trim() : "";
  return [summary, question].filter(Boolean).join("\n");
}

function formatProposal(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "候选方案暂时无法展示";
  }
}

function matchesFilter(candidate: AIOptimizationCandidateView, filter: QueueFilter) {
  const stage = getCandidateStage(candidate);
  if (filter === "actionable") return stage === "review" || stage === "validation" || stage === "publish" || stage === "technical";
  if (filter === "validation") return stage === "validation" || stage === "technical";
  return stage === filter;
}

function sortCandidates(left: AIOptimizationCandidateView, right: AIOptimizationCandidateView) {
  const stageDifference = STAGE_PRIORITY[getCandidateStage(left)] - STAGE_PRIORITY[getCandidateStage(right)];
  if (stageDifference !== 0) return stageDifference;
  const riskDifference = (RISK_PRIORITY[left.riskLevel] ?? 3) - (RISK_PRIORITY[right.riskLevel] ?? 3);
  if (riskDifference !== 0) return riskDifference;
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function CandidateQueueItem({
  candidate,
  selected,
  onSelect
}: {
  candidate: AIOptimizationCandidateView;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = getCandidateName(candidate);
  const stage = getCandidateStage(candidate);
  return (
    <li className="border-b border-[var(--line-soft)] last:border-b-0">
      <button
        type="button"
        className={`grid min-h-24 w-full min-w-0 gap-2 px-4 py-3 text-left active:bg-[var(--amber-soft)] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--paper-deep)] ${
          selected ? "bg-[var(--amber-soft)]" : "bg-transparent hover:bg-[var(--moss-soft)]"
        }`}
        aria-pressed={selected}
        aria-label={`审核候选：${name}`}
        onClick={onSelect}
      >
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0 [overflow-wrap:anywhere] text-sm font-semibold leading-6 text-ink">{name}</span>
          <span className="shrink-0 text-xs text-ink">{STAGE_LABEL[stage]}</span>
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-[var(--text-dim)]">
          <span>{candidate.artifactType ? ARTIFACT_LABEL[candidate.artifactType] : "通用回复"}</span>
          <span>{PATH_LABEL[candidate.path]}</span>
          <span className="tabular-nums">{candidate.evidenceTraceIds.length} 条证据</span>
          <span>{RISK_LABEL[candidate.riskLevel] ?? "待确认风险"}</span>
        </span>
      </button>
    </li>
  );
}

function StatusFilter({
  label,
  count,
  pressed,
  onClick
}: {
  label: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`min-h-16 rounded-[var(--radius-control)] border px-3 py-2 text-left active:bg-[var(--amber-soft)] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)] ${
        pressed
          ? "border-[var(--line-strong)] bg-[var(--amber-soft)]"
          : "border-[var(--line-soft)] bg-transparent hover:border-[var(--line-strong)]"
      }`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className="block text-xs text-[var(--text-dim)]">{label}</span>
      <strong className="mt-1 block font-mono text-xl font-medium tabular-nums text-ink">{count}</strong>
    </button>
  );
}

function ValidationComparison({
  evidence,
  result
}: {
  evidence: AdminAIQualityEvidenceItem | null;
  result: ValidationResult | null;
}) {
  const candidateOutput = result ? formatValidationOutput(result.candidateOutput) : "";
  return (
    <section className="grid gap-4 border-t border-[var(--line-soft)] pt-5" aria-labelledby="reply-comparison-title">
      <div>
        <h3 id="reply-comparison-title" className="font-display text-xl text-ink">原回复与候选回复</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">证据完成审计加载后，按 Trace 对齐最近一次验证结果。</p>
      </div>
      {!evidence ? (
        <p className="text-sm leading-7 text-[var(--text-dim)]">展开上方问题证据并选择一段对话后，这里会显示原回复。</p>
      ) : (
        <div className="grid border-y border-[var(--line-soft)] lg:grid-cols-2">
          <div className="min-w-0 py-4 lg:pr-5">
            <h4 className="text-sm font-semibold text-ink">原回复</h4>
            <p className="mt-1 text-xs tabular-nums text-[var(--text-dim)]">
              {result?.baselineScore === null || result?.baselineScore === undefined ? "评分待确认" : `${result.baselineScore} 分`}
            </p>
            {evidence.targetOutput.title ? <p className="mt-3 font-medium text-ink">{evidence.targetOutput.title}</p> : null}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/80">{evidence.targetOutput.text}</p>
          </div>
          <div className="min-w-0 border-t border-[var(--line-soft)] py-4 lg:border-l lg:border-t-0 lg:pl-5">
            <h4 className="text-sm font-semibold text-ink">候选回复</h4>
            <p className="mt-1 text-xs tabular-nums text-[var(--text-dim)]">
              {result?.candidateScore === null || result?.candidateScore === undefined
                ? "运行验证后生成"
                : `${result.candidateScore} 分 · ${result.passed ? "通过" : "未通过"}`}
            </p>
            {candidateOutput ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/80">{candidateOutput}</p>
            ) : (
              <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">当前 Trace 还没有候选回复，运行上线前验证后自动补充。</p>
            )}
            {result ? <p className="mt-3 text-xs leading-6 text-[var(--text-dim)]">{result.reason}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}

function ValidationSection({
  candidate,
  pending,
  onValidate
}: {
  candidate: AIOptimizationCandidateView;
  pending: boolean;
  onValidate: () => void;
}) {
  const validation = candidate.latestValidation;
  const canValidate = candidate.status === "approved" && candidate.path !== "engineering";
  const statusText = validation?.status === "passed"
    ? "验证通过，可以进入全量应用"
    : validation?.status === "failed"
      ? "验证未通过，需要继续调整"
      : validation?.status === "error"
        ? "验证过程遇到问题"
        : validation?.status === "running"
          ? "正在验证"
          : "等待首次验证";

  return (
    <section className="grid gap-4 border-t border-[var(--line-soft)] pt-5" aria-labelledby="validation-title">
      <div>
        <h3 id="validation-title" className="font-display text-xl text-ink">上线前验证</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">回放问题场景和历史优质场景，确认问题改善且正常场景保持稳定。</p>
      </div>
      {candidate.path === "engineering" ? (
        <p className="text-sm leading-7 text-[var(--text-dim)]">
          {candidate.status === "approved" ? "候选已经进入技术处理，完成修复与自动化回归后再安排上线。" : "管理员认可后，这条候选会进入技术修复流程。"}
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-ink">{statusText}</p>
          {validation ? (
            <>
              <p className="text-sm leading-7 text-[var(--text-dim)]">
                {validation.summary ?? (validation.errorCode ? getFriendlyError(validation.errorCode) : "系统正在整理验证结果。")}
              </p>
              <dl className="grid grid-cols-2 border-y border-[var(--line-soft)] sm:grid-cols-4 sm:divide-x sm:divide-[var(--line-soft)]">
                <div className="py-3 sm:px-3 sm:first:pl-0">
                  <dt className="text-xs text-[var(--text-dim)]">目标证据</dt>
                  <dd className="mt-1 text-sm tabular-nums text-ink">{validation.targetPassedCount}/{validation.targetCaseCount} 通过</dd>
                </div>
                <div className="py-3 sm:px-3">
                  <dt className="text-xs text-[var(--text-dim)]">优质回归</dt>
                  <dd className="mt-1 text-sm tabular-nums text-ink">{validation.regressionPassedCount}/{validation.regressionCaseCount} 稳定</dd>
                </div>
                <div className="py-3 sm:px-3">
                  <dt className="text-xs text-[var(--text-dim)]">平均分变化</dt>
                  <dd className="mt-1 text-sm tabular-nums text-ink">{validation.averageScoreDelta > 0 ? "+" : ""}{validation.averageScoreDelta}</dd>
                </div>
                <div className="py-3 sm:px-3">
                  <dt className="text-xs text-[var(--text-dim)]">严重回归</dt>
                  <dd className="mt-1 text-sm tabular-nums text-ink">{validation.criticalRegressionCount}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm leading-7 text-[var(--text-dim)]">认可候选后即可运行首次验证。</p>
          )}
          {canValidate ? (
            <div>
              <ActionButton
                variant="secondary"
                disabled={pending}
                aria-label={`${getCandidateName(candidate)}：${validation ? "重新验证" : "运行验证"}`}
                onClick={onValidate}
              >
                {pending ? "正在回放验证…" : validation ? "重新验证" : "运行验证"}
              </ActionButton>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function RunHistory({ runs }: { runs: AIOptimizationRunView[] }) {
  return (
    <section className="border-t border-[var(--line-soft)] pt-5" aria-labelledby="run-history-title">
      <h2 id="run-history-title" className="font-display text-2xl text-ink">系统检查记录</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">保留最近 {runs.length} 次检查，用于核对新增建议和自动合并结果。</p>
      <details className="mt-3">
        <summary className="cursor-pointer select-none py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]">
          展开最近检查
        </summary>
        {runs.length === 0 ? (
          <p className="py-4 text-sm leading-7 text-[var(--text-dim)]">系统还没有进行过检查。</p>
        ) : (
          <>
            <ol className="grid divide-y divide-[var(--line-soft)] lg:hidden" aria-label="系统检查记录">
              {runs.map((run) => (
                <li key={run.id} className="grid gap-2 py-4 text-sm leading-6 text-[var(--text-dim)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ink">{run.status === "completed" ? "已完成" : run.status === "failed" ? "失败" : "运行中"}</span>
                    <time className="text-xs tabular-nums">{new Date(run.startedAt).toLocaleString("zh-CN")}</time>
                  </div>
                  <p className="tabular-nums">{run.scannedBad} 条需改进 · {run.scannedGood} 条优质 · {run.clusterCount} 类问题 · {run.candidateCount} 条新建议</p>
                  <p>{formatRunResult(run)}</p>
                </li>
              ))}
            </ol>
            <div className="hidden lg:block">
              <table className="mt-3 w-full table-fixed text-left text-xs leading-6 text-[var(--text-dim)]">
                <caption className="sr-only">最近 AI 质量检查的状态、发现数量、问题类型、新建议、时间和结果</caption>
                <thead className="border-b border-[var(--line-soft)] text-[var(--text-dim)]">
                  <tr>
                    <th className="w-[8%] py-2 pr-3 font-medium">状态</th>
                    <th className="w-[18%] py-2 pr-3 font-medium">检查发现</th>
                    <th className="w-[10%] py-2 pr-3 font-medium">问题类型</th>
                    <th className="w-[9%] py-2 pr-3 font-medium">新建议</th>
                    <th className="w-[18%] py-2 pr-3 font-medium">开始时间</th>
                    <th className="py-2 font-medium">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-[var(--line-soft)] align-top">
                      <td className="py-2 pr-3">{run.status === "completed" ? "已完成" : run.status === "failed" ? "失败" : "运行中"}</td>
                      <td className="py-2 pr-3 tabular-nums">{run.scannedBad} 需改进 · {run.scannedGood} 优质</td>
                      <td className="py-2 pr-3 tabular-nums">{run.clusterCount}</td>
                      <td className="py-2 pr-3 tabular-nums">{run.candidateCount}</td>
                      <td className="py-2 pr-3 tabular-nums">{new Date(run.startedAt).toLocaleString("zh-CN")}</td>
                      <td className="py-2">{formatRunResult(run)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </details>
    </section>
  );
}

export function AdminAIQualityShell({
  candidates,
  runs
}: {
  candidates: AIOptimizationCandidateView[];
  runs: AIOptimizationRunView[];
}) {
  const router = useRouter();
  const [activeAction, setActiveAction] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [runSummary, setRunSummary] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<QueueFilter>("actionable");
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = React.useState<Record<string, AdminAIQualityEvidenceItem>>({});
  const [returnCandidateId, setReturnCandidateId] = React.useState<string | null>(null);
  const [returnReason, setReturnReason] = React.useState("");
  const [returnReasonError, setReturnReasonError] = React.useState<string | null>(null);
  const returnReasonRef = React.useRef<HTMLTextAreaElement>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const sortedCandidates = React.useMemo(() => [...candidates].sort(sortCandidates), [candidates]);
  const visibleCandidates = React.useMemo(
    () => sortedCandidates.filter((candidate) => matchesFilter(candidate, filter)),
    [filter, sortedCandidates]
  );
  const selectedCandidate = visibleCandidates.find((candidate) => candidate.id === selectedCandidateId)
    ?? visibleCandidates[0]
    ?? null;

  React.useEffect(() => {
    if (selectedCandidate && selectedCandidate.id !== selectedCandidateId) {
      setSelectedCandidateId(selectedCandidate.id);
    }
    if (!selectedCandidate && selectedCandidateId) setSelectedCandidateId(null);
  }, [selectedCandidate, selectedCandidateId]);

  React.useEffect(() => {
    if (returnCandidateId) returnReasonRef.current?.focus();
  }, [returnCandidateId]);

  const handleActiveEvidence = React.useCallback((candidateId: string, evidence: AdminAIQualityEvidenceItem) => {
    setActiveEvidence((current) => current[candidateId]?.traceId === evidence.traceId
      ? current
      : { ...current, [candidateId]: evidence });
  }, []);

  const counts = React.useMemo(() => {
    const stageCount = (stage: CandidateStage) => candidates.filter((candidate) => getCandidateStage(candidate) === stage).length;
    return {
      actionable: candidates.filter((candidate) => matchesFilter(candidate, "actionable")).length,
      review: stageCount("review"),
      validation: stageCount("validation") + stageCount("technical"),
      publish: stageCount("publish"),
      observe: stageCount("observe"),
      history: stageCount("history")
    };
  }, [candidates]);

  async function runIteration() {
    setActiveAction("run");
    setError(null);
    setRunSummary(null);
    try {
      const response = await fetch("/api/admin/ai-quality/runs", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: { evaluated: number; bad?: number; good?: number };
        iteration?: { candidates?: number; reused?: number };
      };
      if (!response.ok) throw new Error(payload.error ?? "AI_QUALITY_RUN_FAILED");
      const reusedText = payload.iteration?.reused ? `其中 ${payload.iteration.reused} 条已自动合并。` : "";
      setRunSummary(
        `检查完成：处理 ${payload.evaluation?.evaluated ?? 0} 条新回复，发现 ${payload.evaluation?.bad ?? 0} 条需关注回复和 ${payload.evaluation?.good ?? 0} 条优质回复，形成 ${payload.iteration?.candidates ?? 0} 条新建议。${reusedText}`
      );
      router.refresh();
    } catch (runError) {
      setError(getFriendlyError(runError instanceof Error ? runError.message : "AI_QUALITY_RUN_FAILED"));
    } finally {
      setActiveAction(null);
    }
  }

  async function review(
    candidate: AIOptimizationCandidateView,
    action: "approve" | "reject" | "publish" | "rollback",
    reason?: string
  ) {
    setActiveAction(`${candidate.id}:${action}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai-quality/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "AI_QUALITY_REVIEW_FAILED");
      if (action === "reject") {
        setReturnCandidateId(null);
        setReturnReason("");
        setReturnReasonError(null);
      }
      router.refresh();
    } catch (reviewError) {
      setError(getFriendlyError(reviewError instanceof Error ? reviewError.message : "AI_QUALITY_REVIEW_FAILED"));
    } finally {
      setActiveAction(null);
    }
  }

  async function validate(candidate: AIOptimizationCandidateView) {
    setActiveAction(`${candidate.id}:validate`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai-quality/candidates/${candidate.id}/validate`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "OPTIMIZATION_VALIDATION_FAILED");
      router.refresh();
    } catch (validationError) {
      setError(getFriendlyError(validationError instanceof Error ? validationError.message : "OPTIMIZATION_VALIDATION_FAILED"));
    } finally {
      setActiveAction(null);
    }
  }

  async function requestPublish(candidate: AIOptimizationCandidateView) {
    const accepted = await confirm({
      eyebrow: "全量发布确认",
      title: "全量应用这条建议？",
      description: `应用后，${candidate.dimension ? DIMENSION_LABEL[candidate.dimension] : "相关场景"}的新 AI 回复会使用这条规则。Prompt Key：${candidate.promptKey ?? "通用"}。最近一次上线前验证已通过，后续可以查看七天效果并回滚。`,
      confirmLabel: "确认全量应用",
      cancelLabel: "再检查一下",
      initialFocus: "cancel"
    });
    if (accepted) await review(candidate, "publish");
  }

  async function requestRollback(candidate: AIOptimizationCandidateView) {
    const accepted = await confirm({
      eyebrow: "版本回滚确认",
      title: "恢复到上一版本？",
      description: `确认后，${candidate.dimension ? DIMENSION_LABEL[candidate.dimension] : "相关场景"}的新 AI 回复会停止使用这条建议。已有 Trace 和七天观察记录会继续保留。`,
      confirmLabel: "确认回滚",
      cancelLabel: "继续观察",
      tone: "danger",
      initialFocus: "cancel"
    });
    if (accepted) await review(candidate, "rollback");
  }

  function openReturnForm(candidate: AIOptimizationCandidateView) {
    setReturnCandidateId(candidate.id);
    setReturnReason("");
    setReturnReasonError(null);
  }

  function submitReturn(candidate: AIOptimizationCandidateView) {
    const reason = returnReason.trim();
    if (reason.length < 4 || reason.length > 300) {
      setReturnReasonError("请填写 4–300 字的具体原因，说明需要补充或调整的内容。");
      return;
    }
    void review(candidate, "reject", reason);
  }

  function selectFilter(nextFilter: QueueFilter) {
    setFilter(nextFilter);
    setSelectedCandidateId(null);
    setReturnCandidateId(null);
    setReturnReason("");
    setReturnReasonError(null);
  }

  const latestRun = runs[0] ?? null;
  const pending = selectedCandidate ? activeAction?.startsWith(`${selectedCandidate.id}:`) ?? false : false;
  const selectedEvidence = selectedCandidate ? activeEvidence[selectedCandidate.id] ?? null : null;
  const selectedValidationResult = selectedCandidate && selectedEvidence
    ? readValidationResults(selectedCandidate.latestValidation?.results).find((result) => result.traceId === selectedEvidence.traceId) ?? null
    : null;

  return (
    <Surface
      as="section"
      className="admin-ai-quality-workbench min-h-[calc(100dvh-var(--site-header-viewport-offset))] overflow-x-clip rounded-none border-x-0 border-t-0 px-4 py-5 sm:px-5 md:px-8 md:py-7 xl:px-10"
    >
      <div className="relative z-10 mx-auto grid max-w-7xl min-w-0 gap-5">
        <header className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="archive-label">AI 回答质量</p>
            <h1 className="mt-2 min-w-0 [overflow-wrap:anywhere] font-display text-3xl text-ink sm:text-4xl">AI 质量改进中心</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              从问题证据、修改方案和验证结果形成连续审核路径，再决定发布、观察或回滚。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <p className="text-xs leading-6 text-[var(--text-dim)]">
              {latestRun
                ? `最近检查 ${new Date(latestRun.startedAt).toLocaleString("zh-CN")} · 新增 ${latestRun.candidateCount} · 自动合并 ${getReusedCount(latestRun.summary)}`
                : "等待首次质量检查"}
            </p>
            <ActionButton
              variant="secondary"
              className="whitespace-nowrap"
              disabled={activeAction === "run"}
              onClick={() => void runIteration()}
            >
              {activeAction === "run" ? "正在检查…" : "检查最近回复"}
            </ActionButton>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="按候选状态筛选">
          <StatusFilter label="全部待处理" count={counts.actionable} pressed={filter === "actionable"} onClick={() => selectFilter("actionable")} />
          <StatusFilter label="待审核" count={counts.review} pressed={filter === "review"} onClick={() => selectFilter("review")} />
          <StatusFilter label="待验证" count={counts.validation} pressed={filter === "validation"} onClick={() => selectFilter("validation")} />
          <StatusFilter label="待发布" count={counts.publish} pressed={filter === "publish"} onClick={() => selectFilter("publish")} />
          <StatusFilter label="观察中" count={counts.observe} pressed={filter === "observe"} onClick={() => selectFilter("observe")} />
          <StatusFilter label="历史" count={counts.history} pressed={filter === "history"} onClick={() => selectFilter("history")} />
        </div>

        {error ? <p role="alert" className="text-sm leading-7 text-ink">操作未完成：{error}</p> : null}
        {runSummary ? <p role="status" className="text-sm leading-7 text-[var(--text-dim)]">{runSummary}</p> : null}

        <Card className="min-h-0 overflow-hidden p-0 lg:h-[max(36rem,calc(100dvh-var(--site-header-viewport-offset)-15rem))]">
          <div className="grid min-h-0 lg:h-full lg:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="min-h-0 border-b border-[var(--line-soft)] lg:flex lg:flex-col lg:border-b-0 lg:border-r" aria-labelledby="candidate-queue-title">
              <div className="border-b border-[var(--line-soft)] px-4 py-4">
                <h2 id="candidate-queue-title" className="font-display text-xl text-ink">候选队列</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{visibleCandidates.length} 条符合当前筛选</p>
              </div>
              {visibleCandidates.length ? (
                <ol className="min-h-0 lg:overflow-y-auto lg:overscroll-contain">
                  {visibleCandidates.map((candidate) => (
                    <CandidateQueueItem
                      key={candidate.id}
                      candidate={candidate}
                      selected={candidate.id === selectedCandidate?.id}
                      onSelect={() => {
                        setSelectedCandidateId(candidate.id);
                        setReturnCandidateId(null);
                        setReturnReason("");
                        setReturnReasonError(null);
                      }}
                    />
                  ))}
                </ol>
              ) : (
                <div className="grid gap-2 px-4 py-8 text-sm leading-7 text-[var(--text-dim)]">
                  <p className="font-medium text-ink">当前筛选下没有候选</p>
                  <p>选择其他状态，或运行一次最近回复检查。</p>
                </div>
              )}
            </aside>

            {selectedCandidate ? (
              <article className="flex min-h-0 min-w-0 flex-col" aria-labelledby={`candidate-${selectedCandidate.id}-title`}>
                <div className="min-h-0 min-w-0 flex-1 px-4 py-5 sm:px-5 lg:overflow-y-auto lg:overscroll-contain lg:px-7">
                  <div className="grid min-w-0 gap-5">
                    <header className="grid min-w-0 gap-3">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink">{STAGE_LABEL[getCandidateStage(selectedCandidate)]}</p>
                          <h2
                            id={`candidate-${selectedCandidate.id}-title`}
                            className="mt-1 min-w-0 [overflow-wrap:anywhere] font-display text-2xl text-ink sm:text-3xl"
                          >
                            {getCandidateName(selectedCandidate)}
                          </h2>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--text-dim)]">{RISK_LABEL[selectedCandidate.riskLevel] ?? "风险待确认"}</span>
                      </div>
                      <p className="max-w-3xl text-sm leading-7 text-[var(--text-dim)]">{getCandidateExplanation(selectedCandidate)}</p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs leading-6 text-[var(--text-dim)]">
                        <span>{selectedCandidate.dimension ? DIMENSION_LABEL[selectedCandidate.dimension] : "全部维度"}</span>
                        <span>{selectedCandidate.artifactType ? ARTIFACT_LABEL[selectedCandidate.artifactType] : "通用回复"}</span>
                        <span>{PATH_LABEL[selectedCandidate.path]}</span>
                        <span className="tabular-nums">{selectedCandidate.evidenceTraceIds.length} 条证据</span>
                        <span className="tabular-nums">发现于 {new Date(selectedCandidate.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                    </header>

                    <Divider />

                    <section className="grid gap-3" aria-labelledby="evidence-title">
                      <div>
                        <h3 id="evidence-title" className="font-display text-xl text-ink">问题证据</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">先确认真实场景和用户反馈，再判断候选方案是否对症。</p>
                      </div>
                      <AdminAIQualityEvidence
                        key={selectedCandidate.id}
                        candidateId={selectedCandidate.id}
                        candidateName={getCandidateName(selectedCandidate)}
                        evidenceCount={selectedCandidate.evidenceTraceIds.length}
                        onActiveEvidenceChange={handleActiveEvidence}
                      />
                    </section>

                    <section className="grid gap-3 border-t border-[var(--line-soft)] pt-5" aria-labelledby="proposal-title">
                      <div>
                        <h3 id="proposal-title" className="font-display text-xl text-ink">修改方案</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">当前候选采用{PATH_LABEL[selectedCandidate.path]}路径。</p>
                      </div>
                      <p className="text-sm leading-7 text-ink/80">{getProposalText(selectedCandidate)}</p>
                    </section>

                    <ValidationComparison evidence={selectedEvidence} result={selectedValidationResult} />

                    <ValidationSection
                      candidate={selectedCandidate}
                      pending={activeAction === `${selectedCandidate.id}:validate`}
                      onValidate={() => void validate(selectedCandidate)}
                    />

                    <section className="grid gap-3 border-t border-[var(--line-soft)] pt-5" aria-labelledby="scope-title">
                      <div>
                        <h3 id="scope-title" className="font-display text-xl text-ink">影响范围</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">发布前确认生效对象、运行路径和可回滚边界。</p>
                      </div>
                      <dl className="grid gap-x-6 gap-y-2 text-sm leading-7 text-[var(--text-dim)] sm:grid-cols-2">
                        <div><dt className="inline text-[var(--text-dim)]">生效维度：</dt><dd className="inline text-ink">{selectedCandidate.dimension ? DIMENSION_LABEL[selectedCandidate.dimension] : "全部维度"}</dd></div>
                        <div><dt className="inline text-[var(--text-dim)]">内容类型：</dt><dd className="inline text-ink">{selectedCandidate.artifactType ? ARTIFACT_LABEL[selectedCandidate.artifactType] : "通用回复"}</dd></div>
                        <div><dt className="inline text-[var(--text-dim)]">调整路径：</dt><dd className="inline text-ink">{PATH_LABEL[selectedCandidate.path]}</dd></div>
                        <div><dt className="inline text-[var(--text-dim)]">Prompt Key：</dt><dd className="inline break-all font-mono text-xs text-ink">{selectedCandidate.promptKey ?? "通用"}</dd></div>
                      </dl>
                    </section>

                    {selectedCandidate.status === "published" || selectedCandidate.status === "rolled_back" ? (
                      <AdminAIQualityImpact
                        candidateId={selectedCandidate.id}
                        candidateName={getCandidateName(selectedCandidate)}
                        rollbackAvailable={selectedCandidate.status === "published"}
                        rollbackPending={activeAction === `${selectedCandidate.id}:rollback`}
                        onRollback={() => void requestRollback(selectedCandidate)}
                      />
                    ) : null}

                    <details className="border-t border-[var(--line-soft)] pt-5 text-xs leading-6 text-[var(--text-dim)]">
                      <summary className="cursor-pointer select-none font-medium text-[var(--text-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--paper-deep)]">
                        查看技术详情
                      </summary>
                      <div className="mt-3 grid gap-2">
                        <p>内部方案：{TECHNICAL_PATH_LABEL[selectedCandidate.path]}</p>
                        <p>内部标题：{selectedCandidate.title}</p>
                        {selectedCandidate.cluster ? <p>问题代码：{selectedCandidate.cluster.issueCode}（{selectedCandidate.cluster.caseCount} 条）</p> : null}
                        {selectedCandidate.promptKey ? <p className="break-all font-mono">Prompt Key：{selectedCandidate.promptKey}</p> : null}
                        <p className="break-all font-mono">Trace ID：{selectedCandidate.evidenceTraceIds.join("、")}</p>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-ink/70">
                          {formatProposal(selectedCandidate.proposal)}
                        </pre>
                      </div>
                    </details>
                  </div>
                </div>

                {(selectedCandidate.status === "draft" || selectedCandidate.status === "approved" || selectedCandidate.status === "rejected") ? (
                  <footer className="border-t border-[var(--line-soft)] bg-[var(--paper-main)] px-4 py-4 sm:px-5 lg:px-7" aria-label={`${getCandidateName(selectedCandidate)}的审核动作`}>
                    {selectedCandidate.status === "rejected" ? (
                      <div className="grid gap-1 text-sm leading-6 text-[var(--text-dim)]">
                        <p className="font-medium text-ink">已退回调整</p>
                        {selectedCandidate.reviewReason ? <p>原因：{selectedCandidate.reviewReason}</p> : null}
                        <p className="text-xs tabular-nums text-[var(--text-dim)]">
                          {[selectedCandidate.reviewedBy, selectedCandidate.reviewedAt ? new Date(selectedCandidate.reviewedAt).toLocaleString("zh-CN") : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ) : returnCandidateId === selectedCandidate.id ? (
                      <div className="grid gap-3">
                        <label htmlFor={`return-reason-${selectedCandidate.id}`} className="text-sm font-medium text-ink">退回原因</label>
                        <textarea
                          ref={returnReasonRef}
                          id={`return-reason-${selectedCandidate.id}`}
                          className="min-h-24 resize-y rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-[var(--paper-main)] px-3 py-2 text-sm leading-6 text-ink outline-2 outline-offset-1 outline-transparent aria-[invalid=true]:border-[var(--line-strong)] aria-[invalid=true]:bg-[var(--amber-soft)] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-[var(--paper-deep)]"
                          value={returnReason}
                          minLength={4}
                          maxLength={300}
                          disabled={pending}
                          aria-invalid={Boolean(returnReasonError)}
                          aria-describedby={`return-reason-help-${selectedCandidate.id}`}
                          onChange={(event) => {
                            setReturnReason(event.target.value);
                            if (returnReasonError) setReturnReasonError(null);
                          }}
                        />
                        <div id={`return-reason-help-${selectedCandidate.id}`} className="flex min-h-6 flex-wrap justify-between gap-2 text-xs leading-6">
                          <span className={returnReasonError ? "text-ink" : "text-[var(--text-dim)]"}>
                            {returnReasonError ?? "说明证据、方案或验证中需要补充的内容。"}
                          </span>
                          <span className="tabular-nums text-[var(--text-dim)]">{returnReason.length}/300</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            variant="primary"
                            className="whitespace-nowrap"
                            disabled={pending}
                            aria-label={`${getCandidateName(selectedCandidate)}：确认退回调整`}
                            onClick={() => submitReturn(selectedCandidate)}
                          >
                            {activeAction === `${selectedCandidate.id}:reject` ? "正在退回…" : "确认退回"}
                          </ActionButton>
                          <ActionButton
                            variant="ghost"
                            className="whitespace-nowrap"
                            disabled={pending}
                            onClick={() => {
                              setReturnCandidateId(null);
                              setReturnReason("");
                              setReturnReasonError(null);
                            }}
                          >
                            取消
                          </ActionButton>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedCandidate.status === "draft" ? (
                          <ActionButton
                            variant="primary"
                            className="whitespace-nowrap"
                            disabled={pending}
                            aria-label={`${getCandidateName(selectedCandidate)}：认可并进入验证`}
                            onClick={() => void review(selectedCandidate, "approve")}
                          >
                            {activeAction === `${selectedCandidate.id}:approve` ? "正在认可…" : selectedCandidate.path === "engineering" ? "认可并转技术处理" : "认可并进入验证"}
                          </ActionButton>
                        ) : null}
                        {selectedCandidate.status === "approved" && selectedCandidate.path !== "engineering" && selectedCandidate.latestValidation?.status === "passed" ? (
                          <ActionButton
                            variant="primary"
                            className="whitespace-nowrap"
                            disabled={pending}
                            aria-label={`${getCandidateName(selectedCandidate)}：全量应用`}
                            onClick={() => void requestPublish(selectedCandidate)}
                          >
                            全量应用
                          </ActionButton>
                        ) : null}
                        {selectedCandidate.status === "approved" && selectedCandidate.path !== "engineering" && selectedCandidate.latestValidation?.status !== "passed" ? (
                          <ActionButton
                            variant="primary"
                            className="whitespace-nowrap"
                            disabled={pending}
                            aria-label={`${getCandidateName(selectedCandidate)}：运行上线前验证`}
                            onClick={() => void validate(selectedCandidate)}
                          >
                            {activeAction === `${selectedCandidate.id}:validate` ? "正在验证…" : "运行上线前验证"}
                          </ActionButton>
                        ) : null}
                        {selectedCandidate.status === "approved" && selectedCandidate.path === "engineering" ? (
                          <span className="mr-auto text-sm text-[var(--text-dim)]">候选已进入技术修复流程。</span>
                        ) : null}
                        <ActionButton
                          variant="ghost"
                          className="whitespace-nowrap"
                          disabled={pending}
                          aria-label={`${getCandidateName(selectedCandidate)}：退回调整`}
                          onClick={() => openReturnForm(selectedCandidate)}
                        >
                          退回调整
                        </ActionButton>
                        {pending ? <span role="status" className="text-xs text-[var(--text-dim)]">处理中…</span> : null}
                      </div>
                    )}
                  </footer>
                ) : null}
              </article>
            ) : (
              <div className="grid min-h-72 place-content-center gap-2 px-5 py-10 text-center text-sm leading-7 text-[var(--text-dim)]">
                <p className="font-medium text-ink">选择一个有内容的状态</p>
                <p>候选详情会在这里形成完整审核路径。</p>
              </div>
            )}
          </div>
        </Card>

        <RunHistory runs={runs} />
      </div>
      {confirmDialog}
    </Surface>
  );
}
