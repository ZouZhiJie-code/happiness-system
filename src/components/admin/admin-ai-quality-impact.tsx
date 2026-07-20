"use client";

import React from "react";

import {
  AdminAIQualityEvidenceDetail,
  friendlyEvidenceError
} from "@/components/admin/admin-ai-quality-evidence";
import { ActionButton, Divider, SectionHeading } from "@/components/ui";
import type {
  AdminAIQualityImpactEvidenceResponse,
  AdminAIQualityImpactResponse
} from "@/features/ai-quality/admin-impact";
import { formatAdminDateTime } from "@/features/ai-quality/admin-date-time";

type MetricRow = {
  key: keyof AdminAIQualityImpactResponse["baseline"];
  label: string;
  format: "count" | "rate" | "latency";
};

const METRIC_ROWS: MetricRow[] = [
  { key: "generationCount", label: "AI 生成数量", format: "count" },
  { key: "upvoteCount", label: "点赞数量", format: "count" },
  { key: "downvoteCount", label: "点踩数量", format: "count" },
  { key: "downvoteRate", label: "点踩率", format: "rate" },
  { key: "sameIssueCount", label: "同一问题数量", format: "count" },
  { key: "sameIssueRate", label: "同一问题率", format: "rate" },
  { key: "severeIssueCount", label: "严重质量问题", format: "count" },
  { key: "failureCount", label: "AI 调用失败数量", format: "count" },
  { key: "failureRate", label: "AI 调用失败率", format: "rate" },
  { key: "averageLatencyMs", label: "平均调用延迟", format: "latency" }
];

function formatValue(value: number | null, format: MetricRow["format"]) {
  if (value === null) return "—";
  if (format === "rate") return `${(value * 100).toFixed(1)}%`;
  if (format === "latency") return `${Math.round(value)} ms`;
  return String(value);
}

function formatChange(value: number | null, format: MetricRow["format"]) {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  if (format === "rate") return `${sign}${(value * 100).toFixed(1)} 个百分点`;
  if (format === "latency") return `${sign}${Math.round(value)} ms`;
  return `${sign}${value}`;
}

function friendlyImpactError(code: string, requestId?: string) {
  const suffix = requestId ? `（编号 ${requestId}）` : "";
  if (code === "OPTIMIZATION_RELEASE_NOT_FOUND") return `这条建议尚未形成可观察的发布记录。${suffix}`;
  if (code === "OPTIMIZATION_IMPACT_UNAVAILABLE") return `当前建议类型暂不支持自动效果统计。${suffix}`;
  if (/P1001|P1017|P2024|AI_QUALITY_IMPACT/iu.test(code)) return `数据连接暂时不可用，请稍后重试。${suffix}`;
  return `${friendlyEvidenceError(code)}${suffix}`;
}

function ImpactSkeleton() {
  return (
    <div className="grid gap-5" role="status" aria-label="正在加载上线效果">
      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
        <div className="grid gap-3">
          <div className="h-7 w-36 animate-pulse rounded-[var(--radius-control)] bg-[var(--line-soft)] motion-reduce:animate-none" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded-[var(--radius-control)] bg-[var(--line-soft)] motion-reduce:animate-none" />
          <div className="h-4 w-3/4 animate-pulse rounded-[var(--radius-control)] bg-[var(--line-soft)] motion-reduce:animate-none" />
        </div>
        <div className="grid content-start gap-3">
          <div className="h-5 w-24 animate-pulse rounded-[var(--radius-control)] bg-[var(--line-soft)] motion-reduce:animate-none" />
          <div className="h-4 w-40 animate-pulse rounded-[var(--radius-control)] bg-[var(--line-soft)] motion-reduce:animate-none" />
          <div className="h-4 w-32 animate-pulse rounded-[var(--radius-control)] bg-[var(--line-soft)] motion-reduce:animate-none" />
        </div>
      </div>
      <div className="h-56 animate-pulse rounded-[var(--radius-control)] bg-[var(--line-soft)] motion-reduce:animate-none" />
    </div>
  );
}

function ImpactEvidence({
  candidateId,
  counts
}: {
  candidateId: string;
  counts: AdminAIQualityImpactResponse["evidenceCounts"];
}) {
  const [kind, setKind] = React.useState<"attention" | "positive">("attention");
  const [payloads, setPayloads] = React.useState<Partial<Record<"attention" | "positive", AdminAIQualityImpactEvidenceResponse>>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const payload = payloads[kind];

  const loadPage = React.useCallback(async (nextKind: "attention" | "positive", page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/ai-quality/candidates/${candidateId}/impact/evidence?kind=${nextKind}&page=${page}`
      );
      const result = (await response.json()) as AdminAIQualityImpactEvidenceResponse & {
        error?: string;
        code?: string;
        requestId?: string;
      };
      if (!response.ok) throw new Error(`${result.code ?? result.error ?? "AI_QUALITY_IMPACT_EVIDENCE_FAILED"}|${result.requestId ?? ""}`);
      setPayloads((current) => ({ ...current, [nextKind]: result }));
      setActiveIndex(0);
    } catch (loadError) {
      const [code, requestId] = (loadError instanceof Error ? loadError.message : "AI_QUALITY_IMPACT_EVIDENCE_FAILED").split("|");
      setError(friendlyImpactError(code, requestId));
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  React.useEffect(() => {
    if (!payloads[kind]) void loadPage(kind, 1);
  }, [kind, loadPage, payloads]);

  const activeEvidence = payload?.items[activeIndex] ?? null;
  const offset = payload ? (payload.page - 1) * payload.pageSize : 0;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2" aria-label="选择上线后案例类型">
        <ActionButton
          variant={kind === "attention" ? "primary" : "ghost"}
          aria-pressed={kind === "attention"}
          onClick={() => setKind("attention")}
        >
          需关注（{counts.attention}）
        </ActionButton>
        <ActionButton
          variant={kind === "positive" ? "primary" : "ghost"}
          aria-pressed={kind === "positive"}
          onClick={() => setKind("positive")}
        >
          正向反馈（{counts.positive}）
        </ActionButton>
        <span className="text-xs leading-6 text-[var(--text-dim)]">查看行为会记录在管理员审计日志中</span>
      </div>

      {loading ? <p role="status" className="text-sm leading-7 text-[var(--text-dim)]">正在还原上线后的真实对话…</p> : null}
      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm leading-7 text-ink">{error}</p>
          <ActionButton variant="ghost" onClick={() => void loadPage(kind, payload?.page ?? 1)}>重新加载</ActionButton>
        </div>
      ) : null}
      {!loading && !error && payload?.items.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2" aria-label="选择上线后案例">
            {payload.items.map((item, index) => (
              <ActionButton
                key={item.traceId}
                variant={index === activeIndex ? "secondary" : "ghost"}
                aria-pressed={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              >
                第 {offset + index + 1} 段对话
              </ActionButton>
            ))}
            <span className="text-xs text-[var(--text-dim)]">共 {payload.total} 段</span>
          </div>
          {activeEvidence ? <AdminAIQualityEvidenceDetail evidence={activeEvidence} /> : null}
          {payload.totalPages > 1 ? (
            <div className="flex items-center gap-3 border-t border-[var(--line-soft)] pt-4">
              <ActionButton
                variant="ghost"
                disabled={payload.page <= 1 || loading}
                onClick={() => void loadPage(kind, payload.page - 1)}
              >
                上一组
              </ActionButton>
              <span className="text-xs tabular-nums text-[var(--text-dim)]">第 {payload.page}/{payload.totalPages} 组</span>
              <ActionButton
                variant="ghost"
                disabled={payload.page >= payload.totalPages || loading}
                onClick={() => void loadPage(kind, payload.page + 1)}
              >
                下一组
              </ActionButton>
            </div>
          ) : null}
        </>
      ) : null}
      {!loading && !error && payload && payload.items.length === 0 ? (
        <p className="text-pretty text-sm leading-7 text-[var(--text-dim)]">
          {kind === "attention" ? "上线后暂未发现需要重点关注的案例。" : "上线后正在等待首批点赞反馈。"}
        </p>
      ) : null}
    </div>
  );
}

export function AdminAIQualityImpact({
  candidateId,
  candidateName,
  onRollback,
  rollbackPending,
  rollbackAvailable = true
}: {
  candidateId: string;
  candidateName?: string;
  onRollback: () => void;
  rollbackPending: boolean;
  rollbackAvailable?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [impact, setImpact] = React.useState<AdminAIQualityImpactResponse | null>(null);
  const [evidenceExpanded, setEvidenceExpanded] = React.useState(false);

  async function loadImpact() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai-quality/candidates/${candidateId}/impact`);
      const result = (await response.json()) as AdminAIQualityImpactResponse & {
        error?: string;
        code?: string;
        requestId?: string;
      };
      if (!response.ok) throw new Error(`${result.code ?? result.error ?? "AI_QUALITY_IMPACT_FAILED"}|${result.requestId ?? ""}`);
      setImpact(result);
    } catch (loadError) {
      const [code, requestId] = (loadError instanceof Error ? loadError.message : "AI_QUALITY_IMPACT_FAILED").split("|");
      setError(friendlyImpactError(code, requestId));
    } finally {
      setLoading(false);
    }
  }

  function toggleImpact() {
    const next = !expanded;
    setExpanded(next);
    if (next && !impact && !loading) void loadImpact();
  }

  return (
    <section className="grid gap-5 border-t border-[var(--line-soft)] pt-5" aria-label="上线效果观察">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          title="上线效果观察"
          description="对比发布前七天与发布后七天，帮助你决定继续保留、复核或回滚。"
        />
        <ActionButton
          variant="secondary"
          className="whitespace-nowrap"
          aria-expanded={expanded}
          aria-label={candidateName ? `${candidateName}：${expanded ? "收起上线效果" : "查看上线效果"}` : undefined}
          onClick={toggleImpact}
        >
          {expanded ? "收起上线效果" : "查看上线效果"}
        </ActionButton>
      </div>

      {expanded ? (
        <div className="grid gap-6">
          {loading ? <ImpactSkeleton /> : null}
          {error ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-pretty text-sm leading-7 text-ink">{error}</p>
              <ActionButton variant="ghost" onClick={() => void loadImpact()}>重新加载</ActionButton>
            </div>
          ) : null}
          {!loading && !error && impact ? (
            <>
              <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
                <div className="grid content-start gap-3">
                  <p className="archive-label">当前判断</p>
                  <h4 className="text-balance font-display text-2xl text-ink">{impact.conclusion.title}</h4>
                  <p className="max-w-2xl text-pretty text-sm leading-7 text-[var(--text-dim)]">{impact.conclusion.summary}</p>
                  <ul className="grid gap-1 text-sm leading-7 text-ink/75">
                    {impact.conclusion.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
                  </ul>
                  {rollbackAvailable ? (
                    <div className="pt-2">
                      <ActionButton
                        variant={impact.conclusion.status === "rollback_recommended" ? "primary" : "secondary"}
                        disabled={rollbackPending}
                        aria-label={candidateName ? `${candidateName}：${impact.conclusion.status === "rollback_recommended" ? "一键回滚" : "回滚到上一版本"}` : undefined}
                        onClick={onRollback}
                      >
                        {rollbackPending ? "正在回滚…" : impact.conclusion.status === "rollback_recommended" ? "一键回滚" : "回滚到上一版本"}
                      </ActionButton>
                    </div>
                  ) : null}
                </div>
                <div className="grid content-start gap-2 border-t border-[var(--line-soft)] pt-4 text-sm leading-7 text-[var(--text-dim)] md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <p className="font-medium tabular-nums text-ink">观察第 {impact.observation.observedDay}/7 天</p>
                  <p className="tabular-nums">当前版本：第 {impact.release.version} 版</p>
                  <p>发布时间：{formatAdminDateTime(impact.release.publishedAt)}</p>
                  <p>{impact.observation.completed ? "观察期已结束" : "观察数据持续更新中"}</p>
                </div>
              </div>

              <Divider />

              {impact.after.generationCount === 0 ? (
                <div className="grid gap-3 py-4">
                  <p className="font-medium text-ink">已开始观察，等待首批回复</p>
                  <p className="text-pretty text-sm leading-7 text-[var(--text-dim)]">命中当前版本的新回复出现后，这里会自动展示质量变化。</p>
                  <div><ActionButton variant="ghost" onClick={() => void loadImpact()}>重新加载</ActionButton></div>
                </div>
              ) : (
                <>
                  <dl className="grid divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)] lg:hidden">
                    {METRIC_ROWS.map((row) => {
                      const exactIssueUnavailable =
                        (row.key === "sameIssueCount" || row.key === "sameIssueRate") &&
                        impact.baseline.sameIssueRate === null &&
                        impact.after.sameIssueRate === null;
                      return (
                        <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3 text-sm">
                          <dt className="font-medium text-ink/80">{row.label}</dt>
                          <dd className="text-right tabular-nums text-ink">
                            {exactIssueUnavailable ? "口径不足" : formatValue(impact.after[row.key], row.format)}
                          </dd>
                          <dd className="col-span-2 text-xs tabular-nums text-[var(--text-dim)]">
                            发布前 {exactIssueUnavailable ? "口径不足" : formatValue(impact.baseline[row.key], row.format)}
                            {" · "}
                            变化 {exactIssueUnavailable ? "—" : formatChange(impact.changes[row.key], row.format)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <div className="hidden lg:block">
                    <table className="w-full table-fixed text-left text-sm leading-7">
                      <caption className="sr-only">发布前后七天效果对比</caption>
                      <thead className="border-b border-[var(--line-soft)] text-xs text-[var(--text-dim)]">
                        <tr>
                          <th className="py-2 pr-4 font-medium">观察指标</th>
                          <th className="py-2 pr-4 font-medium">发布前 7 天</th>
                          <th className="py-2 pr-4 font-medium">发布后</th>
                          <th className="py-2 font-medium">变化</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums text-[var(--text-dim)]">
                        {METRIC_ROWS.map((row) => {
                          const exactIssueUnavailable =
                            (row.key === "sameIssueCount" || row.key === "sameIssueRate") &&
                            impact.baseline.sameIssueRate === null &&
                            impact.after.sameIssueRate === null;
                          return (
                            <tr key={row.key} className="border-b border-[var(--line-soft)]">
                              <th className="py-2 pr-4 font-medium text-ink/80">{row.label}</th>
                              <td className="py-2 pr-4">{exactIssueUnavailable ? "口径不足" : formatValue(impact.baseline[row.key], row.format)}</td>
                              <td className="py-2 pr-4">{exactIssueUnavailable ? "口径不足" : formatValue(impact.after[row.key], row.format)}</td>
                              <td className="py-2">{exactIssueUnavailable ? "—" : formatChange(impact.changes[row.key], row.format)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="grid gap-4 border-t border-[var(--line-soft)] pt-5">
                <div>
                  <ActionButton
                    variant="secondary"
                    className="whitespace-nowrap"
                    aria-expanded={evidenceExpanded}
                    aria-label={candidateName ? `${candidateName}：${evidenceExpanded ? "收起上线后真实案例" : "查看上线后真实案例"}` : undefined}
                    onClick={() => setEvidenceExpanded((current) => !current)}
                  >
                    {evidenceExpanded ? "收起上线后真实案例" : "查看上线后真实案例"}
                  </ActionButton>
                </div>
                {evidenceExpanded ? <ImpactEvidence candidateId={candidateId} counts={impact.evidenceCounts} /> : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
