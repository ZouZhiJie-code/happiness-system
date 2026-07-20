"use client";

import React from "react";

import { ActionButton, Divider, SectionHeading } from "@/components/ui";
import type {
  AdminAIQualityEvidenceItem,
  AdminAIQualityEvidenceResponse
} from "@/features/ai-quality/admin-evidence";

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

const ROLE_LABEL = {
  user: "用户",
  assistant: "AI",
  context: "背景信息"
} as const;

const EVALUATION_DIMENSION_LABEL: Record<string, string> = {
  grounding: "事实忠实",
  dimensionAlignment: "维度与产品目标",
  boundarySafety: "用户边界与安全",
  clarity: "表达清晰度",
  completeness: "任务完成度"
};

export function friendlyEvidenceError(code: string) {
  if (code === "ADMIN_FORBIDDEN") return "当前账号没有查看这些内容的权限，请重新使用管理员入口登录。";
  if (code === "AUTHENTICATION_REQUIRED") return "登录状态已失效，请重新登录后查看。";
  if (code === "OPTIMIZATION_CANDIDATE_NOT_FOUND") return "这条改进建议已经更新，请刷新页面后重试。";
  return "对话证据暂时无法读取，请稍后重试。";
}

export function AdminAIQualityEvidenceDetail({ evidence }: { evidence: AdminAIQualityEvidenceItem }) {
  const hasTargetInConversation = evidence.conversation.some((message) => message.isTarget);

  return (
    <div className="grid gap-5" aria-label={`${evidence.userLabel}的证据详情`}>
      <div className="grid gap-2">
        <p className="text-sm font-medium leading-7 text-ink">{evidence.scenarioSummary}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs leading-6 text-[var(--text-faint)]">
          <span>{evidence.userLabel}</span>
          <span>{evidence.dimension ? DIMENSION_LABEL[evidence.dimension] : "通用场景"}</span>
          <span>{ARTIFACT_LABEL[evidence.artifactType]}</span>
          <span>{new Date(evidence.entryDate ?? evidence.createdAt).toLocaleString("zh-CN")}</span>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-wide text-[var(--text-faint)]">用户反馈与系统判断</p>
        {evidence.feedback ? (
          <div className="grid gap-2 text-sm leading-7 text-[var(--text-dim)]">
            <p>{evidence.feedback.vote === "upvote" ? "用户点了赞，认可这条回复。" : "用户点了踩，认为这条回复需要改进。"}</p>
            {evidence.feedback.tags.length ? (
              <div className="flex flex-wrap gap-2" aria-label="用户反馈标签">
                {evidence.feedback.tags.map((tag) => (
                  <span key={tag.code} className="rounded-full border border-[var(--line-soft)] px-3 py-1 text-xs text-ink/75">
                    {tag.label}
                  </span>
                ))}
              </div>
            ) : null}
            {evidence.feedback.comment ? <p>用户补充：{evidence.feedback.comment}</p> : null}
          </div>
        ) : (
          <p className="text-sm leading-7 text-[var(--text-dim)]">这条记录来自系统自动检查。</p>
        )}
        {evidence.evaluation ? (
          <div className="grid gap-1 text-sm leading-7 text-[var(--text-dim)]">
            <p>系统质量评分：{evidence.evaluation.totalScore} 分</p>
            {evidence.classification?.level === "bad" && evidence.evaluation.totalScore >= 85 ? (
              <p>这条回复命中了严重质量问题，因此仍被列为需要改进。</p>
            ) : null}
            {evidence.evaluation.reasons.map((reason) => <p key={reason}>判断原因：{reason}</p>)}
            {evidence.evaluation.deductions.map((deduction, index) => (
              <p key={`${deduction.reason}-${index}`}>
                需要改进：{deduction.reason}{deduction.points ? `（${EVALUATION_DIMENSION_LABEL[deduction.dimension ?? ""] ?? "对应质量"}维度扣 ${deduction.points} 分）` : ""}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <Divider />

      <div className="grid gap-3">
        <SectionHeading
          title="用户与 AI 的对话"
          description="重点标记的 AI 回复，是这条改进建议直接参考的生成结果。"
        />
        {evidence.conversation.length ? (
          <ol className="grid gap-4" aria-label="对话记录">
            {evidence.conversation.map((message) => (
              <li
                key={message.id}
                className={`border-l-2 pl-4 ${message.isTarget ? "border-[var(--paper-deep)]" : "border-[var(--line-soft)]"}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-faint)]">
                  <span>{ROLE_LABEL[message.role]}</span>
                  {message.isTarget ? <span className="text-[var(--paper-deep)]">本次重点判断</span> : null}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-ink/80">{message.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-7 text-[var(--text-dim)]">这条记录暂时没有可还原的历史对话。</p>
        )}
      </div>

      {!hasTargetInConversation || evidence.artifactType === "dimension_journal" ? (
        <div className="grid gap-2 border-l-2 border-[var(--paper-deep)] pl-4">
          <p className="text-xs font-medium text-[var(--paper-deep)]">本次生成结果</p>
          {evidence.targetOutput.title ? <p className="font-medium text-ink">{evidence.targetOutput.title}</p> : null}
          <p className="whitespace-pre-wrap text-sm leading-7 text-ink/80">{evidence.targetOutput.text}</p>
        </div>
      ) : null}
    </div>
  );
}

export function AdminAIQualityEvidence({ candidateId, evidenceCount }: { candidateId: string; evidenceCount: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<AdminAIQualityEvidenceResponse | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  async function loadPage(page: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai-quality/candidates/${candidateId}/evidence?page=${page}`);
      const result = (await response.json()) as AdminAIQualityEvidenceResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "AI_QUALITY_EVIDENCE_FAILED");
      setPayload(result);
      setActiveIndex(0);
    } catch (loadError) {
      setError(friendlyEvidenceError(loadError instanceof Error ? loadError.message : "AI_QUALITY_EVIDENCE_FAILED"));
    } finally {
      setLoading(false);
    }
  }

  function toggleEvidence() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !payload && !loading) void loadPage(1);
  }

  const activeEvidence = payload?.items[activeIndex] ?? null;
  const itemOffset = payload ? (payload.page - 1) * payload.pageSize : 0;

  return (
    <section className="grid gap-4" aria-label="用户场景与对话证据">
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton variant="secondary" aria-expanded={expanded} onClick={toggleEvidence}>
          {expanded ? "收起用户场景与对话" : `查看用户场景与对话（${evidenceCount}）`}
        </ActionButton>
        <span className="text-xs leading-6 text-[var(--text-faint)]">查看行为会记录在管理员审计日志中</span>
      </div>

      {expanded ? (
        <div className="grid gap-5 border-t border-[var(--line-soft)] pt-5">
          {loading ? <p role="status" className="text-sm leading-7 text-[var(--text-dim)]">正在还原对话背景…</p> : null}
          {error ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm leading-7 text-[#8a5440]">{error}</p>
              <ActionButton variant="ghost" onClick={() => void loadPage(payload?.page ?? 1)}>重新加载</ActionButton>
            </div>
          ) : null}
          {!loading && !error && payload?.items.length ? (
            <>
              <div className="flex flex-wrap items-center gap-2" aria-label="选择证据">
                {payload.items.map((item, index) => (
                  <ActionButton
                    key={item.traceId}
                    variant={index === activeIndex ? "primary" : "ghost"}
                    aria-pressed={index === activeIndex}
                    onClick={() => setActiveIndex(index)}
                  >
                    第 {itemOffset + index + 1} 段对话
                  </ActionButton>
                ))}
                <span className="text-xs text-[var(--text-faint)]">共 {payload.total} 段证据</span>
              </div>

              {activeEvidence ? <AdminAIQualityEvidenceDetail evidence={activeEvidence} /> : null}

              {payload.totalPages > 1 ? (
                <div className="flex items-center gap-3 border-t border-[var(--line-soft)] pt-4">
                  <ActionButton variant="ghost" disabled={payload.page <= 1 || loading} onClick={() => void loadPage(payload.page - 1)}>
                    上一组
                  </ActionButton>
                  <span className="text-xs text-[var(--text-faint)]">第 {payload.page}/{payload.totalPages} 组</span>
                  <ActionButton variant="ghost" disabled={payload.page >= payload.totalPages || loading} onClick={() => void loadPage(payload.page + 1)}>
                    下一组
                  </ActionButton>
                </div>
              ) : null}
            </>
          ) : null}
          {!loading && !error && payload && payload.items.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--text-dim)]">这条建议关联的对话证据已经失效，请重新运行质量检查。</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
