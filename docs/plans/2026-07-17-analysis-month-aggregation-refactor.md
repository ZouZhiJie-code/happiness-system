# Analysis Month Aggregation Refactor Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Split the month analysis aggregator into focused pure-function modules while preserving every existing API, type, date rule, ordering rule, and user-visible string.

**Architecture:** Keep `aggregate-month.ts` as the stable public orchestrator. Move shared date primitives, coverage/score/rhythm calculations, dimension evidence calculations, and cross-dimension overview calculations into one-way internal modules; preserve `buildAnalysisScoreTrend` through a re-export from the original path.

**Tech Stack:** TypeScript 5.6, Vitest 2, Next.js 15, existing Analysis read-model types.

---

### Task 1: Add failing coverage-module behavior tests

**Files:**
- Create: `tests/unit/analysis-month-coverage.test.ts`
- Create later: `src/features/analysis/month-coverage.ts`

**Step 1: Write the failing test**

Create a test importing `buildAnalysisMonthCoverage` and `buildAnalysisScoreTrend` from `@/features/analysis/month-coverage`. Use one saved joy entry, one stale daily journal, one in-month score and one out-of-month score. Assert:

```ts
expect(result.dailyCoverage).toHaveLength(31);
expect(result.dailyCoverage.find((day) => day.date === "2026-05-02")).toMatchObject({
  savedDimensionCount: 1,
  savedDimensions: ["joy"],
  hasDailyJournalSaved: true,
  hasStaleDailyJournal: true,
  hasScore: true,
  averageScore: 7.5
});
expect(result.scoreOverview).toEqual({
  scoredDayCount: 1,
  monthAverageScore: 7.5,
  latestScoredDate: "2026-05-02"
});
expect(result.rhythmOverview.pendingDailyJournalCount).toBe(1);
expect(buildAnalysisScoreTrend({ month: "invalid", scoreRecords: [] })).toThrow;
```

Use `expect(() => buildAnalysisScoreTrend(...)).toThrow("INVALID_MONTH")` for the invalid-month assertion.

**Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/unit/analysis-month-coverage.test.ts`

Expected: FAIL because `@/features/analysis/month-coverage` does not exist.

**Step 3: Commit the red test**

```bash
git add tests/unit/analysis-month-coverage.test.ts
git commit -m "test: characterize analysis month coverage"
```

### Task 2: Extract shared utilities and month coverage

**Files:**
- Create: `src/features/analysis/month-aggregation-utils.ts`
- Create: `src/features/analysis/month-coverage.ts`
- Modify: `src/features/analysis/aggregate-month.ts`
- Test: `tests/unit/analysis-month-coverage.test.ts`

**Step 1: Move shared primitives**

Move `MONTH_PATTERN`, `parseMonthKey`, `formatDateKey`, `buildMonthDates`, `compareDateDesc`, and `roundScoreAverage` into `month-aggregation-utils.ts`. Export only `buildMonthDates`, `compareDateDesc`, and `roundScoreAverage`.

**Step 2: Move coverage behavior**

Move `buildContentPreview`, `buildDailyCoverage`, score helpers, observed-day helpers, span helpers, `buildRhythmOverview`, and `buildAnalysisScoreTrend` into `month-coverage.ts`. Add:

```ts
export function buildAnalysisMonthCoverage(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  dailyJournals: AnalysisSavedDailyJournalSource[];
  scoreRecords: DailyHappinessScoreRecord[];
  today: string;
}) {
  const dailyCoverage = buildDailyCoverage(input);
  const { scoreOverview, scoreTrend } = buildAnalysisScoreTrend(input);

  return {
    dailyCoverage,
    rhythmOverview: buildRhythmOverview({ month: input.month, dailyCoverage, today: input.today }),
    scoreOverview,
    scoreTrend
  };
}
```

**Step 3: Preserve the original export**

In `aggregate-month.ts`, add:

```ts
export { buildAnalysisScoreTrend } from "@/features/analysis/month-coverage";
```

Use `buildAnalysisMonthCoverage` inside `aggregateAnalysisMonth` and remove the moved implementations.

**Step 4: Run focused tests**

Run: `npm test -- --run tests/unit/analysis-month-coverage.test.ts tests/unit/analysis.service.test.ts tests/unit/analysis.api.test.ts`

Expected: PASS.

**Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/features/analysis/month-aggregation-utils.ts src/features/analysis/month-coverage.ts src/features/analysis/aggregate-month.ts tests/unit/analysis-month-coverage.test.ts
git commit -m "refactor: extract analysis month coverage"
```

### Task 3: Add failing dimension-module behavior tests

**Files:**
- Create: `tests/unit/analysis-month-dimensions.test.ts`
- Create later: `src/features/analysis/month-dimensions.ts`

**Step 1: Write the failing test**

Import `buildAnalysisMonthDimensions` from the new module. Provide two joy entries on different days, including tags and payload signals, plus factor averages. Assert that breakdown counts, confidence, continuity, momentum, recent signal order and evidence excerpts match current behavior.

```ts
expect(result.dimensionBreakdown.find((item) => item.dimension === "joy")).toEqual({
  dimension: "joy",
  savedEntryCount: 2,
  recordedDayCount: 2
});
expect(result.dimensions.find((item) => item.dimension === "joy")).toMatchObject({
  confidence: "medium",
  continuity: "intermittent",
  momentum: "steady",
  representativeDates: ["2026-05-20", "2026-05-02"]
});
```

**Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/unit/analysis-month-dimensions.test.ts`

Expected: FAIL because the module does not exist.

**Step 3: Commit the red test**

```bash
git add tests/unit/analysis-month-dimensions.test.ts
git commit -m "test: characterize analysis month dimensions"
```

### Task 4: Extract dimension evidence and insight cards

**Files:**
- Create: `src/features/analysis/month-dimensions.ts`
- Modify: `src/features/analysis/aggregate-month.ts`
- Test: `tests/unit/analysis-month-dimensions.test.ts`

**Step 1: Move dimension calculations**

Move the dimension score maps and the functions from `buildDimensionBreakdown` through `buildDimensionInsights` into the new module. Keep every regular expression, string, limit and sort tiebreaker byte-for-byte equivalent.

**Step 2: Add one public internal entry**

```ts
export function buildAnalysisMonthDimensions(input: {
  month: string;
  entries: AnalysisSavedEntrySource[];
  factorAverages: Record<HappinessScoreRequestKey, number | null>;
}) {
  return {
    dimensionBreakdown: buildDimensionBreakdown(input.entries),
    dimensions: buildDimensionInsights(input)
  };
}
```

**Step 3: Update the orchestrator**

Call `buildAnalysisMonthDimensions` after coverage generation and pass `scoreTrend.factorAverages`. Remove the moved code from `aggregate-month.ts`.

**Step 4: Verify**

Run: `npm test -- --run tests/unit/analysis-month-dimensions.test.ts tests/unit/analysis.service.test.ts tests/unit/analysis.api.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/analysis/month-dimensions.ts src/features/analysis/aggregate-month.ts tests/unit/analysis-month-dimensions.test.ts
git commit -m "refactor: extract analysis month dimensions"
```

### Task 5: Add failing overview-module behavior tests

**Files:**
- Create: `tests/unit/analysis-month-insights.test.ts`
- Create later: `src/features/analysis/month-insights.ts`

**Step 1: Write the failing test**

Import `buildAnalysisInsightsOverview`. Build five minimal `AnalysisDimensionInsightCard` fixtures where joy is featured, reflection is related, and improvement is quiet with a lagging score. Add one day containing joy and reflection. Assert the exact headline, featured dimension, quiet dimensions and relationship-link order.

```ts
expect(result.headline).toBe("开心是主线，思考在旁边接上了它，改进还没真正展开。");
expect(result.featuredDimension).toBe("joy");
expect(result.quietDimensions).toContain("improvement");
expect(result.links.map((link) => link.type)).toEqual(["pairing", "followup", "score", "gap"]);
```

**Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/unit/analysis-month-insights.test.ts`

Expected: FAIL because the module does not exist.

**Step 3: Commit the red test**

```bash
git add tests/unit/analysis-month-insights.test.ts
git commit -m "test: characterize analysis month insights"
```

### Task 6: Extract cross-dimension overview

**Files:**
- Create: `src/features/analysis/month-insights.ts`
- Modify: `src/features/analysis/aggregate-month.ts`
- Test: `tests/unit/analysis-month-insights.test.ts`

**Step 1: Move overview behavior**

Move `compareDimensionInsights` and all functions from `buildPairingLink` through `buildInsightsOverview` into the new module. Rename only the exported entry to `buildAnalysisInsightsOverview`; preserve internal names and output strings.

**Step 2: Update the orchestrator**

Import `buildAnalysisInsightsOverview` and use it to fill `insightsOverview`. The final `aggregate-month.ts` should contain imports, the preserved score-trend re-export, `aggregateAnalysisMonth`, and no domain helper implementations.

**Step 3: Verify**

Run: `npm test -- --run tests/unit/analysis-month-insights.test.ts tests/unit/analysis.service.test.ts tests/unit/analysis.api.test.ts tests/unit/analysis-shell.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/features/analysis/month-insights.ts src/features/analysis/aggregate-month.ts tests/unit/analysis-month-insights.test.ts
git commit -m "refactor: extract analysis month insights"
```

### Task 7: Verify contracts and architecture

**Files:**
- Modify if needed: files from Tasks 1–6 only

**Step 1: Check dependency direction and exports**

Run:

```bash
rg -n "from \"@/features/analysis/(aggregate-month|month-)" src/features/analysis src/server tests/unit
rg -n "buildAnalysisScoreTrend" src tests
```

Expected: production callers keep using `aggregate-month`; internal modules do not import `aggregate-month`; the original score-trend export remains available.

**Step 2: Run the Analysis test suite**

Run:

```bash
npm test -- --run tests/unit/analysis-month-coverage.test.ts tests/unit/analysis-month-dimensions.test.ts tests/unit/analysis-month-insights.test.ts tests/unit/analysis.service.test.ts tests/unit/analysis.api.test.ts tests/unit/aggregate-trends-range.test.ts tests/unit/analysis-shell.test.tsx tests/unit/analysis-trends-section.test.tsx
```

Expected: PASS.

**Step 3: Run static checks**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS, or only a documented pre-existing unrelated failure.

**Step 4: Run the full suite**

Run: `npm test`

Expected: all refactor-related tests pass; compare any remaining failure against the recorded baseline. The known baseline failure is `tests/unit/site-header-analysis.test.tsx` because `CURRENT_MONTH` uses the real 2026-07 date while `getTodayEntryDate` is mocked to 2026-05.

### Task 8: Independent diff review and final verification

**Files:**
- Review: all changed files

**Step 1: Review scope**

Run: `git diff --stat main...HEAD` and `git diff main...HEAD`.

Confirm that changes are limited to the design/plan, three characterization tests, four internal modules, and the stable orchestrator.

**Step 2: Review behavioral invariants**

Compare moved regular expressions, strings, sort functions, date filters and return assembly against `main:src/features/analysis/aggregate-month.ts`. Confirm that no content, condition or tiebreaker changed.

**Step 3: Re-run focused verification**

Run the Task 7 Analysis suite and `npm run typecheck` again after any review fix.

**Step 4: Commit documentation or review fixes**

```bash
git add docs/plans/2026-07-17-analysis-month-aggregation-refactor-design.md docs/plans/2026-07-17-analysis-month-aggregation-refactor.md
git commit -m "docs: plan analysis month aggregation refactor"
```

