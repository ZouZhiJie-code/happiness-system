"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ActionButton, SectionHeading, SlidingSegmentedControl, Surface, actionButtonClass } from "@/components/ui";
import {
  buildAdminAnalyticsDrilldownHref,
  buildAdminAnalyticsRangePresetHrefs,
  buildAdminAnalyticsViewHref,
  getAdminAnalyticsDimensionLabel,
  getAdminAnalyticsEntryStatusLabel,
  getAdminAnalyticsFunnelLabel,
  getAdminAnalyticsSessionStatusLabel,
  getAdminAnalyticsUserFunnelStepLabel,
  hasActiveAdminAnalyticsUserSearch,
  type AdminAnalyticsView
} from "@/features/admin-analytics/view-state";
import type {
  AdminAnalyticsFunnelRecord,
  AdminAnalyticsOverviewRecord,
  AdminAnalyticsQualityRecord,
  AdminAnalyticsRetentionRecord
} from "@/features/admin-analytics/types";
import type { DailyJournalStatus, InterviewDimension, InterviewSessionStatus, JoyEntryStatus } from "@/types/interview";

interface AdminAnalyticsShellProps {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  overview: AdminAnalyticsOverviewRecord;
  funnel: AdminAnalyticsFunnelRecord;
  retention: AdminAnalyticsRetentionRecord;
  quality: AdminAnalyticsQualityRecord;
  users: Array<{
    id: string;
    username: string;
    createdAt: string;
    latestActiveAt: string | null;
    funnelStep: string | null;
    savedEntryCount: number;
    savedDailyJournalCount: number;
    riskTags: string[];
  }>;
  username: string | null;
  hasSavedJournal: boolean;
  hasBoundaryInsufficient: boolean;
  hasReopenedSession: boolean;
  selectedUserId: string | null;
  userDetail: {
    user: {
      id: string;
      username: string;
      createdAt: string;
    } | null;
    recentActiveAt: string | null;
    funnelStep: string | null;
    scoreOverview: {
      scoreCount: number;
      latestScoreDate: string | null;
    };
    sessions: Array<{
      id: string;
      dimension: InterviewDimension;
      status: InterviewSessionStatus;
      turnCount: number;
      entryDate: string;
      startedAt: string;
      completedAt: string | null;
      pausedAt: string | null;
    }>;
    joyEntries: Array<{
      id: string;
      sessionId: string;
      title: string;
      status: JoyEntryStatus;
      updatedAt: string;
      savedAt: string | null;
    }>;
    dailyJournals: Array<{
      id: string;
      date: string;
      title: string;
      status: DailyJournalStatus;
      updatedAt: string;
      savedAt: string | null;
    }>;
    scores: Array<unknown>;
  } | null;
  sessionDetail: {
    id: string;
    status?: InterviewSessionStatus;
    messages: Array<{
      id: string;
      role: string;
      content: string;
    }>;
  } | null;
  entryDetail: {
    id: string;
    title: string;
    content: string;
  } | null;
  dailyJournalDetail: {
    id: string;
    title: string;
    content: string;
  } | null;
}

interface SearchContext {
  username: string | null;
  hasSavedJournal: boolean;
  hasBoundaryInsufficient: boolean;
  hasReopenedSession: boolean;
  selectedUserId: string | null;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatLatency(value: number | null) {
  return value == null ? "暂无" : `${value}ms`;
}

function formatEntryDateLike(value: string) {
  return value.slice(0, 10);
}

function buildStepConversionRows(steps: Array<{ key: string; count: number }>) {
  return steps.map((step, index) => {
    const previousCount = index === 0 ? null : steps[index - 1]?.count ?? null;
    const conversion = previousCount && previousCount > 0 ? `${Math.round((step.count / previousCount) * 100)}%` : "起点";

    return {
      ...step,
      label: getAdminAnalyticsFunnelLabel(step.key as never),
      conversion
    };
  });
}

function getRangeLabel(range: { startDate: string; endDate: string }) {
  const diffDays = Math.round((Date.parse(range.endDate) - Date.parse(range.startDate)) / (24 * 60 * 60 * 1000)) + 1;

  if (diffDays === 7) {
    return "最近 7 天";
  }

  if (diffDays === 30) {
    return "最近 30 天";
  }

  if (range.startDate.endsWith("-01")) {
    return "本月";
  }

  return "自定义范围";
}

function getFilterSummary(context: SearchContext) {
  const parts: string[] = [];

  if (context.hasSavedJournal) {
    parts.push("已有已保存日志");
  }

  if (context.hasBoundaryInsufficient) {
    parts.push("boundary insufficient");
  }

  if (context.hasReopenedSession) {
    parts.push("会话重开");
  }

  return parts;
}

function getSearchNarrative(context: SearchContext, rangeLabel: string) {
  if (context.username) {
    return `正在看${rangeLabel}内，用户名命中“${context.username}”的候选用户。`;
  }

  const filters = getFilterSummary(context);

  if (filters.length > 0) {
    return `正在看${rangeLabel}内，命中当前筛选条件的候选用户。`;
  }

  return `先输入用户名或启用筛选条件，再进入${rangeLabel}内的候选用户。`;
}

function getSelectedUserReason(context: SearchContext) {
  const reasons: string[] = [];

  if (context.username) {
    reasons.push(`命中搜索词“${context.username}”`);
  }

  if (context.hasSavedJournal) {
    reasons.push("带有已保存日志");
  }

  if (context.hasBoundaryInsufficient) {
    reasons.push("出现 boundary insufficient");
  }

  if (context.hasReopenedSession) {
    reasons.push("存在会话重开记录");
  }

  if (reasons.length === 0) {
    reasons.push("从候选用户列表手动进入");
  }

  return reasons;
}

function getCandidateRiskLabel(tag: string) {
  switch (tag) {
    case "boundary_insufficient":
      return "boundary insufficient";
    case "return_visit":
      return "return visit";
    default:
      return tag;
  }
}

function getCandidateSummary(user: {
  savedEntryCount: number;
  savedDailyJournalCount: number;
}) {
  if (user.savedDailyJournalCount > 0) {
    return `${user.savedEntryCount} 篇维度日志 · ${user.savedDailyJournalCount} 篇完整日志`;
  }

  if (user.savedEntryCount > 0) {
    return `${user.savedEntryCount} 篇维度日志`;
  }

  return "还没有已保存结果";
}

const CHIP_ACTIVE_CLASS = "border-[var(--line-strong)] bg-[var(--amber-soft)] text-ink";
const CHIP_IDLE_CLASS = "border-[var(--line-soft)] text-[var(--text-dim)] transition-colors hover:border-[var(--line-strong)] hover:text-ink";

function MetricTile({
  label,
  value,
  hint,
  action
}: {
  label: string;
  value: string | number;
  hint?: string;
  action?: {
    label: string;
    href: string;
  };
}) {
  return (
    <article>
      <p className="text-xs tracking-[0.16em] text-[var(--text-faint)]">{label}</p>
      <p className="mt-2 text-2xl text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-6 text-[var(--text-dim)]">{hint}</p> : null}
      {action ? (
        <Link href={action.href} scroll={false} className={actionButtonClass("ghost", "mt-2 px-0")}>
          {action.label}
        </Link>
      ) : null}
    </article>
  );
}

function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--line-soft)] pt-5">
      <SectionHeading title={title} description={description} />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StepBlock({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 border-t border-[var(--line-strong)] pt-6">
      <div className="max-w-4xl">
        <h2 className="font-display text-3xl text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-8 text-[var(--text-dim)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DetailDisclosure({
  summary,
  children
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details>
      <summary className="cursor-pointer list-none text-sm font-medium text-ink underline decoration-1 underline-offset-4">
        {summary}
      </summary>
      <div className="mt-3 text-sm leading-7 text-[var(--text-dim)]">{children}</div>
    </details>
  );
}

function buildUserSearchHref({
  view,
  range,
  context,
  overrides
}: {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  context: SearchContext;
  overrides?: Partial<SearchContext>;
}) {
  return buildAdminAnalyticsDrilldownHref({
    view,
    range,
    username: overrides?.username === undefined ? context.username : overrides.username,
    hasSavedJournal: overrides?.hasSavedJournal === undefined ? context.hasSavedJournal : overrides.hasSavedJournal,
    hasBoundaryInsufficient:
      overrides?.hasBoundaryInsufficient === undefined ? context.hasBoundaryInsufficient : overrides.hasBoundaryInsufficient,
    hasReopenedSession:
      overrides?.hasReopenedSession === undefined ? context.hasReopenedSession : overrides.hasReopenedSession,
    userId: overrides?.selectedUserId === undefined ? context.selectedUserId : overrides.selectedUserId
  });
}

function InvestigationPath({
  view,
  range,
  context
}: {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  context: SearchContext;
}) {
  const filterSummary = getFilterSummary(context);
  const activeSearch = hasActiveAdminAnalyticsUserSearch(context);

  return (
    <section className="border-t border-[var(--line-soft)] pt-5">
      <p className="font-mono text-[0.72rem] tracking-[0.22em] text-[var(--text-faint)]">当前调查路径</p>
      <div className="mt-4 grid gap-x-6 gap-y-4 text-sm text-[var(--text-dim)] md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p className="text-xs tracking-[0.14em] text-[var(--text-faint)]">当前视角：{view === "review" ? "复盘" : "监控"}</p>
          <p className="mt-1">{view === "review" ? "先看沉淀与转化，再进入人群。" : "先看链路健康与异常，再定位受影响的人。"}</p>
        </div>
        <div>
          <p className="text-xs tracking-[0.14em] text-[var(--text-faint)]">当前时间范围</p>
          <p className="mt-1">{`${getRangeLabel(range)} · ${range.startDate} 至 ${range.endDate}`}</p>
        </div>
        <div>
          <p className="text-xs tracking-[0.14em] text-[var(--text-faint)]">当前关注点</p>
          <p className="mt-1">
            {activeSearch ? "已经进入候选集合筛查，准备判断哪些人值得继续看。" : "先判断最近发生了什么，再决定要看哪类人。"}
          </p>
        </div>
        <div>
          <p className="text-xs tracking-[0.14em] text-[var(--text-faint)]">启用的筛选条件</p>
          <p className="mt-1">{filterSummary.length ? filterSummary.join("、") : "当前未启用筛选条件"}</p>
        </div>
        <div>
          <p className="text-xs tracking-[0.14em] text-[var(--text-faint)]">搜索词</p>
          <p className="mt-1">{context.username ? `用户名包含“${context.username}”` : "当前没有搜索词"}</p>
        </div>
        <div>
          <p className="text-xs tracking-[0.14em] text-[var(--text-faint)]">单人上下文</p>
          <p className="mt-1">{context.selectedUserId ? "已选中 1 位候选用户，正在查看单人证据。" : "尚未选中具体用户"}</p>
        </div>
      </div>
    </section>
  );
}

function FunnelStepRows({ title, steps }: { title: string; steps: Array<{ key: string; label: string; conversion: string; count: number }> }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <div className="mt-2 divide-y divide-[var(--line-soft)]">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-ink">{step.label}</p>
              <p className="text-xs text-[var(--text-faint)]">对上一环转化 {step.conversion}</p>
            </div>
            <p className="text-lg text-ink">{step.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DimensionSaveRows({ items }: { items: Array<{ dimension: InterviewDimension; savedEntryCount: number }> }) {
  return (
    <div className="divide-y divide-[var(--line-soft)] text-sm text-[var(--text-dim)]">
      {items.map((item) => (
        <div key={item.dimension} className="flex items-center justify-between py-3">
          <span>{getAdminAnalyticsDimensionLabel(item.dimension)}</span>
          <span>{item.savedEntryCount}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorCodeRows({ items }: { items: Array<{ errorCode: string; count: number }> }) {
  if (!items.length) {
    return <p className="text-sm text-[var(--text-dim)]">当前范围没有错误码记录。</p>;
  }

  return (
    <div className="divide-y divide-[var(--line-soft)] text-sm text-[var(--text-dim)]">
      {items.map((item) => (
        <div key={item.errorCode} className="flex items-center justify-between py-3">
          <span>{item.errorCode}</span>
          <span>{`当前范围记录到 ${item.count} 次。`}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewWorkspace({
  overview,
  funnel,
  retention,
  quality,
  range,
  view,
  context
}: {
  overview: AdminAnalyticsOverviewRecord;
  funnel: AdminAnalyticsFunnelRecord;
  retention: AdminAnalyticsRetentionRecord;
  quality: AdminAnalyticsQualityRecord;
  range: {
    startDate: string;
    endDate: string;
  };
  view: AdminAnalyticsView;
  context: SearchContext;
}) {
  const mainFunnel = buildStepConversionRows(funnel.mainFunnel);
  const secondaryFunnel = buildStepConversionRows(funnel.secondaryFunnel);

  return (
    <>
      <SectionCard title="本期速览" description="先判断这段时间有没有形成持续记录与结果沉淀，再决定往哪类人群下看。">
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
          <MetricTile label="MRU-7" value={overview.northStar.value} hint="最近 7 天内至少活跃一次的记录用户数" />
          <MetricTile
            label="结果沉淀"
            value={`${overview.overview.savedJournalCount} / ${overview.overview.savedDailyJournalCount}`}
            hint={`维度日志 ${overview.overview.savedJournalCount}，完整日志 ${overview.overview.savedDailyJournalCount}`}
            action={{
              label: "查看已有已保存日志的用户",
              href: buildUserSearchHref({
                view,
                range,
                context,
                overrides: {
                  hasSavedJournal: true,
                  selectedUserId: null
                }
              })
            }}
          />
          <MetricTile label="系统稳定" value={formatPercent(quality.ai.successRate)} hint={`p95 ${formatLatency(quality.ai.p95LatencyMs)}`} />
        </div>
      </SectionCard>

      <SectionCard title="转化路径" description="用同一份数据看主链路和完整日志补充链路，先定位掉点，再决定下一步看哪类人。">
        <div className="grid gap-x-10 gap-y-6 xl:grid-cols-2">
          <FunnelStepRows title="主链路" steps={mainFunnel} />
          <FunnelStepRows title="完整日志补充链路" steps={secondaryFunnel} />
        </div>
      </SectionCard>

      <SectionCard title="留存与回访" description="确认用户会不会回来记录，以及回来之后是否还会留下结果。">
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="D1 回访" value={formatPercent(retention.d1ReturnToRecordRate)} />
          <MetricTile
            label="D7 回访"
            value={formatPercent(retention.d7ReturnToRecordRate)}
            action={{
              label: "查看有回访记录的用户",
              href: buildUserSearchHref({
                view,
                range,
                context,
                overrides: {
                  hasReopenedSession: true,
                  selectedUserId: null
                }
              })
            }}
          />
          <MetricTile label="D30 回访" value={formatPercent(retention.d30ReturnToRecordRate)} />
          <MetricTile label="D7 再次保存" value={formatPercent(retention.d7RepeatSaveRate)} />
          <MetricTile label="D30 再次保存" value={formatPercent(retention.d30RepeatSaveRate)} />
        </div>
      </SectionCard>

      <SectionCard title="内容与质量" description="把草稿改写、异常边界、时延和错误码放在一起读，更容易判断体验摩擦。">
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <MetricTile
              label="草稿编辑率"
              value={formatPercent(quality.draftEditRate)}
              action={{
                label: "查看高编辑用户",
                href: buildUserSearchHref({
                  view,
                  range,
                  context,
                  overrides: {
                    hasSavedJournal: true,
                    selectedUserId: null
                  }
                })
              }}
            />
            <MetricTile
              label="boundary insufficient 率"
              value={formatPercent(quality.boundaryInsufficientRate)}
              action={{
                label: "查看相关用户",
                href: buildUserSearchHref({
                  view,
                  range,
                  context,
                  overrides: {
                    hasBoundaryInsufficient: true,
                    selectedUserId: null
                  }
                })
              }}
            />
            <MetricTile
              label="stale 比例"
              value={formatPercent(quality.staleRate)}
              action={{
                label: "查看待更新用户",
                href: buildUserSearchHref({
                  view,
                  range,
                  context,
                  overrides: {
                    hasSavedJournal: true,
                    selectedUserId: null
                  }
                })
              }}
            />
            <MetricTile label="AI 成功率" value={formatPercent(quality.ai.successRate)} />
            <MetricTile label="AI p50" value={formatLatency(quality.ai.p50LatencyMs)} />
            <MetricTile label="AI p95" value={formatLatency(quality.ai.p95LatencyMs)} />
          </div>
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-ink">维度保存分布</h4>
              <div className="mt-2">
                <DimensionSaveRows items={quality.dimensionSaveBreakdown} />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-ink">错误码分布</h4>
              <div className="mt-2">
                <ErrorCodeRows items={quality.ai.errorCodeBreakdown} />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function MonitorWorkspace({
  overview,
  funnel,
  quality,
  range,
  view,
  context
}: {
  overview: AdminAnalyticsOverviewRecord;
  funnel: AdminAnalyticsFunnelRecord;
  quality: AdminAnalyticsQualityRecord;
  range: {
    startDate: string;
    endDate: string;
  };
  view: AdminAnalyticsView;
  context: SearchContext;
}) {
  return (
    <>
      <SectionCard title="链路健康" description="先判断服务是否稳定、主链路是否持续有人走到关键节点。">
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="AI 成功率" value={formatPercent(quality.ai.successRate)} />
          <MetricTile label="AI p50" value={formatLatency(quality.ai.p50LatencyMs)} />
          <MetricTile label="AI p95" value={formatLatency(quality.ai.p95LatencyMs)} />
          <MetricTile label="开始访谈" value={funnel.mainFunnel.find((item) => item.key === "sessionStart")?.count ?? 0} />
          <MetricTile label="保存维度日志" value={funnel.mainFunnel.find((item) => item.key === "journalSaved")?.count ?? 0} />
        </div>
      </SectionCard>

      <SectionCard title="异常信号" description="把暂停、重开、边界不足和跳维提示并列放置，便于快速扫出异常。">
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="暂停会话" value={funnel.qualitySignals.pausedCount} />
          <MetricTile label="重开会话" value={funnel.qualitySignals.reopenedCount} />
          <MetricTile
            label="boundary insufficient"
            value={funnel.qualitySignals.boundaryInsufficientCount}
            action={{
              label: "查看相关用户",
              href: buildUserSearchHref({
                view,
                range,
                context,
                overrides: {
                  hasBoundaryInsufficient: true,
                  selectedUserId: null
                }
              })
            }}
          />
          <MetricTile label="dimension redirect" value={funnel.qualitySignals.dimensionRedirectCount} />
        </div>
        <div className="mt-6">
          <h4 className="text-sm font-medium text-ink">错误码分布</h4>
          <div className="mt-2">
            <ErrorCodeRows items={quality.ai.errorCodeBreakdown} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="质量风险" description="不扩新口径，直接把需要盯的风险项集中展示，再进入候选用户。">
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <MetricTile label="stale rate" value={formatPercent(quality.staleRate)} />
            <MetricTile label="草稿编辑率" value={formatPercent(quality.draftEditRate)} />
            <MetricTile label="MRU-7" value={overview.northStar.value} />
            <MetricTile label="完整日志保存" value={funnel.secondaryFunnel.find((item) => item.key === "dailyJournalSaved")?.count ?? 0} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-ink">维度保存分布</h4>
            <div className="mt-2">
              <DimensionSaveRows items={quality.dimensionSaveBreakdown} />
            </div>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function CandidateSearchPanel({
  view,
  range,
  context
}: {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  context: SearchContext;
}) {
  const router = useRouter();
  const chips = [
    {
      label: "已有已保存日志",
      active: context.hasSavedJournal,
      href: buildUserSearchHref({
        view,
        range,
        context,
        overrides: {
          hasSavedJournal: !context.hasSavedJournal,
          selectedUserId: null
        }
      })
    },
    {
      label: "boundary insufficient",
      active: context.hasBoundaryInsufficient,
      href: buildUserSearchHref({
        view,
        range,
        context,
        overrides: {
          hasBoundaryInsufficient: !context.hasBoundaryInsufficient,
          selectedUserId: null
        }
      })
    },
    {
      label: "会话重开",
      active: context.hasReopenedSession,
      href: buildUserSearchHref({
        view,
        range,
        context,
        overrides: {
          hasReopenedSession: !context.hasReopenedSession,
          selectedUserId: null
        }
      })
    }
  ];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextUsername = formData.get("username")?.toString().trim() ?? "";

    router.replace(
      buildUserSearchHref({
        view,
        range,
        context,
        overrides: {
          username: nextUsername.length > 0 ? nextUsername : null,
          selectedUserId: null
        }
      }),
      { scroll: false }
    );
  }

  return (
    <SectionCard title="当前调查对象" description={getSearchNarrative(context, getRangeLabel(range))}>
      <div className="space-y-5">
        <div className="grid gap-x-10 gap-y-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
          <div>
            <p className="text-sm font-medium text-ink">搜索输入框</p>
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="startDate" value={range.startDate} />
              <input type="hidden" name="endDate" value={range.endDate} />
              {context.hasSavedJournal ? <input type="hidden" name="hasSavedJournal" value="1" /> : null}
              {context.hasBoundaryInsufficient ? <input type="hidden" name="hasBoundaryInsufficient" value="1" /> : null}
              {context.hasReopenedSession ? <input type="hidden" name="hasReopenedSession" value="1" /> : null}
              <input
                type="search"
                name="username"
                defaultValue={context.username ?? ""}
                placeholder="按用户名定位候选用户"
                className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--line-soft)] bg-white px-4 text-sm text-ink outline-none transition-colors focus:border-[var(--line-strong)]"
              />
              <ActionButton type="submit" variant="primary" className="min-h-11 px-5 text-sm">
                开始筛查
              </ActionButton>
            </form>
            <p className="mt-3 text-sm leading-7 text-[var(--text-faint)]">先输入用户名或启用一个筛选条件，候选用户才会出现。</p>
          </div>

          <div>
            <p className="text-sm font-medium text-ink">调查说明</p>
            <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
              {hasActiveAdminAnalyticsUserSearch(context)
                ? "这批候选用户适合回答：最近哪类人发生了问题、留下了结果，或者值得继续追踪。"
                : "这里先不直接铺全量用户。先明确目标，再把候选集合缩到足够可判断的范围。"}
            </p>
            {getFilterSummary(context).length ? (
              <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">已启用筛选：{getFilterSummary(context).join("、")}。</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              scroll={false}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm ${
                chip.active ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function CandidateResults({
  view,
  range,
  users,
  context
}: {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  users: Array<{
    id: string;
    username: string;
    createdAt: string;
    latestActiveAt: string | null;
    funnelStep: string | null;
    savedEntryCount: number;
    savedDailyJournalCount: number;
    riskTags: string[];
  }>;
  context: SearchContext;
}) {
  if (!hasActiveAdminAnalyticsUserSearch(context)) {
    return null;
  }

  return (
    <section className="border-t border-[var(--line-soft)] pt-5">
      <SectionHeading
        title="候选用户"
        description="先看轻量概览，再决定是否进入单人上下文。"
        actions={
          <p className="text-sm text-[var(--text-faint)]">{users.length ? `共 ${users.length} 位候选用户` : "当前没有候选用户"}</p>
        }
      />
      {users.length ? (
        <div className="mt-5 overflow-x-auto">
          <table aria-label="候选用户结果" className="min-w-full border-collapse text-left text-sm text-[var(--text-dim)]">
            <thead>
              <tr className="border-b border-[var(--line-strong)] text-xs tracking-[0.14em] text-[var(--text-faint)]">
                <th className="px-3 py-3 font-medium">用户名</th>
                <th className="px-3 py-3 font-medium">最近活跃</th>
                <th className="px-3 py-3 font-medium">当前漏斗阶段</th>
                <th className="px-3 py-3 font-medium">沉淀概览</th>
                <th className="px-3 py-3 font-medium">风险标签</th>
                <th className="px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--line-soft)]">
                  <td className="px-3 py-4 text-ink">{user.username}</td>
                  <td className="px-3 py-4">{formatEntryDateLike(user.latestActiveAt ?? user.createdAt)}</td>
                  <td className="px-3 py-4">{getAdminAnalyticsUserFunnelStepLabel(user.funnelStep)}</td>
                  <td className="px-3 py-4">{getCandidateSummary(user)}</td>
                  <td className="px-3 py-4">
                    {user.riskTags.length ? (
                      <div className="flex flex-wrap gap-2">
                        {user.riskTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex min-h-8 items-center rounded-full border border-[var(--line-soft)] px-3 text-xs tracking-[0.08em] text-[var(--text-dim)]"
                          >
                            {getCandidateRiskLabel(tag)}
                          </span>
                        ))}
                      </div>
                    ) : "常规观察"}
                  </td>
                  <td className="px-3 py-4">
                    <Link
                      href={buildUserSearchHref({
                        view,
                        range,
                        context,
                        overrides: {
                          selectedUserId: user.id
                        }
                      })}
                      scroll={false}
                      className={actionButtonClass("secondary", "min-h-10 px-4 text-sm")}
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-[var(--text-faint)]">当前筛查条件下还没有候选用户，建议调整搜索词或切换筛选条件。</p>
      )}
    </section>
  );
}

function EmptyUserContext() {
  return (
    <section className="border-t border-[var(--line-strong)] pt-6">
      <h3 className="font-display text-2xl text-ink">第三步：进入单人上下文</h3>
      <p className="mt-3 text-sm leading-8 text-[var(--text-dim)]">只有明确选中某个候选用户后，这里才会展开单人证据。当前先停留在候选集合层，避免总览和个人详情并排混在同一决策层。</p>
    </section>
  );
}

function UserContextDetail({
  view,
  range,
  userDetail,
  sessionDetail,
  entryDetail,
  dailyJournalDetail,
  context
}: {
  view: AdminAnalyticsView;
  range: {
    startDate: string;
    endDate: string;
  };
  userDetail: AdminAnalyticsShellProps["userDetail"];
  sessionDetail: AdminAnalyticsShellProps["sessionDetail"];
  entryDetail: AdminAnalyticsShellProps["entryDetail"];
  dailyJournalDetail: AdminAnalyticsShellProps["dailyJournalDetail"];
  context: SearchContext;
}) {
  if (!context.selectedUserId || !userDetail?.user) {
    return <EmptyUserContext />;
  }

  const whyVisible = getSelectedUserReason(context);

  return (
    <section className="space-y-6 border-t border-[var(--line-strong)] pt-6">
      <div>
        <h3 className="font-display text-2xl text-ink">第三步：进入单人上下文</h3>
        <p className="mt-3 text-sm leading-8 text-[var(--text-dim)]">现在开始回答：这个人为什么值得看，以及最近具体发生了什么。</p>
      </div>

      <div className="grid gap-x-10 gap-y-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section>
          <p className="font-mono text-[0.68rem] tracking-[0.18em] text-[var(--text-faint)]">为什么看到这个人</p>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-[var(--text-dim)]">
            {whyVisible.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>

        <section>
          <p className="font-mono text-[0.68rem] tracking-[0.18em] text-[var(--text-faint)]">用户摘要</p>
          <h4 className="mt-3 font-display text-2xl text-ink">{userDetail.user.username}</h4>
          <dl className="mt-4 grid gap-3 text-sm text-[var(--text-dim)]">
            <div className="flex items-center justify-between gap-4">
              <dt>注册时间</dt>
              <dd>{formatEntryDateLike(userDetail.user.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>最近活跃时间</dt>
              <dd>{userDetail.recentActiveAt ? formatEntryDateLike(userDetail.recentActiveAt) : "暂无"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>当前漏斗阶段</dt>
              <dd>{getAdminAnalyticsUserFunnelStepLabel(userDetail.funnelStep)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>评分概览</dt>
              <dd>{userDetail.scoreOverview.scoreCount > 0 ? `${userDetail.scoreOverview.scoreCount} 次，最近 ${userDetail.scoreOverview.latestScoreDate}` : "暂无评分记录"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid gap-x-10 gap-y-6 xl:grid-cols-3">
        <section>
          <h4 className="text-sm font-medium text-ink">最近会话</h4>
          <div className="mt-2 divide-y divide-[var(--line-soft)]">
            {userDetail.sessions.map((session) => (
              <Link
                key={session.id}
                href={buildAdminAnalyticsDrilldownHref({
                  view,
                  range,
                  username: context.username,
                  hasSavedJournal: context.hasSavedJournal,
                  hasBoundaryInsufficient: context.hasBoundaryInsufficient,
                  hasReopenedSession: context.hasReopenedSession,
                  userId: userDetail.user?.id,
                  sessionId: session.id
                })}
                scroll={false}
                className="block py-3 text-sm text-[var(--text-dim)] transition-colors hover:text-ink"
              >
                {`${getAdminAnalyticsDimensionLabel(session.dimension)} · ${formatEntryDateLike(session.entryDate)} · ${getAdminAnalyticsSessionStatusLabel(session.status)} · ${session.turnCount} 轮`}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-medium text-ink">最近维度日志</h4>
          <div className="mt-2 divide-y divide-[var(--line-soft)]">
            {userDetail.joyEntries.map((entry) => (
              <Link
                key={entry.id}
                href={buildAdminAnalyticsDrilldownHref({
                  view,
                  range,
                  username: context.username,
                  hasSavedJournal: context.hasSavedJournal,
                  hasBoundaryInsufficient: context.hasBoundaryInsufficient,
                  hasReopenedSession: context.hasReopenedSession,
                  userId: userDetail.user?.id,
                  entryId: entry.id
                })}
                scroll={false}
                className="block py-3 text-sm text-[var(--text-dim)] transition-colors hover:text-ink"
              >
                {`${entry.title} · ${getAdminAnalyticsEntryStatusLabel(entry.status)} · ${formatEntryDateLike(entry.updatedAt)}`}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-medium text-ink">最近完整日志</h4>
          <div className="mt-2 divide-y divide-[var(--line-soft)]">
            {userDetail.dailyJournals.map((entry) => (
              <Link
                key={entry.id}
                href={buildAdminAnalyticsDrilldownHref({
                  view,
                  range,
                  username: context.username,
                  hasSavedJournal: context.hasSavedJournal,
                  hasBoundaryInsufficient: context.hasBoundaryInsufficient,
                  hasReopenedSession: context.hasReopenedSession,
                  userId: userDetail.user?.id,
                  dailyJournalId: entry.id
                })}
                scroll={false}
                className="block py-3 text-sm text-[var(--text-dim)] transition-colors hover:text-ink"
              >
                {`${entry.title} · ${getAdminAnalyticsEntryStatusLabel(entry.status)} · ${formatEntryDateLike(entry.date)}`}
              </Link>
            ))}
          </div>
        </section>
      </div>

      {sessionDetail ? (
        <section className="border-t border-[var(--line-soft)] pt-5">
          <h4 className="text-sm font-medium text-ink">会话详情</h4>
          <p className="mt-2 text-xs text-[var(--text-faint)]">状态：{getAdminAnalyticsSessionStatusLabel(sessionDetail.status ?? "completed")}</p>
          <div className="mt-4">
            <DetailDisclosure summary="展开对话原文">
              <div className="space-y-3">
                {sessionDetail.messages.map((message) => (
                  <div key={message.id} className="border-l border-[var(--line-soft)] pl-3">
                    <p className="text-xs tracking-[0.16em] text-[var(--text-faint)]">{message.role === "user" ? "用户" : "AI"}</p>
                    <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
              </div>
            </DetailDisclosure>
          </div>
        </section>
      ) : null}

      {entryDetail ? (
        <section className="border-t border-[var(--line-soft)] pt-5">
          <h4 className="text-sm font-medium text-ink">维度日志详情</h4>
          <p className="mt-3 text-sm text-ink">{entryDetail.title}</p>
          <div className="mt-4">
            <DetailDisclosure summary="展开维度日志正文">
              <p className="whitespace-pre-wrap">{entryDetail.content}</p>
            </DetailDisclosure>
          </div>
        </section>
      ) : null}

      {dailyJournalDetail ? (
        <section className="border-t border-[var(--line-soft)] pt-5">
          <h4 className="text-sm font-medium text-ink">完整日志详情</h4>
          <p className="mt-3 text-sm text-ink">{dailyJournalDetail.title}</p>
          <div className="mt-4">
            <DetailDisclosure summary="展开完整日志正文">
              <p className="whitespace-pre-wrap">{dailyJournalDetail.content}</p>
            </DetailDisclosure>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export function AdminAnalyticsShell({
  view,
  range,
  overview,
  funnel,
  retention,
  quality,
  users,
  username,
  hasSavedJournal,
  hasBoundaryInsufficient,
  hasReopenedSession,
  selectedUserId,
  userDetail,
  sessionDetail,
  entryDetail,
  dailyJournalDetail
}: AdminAnalyticsShellProps) {
  const router = useRouter();
  const context: SearchContext = {
    username,
    hasSavedJournal,
    hasBoundaryInsufficient,
    hasReopenedSession,
    selectedUserId
  };

  const viewPresets: Array<{ value: AdminAnalyticsView; label: string }> = [
    { value: "review", label: "复盘视角" },
    { value: "monitor", label: "监控视角" }
  ];

  const rangePresets = buildAdminAnalyticsRangePresetHrefs({
    view,
    range,
    username,
    hasSavedJournal,
    hasBoundaryInsufficient,
    hasReopenedSession,
    userId: selectedUserId
  });

  return (
    <Surface
      as="section"
      className="min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="max-w-[56rem]">
          <p className="font-mono text-[0.72rem] tracking-[0.22em] text-[var(--text-faint)]">Admin Analytics</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink md:text-5xl">管理员数据分析</h1>
          <p className="mt-4 text-sm leading-8 text-[var(--text-dim)]">把总览、人群筛查和单人证据拆成三层推进，先判断最近发生了什么，再进入候选集合和个人上下文。</p>
        </header>

        <div className="flex flex-col gap-4">
          <SlidingSegmentedControl
            variant="admin"
            ariaLabel="分析视角"
            value={view}
            onChange={(nextView) => {
              router.replace(
                buildAdminAnalyticsViewHref({
                  view: nextView,
                  range,
                  username,
                  hasSavedJournal,
                  hasBoundaryInsufficient,
                  hasReopenedSession,
                  userId: selectedUserId
                }),
                { scroll: false }
              );
            }}
            items={viewPresets.map((item) => ({
              value: item.value,
              label: item.label
            }))}
          />

          <div className="flex flex-wrap items-center gap-3">
            {rangePresets.map((preset) => (
              <Link
                key={preset.key}
                href={preset.href}
                scroll={false}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm ${
                  preset.label === getRangeLabel(range) ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS
                }`}
              >
                {preset.label}
              </Link>
            ))}
            <span className="text-sm text-[var(--text-faint)]">{`${range.startDate} 至 ${range.endDate}`}</span>
          </div>
        </div>

        <InvestigationPath view={view} range={range} context={context} />

        <StepBlock title="第一步：先判断最近发生了什么" description="这里只回答群体级问题。先看总览、链路、留存和质量，再决定要看哪类人。">
          {view === "review"
            ? (
              <ReviewWorkspace
                overview={overview}
                funnel={funnel}
                retention={retention}
                quality={quality}
                range={range}
                view={view}
                context={context}
              />
            )
            : (
              <MonitorWorkspace
                overview={overview}
                funnel={funnel}
                quality={quality}
                range={range}
                view={view}
                context={context}
              />
            )}
        </StepBlock>

        <StepBlock title="第二步：先锁定一类人，再看个人" description="用户调查区只处理候选集合，不直接展开会话和正文。没有搜索词或筛选条件时，不展示结果表。">
          <CandidateSearchPanel view={view} range={range} context={context} />
          <CandidateResults view={view} range={range} users={users} context={context} />
        </StepBlock>

        <UserContextDetail
          view={view}
          range={range}
          userDetail={userDetail}
          sessionDetail={sessionDetail}
          entryDetail={entryDetail}
          dailyJournalDetail={dailyJournalDetail}
          context={context}
        />
      </div>
    </Surface>
  );
}
