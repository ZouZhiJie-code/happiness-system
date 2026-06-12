> **已并入 [DESIGN.md](../../DESIGN.md)（2026-06-12）**；本文件保留决策过程。

# 分析页「量化趋势」段打磨设计（2026-06-12）

## 背景

在已落地的单页锚点框架（`section=trends|dimensions|correlation|review`）上，将「量化趋势」从临时复用的评分录入面板 + 可点击热力，改为**读数台**：只看评分与记录密度，不带补漏 CTA。

示意图参考：[`trends-final-preview.html`](analysis-ia-mockups/trends-final-preview.html)（方向参考，非像素稿）。

## 产品决策

| 项 | 决策 |
| --- | --- |
| 段定位 | 读数台：看清评分与记录，无补漏/强 CTA |
| 时间范围 | **本周 / 本月 / 自定义**；本周 = 周一至周日（Asia/Shanghai） |
| 本月 | 自然月 1 日至今天（当前月）或月末（历史月） |
| 总分走势 | 柱 + 线综合图；Y 轴 2–10，舒适区 6–8 |
| 8 要素 | 全量 8 项；默认雷达图，可切换棒棒糖 |
| 日志天数 | 仅维度日志记录；极简色块；无点选、无侧栏、无行动按钮 |
| 顶栏 | 周期 preset + 日期范围 + 四段锚点，并入 `SiteHeader` 中区 |
| 评分热力 | 不做 |

## URL 与状态

在既有 `month`、`section` 上扩展：

```
/analysis?month=2026-06&section=trends&preset=month
/analysis?month=2026-06&section=trends&preset=week
/analysis?month=2026-06&section=trends&preset=custom&start=2026-06-01&end=2026-06-10
```

- `month`：五维全景等仍按月聚合；也作为本月/翻月锚点。
- `preset` 缺省为 `month`；非法值归一为 `month`。
- `custom` 必须带合法 `start`/`end`（`YYYY-MM-DD`，`start <= end`，跨度 ≤ 93 天）。

归一化逻辑：`src/features/analysis/view-state.ts` + `src/features/analysis/date-range.ts`。

## API

新增 **`GET /api/analysis/range`**（保留 `/api/analysis/month` 不动）：

```
?preset=week|month|custom&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

- `preset=month` 时可用 `month=YYYY-MM` 代替显式日期（service 推导起止）。
- 返回 `AnalysisTrendsRangeRecord`：`preset, startDate, endDate, logOverview, dailyCoverage, scoreOverview, scoreTrend`。

聚合：`aggregateAnalysisTrendsRange`（`src/features/analysis/aggregate-trends-range.ts`），日期窗口与仓库查询统一走 `Asia/Shanghai` 整天边界。

## 前端落点

| 文件 | 职责 |
| --- | --- |
| `analysis-toolbar.tsx` | 本周/本月/自定义、日期范围展示、翻周/翻月 |
| `analysis-trends-section.tsx` | 周期摘要 + 总分图 + 日志天数 + 8 要素 |
| `analysis-shell.tsx` | trends 段改读 range API；其余段仍用 month API |
| `range-client.ts` | 拉取 range 数据 |

## 测试

- `date-range` / `view-state` preset 归一化
- `aggregate-trends-range` 周/月/custom 覆盖
- `analysis.api.test.ts` range route
- `analysis-shell.test.tsx` trends 段渲染与只读语义

## 边界（本轮不做）

- 自定义日期弹层/日历选择器精修（先用原生 `input[type=date]`）
- 周期均分环比 ↑↓
- 关联 / 复盘 AI 生成
