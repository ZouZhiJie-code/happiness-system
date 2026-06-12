> **已并入 [DESIGN.md](../../DESIGN.md)（2026-06-12）**；本文件保留决策过程。

# 分析页单页锚点框架设计（2026-06-12）

## 背景

分析页从「四 tab 互斥渲染」改为「单页四段纵向 scroll + 顶部 tab 锚点跳转 + scroll spy 双向联动」。这是 A（单一报告流）与 B（顶部 tab）的混合方案，用户已确认选用。

## 信息架构

| Tab 文案 | URL `section` | DOM id | 本轮内容 |
| --- | --- | --- | --- |
| 量化趋势 | `trends` | `analysis-trends` | `AnalysisTrendsSection`（周期摘要 + 总分柱线图 + 日志天数 + 8 要素雷达/棒棒糖） |
| 五维全景 | `dimensions` | `analysis-dimensions` | 临时复用 `DimensionInsights` |
| 关联 | `correlation` | `analysis-correlation` | 占位 + disabled CTA |
| 复盘 | `review` | `analysis-review` | 占位 + disabled CTA |

默认 landing：`section=trends`

## 导航机制

- **点击 tab**：`router.replace(..., { scroll: false })` → shell 监听 section 变化 → `scrollIntoView` 到对应锚点
- **用户滚动**：`IntersectionObserver` 检测当前 section → `replaceState` 更新 URL + 自定义事件通知 toolbar 高亮
- **programmatic scroll 锁**：避免 scroll spy 与 tab 点击互相打架

旧 URL 映射：

- `overview` / `score` / `rhythm` → `trends`
- `insights` → `dimensions`

## 代码落点

- [`src/features/analysis/view-state.ts`](../../src/features/analysis/view-state.ts) — section keys 与 URL 归一化
- [`src/features/analysis/section-nav.ts`](../../src/features/analysis/section-nav.ts) — scroll spy 与 toolbar 的事件桥
- [`src/components/analysis/use-analysis-section-spy.ts`](../../src/components/analysis/use-analysis-section-spy.ts) — IntersectionObserver + 深链滚动
- [`src/components/analysis/analysis-shell.tsx`](../../src/components/analysis/analysis-shell.tsx) — 四段同屏
- [`src/components/analysis/analysis-toolbar.tsx`](../../src/components/analysis/analysis-toolbar.tsx) — 新 tab 文案，chip 去掉补漏导向

## 本轮边界（未做）

- AI 关联分析与周期复盘生成
- 五维 / 关联 / 复盘段业务细节打磨（叙事重写等）
- `overview` 专属 UI 已从 shell 移除（组件文件保留）

## 2026-06-12 量化趋势段打磨（已完成）

- 设计文档：[`2026-06-12-analysis-trends-polish-design.md`](2026-06-12-analysis-trends-polish-design.md)
- `GET /api/analysis/range` + toolbar `本周/本月/自定义`
- trends 段改读数台，不再复用 `HappinessScorePanel` / `CoverageHeatmap`

## Mockup

静态参照：[`docs/plans/analysis-ia-mockups/scheme-d-scroll-tabs.html`](analysis-ia-mockups/scheme-d-scroll-tabs.html)
