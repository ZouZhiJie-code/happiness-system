"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { ActionButton, Card, Divider, SectionHeading, Surface } from "@/components/ui";
import { AdminAIQualityEvidence } from "@/components/admin/admin-ai-quality-evidence";

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
  cluster: { issueCode: string; caseCount: number } | null;
  fewShotExampleCount: number;
  releaseCount: number;
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

const PATH_LABEL = {
  system_prompt: "调整 AI 的回答规则",
  few_shot: "加入优质回答示例",
  engineering: "安排产品技术修复"
} as const;

const TECHNICAL_PATH_LABEL = {
  system_prompt: "System Prompt",
  few_shot: "Few-shot",
  engineering: "Engineering"
} as const;

const STATUS_LABEL = {
  draft: "待审核",
  approved: "已批准",
  published: "已发布",
  rejected: "已拒绝",
  rolled_back: "已回滚"
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
  high: "需要谨慎验证",
  medium: "常规审核",
  low: "影响较小"
};

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getIssueDescription(issueCode: string | null) {
  if (!issueCode) return "一类回复质量问题";
  if (/boundary|ignored_boundary/iu.test(issueCode)) return "用户已经想停下，AI 仍继续追问";
  if (/abstract|clarity|multiple_questions|question_/iu.test(issueCode)) return "AI 的问题偏抽象，或一次问得太多";
  if (/ground|hallucin|anchor|factually_wrong|missing_supporting/iu.test(issueCode)) {
    return "回复加入了用户没有表达过的内容";
  }
  if (/tone|diagnosis|pressure|advice|self_blame/iu.test(issueCode)) return "回复语气让人感到压力或说教感";
  if (/title/iu.test(issueCode)) return "日志标题不够自然、准确";
  if (/schema|provider|generation_not_completed|missing_final_output|database|trace|request_log/iu.test(issueCode)) {
    return "生成过程出现技术异常，影响了最终回复";
  }
  return "一类相似的回复质量问题";
}

function getExpectedImprovement(issueCode: string | null) {
  if (!issueCode) return "让 AI 的回复更准确、更自然。";
  if (/boundary|ignored_boundary/iu.test(issueCode)) return "让 AI 在用户想停下或直接整理日志时及时收住。";
  if (/abstract|clarity|multiple_questions|question_/iu.test(issueCode)) return "让 AI 每次只问一个具体、容易回答的问题。";
  if (/ground|hallucin|anchor|factually_wrong|missing_supporting/iu.test(issueCode)) {
    return "让 AI 只使用用户真正表达过的事实。";
  }
  if (/tone|diagnosis|pressure|advice|self_blame/iu.test(issueCode)) return "让 AI 的语气更自然、温和，也更尊重用户节奏。";
  if (/title/iu.test(issueCode)) return "让日志标题更简短、自然，并准确概括用户经历。";
  return "降低同类问题再次出现的概率。";
}

function getCandidateTitle(candidate: AIOptimizationCandidateView) {
  const scope = `${candidate.dimension ? DIMENSION_LABEL[candidate.dimension] : "通用"}${
    candidate.artifactType ? ARTIFACT_LABEL[candidate.artifactType] : "回复"
  }`;
  if (candidate.path === "few_shot") return `为${scope}补充优质参考示例`;
  if (candidate.path === "engineering") return `修复${scope}的生成异常`;
  return `改善${scope}：“${getIssueDescription(candidate.cluster?.issueCode ?? null)}”`;
}

function getCandidateExplanation(candidate: AIOptimizationCandidateView) {
  if (candidate.path === "few_shot") {
    return `系统找到了 ${candidate.fewShotExampleCount || candidate.evidenceTraceIds.length} 条用户认可、质量较高的回复。采用后，AI 可以参考这些表达方式生成新的回复。`;
  }
  const count = candidate.cluster?.caseCount ?? candidate.evidenceTraceIds.length;
  return `系统发现 ${count} 条回复出现了相似情况：${getIssueDescription(candidate.cluster?.issueCode ?? null)}。${getExpectedImprovement(candidate.cluster?.issueCode ?? null)}`;
}

function getFriendlyError(errorCode: string) {
  if (errorCode === "ADMIN_FORBIDDEN") return "当前登录账号没有管理员权限，请重新使用管理员验收入口登录。";
  if (errorCode === "AUTHENTICATION_REQUIRED") return "登录状态已失效，请重新登录后再试。";
  if (/DATABASE|P1001|P2024/iu.test(errorCode)) return "数据连接暂时不可用，请稍后重新尝试。";
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
  const reusedText = reused > 0 ? `另有 ${reused} 条建议与已有内容相同，已自动合并。` : "";
  return `发现 ${run.scannedBad} 条需要改进的回复、${run.scannedGood} 条值得学习的回复，整理出 ${run.clusterCount} 类问题，形成 ${run.candidateCount} 条新建议。${reusedText}`;
}

function formatProposal(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "候选方案暂时无法展示";
  }
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

  async function runIteration() {
    setActiveAction("run");
    setError(null);
    setRunSummary(null);
    try {
      const response = await fetch("/api/admin/ai-quality/runs", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: { scanned: number; evaluated: number; bad?: number; good?: number };
        iteration?: { clusters?: number; candidates?: number; reused?: number; summary: string };
      };
      if (!response.ok) throw new Error(payload.error ?? "AI_QUALITY_RUN_FAILED");
      const reusedText = payload.iteration?.reused
        ? `其中 ${payload.iteration.reused} 条与已有建议相同，已自动合并。`
        : "";
      setRunSummary(
        `检查完成：处理了 ${payload.evaluation?.evaluated ?? 0} 条新回复，发现 ${payload.evaluation?.bad ?? 0} 条需要关注的回复和 ${payload.evaluation?.good ?? 0} 条优质回复，形成 ${payload.iteration?.candidates ?? 0} 条新建议。${reusedText}`
      );
      router.refresh();
    } catch (runError) {
      setError(getFriendlyError(runError instanceof Error ? runError.message : "AI_QUALITY_RUN_FAILED"));
    } finally {
      setActiveAction(null);
    }
  }

  async function review(candidateId: string, action: "approve" | "reject" | "publish" | "rollback") {
    setActiveAction(`${candidateId}:${action}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai-quality/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "AI_QUALITY_REVIEW_FAILED");
      router.refresh();
    } catch (reviewError) {
      setError(getFriendlyError(reviewError instanceof Error ? reviewError.message : "AI_QUALITY_REVIEW_FAILED"));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <Surface
      as="section"
      className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
    >
      <div className="relative z-10 mx-auto grid max-w-6xl gap-7">
        <header className="grid gap-3">
          <p className="archive-label">AI 回答质量</p>
          <h1 className="font-display text-4xl text-ink md:text-5xl">让 AI 的回答越来越好</h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--text-dim)]">
            系统会从用户反馈和日常回复中找出值得改进的问题，也会挑选用户认可的优质回答。你可以在这里判断建议是否合理，再决定是否应用。
          </p>
          <p className="text-sm text-[var(--text-faint)]">当前有 {candidates.length} 条改进建议等待查看</p>
          <div>
            <ActionButton variant="primary" disabled={activeAction === "run"} onClick={() => void runIteration()}>
              {activeAction === "run" ? "正在检查最近回复…" : "检查最近回复并生成建议"}
            </ActionButton>
          </div>
        </header>

        {error ? (
          <p role="alert" className="text-sm leading-7 text-[#8a5440]">
            操作失败：{error}
          </p>
        ) : null}
        {runSummary ? <p role="status" className="text-sm leading-7 text-[var(--text-dim)]">{runSummary}</p> : null}

        <section className="grid gap-3">
          <SectionHeading
            title="系统检查记录"
            hint={`${runs.length} 次`}
            description="每次检查最近 7 天的回复，找出需要改进的回答和值得学习的好回答。"
          />
          {runs.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--text-dim)]">系统还没有进行过检查，点击上方按钮即可查看最近回复。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs leading-6 text-[var(--text-dim)]">
                <thead className="border-b border-[var(--line-soft)] text-[var(--text-faint)]">
                  <tr>
                    <th className="py-2 pr-4 font-medium">状态</th>
                    <th className="py-2 pr-4 font-medium">需要改进</th>
                    <th className="py-2 pr-4 font-medium">值得学习</th>
                    <th className="py-2 pr-4 font-medium">问题类型</th>
                    <th className="py-2 pr-4 font-medium">新建议</th>
                    <th className="py-2 pr-4 font-medium">开始时间</th>
                    <th className="py-2 font-medium">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-[var(--line-soft)] align-top">
                      <td className="py-2 pr-4">{run.status === "completed" ? "已完成" : run.status === "failed" ? "失败" : "运行中"}</td>
                      <td className="py-2 pr-4">{run.scannedBad}</td>
                      <td className="py-2 pr-4">{run.scannedGood}</td>
                      <td className="py-2 pr-4">{run.clusterCount}</td>
                      <td className="py-2 pr-4">{run.candidateCount}</td>
                      <td className="py-2 pr-4">{new Date(run.startedAt).toLocaleString("zh-CN")}</td>
                      <td className="max-w-md py-2">{formatRunResult(run)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Divider />

        <div className="grid gap-4">
          {candidates.length === 0 ? (
            <div className="py-10 text-center text-sm leading-7 text-[var(--text-dim)]">
              <p className="font-medium text-ink">当前没有需要处理的改进建议</p>
              <p className="mt-2">当用户指出回复有问题，或系统发现一批相似问题时，这里会出现改进建议。</p>
              <p>点击“检查最近回复并生成建议”，可以主动更新检查结果。</p>
            </div>
          ) : null}
          {candidates.map((candidate) => {
            const pending = activeAction?.startsWith(`${candidate.id}:`) ?? false;
            return (
              <Card key={candidate.id} className="grid gap-5 p-5 md:p-6">
                <SectionHeading
                  title={getCandidateTitle(candidate)}
                  hint={`${PATH_LABEL[candidate.path]} · ${STATUS_LABEL[candidate.status]}`}
                  description={getCandidateExplanation(candidate)}
                />

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-dim)]">
                  <span>审核提醒：{RISK_LABEL[candidate.riskLevel] ?? "请确认后应用"}</span>
                  <span>涉及内容：{candidate.dimension ? DIMENSION_LABEL[candidate.dimension] : "全部维度"} · {candidate.artifactType ? ARTIFACT_LABEL[candidate.artifactType] : "通用回复"}</span>
                  <span>参考回复：{candidate.evidenceTraceIds.length} 条</span>
                  {candidate.releaseCount > 0 ? <span>历史应用：{candidate.releaseCount} 次</span> : null}
                  <span>发现时间：{new Date(candidate.createdAt).toLocaleString("zh-CN")}</span>
                </div>

                <Divider />

                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-[var(--text-faint)]">建议怎么做</p>
                  {candidate.path === "system_prompt" ? (
                    <p className="text-sm leading-7 text-ink/78">
                      {typeof readRecord(candidate.proposal).instructionPatch === "string"
                        ? String(readRecord(candidate.proposal).instructionPatch)
                        : getExpectedImprovement(candidate.cluster?.issueCode ?? null)}
                    </p>
                  ) : candidate.path === "few_shot" ? (
                    <p className="text-sm leading-7 text-ink/78">
                      把这 {candidate.fewShotExampleCount || candidate.evidenceTraceIds.length} 条优质回复加入 AI 的参考示例。以后遇到相似情境时，AI 会参考它们的表达方式；参考库最多保留 6 条当前有效示例。
                    </p>
                  ) : (
                    <p className="text-sm leading-7 text-ink/78">
                      交给产品技术人员复现问题、修复生成规则并完成回归检查；验证通过后再进入正常发布流程。
                    </p>
                  )}
                </div>

                <AdminAIQualityEvidence candidateId={candidate.id} evidenceCount={candidate.evidenceTraceIds.length} />

                <details className="text-xs leading-6 text-[var(--text-dim)]">
                  <summary className="cursor-pointer select-none font-medium text-[var(--text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                    查看技术详情
                  </summary>
                  <div className="mt-3 grid gap-2">
                    <p>内部方案：{TECHNICAL_PATH_LABEL[candidate.path]}</p>
                    <p>内部标题：{candidate.title}</p>
                    {candidate.cluster ? <p>问题代码：{candidate.cluster.issueCode}（{candidate.cluster.caseCount} 条）</p> : null}
                    {candidate.promptKey ? <p className="font-mono">Prompt Key：{candidate.promptKey}</p> : null}
                    <p className="break-all font-mono">Trace ID：{candidate.evidenceTraceIds.join("、")}</p>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-ink/70">
                      {formatProposal(candidate.proposal)}
                    </pre>
                  </div>
                </details>

                <div className="flex flex-wrap items-center gap-3">
                  {candidate.status === "draft" ? (
                    <>
                      <ActionButton variant="primary" disabled={pending} onClick={() => review(candidate.id, "approve")}>
                        认可这条建议
                      </ActionButton>
                      <ActionButton disabled={pending} onClick={() => review(candidate.id, "reject")}>
                        暂不采用
                      </ActionButton>
                    </>
                  ) : null}
                  {candidate.status === "approved" && candidate.path !== "engineering" ? (
                    <>
                      <ActionButton variant="primary" disabled={pending} onClick={() => review(candidate.id, "publish")}>
                        应用到 AI 回答
                      </ActionButton>
                      <ActionButton disabled={pending} onClick={() => review(candidate.id, "reject")}>
                        暂不采用
                      </ActionButton>
                    </>
                  ) : null}
                  {candidate.status === "approved" && candidate.path === "engineering" ? (
                    <span className="text-sm text-[var(--text-dim)]">产品技术人员会继续处理这条建议，完成验证后再安排上线。</span>
                  ) : null}
                  {candidate.status === "published" ? (
                    <ActionButton disabled={pending} onClick={() => review(candidate.id, "rollback")}>
                        撤回这次应用
                    </ActionButton>
                  ) : null}
                  {pending ? <span className="text-xs text-[var(--text-faint)]">处理中…</span> : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
