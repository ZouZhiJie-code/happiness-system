"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import type { AnalysisDailyCoverageDay, AnalysisTrendsRangeRecord } from "@/features/analysis/types";
import type { AnalysisRangePreset } from "@/features/analysis/date-range";
import { buildCalendarMonthGrid } from "@/features/calendar/view-state";
import { happinessScorePresentationItems } from "@/features/happiness-score/presentation";
import { actionButtonClass, Card, HorizontalPager, SlidingSegmentedControl } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatScoreAverage } from "./analysis-shared";

type FactorView = "radar" | "lollipop";

const TRENDS_VIZ_CLASS = "analysis-trends-viz";
const TRENDS_PANE_PAD = "px-[0.85rem] py-[0.65rem]";
// 底部两列统一图表槽；高度按放大后的 8 行棒棒糖内容兜住。
const TRENDS_BOTTOM_PANE_SLOT = "h-[13rem] w-full";

const RADAR_LAYOUT = {
  cx: 100,
  cy: 100,
  radius: 72,
  labelRadius: 88,
  labelFontSize: 10,
  padding: 4
} as const;

function TrendsVizCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn(TRENDS_VIZ_CLASS, className)}>{children}</Card>;
}

function TrendsPaneHead({
  title,
  action
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-[0.35rem] flex items-center justify-between gap-2">
      <h3 className="text-[0.8rem] font-semibold text-[var(--text-main)]">{title}</h3>
      {action}
    </div>
  );
}

function getLogDensityClass(count: number) {
  if (count <= 0) return "bg-ember/[0.06]";
  if (count === 1) return "bg-ember/20";
  if (count === 2) return "bg-ember/[0.38]";
  if (count === 3) return "bg-ember/[0.55]";
  return "bg-clay/75";
}

function buildCoverageMap(days: AnalysisDailyCoverageDay[]) {
  return new Map(days.map((day) => [day.date, day]));
}

function PeriodSummary({ record }: { record: AnalysisTrendsRangeRecord }) {
  const scoredDays = record.scoreOverview.scoredDayCount;
  const loggedDays = record.logOverview.recordedDayCount;
  const average = record.scoreOverview.monthAverageScore;

  return (
    <p className={cn("analysis-trends-period-bar px-[0.85rem] py-[0.55rem] leading-relaxed")}>
      本周期 <strong className="font-semibold text-[var(--text-main)]">{scoredDays} 天有评分</strong>、
      <strong className="font-semibold text-[var(--text-main)]">{loggedDays} 天有记录</strong>
      {typeof average === "number" ? (
        <>
          {" "}
          · 均分 <strong className="font-semibold text-[var(--text-main)]">{formatScoreAverage(average)}</strong>
        </>
      ) : null}
    </p>
  );
}

function TotalScoreComboChart({ record }: { record: AnalysisTrendsRangeRecord }) {
  const gradientId = useId().replace(/:/g, "");
  const scoredDays = record.scoreTrend.days.filter((day) => day.hasScore && typeof day.averageScore === "number");

  if (scoredDays.length === 0) {
    return (
      <TrendsVizCard className="px-5 py-8 text-center text-[0.88rem] text-[var(--text-dim)]">
        <p>这个周期还没有评分记录。</p>
        <Link href="/interview" className={actionButtonClass("ghost", "mt-3")}>前往当天评分</Link>
      </TrendsVizCard>
    );
  }

  const width = 640;
  const height = 200;
  const paddingLeft = 38;
  const paddingRight = 16;
  const paddingTop = 36;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const minScore = 2;
  const maxScore = 10;
  const dayCount = record.scoreTrend.days.length;
  const barSlot = chartWidth / Math.max(dayCount, 1);
  const barWidth = Math.min(12, Math.max(6, barSlot * 0.55));

  const yForScore = (score: number) =>
    paddingTop + chartHeight - ((score - minScore) / (maxScore - minScore)) * chartHeight;

  const comfortTop = yForScore(8);
  const comfortBottom = yForScore(6);
  const chartFloor = yForScore(minScore);

  const points = record.scoreTrend.days
    .map((day, index) => {
      if (!day.hasScore || typeof day.averageScore !== "number") {
        return null;
      }

      const x = paddingLeft + barSlot * index + barSlot / 2;
      const y = yForScore(day.averageScore);
      return { x, y, score: day.averageScore };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  const linePath =
    points.length > 0
      ? points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")
      : "";

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${chartFloor.toFixed(1)} L ${points[0].x.toFixed(1)} ${chartFloor.toFixed(1)} Z`
      : "";

  return (
    <TrendsVizCard className="px-[1.1rem] pb-[0.9rem] pt-4">
      <div className="mb-[0.45rem] flex items-center justify-between gap-3">
        <h3 className="text-[0.82rem] font-semibold text-[var(--text-main)]">总分走势</h3>
        <span className="font-mono text-[0.66rem] text-clay/80">柱+线 · 舒适区 6–8</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto min-h-[12rem] w-full md:min-h-[16.5rem]" aria-label="总分柱线走势">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x={paddingLeft}
          y={comfortTop}
          width={chartWidth}
          height={Math.max(comfortBottom - comfortTop, 0)}
          className="fill-[var(--moss-soft)]"
          rx={2}
        />
        <text x={paddingLeft + 2} y={comfortTop - 4} className="fill-moss text-[7px]">
          6–8
        </text>
        {[2, 4, 6, 8, 10].map((tick) => (
          <g key={tick}>
            <line
              x1={paddingLeft}
              x2={paddingLeft + chartWidth}
              y1={yForScore(tick)}
              y2={yForScore(tick)}
              className="stroke-ember/[0.07]"
              strokeWidth={0.8}
            />
            <text
              x={paddingLeft - 6}
              y={yForScore(tick) + 3}
              textAnchor="end"
              className="fill-line/70 font-mono text-[7px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {record.scoreTrend.days.map((day, index) => {
          const x = paddingLeft + barSlot * index + (barSlot - barWidth) / 2;
          const score = day.averageScore;
          const hasScore = day.hasScore && typeof score === "number";

          if (!hasScore) {
            return null;
          }

          const barTop = yForScore(score);
          const barBottom = chartFloor;
          const tone =
            score >= 6 && score <= 8 ? "fill-moss/35" : score < 5 ? "fill-ember/12" : "fill-ember/20";

          return <rect key={day.date} x={x} y={barTop} width={barWidth} height={Math.max(barBottom - barTop, 2)} className={tone} rx={1} />;
        })}
        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {linePath ? <path d={linePath} fill="none" className="stroke-clay" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((point) => (
          <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r={2.5} className="fill-paper stroke-clay" strokeWidth={1.5} />
        ))}
        {record.scoreTrend.days.map((day, index) => {
          const x = paddingLeft + barSlot * index + barSlot / 2;
          const [, , dayText] = day.date.split("-");
          return (
            <text key={`${day.date}-label`} x={x} y={height - 14} textAnchor="middle" className="fill-line/70 font-mono text-[6.5px]">
              {Number(dayText)}
            </text>
          );
        })}
      </svg>
    </TrendsVizCard>
  );
}

function LogDaysHeatmap({ record, preset }: { record: AnalysisTrendsRangeRecord; preset: AnalysisRangePreset }) {
  const coverageByDate = useMemo(() => buildCoverageMap(record.dailyCoverage), [record.dailyCoverage]);
  const isFullMonthGrid = preset === "month" && record.startDate.endsWith("-01");

  const cells = useMemo(() => {
    if (preset === "week") {
      return record.dailyCoverage.map((day) => ({
        key: day.date,
        count: day.savedDimensionCount,
        pad: false
      }));
    }

    const monthKey = record.startDate.slice(0, 7);
    if (isFullMonthGrid) {
      return buildCalendarMonthGrid(monthKey).map((cell) => ({
        key: cell.key,
        count: cell.date ? (coverageByDate.get(cell.date)?.savedDimensionCount ?? 0) : 0,
        pad: !cell.date
      }));
    }

    return record.dailyCoverage.map((day) => ({
      key: day.date,
      count: day.savedDimensionCount,
      pad: false
    }));
  }, [coverageByDate, isFullMonthGrid, preset, record.dailyCoverage, record.startDate]);

  return (
    <TrendsVizCard className={TRENDS_PANE_PAD}>
      <TrendsPaneHead title="日志天数" />
      <div className={cn(TRENDS_BOTTOM_PANE_SLOT, "flex items-center")}>
        <div
          className={cn(
            "mx-auto grid w-full gap-[3px]",
            isFullMonthGrid
              ? "max-w-[15.125rem] grid-cols-7"
              : preset === "week"
                ? "w-full grid-cols-7"
              : "grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))]"
          )}
          role="img"
          aria-label="本周期日志记录密度"
        >
          {cells.map((cell) => (
            <div
              key={cell.key}
              className={cn("aspect-square rounded-[2px]", cell.pad ? "bg-transparent" : getLogDensityClass(cell.count))}
              aria-hidden={cell.pad}
            />
          ))}
        </div>
      </div>
    </TrendsVizCard>
  );
}

const FACTOR_VIEW_ITEMS = [
  { value: "radar" as const, label: "雷达图" },
  { value: "lollipop" as const, label: "棒棒糖" }
];

function FactorToggle({ view, onChange }: { view: FactorView; onChange: (view: FactorView) => void }) {
  return (
    <SlidingSegmentedControl
      variant="soft"
      ariaLabel="幸福8要素图表样式"
      value={view}
      onChange={onChange}
      items={FACTOR_VIEW_ITEMS}
    />
  );
}

function EightFactorsPanel({ record }: { record: AnalysisTrendsRangeRecord }) {
  const [view, setView] = useState<FactorView>("radar");
  const gradientId = useId().replace(/:/g, "");
  const items = happinessScorePresentationItems;

  const radarGeometry = useMemo(() => {
    const angleStep = (Math.PI * 2) / items.length;
    const { cx, cy, radius, labelRadius, labelFontSize, padding } = RADAR_LAYOUT;
    const labelHalfWidth = labelFontSize * 1.1;

    const points = items.map((item, index) => {
      const value = record.scoreTrend.factorAverages[item.requestKey];
      const ratio = typeof value === "number" ? (value - 2) / 8 : 0;
      const angle = -Math.PI / 2 + angleStep * index;
      const plotRadius = radius * Math.max(ratio, 0.08);
      const x = cx + Math.cos(angle) * plotRadius;
      const y = cy + Math.sin(angle) * plotRadius;
      const labelX = cx + Math.cos(angle) * labelRadius;
      const labelY = cy + Math.sin(angle) * labelRadius;
      const textAnchor: "start" | "middle" | "end" =
        labelX > cx + 10 ? "start" : labelX < cx - 10 ? "end" : "middle";

      return { item, x, y, labelX, labelY, textAnchor };
    });

    const gridScales = [0.35, 0.55, 0.75, 1] as const;
    const grids = gridScales.map((scale) =>
      items
        .map((_, index) => {
          const angle = -Math.PI / 2 + angleStep * index;
          const gridRadius = radius * scale;
          const x = cx + Math.cos(angle) * gridRadius;
          const y = cy + Math.sin(angle) * gridRadius;
          return `${x},${y}`;
        })
        .join(" ")
    );

    let minX: number = cx;
    let maxX: number = cx;
    let minY: number = cy;
    let maxY: number = cy;

    points.forEach((point, index) => {
      const outerAngle = -Math.PI / 2 + angleStep * index;
      const outerRingX = cx + Math.cos(outerAngle) * radius;
      const outerRingY = cy + Math.sin(outerAngle) * radius;

      minX = Math.min(minX, point.x, outerRingX);
      maxX = Math.max(maxX, point.x, outerRingX);
      minY = Math.min(minY, point.y, outerRingY);
      maxY = Math.max(maxY, point.y, outerRingY);

      if (point.textAnchor === "start") {
        minX = Math.min(minX, point.labelX);
        maxX = Math.max(maxX, point.labelX + labelHalfWidth * 2);
      } else if (point.textAnchor === "end") {
        minX = Math.min(minX, point.labelX - labelHalfWidth * 2);
        maxX = Math.max(maxX, point.labelX);
      } else {
        minX = Math.min(minX, point.labelX - labelHalfWidth);
        maxX = Math.max(maxX, point.labelX + labelHalfWidth);
      }

      minY = Math.min(minY, point.labelY - labelFontSize / 2);
      maxY = Math.max(maxY, point.labelY + labelFontSize / 2);
    });

    const viewBox = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };

    return { points, grids, viewBox };
  }, [items, record.scoreTrend.factorAverages]);

  const hasAnyAverage = Object.values(record.scoreTrend.factorAverages).some((value) => typeof value === "number");

  return (
    <TrendsVizCard className={TRENDS_PANE_PAD}>
      <TrendsPaneHead title="幸福 8 要素评分" action={<FactorToggle view={view} onChange={setView} />} />

      {!hasAnyAverage ? (
        <p className={cn(TRENDS_BOTTOM_PANE_SLOT, "flex items-center justify-center text-[0.88rem] text-[var(--text-dim)]")}>
          这个周期还没有足够的评分样本。
        </p>
      ) : (
        <HorizontalPager
          activeKey={view}
          ariaLabel="幸福8要素图表视图"
          className={TRENDS_BOTTOM_PANE_SLOT}
          pages={[
            {
              key: "radar",
              className: "h-full",
              children: (
                <svg
                  viewBox={`${radarGeometry.viewBox.x} ${radarGeometry.viewBox.y} ${radarGeometry.viewBox.width} ${radarGeometry.viewBox.height}`}
                  className="block h-full w-full"
                  preserveAspectRatio="xMidYMid meet"
                  aria-label="幸福8要素雷达图"
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {radarGeometry.grids.map((gridPoints, index) => (
                    <polygon
                      key={index}
                      points={gridPoints}
                      className={cn(
                        "fill-none",
                        index === radarGeometry.grids.length - 1 ? "stroke-ember/20" : "stroke-ember/15"
                      )}
                      strokeWidth={1}
                    />
                  ))}
                  <polygon
                    points={radarGeometry.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill={`url(#${gradientId})`}
                    className="stroke-clay"
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                  />
                  {radarGeometry.points.map((point) => (
                    <text
                      key={point.item.requestKey}
                      x={point.labelX}
                      y={point.labelY}
                      textAnchor={point.textAnchor}
                      dominantBaseline="middle"
                      className="fill-[var(--text-dim)] text-[10px]"
                    >
                      {point.item.label}
                    </text>
                  ))}
                </svg>
              )
            },
            {
              key: "lollipop",
              className: "flex h-full flex-col justify-center gap-[0.43rem]",
              children: items.map((item) => {
                const value = record.scoreTrend.factorAverages[item.requestKey];
                const ratio = typeof value === "number" ? ((value - 2) / 8) * 100 : 0;
                return (
                  <div key={item.requestKey} className="grid grid-cols-[3.85rem_1fr_1.95rem] items-center gap-[0.43rem]">
                    <span className="text-[0.88rem] text-[var(--text-main)]">{item.label}</span>
                    <div className="relative h-px bg-line/15">
                      <div
                        className="absolute top-1/2 h-[2.5px] -translate-y-1/2 bg-clay/35"
                        style={{ left: "8%", width: `${Math.max(ratio, 4)}%` }}
                      />
                      <div
                        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-clay bg-paper"
                        style={{ left: `${8 + Math.max(ratio, 4)}%` }}
                      />
                    </div>
                    <span className="text-right font-mono text-[0.88rem] text-[var(--text-dim)]">
                      {typeof value === "number" ? value.toFixed(1) : "—"}
                    </span>
                  </div>
                );
              })
            }
          ]}
        />
      )}
    </TrendsVizCard>
  );
}

export function AnalysisTrendsSection({
  record,
  preset
}: {
  record: AnalysisTrendsRangeRecord;
  preset: AnalysisRangePreset;
}) {
  return (
    <div className="space-y-3">
      <PeriodSummary record={record} />
      <TotalScoreComboChart record={record} />
      <div className="grid gap-3 md:grid-cols-2">
        <LogDaysHeatmap record={record} preset={preset} />
        <EightFactorsPanel record={record} />
      </div>
    </div>
  );
}
