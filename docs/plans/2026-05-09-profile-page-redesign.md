# 画像页重构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将画像页从 MemoryFact CRUD 列表重构为"叙事先行"的个人画像页面——AI 合成洞察为主体，认知演变时间轴为独立视图，数据从日历/分析/访谈/幸福分汇聚。

**Architecture:** 三视图结构（画像/记忆库/演变）。新增 `PortraitSnapshot` 模型缓存 AI 合成结果。后端新增 `portrait-synthesis.service.ts` 编排多数据源 → AI 合成。前端将现有 `ProfileContent` 重构为三个独立视图组件，通过 URL 参数切换。交互层面增加删除确认、乐观更新、卡片收起/展开。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Prisma 5.22, Zod, Tailwind CSS, Volcengine Ark (Doubao)

---

## 并行开发说明

本计划分两个可并行的 track：

| Track | 任务 | 前置依赖 |
|-------|------|----------|
| **Backend** | Task 1 → 2 → 3 → 4 | 任务间串行（数据模型 → 数据聚合 → AI 合成 → API） |
| **Frontend** | Task 5 → 6 → 7 → 8 | Task 5 无依赖可立即开始；6/7 并行依赖 5；8 依赖 5+6+7 |
| **Polish** | Task 9 | 依赖 Task 8（在现有组件上改进） |
| **Test** | Task 10 | 跟随各 track |

**关键隔离点：**
- Task 5 定义所有共享 TypeScript 类型，Frontend 可在 Backend 完成前独立开发（使用类型驱动开发，不依赖实际 API）
- Task 8 的 API 集成是 Backend 和 Frontend 的汇合点，此时两 track 合并
- 所有 mock 数据使用 `vi.mock`，与现有测试模式一致

---

## Task 1: Prisma 模型与枚举

**Files:**
- Modify: `prisma/schema.prisma:65-69` (AIRequestStage enum)
- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_portrait_snapshot/migration.sql`

**Step 1: 在 AIRequestStage 枚举中添加 portrait_synthesis 阶段**

在 `prisma/schema.prisma` 中修改：

```prisma
enum AIRequestStage {
  transcribe
  extract
  generate
  portrait_synthesis
}
```

**Step 2: 添加 PortraitSnapshot 模型**

在 `prisma/schema.prisma` 末尾追加：

```prisma
model PortraitSnapshot {
  id               String   @id @default(cuid())
  userId           String
  summary          String
  dimensionInsights Json
  factCount        Int
  dataRangeMonths  Int      @default(3)
  generatedAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

在 `User` 模型中添加 relation（如果 `User` 模型有 relations 块）：

```prisma
  portraitSnapshots PortraitSnapshot[]
```

**Step 3: 生成并运行 migration**

```bash
npx prisma migrate dev --name add_portrait_snapshot
npx prisma generate
```

Expected: Migration applied, Prisma client regenerated with `PortraitSnapshot` model.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add PortraitSnapshot model and portrait_synthesis AI stage"
```

---

## Task 2: 数据聚合服务

**Files:**
- Create: `src/server/services/portrait/portrait-data.service.ts`
- Create: `tests/unit/portrait-data.service.test.ts`

**Step 1: 写 failing test — 聚合数据结构**

```typescript
// tests/unit/portrait-data.service.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindAllMemoryFacts = vi.fn();
const mockListCalendarSourcesByDateRange = vi.fn();
const mockListAnalysisSourcesByDateRange = vi.fn();
const mockListDailyHappinessScoresByDateRange = vi.fn();

vi.mock("@/server/repositories/memory.repository", () => ({
  findAllMemoryFacts: mockFindAllMemoryFacts
}));
vi.mock("@/server/repositories/calendar.repository", () => ({
  listCalendarSourcesByDateRange: mockListCalendarSourcesByDateRange
}));
vi.mock("@/server/repositories/analysis.repository", () => ({
  listAnalysisSourcesByDateRange: mockListAnalysisSourcesByDateRange
}));
vi.mock("@/server/repositories/daily-happiness-score.repository", () => ({
  listDailyHappinessScoresByDateRange: mockListDailyHappinessScoresByDateRange
}));

import { gatherPortraitData } from "@/server/services/portrait/portrait-data.service";

describe("portrait-data.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAllMemoryFacts.mockResolvedValue([]);
    mockListCalendarSourcesByDateRange.mockResolvedValue({ sessions: [], entries: [], dailyJournals: [] });
    mockListAnalysisSourcesByDateRange.mockResolvedValue({ entries: [], dailyJournals: [] });
    mockListDailyHappinessScoresByDateRange.mockResolvedValue([]);
  });

  it("returns aggregated data with correct structure", async () => {
    const result = await gatherPortraitData("test-user");

    expect(result).toHaveProperty("facts");
    expect(result).toHaveProperty("calendarSummary");
    expect(result).toHaveProperty("analysisSummary");
    expect(result).toHaveProperty("scoreTrend");
    expect(result).toHaveProperty("interviewMeta");
  });

  it("computes calendar dimension frequency from sessions", async () => {
    mockListCalendarSourcesByDateRange.mockResolvedValue({
      sessions: [
        { id: "s1", dimension: "joy", status: "completed", entryDate: "2026-05-01" },
        { id: "s2", dimension: "joy", status: "completed", entryDate: "2026-05-02" },
        { id: "s3", dimension: "reflection", status: "completed", entryDate: "2026-05-03" }
      ],
      entries: [],
      dailyJournals: []
    });

    const result = await gatherPortraitData("test-user");

    expect(result.calendarSummary.dimensionFrequency.joy).toBe(2);
    expect(result.calendarSummary.dimensionFrequency.reflection).toBe(1);
    expect(result.calendarSummary.totalRecordDays).toBe(3);
  });

  it("computes interview meta from sessions", async () => {
    mockListCalendarSourcesByDateRange.mockResolvedValue({
      sessions: [
        { id: "s1", dimension: "joy", status: "completed", entryDate: "2026-05-01", startedAt: new Date("2026-05-01") },
        { id: "s2", dimension: "fulfillment", status: "completed", entryDate: "2026-05-02", startedAt: new Date("2026-05-02") }
      ],
      entries: [],
      dailyJournals: []
    });

    const result = await gatherPortraitData("test-user");

    expect(result.interviewMeta.totalSessions).toBe(2);
    expect(result.interviewMeta.dimensionCoverage).toContain("joy");
    expect(result.interviewMeta.dimensionCoverage).toContain("fulfillment");
  });

  it("computes score trend from happiness scores", async () => {
    mockListDailyHappinessScoresByDateRange.mockResolvedValue([
      { date: "2026-05-01", meaningScore: 7, healthScore: 6, virtueScore: 5, autonomyScore: 8, interestScore: 7, skillScore: 6, relationshipScore: 7, livingConditionScore: 6 },
      { date: "2026-05-02", meaningScore: 8, healthScore: 7, virtueScore: 6, autonomyScore: 7, interestScore: 8, skillScore: 7, relationshipScore: 8, livingConditionScore: 7 }
    ]);

    const result = await gatherPortraitData("test-user");

    expect(result.scoreTrend.days).toBe(2);
    expect(result.scoreTrend.latest).toBeDefined();
    expect(result.scoreTrend.trend).toBeDefined();
  });
});
```

**Step 2: 跑测试确认失败**

```bash
npx vitest run tests/unit/portrait-data.service.test.ts
```

Expected: FAIL — `Cannot find module '@/server/services/portrait/portrait-data.service'`

**Step 3: 实现 portrait-data.service.ts**

```typescript
// src/server/services/portrait/portrait-data.service.ts
import type { InterviewDimension, MemoryFact } from "@prisma/client";

import { findAllMemoryFacts } from "@/server/repositories/memory.repository";
import { listCalendarSourcesByDateRange } from "@/server/repositories/calendar.repository";
import { listAnalysisSourcesByDateRange } from "@/server/repositories/analysis.repository";
import { listDailyHappinessScoresByDateRange } from "@/server/repositories/daily-happiness-score.repository";

const DEMO_USER_ID = "local-demo-user";
const ALL_DIMENSIONS: InterviewDimension[] = ["joy", "fulfillment", "reflection", "improvement", "gratitude"];

export interface PortraitData {
  facts: MemoryFact[];
  calendarSummary: {
    dimensionFrequency: Record<InterviewDimension, number>;
    totalRecordDays: number;
    recentMonthRecordDays: number;
  };
  analysisSummary: {
    recentMonths: number;
    totalSavedEntries: number;
    dimensionBreakdown: Record<InterviewDimension, number>;
  };
  scoreTrend: {
    days: number;
    average: Record<string, number> | null;
    latest: Record<string, number> | null;
    trend: "rising" | "stable" | "declining" | "insufficient";
  };
  interviewMeta: {
    totalSessions: number;
    dimensionCoverage: InterviewDimension[];
    dateRange: { first: string | null; last: string | null };
  };
}

export async function gatherPortraitData(userId?: string): Promise<PortraitData> {
  const uid = userId || DEMO_USER_ID;

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const startDate = threeMonthsAgo.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  const [facts, calendarSources, analysisSources, scoreRecords] = await Promise.all([
    findAllMemoryFacts(uid),
    listCalendarSourcesByDateRange({ startDate, endDate }),
    listAnalysisSourcesByDateRange({ startDate, endDate }),
    listDailyHappinessScoresByDateRange({ startDate, endDate })
  ]);

  // Calendar summary
  const dimensionFrequency = {} as Record<InterviewDimension, number>;
  for (const dim of ALL_DIMENSIONS) dimensionFrequency[dim] = 0;
  for (const session of calendarSources.sessions) {
    if (session.dimension in dimensionFrequency) {
      dimensionFrequency[session.dimension as InterviewDimension]++;
    }
  }
  const recordDates = new Set(calendarSources.entries.map((e) => e.date));
  const recentMonthStart = new Date(now);
  recentMonthStart.setMonth(recentMonthStart.getMonth() - 1);
  const recentMonthStartStr = recentMonthStart.toISOString().slice(0, 10);
  const recentMonthRecordDays = [...recordDates].filter((d) => d >= recentMonthStartStr).length;

  // Analysis summary
  const analysisDimensionBreakdown = {} as Record<InterviewDimension, number>;
  for (const dim of ALL_DIMENSIONS) analysisDimensionBreakdown[dim] = 0;
  for (const entry of analysisSources.entries) {
    if (entry.dimension in analysisDimensionBreakdown) {
      analysisDimensionBreakdown[entry.dimension as InterviewDimension]++;
    }
  }

  // Score trend
  const scoreKeys = ["meaningScore", "healthScore", "virtueScore", "autonomyScore", "interestScore", "skillScore", "relationshipScore", "livingConditionScore"];
  let averageScores: Record<string, number> | null = null;
  let latestScores: Record<string, number> | null = null;
  let trend: PortraitData["scoreTrend"]["trend"] = "insufficient";

  if (scoreRecords.length >= 2) {
    const sums: Record<string, number> = {};
    for (const key of scoreKeys) sums[key] = 0;
    for (const record of scoreRecords) {
      for (const key of scoreKeys) sums[key] += (record as Record<string, number>)[key] ?? 0;
    }
    averageScores = {};
    for (const key of scoreKeys) averageScores[key] = Math.round((sums[key] / scoreRecords.length) * 10) / 10;

    const latest = scoreRecords[scoreRecords.length - 1];
    latestScores = {};
    for (const key of scoreKeys) latestScores[key] = (latest as Record<string, number>)[key] ?? 0;

    // Simple trend: compare first half average vs second half average
    const mid = Math.floor(scoreRecords.length / 2);
    const firstHalf = scoreRecords.slice(0, mid);
    const secondHalf = scoreRecords.slice(mid);
    const avgFirst = firstHalf.reduce((s, r) => s + Object.values(r as Record<string, unknown>).filter((v): v is number => typeof v === "number").reduce((a, b) => a + b, 0) / scoreKeys.length, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, r) => s + Object.values(r as Record<string, unknown>).filter((v): v is number => typeof v === "number").reduce((a, b) => a + b, 0) / scoreKeys.length, 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    trend = diff > 0.3 ? "rising" : diff < -0.3 ? "declining" : "stable";
  }

  // Interview meta
  const sessionDates = calendarSources.sessions
    .map((s) => s.entryDate)
    .filter(Boolean)
    .sort();
  const dimCoverage = [...new Set(calendarSources.sessions.map((s) => s.dimension as InterviewDimension))];

  return {
    facts,
    calendarSummary: {
      dimensionFrequency,
      totalRecordDays: recordDates.size,
      recentMonthRecordDays
    },
    analysisSummary: {
      recentMonths: 3,
      totalSavedEntries: analysisSources.entries.length,
      dimensionBreakdown: analysisDimensionBreakdown
    },
    scoreTrend: {
      days: scoreRecords.length,
      average: averageScores,
      latest: latestScores,
      trend
    },
    interviewMeta: {
      totalSessions: calendarSources.sessions.length,
      dimensionCoverage: dimCoverage,
      dateRange: { first: sessionDates[0] ?? null, last: sessionDates[sessionDates.length - 1] ?? null }
    }
  };
}
```

**Step 4: 跑测试确认通过**

```bash
npx vitest run tests/unit/portrait-data.service.test.ts
```

Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/server/services/portrait/portrait-data.service.ts tests/unit/portrait-data.service.test.ts
git commit -m "feat(portrait): add data aggregation service for portrait synthesis"
```

---

## Task 3: AI 合成服务与 Prompt

**Files:**
- Create: `src/features/portrait/prompts/portrait-synthesis.prompts.ts`
- Create: `src/server/services/portrait/portrait-synthesis.service.ts`
- Create: `tests/unit/portrait-synthesis.service.test.ts`
- Modify: `src/server/repositories/memory.repository.ts` (追加 PortraitSnapshot CRUD)

**Step 1: 写 portrait-synthesis prompts**

```typescript
// src/features/portrait/prompts/portrait-synthesis.prompts.ts
import type { AIChatMessage } from "@/server/services/ai/ai-provider";
import type { InterviewDimension } from "@prisma/client";

const DIMENSION_NAMES: Record<InterviewDimension, string> = {
  joy: "开心",
  fulfillment: "充实",
  reflection: "思考",
  improvement: "改进",
  gratitude: "感谢"
};

export interface PortraitSynthesisInput {
  dimension: InterviewDimension;
  facts: Array<{ summary: string; kind: string; topicTags: string[] }>;
  calendarFrequency: number;
  scoreTrend: string;
  interviewCount: number;
}

export function buildPortraitSummaryMessages(input: {
  facts: Array<{ dimension: InterviewDimension; summary: string; kind: string; topicTags: string[] }>;
  calendarSummary: {
    dimensionFrequency: Record<InterviewDimension, number>;
    totalRecordDays: number;
  };
  scoreTrend: { days: number; trend: string; average: Record<string, number> | null };
  interviewMeta: { totalSessions: number; dimensionCoverage: InterviewDimension[] };
}): AIChatMessage[] {
  const systemMessage = [
    "你是幸福日志产品的用户画像分析师。你需要从用户的长期记忆、记录数据和评分趋势中，合成一段「关于这个人」的总述。",
    "",
    "核心规则：",
    "1. 用第二人称（"你"）写，像在写给用户的一封短信。",
    "2. 不要复述单条记忆原文，而是提炼跨维度的模式和特征。",
    "3. 100-200字，3-5句话。",
    "4. 语调温暖但克制，像一个老朋友在描述他认识的你。",
    "5. 如果数据太少（少于3条记忆），坦诚说"我们还在认识中"。",
    "",
    "输出格式（严格JSON）：",
    '{"summary":"总述文字"}'
  ].join("\n");

  const factsByDimension: Record<string, string[]> = {};
  for (const fact of input.facts) {
    const dim = fact.dimension;
    if (!factsByDimension[dim]) factsByDimension[dim] = [];
    factsByDimension[dim].push(`[${fact.kind}] ${fact.summary} (标签: ${fact.topicTags.join(", ")})`);
  }

  const factsText = Object.entries(factsByDimension)
    .map(([dim, items]) => `${DIMENSION_NAMES[dim as InterviewDimension]}维度 (${items.length}条):\n${items.join("\n")}`)
    .join("\n\n");

  const userMessage = [
    `长期记忆（共${input.facts.length}条）：`,
    factsText || "（暂无记忆数据）",
    "",
    `记录概况：过去3个月有${input.calendarSummary.totalRecordDays}天记录`,
    `维度活跃度：${Object.entries(input.calendarSummary.dimensionFrequency)
      .filter(([, v]) => v > 0)
      .map(([dim, count]) => `${DIMENSION_NAMES[dim as InterviewDimension]}${count}次`)
      .join("、") || "暂无"}`,
    "",
    `评分数据：共${input.scoreTrend.days}天评分，趋势为${input.scoreTrend.trend}`,
    input.scoreTrend.average
      ? `平均分：${Object.entries(input.scoreTrend.average).map(([k, v]) => `${k}:${v}`).join(", ")}`
      : "评分数据不足",
    "",
    `访谈：共${input.interviewMeta.totalSessions}次，覆盖${input.interviewMeta.dimensionCoverage.map((d) => DIMENSION_NAMES[d]).join("、") || "暂无"}维度`
  ].join("\n");

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage }
  ];
}

export function buildDimensionInsightMessages(input: PortraitSynthesisInput): AIChatMessage[] {
  const systemMessage = [
    `你是幸福日志产品的用户画像分析师。你需要从用户${DIMENSION_NAMES[input.dimension]}维度的记忆和数据中，提炼一段洞察。`,
    "",
    "核心规则：",
    "1. 2-3句话，60字以内。",
    "2. 不要复述单条记忆原文，提炼核心特征。",
    "3. 如果该维度数据不足，说一句温和的引导。",
    "",
    "输出格式（严格JSON）：",
    '{"insight":"洞察文字"}'
  ].join("\n");

  const factsText = input.facts.map((f) => `[${f.kind}] ${f.summary} (标签: ${f.topicTags.join(", ")})`).join("\n");

  const userMessage = [
    `${DIMENSION_NAMES[input.dimension]}维度记忆（${input.facts.length}条）：`,
    factsText || "（暂无）",
    "",
    `该维度记录频率：近3个月${input.calendarFrequency}次`,
    `评分趋势：${input.scoreTrend}`,
    `访谈覆盖：${input.interviewCount}次`
  ].join("\n");

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage }
  ];
}
```

**Step 2: 在 memory.repository 中追加 PortraitSnapshot CRUD**

在 `src/server/repositories/memory.repository.ts` 末尾追加：

```typescript
// ─── Portrait Snapshot Operations ─────────────────────────────────────────

import type { PortraitSnapshot } from "@prisma/client";

export async function findLatestPortraitSnapshot(userId?: string): Promise<PortraitSnapshot | null> {
  return prisma.portraitSnapshot.findFirst({
    where: { userId: userId ?? DEMO_USER_ID },
    orderBy: { generatedAt: "desc" }
  });
}

export async function createPortraitSnapshot(data: {
  userId?: string;
  summary: string;
  dimensionInsights: Record<string, string>;
  factCount: number;
  dataRangeMonths?: number;
}): Promise<PortraitSnapshot> {
  return prisma.portraitSnapshot.create({
    data: {
      userId: data.userId ?? DEMO_USER_ID,
      summary: data.summary,
      dimensionInsights: data.dimensionInsights,
      factCount: data.factCount,
      dataRangeMonths: data.dataRangeMonths ?? 3
    }
  });
}
```

**Step 3: 写 failing test — portrait-synthesis.service**

```typescript
// tests/unit/portrait-synthesis.service.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockGatherPortraitData = vi.fn();
const mockGetAIProvider = vi.fn();
const mockFindLatestPortraitSnapshot = vi.fn();
const mockCreatePortraitSnapshot = vi.fn();
const mockCreateAIRequestLog = vi.fn();

vi.mock("@/server/services/portrait/portrait-data.service", () => ({
  gatherPortraitData: mockGatherPortraitData
}));
vi.mock("@/server/services/ai", () => ({
  getAIProvider: mockGetAIProvider
}));
vi.mock("@/server/repositories/memory.repository", () => ({
  findLatestPortraitSnapshot: mockFindLatestPortraitSnapshot,
  createPortraitSnapshot: mockCreatePortraitSnapshot
}));
vi.mock("@/server/repositories/interview.repository", () => ({
  createAIRequestLog: mockCreateAIRequestLog
}));

import {
  synthesizePortrait,
  getPortraitSnapshot
} from "@/server/services/portrait/portrait-synthesis.service";

function buildMockData(factCount: number) {
  const facts = Array.from({ length: factCount }, (_, i) => ({
    id: `mem-${i}`,
    userId: "test-user",
    dimension: i % 2 === 0 ? "joy" : "fulfillment",
    kind: "preference",
    topicTags: ["标签"],
    summary: `记忆${i}`,
    sourceType: "ai_extracted",
    confidence: 0.8,
    evidenceEntryIds: [],
    evidenceSessionIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: null,
    deletedAt: null,
    embedding: null
  }));

  return {
    facts,
    calendarSummary: {
      dimensionFrequency: { joy: 5, fulfillment: 3, reflection: 2, improvement: 1, gratitude: 0 },
      totalRecordDays: 11,
      recentMonthRecordDays: 4
    },
    analysisSummary: {
      recentMonths: 3,
      totalSavedEntries: 8,
      dimensionBreakdown: { joy: 3, fulfillment: 2, reflection: 1, improvement: 1, gratitude: 1 }
    },
    scoreTrend: {
      days: 15,
      average: { meaningScore: 7.5 },
      latest: { meaningScore: 8 },
      trend: "rising" as const
    },
    interviewMeta: {
      totalSessions: 12,
      dimensionCoverage: ["joy", "fulfillment", "reflection"] as const,
      dateRange: { first: "2026-03-01", last: "2026-05-08" }
    }
  };
}

describe("portrait-synthesis.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAIProvider.mockReturnValue({
      name: "mock",
      complete: vi.fn()
    });
  });

  describe("getPortraitSnapshot", () => {
    it("returns cached snapshot when available", async () => {
      const cached = {
        id: "snap-1",
        userId: "test-user",
        summary: "你是一个...",
        dimensionInsights: { joy: "开心洞察" },
        factCount: 10,
        dataRangeMonths: 3,
        generatedAt: new Date()
      };
      mockFindLatestPortraitSnapshot.mockResolvedValue(cached);

      const result = await getPortraitSnapshot("test-user");

      expect(result).toEqual(cached);
    });

    it("returns null when no cached snapshot", async () => {
      mockFindLatestPortraitSnapshot.mockResolvedValue(null);

      const result = await getPortraitSnapshot("test-user");

      expect(result).toBeNull();
    });
  });

  describe("synthesizePortrait", () => {
    it("returns null when fewer than 3 facts exist", async () => {
      mockGatherPortraitData.mockResolvedValue(buildMockData(2));

      const result = await synthesizePortrait("test-user");

      expect(result).toBeNull();
    });

    it("calls AI to generate summary and dimension insights", async () => {
      mockGatherPortraitData.mockResolvedValue(buildMockData(5));

      const mockComplete = vi.fn()
        .mockResolvedValueOnce({ content: '{"summary":"你是一个喜欢独处的人"}', latencyMs: 100, provider: "mock" })
        .mockResolvedValue({ content: '{"insight":"独处是你充电的方式"}', latencyMs: 80, provider: "mock" });

      mockGetAIProvider.mockReturnValue({ name: "mock", complete: mockComplete });
      mockCreatePortraitSnapshot.mockResolvedValue({ id: "snap-new" });

      const result = await synthesizePortrait("test-user");

      expect(result).not.toBeNull();
      expect(result!.summary).toBe("你是一个喜欢独处的人");
      expect(mockComplete).toHaveBeenCalledTimes(6); // 1 summary + 5 dimensions
    });

    it("caches the result to PortraitSnapshot", async () => {
      mockGatherPortraitData.mockResolvedValue(buildMockData(5));

      const mockComplete = vi.fn()
        .mockResolvedValueOnce({ content: '{"summary":"总述"}', latencyMs: 100, provider: "mock" })
        .mockResolvedValue({ content: '{"insight":"洞察"}', latencyMs: 80, provider: "mock" });

      mockGetAIProvider.mockReturnValue({ name: "mock", complete: mockComplete });
      mockCreatePortraitSnapshot.mockResolvedValue({ id: "snap-new" });

      await synthesizePortrait("test-user");

      expect(mockCreatePortraitSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user",
          summary: "总述",
          factCount: 5
        })
      );
    });

    it("handles AI failure gracefully by returning null", async () => {
      mockGatherPortraitData.mockResolvedValue(buildMockData(5));
      mockGetAIProvider.mockReturnValue(null);

      const result = await synthesizePortrait("test-user");

      expect(result).toBeNull();
    });
  });
});
```

**Step 4: 跑测试确认失败**

```bash
npx vitest run tests/unit/portrait-synthesis.service.test.ts
```

Expected: FAIL — `Cannot find module '@/server/services/portrait/portrait-synthesis.service'`

**Step 5: 实现 portrait-synthesis.service.ts**

```typescript
// src/server/services/portrait/portrait-synthesis.service.ts
import type { InterviewDimension } from "@prisma/client";
import type { PortraitSnapshot } from "@prisma/client";

import { logger } from "@/server/lib/logger";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import { gatherPortraitData } from "@/server/services/portrait/portrait-data.service";
import {
  buildPortraitSummaryMessages,
  buildDimensionInsightMessages
} from "@/features/portrait/prompts/portrait-synthesis.prompts";
import {
  findLatestPortraitSnapshot,
  createPortraitSnapshot
} from "@/server/repositories/memory.repository";
import { z } from "zod";

const MIN_FACTS = 3;
const ALL_DIMENSIONS: InterviewDimension[] = ["joy", "fulfillment", "reflection", "improvement", "gratitude"];

const summarySchema = z.object({ summary: z.string().min(1).max(500) });
const insightSchema = z.object({ insight: z.string().min(1).max(200) });

export { findLatestPortraitSnapshot as getPortraitSnapshot };

export async function synthesizePortrait(userId?: string): Promise<{
  summary: string;
  dimensionInsights: Record<InterviewDimension, string>;
  factCount: number;
} | null> {
  const provider = getAIProvider();
  if (!provider) {
    logger.warn("portrait synthesis skipped: no AI provider");
    return null;
  }

  const data = await gatherPortraitData(userId);

  if (data.facts.length < MIN_FACTS) {
    logger.info({ factCount: data.facts.length }, "portrait synthesis skipped: insufficient facts");
    return null;
  }

  const factsForPrompt = data.facts.map((f) => ({
    dimension: f.dimension,
    summary: f.summary,
    kind: f.kind,
    topicTags: f.topicTags
  }));

  // Step 1: Generate cross-dimensional summary
  const summaryResult = await completeStructuredOutput({
    provider,
    stage: "portrait_synthesis",
    schema: summarySchema,
    messages: buildPortraitSummaryMessages({
      facts: factsForPrompt,
      calendarSummary: data.calendarSummary,
      scoreTrend: data.scoreTrend,
      interviewMeta: data.interviewMeta
    }),
    maxTokens: 300
  });

  if (!summaryResult) {
    logger.warn("portrait summary generation failed");
    return null;
  }

  // Step 2: Generate per-dimension insights (parallel)
  const dimensionInsights: Record<string, string> = {};

  const insightPromises = ALL_DIMENSIONS.map(async (dim) => {
    const dimFacts = factsForPrompt.filter((f) => f.dimension === dim);
    const result = await completeStructuredOutput({
      provider,
      stage: "portrait_synthesis",
      schema: insightSchema,
      messages: buildDimensionInsightMessages({
        dimension: dim,
        facts: dimFacts,
        calendarFrequency: data.calendarSummary.dimensionFrequency[dim],
        scoreTrend: data.scoreTrend.trend,
        interviewCount: data.interviewMeta.totalSessions
      }),
      maxTokens: 150
    });
    return { dim, insight: result?.insight ?? null };
  });

  const results = await Promise.all(insightPromises);
  for (const { dim, insight } of results) {
    if (insight) dimensionInsights[dim] = insight;
  }

  // Step 3: Cache result
  await createPortraitSnapshot({
    userId,
    summary: summaryResult.summary,
    dimensionInsights,
    factCount: data.facts.length
  });

  return {
    summary: summaryResult.summary,
    dimensionInsights: dimensionInsights as Record<InterviewDimension, string>,
    factCount: data.facts.length
  };
}
```

**Step 6: 跑测试确认通过**

```bash
npx vitest run tests/unit/portrait-synthesis.service.test.ts
```

Expected: All 4 tests PASS.

**Step 7: Commit**

```bash
git add src/features/portrait/prompts/portrait-synthesis.prompts.ts \
  src/server/services/portrait/portrait-synthesis.service.ts \
  src/server/repositories/memory.repository.ts \
  tests/unit/portrait-synthesis.service.test.ts
git commit -m "feat(portrait): add AI synthesis service with summary + dimension insights"
```

---

## Task 4: Portrait API 端点

**Files:**
- Create: `src/app/api/profile/portrait/route.ts`

**Step 1: 创建 API 路由**

```typescript
// src/app/api/profile/portrait/route.ts
import { NextResponse } from "next/server";

import {
  getPortraitSnapshot,
  synthesizePortrait
} from "@/server/services/portrait/portrait-synthesis.service";

export async function GET() {
  try {
    const snapshot = await getPortraitSnapshot();

    if (!snapshot) {
      return NextResponse.json({ snapshot: null });
    }

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        summary: snapshot.summary,
        dimensionInsights: snapshot.dimensionInsights,
        factCount: snapshot.factCount,
        generatedAt: snapshot.generatedAt.toISOString()
      }
    });
  } catch {
    return NextResponse.json({ error: "PORTRAIT_QUERY_FAILED" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await synthesizePortrait();

    if (!result) {
      return NextResponse.json(
        { error: "PORTRAIT_SYNTHESIS_FAILED", message: "数据不足或 AI 服务不可用" },
        { status: 422 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "PORTRAIT_SYNTHESIS_FAILED" }, { status: 500 });
  }
}
```

**Step 2: 验证 API 可访问**

```bash
curl -s http://localhost:3000/api/profile/portrait | head -c 200
```

Expected: `{"snapshot": null}` or cached snapshot JSON.

**Step 3: Commit**

```bash
git add src/app/api/profile/portrait/route.ts
git commit -m "feat(portrait): add GET/POST /api/profile/portrait endpoint"
```

---

## Task 5: 共享 TypeScript 类型

**Files:**
- Create: `src/features/portrait/types.ts`

**Step 1: 定义前端所需的全部类型**

```typescript
// src/features/portrait/types.ts
import type { InterviewDimension, MemoryFact } from "@prisma/client";

// ─── Portrait Snapshot (from GET /api/profile/portrait) ────────────────────

export interface PortraitSnapshotView {
  id: string;
  summary: string;
  dimensionInsights: Record<InterviewDimension, string>;
  factCount: number;
  generatedAt: string;
}

export interface PortraitApiResponse {
  snapshot: PortraitSnapshotView | null;
}

// ─── Evolution Timeline ────────────────────────────────────────────────────

export type TimelineEventType = "new" | "merged" | "edited";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string; // ISO date string
  dimension: InterviewDimension;
  summary: string;
  topicTags: string[];
  confidence: number;
}

export interface TimelineMonth {
  month: string; // "2026-05"
  events: TimelineEvent[];
  newCount: number;
}

// ─── View Tabs ────────────────────────────────────────────────────────────

export type ProfileViewTab = "portrait" | "memories" | "evolution";

// ─── Helpers ──────────────────────────────────────────────────────────────

export function factsToTimeline(facts: MemoryFact[]): TimelineMonth[] {
  const monthMap = new Map<string, TimelineEvent[]>();

  for (const fact of facts) {
    const date = new Date(fact.createdAt);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const event: TimelineEvent = {
      id: fact.id,
      type: fact.sourceType === "user_added" ? "new" : "new",
      date: fact.createdAt instanceof Date ? fact.createdAt.toISOString() : String(fact.createdAt),
      dimension: fact.dimension,
      summary: fact.summary,
      topicTags: fact.topicTags,
      confidence: fact.confidence
    };

    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(event);
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, events]) => ({
      month,
      events: events.sort((a, b) => b.date.localeCompare(a.date)),
      newCount: events.length
    }));
}
```

**Step 2: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "portrait/types" || echo "No type errors in portrait/types"
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add src/features/portrait/types.ts
git commit -m "feat(portrait): add shared TypeScript types for portrait views"
```

---

## Task 6: 画像视图组件（Portrait View）

**Files:**
- Create: `src/components/profile/portrait-view.tsx`

前置依赖：Task 5（类型）

**Step 1: 实现 PortraitView 组件**

```tsx
// src/components/profile/portrait-view.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import type { InterviewDimension } from "@prisma/client";
import type { PortraitSnapshotView } from "@/features/portrait/types";

const DIMENSION_META: Record<InterviewDimension, { label: string; full: string }> = {
  joy: { label: "悦", full: "开心" },
  fulfillment: { label: "实", full: "充实" },
  reflection: { label: "思", full: "思考" },
  improvement: { label: "改", full: "改进" },
  gratitude: { label: "谢", full: "感谢" }
};

const ALL_DIMENSIONS: InterviewDimension[] = ["joy", "fulfillment", "reflection", "improvement", "gratitude"];

export function PortraitView() {
  const [snapshot, setSnapshot] = useState<PortraitSnapshotView | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDim, setExpandedDim] = useState<InterviewDimension | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile/portrait");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setSnapshot(json.snapshot);
      setError(null);
    } catch {
      setError("加载画像失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  async function handleSynthesize() {
    setSynthesizing(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/portrait", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "synthesis failed");
      }
      await fetchSnapshot();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成画像失败");
    } finally {
      setSynthesizing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded bg-[rgba(255,249,239,0.5)]" />
          <div className="h-16 rounded bg-[rgba(255,249,239,0.3)]" />
          <div className="h-16 rounded bg-[rgba(255,249,239,0.3)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Summary Section */}
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-5 md:p-6">
        <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">关于你</p>
        {snapshot ? (
          <>
            <p className="mt-3 text-base leading-8 text-[#2c2117] font-display">
              {snapshot.summary}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[0.65rem] text-[#8a7a68]">
                基于 {snapshot.factCount} 条认知 · {new Date(snapshot.generatedAt).toLocaleDateString("zh-CN")}
              </p>
              <button
                type="button"
                className="rounded-full border border-[rgba(115,77,39,0.14)] px-3 py-1 text-[0.65rem] tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.5)] disabled:opacity-50"
                onClick={handleSynthesize}
                disabled={synthesizing}
              >
                {synthesizing ? "生成中…" : "重新生成"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-sm leading-7 text-[#5a4632]">
              还没有足够的数据生成画像。完成几次访谈或手动添加认知后，点击下方按钮让 AI 为你生成。
            </p>
            <button
              type="button"
              className="mt-3 wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em] transition-opacity hover:opacity-80 disabled:opacity-50"
              onClick={handleSynthesize}
              disabled={synthesizing}
            >
              {synthesizing ? "生成中…" : "生成画像"}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-[#a07060]">{error}</p>}
      </div>

      {/* Dimension Cards */}
      {ALL_DIMENSIONS.map((dim) => {
        const meta = DIMENSION_META[dim];
        const insight = snapshot?.dimensionInsights[dim];
        const isExpanded = expandedDim === dim;

        return (
          <div key={dim} className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.28)]">
            <button
              type="button"
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[rgba(255,249,239,0.15)]"
              onClick={() => setExpandedDim(isExpanded ? null : dim)}
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[rgba(168,124,69,0.22)] bg-[rgba(191,133,73,0.1)] font-mono text-xs text-[#6a4f33]">
                {meta.label}
              </span>
              <span className="text-sm font-medium text-[#2f2217]">{meta.full}维度</span>
              {!isExpanded && insight && (
                <span className="ml-auto truncate text-xs text-[#8a7a68] max-w-[50%]">
                  {insight}
                </span>
              )}
              <span className={`ml-auto text-[0.65rem] text-[#8a7a68] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {isExpanded && insight && (
              <div className="border-t border-[rgba(115,77,39,0.08)] px-4 pb-4 pt-3">
                <p className="text-sm leading-7 text-[#2f2217]">{insight}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "portrait-view" || echo "No type errors"
```

**Step 3: Commit**

```bash
git add src/components/profile/portrait-view.tsx
git commit -m "feat(portrait): add PortraitView component with AI summary + dimension cards"
```

---

## Task 7: 认知演变时间轴组件（Evolution View）

**Files:**
- Create: `src/components/profile/evolution-view.tsx`

前置依赖：Task 5（类型）

**Step 1: 实现 EvolutionView 组件**

```tsx
// src/components/profile/evolution-view.tsx
"use client";

import { useMemo } from "react";

import type { InterviewDimension, MemoryFact } from "@prisma/client";
import { factsToTimeline } from "@/features/portrait/types";

const DIMENSION_LABELS: Record<InterviewDimension, string> = {
  joy: "悦",
  fulfillment: "实",
  reflection: "思",
  improvement: "改",
  gratitude: "谢"
};

const DIMENSION_COLORS: Record<InterviewDimension, string> = {
  joy: "bg-[rgba(191,133,73,0.3)]",
  fulfillment: "bg-[rgba(168,124,69,0.3)]",
  reflection: "bg-[rgba(140,100,60,0.3)]",
  improvement: "bg-[rgba(120,85,50,0.3)]",
  gratitude: "bg-[rgba(100,75,45,0.3)]"
};

interface EvolutionViewProps {
  facts: MemoryFact[];
}

export function EvolutionView({ facts }: EvolutionViewProps) {
  const timeline = useMemo(() => factsToTimeline(facts), [facts]);

  if (facts.length < 3) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">认知演变</p>
        <p className="mt-3 text-sm leading-7 text-[#5a4632]">
          至少需要 3 条认知才能展示演变趋势。完成几次访谈或手动添加更多认知后，这里会展示你的认知变化轨迹。
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-4">
        <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">认知演变</p>
        <p className="mt-1 text-xs text-[#8a7a68]">
          共 {facts.length} 条认知 · 跨越 {timeline.length} 个月
        </p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[rgba(115,77,39,0.15)]" />

        {timeline.map((month, monthIdx) => (
          <div key={month.month} className="relative mb-4">
            {/* Month header */}
            <div className="relative flex items-center gap-3 pb-2">
              <span className="relative z-10 flex size-[30px] items-center justify-center rounded-full border border-[rgba(115,77,39,0.2)] bg-[rgba(249,238,216,0.95)]">
                <span className="text-[0.6rem] font-mono text-[#6a5e53]">
                  {monthIdx === 0 ? "今" : month.month.split("-")[1]}
                </span>
              </span>
              <span className="text-sm font-medium text-[#2f2217]">
                {month.month.replace("-", "年")}月
              </span>
              <span className="wood-chip rounded-full px-2 py-0.5 text-[0.6rem] tracking-[0.1em]">
                {month.newCount} 条新认知
              </span>
            </div>

            {/* Events */}
            <div className="ml-[30px] grid gap-2 border-l border-transparent pl-4">
              {month.events.map((event) => (
                <div
                  key={event.id}
                  className="group border border-[rgba(115,77,39,0.1)] bg-[rgba(255,249,239,0.28)] px-3 py-3 transition-colors hover:bg-[rgba(255,249,239,0.5)]"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-mono text-[#5a4632] ${DIMENSION_COLORS[event.dimension]}`}
                    >
                      {DIMENSION_LABELS[event.dimension]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6 text-[#2f2217]">{event.summary}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {event.topicTags.map((tag) => (
                          <span key={tag} className="wood-chip rounded-full px-2 py-0.5 text-[0.6rem] tracking-[0.1em]">
                            {tag}
                          </span>
                        ))}
                        <span className="text-[0.6rem] text-[#a0937d]">
                          {new Date(event.date).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "evolution-view" || echo "No type errors"
```

**Step 3: Commit**

```bash
git add src/components/profile/evolution-view.tsx
git commit -m "feat(portrait): add EvolutionView timeline component"
```

---

## Task 8: 三视图 Profile 页面重构 + 记忆库视图

**Files:**
- Rewrite: `src/app/profile/page.tsx`
- Modify: `src/components/profile/profile-content.tsx`
- Create: `src/components/profile/memories-view.tsx`

前置依赖：Task 6 + Task 7（视图组件）；Task 4（API 端点，用于 API 集成）

**Step 1: 创建 MemoriesView（从现有 ProfileContent 提取）**

将现有 `profile-content.tsx` 的逻辑提取为 `memories-view.tsx`，保持所有 CRUD 功能不变。这个组件就是"记忆库"视图。

```tsx
// src/components/profile/memories-view.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { InterviewDimension, MemoryFact } from "@prisma/client";

import { MemoryCard } from "@/components/profile/memory-card";
import { AddMemoryDialog } from "@/components/profile/add-memory-dialog";

type GroupedProfile = Record<InterviewDimension, MemoryFact[]>;

const DIMENSION_META: { key: InterviewDimension; label: string; full: string }[] = [
  { key: "joy", label: "悦", full: "开心" },
  { key: "fulfillment", label: "实", full: "充实" },
  { key: "reflection", label: "思", full: "思考" },
  { key: "improvement", label: "改", full: "改进" },
  { key: "gratitude", label: "谢", full: "感谢" }
];

const EMPTY_GROUPED: GroupedProfile = {
  joy: [],
  fulfillment: [],
  reflection: [],
  improvement: [],
  gratitude: []
};

export function MemoriesView() {
  const [data, setData] = useState<GroupedProfile>(EMPTY_GROUPED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [addDialog, setAddDialog] = useState<InterviewDimension | null>(null);
  const [collapsedDims, setCollapsedDims] = useState<Set<InterviewDimension>>(new Set());

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("加载画像失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const facts of Object.values(data)) {
      for (const fact of facts) {
        for (const tag of fact.topicTags) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!selectedTag) return data;
    const result: GroupedProfile = {} as GroupedProfile;
    for (const dim of Object.keys(data) as InterviewDimension[]) {
      result[dim] = data[dim].filter((f) => f.topicTags.includes(selectedTag));
    }
    return result;
  }, [data, selectedTag]);

  const totalCount = useMemo(() => {
    return Object.values(data).reduce((sum, facts) => sum + facts.length, 0);
  }, [data]);

  function toggleDim(dim: InterviewDimension) {
    setCollapsedDims((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  }

  async function handleAdd(dimension: InterviewDimension, summary: string, topicTags: string[]) {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimension, summary, topicTags })
    });
    if (!res.ok) throw new Error("add failed");
    await fetchProfiles();
  }

  async function handleUpdate(id: string, summary: string, topicTags: string[]) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, summary, topicTags })
    });
    if (!res.ok) throw new Error("update failed");
    await fetchProfiles();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/profile?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    await fetchProfiles();
  }

  if (loading) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded bg-[rgba(255,249,239,0.5)]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-6">
        <p className="text-sm text-[#a07060]">{error}</p>
        <button
          type="button"
          className="mt-3 wood-chip rounded-full px-4 py-1.5 text-xs tracking-[0.1em]"
          onClick={fetchProfiles}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 gap-4">
      {/* Summary bar */}
      <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(239,224,194,0.52)] p-4 md:p-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">记忆库</p>
          <span className="wood-chip rounded-full px-3 py-1 text-xs tracking-[0.1em]">
            共 {totalCount} 条
          </span>
        </div>
        {totalCount === 0 && (
          <p className="mt-3 text-sm leading-7 text-[#5a4632]">
            还没有画像条目。完成访谈后系统会自动提取，你也可以手动添加。
          </p>
        )}
      </div>

      {/* Tag cloud */}
      {allTags.length > 0 && (
        <div className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] p-4">
          <p className="font-mono text-[0.68rem] tracking-[0.24em] text-[#6a5e53]">主题标签</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`rounded-full border px-2.5 py-1 text-[0.65rem] tracking-[0.1em] transition-colors ${
                selectedTag === null
                  ? "border-[rgba(168,124,69,0.4)] bg-[rgba(191,133,73,0.15)] text-[#4a4038]"
                  : "border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] text-[#8a7a68] hover:bg-[rgba(255,249,239,0.6)]"
              }`}
              onClick={() => setSelectedTag(null)}
            >
              全部
            </button>
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-[0.65rem] tracking-[0.1em] transition-colors ${
                  selectedTag === tag
                    ? "border-[rgba(168,124,69,0.4)] bg-[rgba(191,133,73,0.15)] text-[#4a4038]"
                    : "border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.34)] text-[#8a7a68] hover:bg-[rgba(255,249,239,0.6)]"
                }`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag}
                <span className="ml-1 opacity-50">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dimension sections */}
      {DIMENSION_META.map((dim) => {
        const facts = filteredData[dim.key];
        const totalInDim = data[dim.key].length;
        const isCollapsed = collapsedDims.has(dim.key);

        return (
          <div key={dim.key} className="border border-[rgba(115,77,39,0.14)] bg-[rgba(255,249,239,0.28)] p-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => toggleDim(dim.key)}
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full border border-[rgba(168,124,69,0.22)] bg-[rgba(191,133,73,0.1)] font-mono text-xs text-[#6a4f33]">
                  {dim.label}
                </span>
                <span className="text-sm font-medium text-[#2f2217]">{dim.full}维度</span>
                <span className="text-[0.65rem] text-[#8a7a68]">{totalInDim} 条</span>
                <span className={`text-[0.65rem] text-[#8a7a68] transition-transform ${isCollapsed ? "" : "rotate-180"}`}>
                  ▾
                </span>
              </button>
              <button
                type="button"
                className="rounded-full border border-[rgba(115,77,39,0.14)] px-3 py-1 text-[0.65rem] tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.5)]"
                onClick={() => setAddDialog(dim.key)}
              >
                + 添加
              </button>
            </div>

            {!isCollapsed && (
              facts.length === 0 ? (
                <p className="mt-3 text-xs text-[#8a7a68]">
                  {selectedTag ? "该标签下没有匹配条目" : "暂无画像条目"}
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {facts.map((fact) => (
                    <MemoryCard
                      key={fact.id}
                      fact={fact}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        );
      })}

      {addDialog && (
        <AddMemoryDialog
          defaultDimension={addDialog}
          onAdd={handleAdd}
          onClose={() => setAddDialog(null)}
        />
      )}
    </div>
  );
}
```

**Step 2: 重构 Profile 页面为三视图结构**

```tsx
// src/app/profile/page.tsx
import { StatusPill } from "@/components/shared/status-pill";
import { ProfileShell } from "@/components/profile/profile-shell";

export default function ProfilePage() {
  return (
    <div className="min-h-0 flex-1">
      <section className="page-shell min-h-[calc(100dvh-var(--site-header-viewport-offset))] rounded-none border-x-0 border-t-0 px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div className="relative z-10 grid min-h-0 gap-7 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <div className="max-w-[38rem]">
            <StatusPill label="用户画像" tone="warm" />
            <p className="archive-label mt-6">长期记忆</p>
            <h1 className="mt-5 text-balance font-display text-5xl leading-[0.96] text-ink md:text-6xl">
              你留下的印记
            </h1>
            <p className="mt-4 text-pretty text-sm leading-8 text-ink/76">
              系统从访谈中提取出你的长期模式和偏好，也会记录你主动添加的画像条目。这些认知会在后续访谈中自然融入提问，不会被直接提及。
            </p>
          </div>
          <ProfileShell />
        </div>
      </section>
    </div>
  );
}
```

**Step 3: 创建 ProfileShell（tab 容器）**

```tsx
// src/components/profile/profile-shell.tsx
"use client";

import { useState } from "react";

import type { ProfileViewTab } from "@/features/portrait/types";
import { PortraitView } from "@/components/profile/portrait-view";
import { MemoriesView } from "@/components/profile/memories-view";
import { EvolutionContainer } from "@/components/profile/evolution-container";

const TABS: { key: ProfileViewTab; label: string }[] = [
  { key: "portrait", label: "画像" },
  { key: "memories", label: "记忆库" },
  { key: "evolution", label: "演变" }
];

export function ProfileShell() {
  const [tab, setTab] = useState<ProfileViewTab>("portrait");

  return (
    <div className="grid min-h-0 gap-4">
      {/* Tab navigation */}
      <nav className="flex items-center gap-0 border-b border-[rgba(115,77,39,0.12)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`relative px-4 py-2.5 font-mono text-[0.72rem] tracking-[0.18em] transition-colors ${
              tab === t.key
                ? "text-[#2c2117]"
                : "text-[#8a7a68] hover:text-[#5a4632]"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-4 -bottom-px h-px bg-[#2c2117]" />
            )}
          </button>
        ))}
      </nav>

      {/* View content */}
      {tab === "portrait" && <PortraitView />}
      {tab === "memories" && <MemoriesView />}
      {tab === "evolution" && <EvolutionContainer />}
    </div>
  );
}
```

**Step 4: 创建 EvolutionContainer（加载 facts 并传给 EvolutionView）**

```tsx
// src/components/profile/evolution-container.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import type { InterviewDimension, MemoryFact } from "@prisma/client";
import { EvolutionView } from "@/components/profile/evolution-view";

type GroupedProfile = Record<InterviewDimension, MemoryFact[]>;

export function EvolutionContainer() {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("fetch failed");
      const json: GroupedProfile = await res.json();
      setFacts(Object.values(json).flat());
    } catch {
      // silently fail — EvolutionView handles empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFacts();
  }, [fetchFacts]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-12 rounded bg-[rgba(255,249,239,0.5)]" />
        <div className="h-20 rounded bg-[rgba(255,249,239,0.3)]" />
        <div className="h-20 rounded bg-[rgba(255,249,239,0.3)]" />
      </div>
    );
  }

  return <EvolutionView facts={facts} />;
}
```

**Step 5: 删除旧的 profile-content.tsx（被 memories-view.tsx 替代）**

旧的 `profile-content.tsx` 不再被 `page.tsx` 引用，可以安全删除。

**Step 6: 验证页面运行**

```bash
# 重启开发服务器（如已在运行则跳过）
curl -s http://localhost:3000/profile | head -c 500
```

Expected: 页面正常加载，显示三视图 tab 导航。

**Step 7: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty
```

Expected: 无新增 type errors。

**Step 8: Commit**

```bash
git add src/app/profile/page.tsx \
  src/components/profile/profile-shell.tsx \
  src/components/profile/memories-view.tsx \
  src/components/profile/evolution-container.tsx
git rm src/components/profile/profile-content.tsx
git commit -m "feat(portrait): refactor profile page into three-view shell (portrait/memories/evolution)"
```

---

## Task 9: 交互优化

**Files:**
- Modify: `src/components/profile/memory-card.tsx`
- Modify: `src/components/profile/memories-view.tsx`

前置依赖：Task 8（memories-view 已就位）

**Step 1: MemoryCard — 增加删除确认（内联展开式）**

在 `memory-card.tsx` 的 display mode 中，修改删除按钮区域：

```tsx
// 替换现有的删除按钮区域（line 109-114）
// 新增 deleting 状态和内联确认
const [deleting, setDeleting] = useState(false);

// 在 display mode 的按钮区域：
{deleting ? (
  <div className="flex items-center gap-2">
    <span className="text-[0.65rem] text-[#a07060]">确认删除？</span>
    <button
      type="button"
      className="rounded px-2 py-1 text-[0.65rem] tracking-[0.1em] text-[#a07060] transition-colors hover:bg-[rgba(255,230,220,0.4)]"
      onClick={async () => { await onDelete(fact.id); }}
    >
      是
    </button>
    <button
      type="button"
      className="rounded px-2 py-1 text-[0.65rem] tracking-[0.1em] text-[#6a5e53] transition-colors hover:bg-[rgba(255,249,239,0.6)]"
      onClick={() => setDeleting(false)}
    >
      否
    </button>
  </div>
) : (
  <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
    <button type="button" ... onClick={() => setEditing(true)}>编辑</button>
    <button type="button" ... onClick={() => setDeleting(true)}>删除</button>
  </div>
)}
```

**Step 2: MemoryCard — 操作期间禁用其他按钮**

在编辑/删除操作进行中，给外层 div 添加 `pointer-events-none opacity-60` 类（仅在 saving 状态）。

**Step 3: MemoriesView — 禁用操作期间的"+ 添加"按钮**

在每个维度的"+ 添加"按钮上添加 `disabled={loading}` 属性。

**Step 4: 验证交互行为**

- 删除按钮 hover 显示 → 点击 → 内联显示"确认删除？是/否"
- 点击"是" → 删除成功，列表更新
- 点击"否" → 回到正常状态
- 编辑中 → 其他操作按钮变灰

**Step 5: Commit**

```bash
git add src/components/profile/memory-card.tsx src/components/profile/memories-view.tsx
git commit -m "feat(portrait): add inline delete confirmation and operation-disabled states"
```

---

## Task 10: 测试补充

**Files:**
- Create: `tests/unit/portrait-data.service.test.ts`（已在 Task 2 创建）
- Create: `tests/unit/portrait-synthesis.service.test.ts`（已在 Task 3 创建）

**Step 1: 确认所有新测试通过**

```bash
npx vitest run tests/unit/portrait-data.service.test.ts tests/unit/portrait-synthesis.service.test.ts
```

Expected: All tests PASS.

**Step 2: 确认没有回归**

```bash
npx vitest run tests/unit/profile.service.test.ts
```

Expected: All existing profile tests still PASS.

**Step 3: 类型检查**

```bash
npx tsc --noEmit --pretty
```

Expected: 无新增 type errors。

**Step 4: 如果全部通过，Commit**

```bash
git add -A
git commit -m "test(portrait): verify all portrait service tests pass"
```

---

## Task 11: 文档更新

**Files:**
- Modify: `docs/handoff.md`
- Modify: `AGENTS.md`

**Step 1: 更新 handoff.md**

在"当前阶段结论"部分追加画像页重构的说明。

**Step 2: 更新 AGENTS.md**

在 API Surface 部分添加 `/api/profile/portrait` 端点文档。

**Step 3: Commit**

```bash
git add docs/handoff.md AGENTS.md
git commit -m "docs: document portrait page redesign and new API endpoint"
```

---

## 总结

| Task | 内容 | Track | 可并行 |
|------|------|-------|--------|
| 1 | Prisma 模型 | Backend | 独立 |
| 2 | 数据聚合服务 | Backend | 依赖 1 |
| 3 | AI 合成服务 | Backend | 依赖 2 |
| 4 | Portrait API | Backend | 依赖 3 |
| 5 | 共享 TS 类型 | Frontend | 独立（与 1 并行） |
| 6 | 画像视图 | Frontend | 依赖 5（与 2 并行） |
| 7 | 演变时间轴 | Frontend | 依赖 5（与 2 并行） |
| 8 | 页面重构 | Frontend | 依赖 6+7（与 3 并行） |
| 9 | 交互优化 | Polish | 依赖 8 |
| 10 | 测试验证 | QA | 随各 track |
| 11 | 文档更新 | Docs | 最后 |

**Backend Track 串行链：** 1 → 2 → 3 → 4
**Frontend Track：** 5 → [6, 7] 并行 → 8
**两 track 最早在 Task 8 汇合**（前端需要 API 集成时，Backend 应已完成 Task 4）。
