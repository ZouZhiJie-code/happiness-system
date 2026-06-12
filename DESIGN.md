---
name: Daily Light
description: 用结构化访谈与记录日历组织每日开心、充实、思考、改进与感谢的记录界面。
colors:
  warm-wood-base: "#855a34"
  warm-paper-soft: "#edd8b5"
  warm-paper-main: "#f8e9cc"
  warm-paper-deep: "#996534"
  text-ink: "#302114"
  accent-amber: "#a96f3d"
  calendar-ink: "#604529"
  calendar-panel: "#f5ecdb"
  calendar-surface: "#fff9f0"
  status-empty: "#7a6857"
  status-in-progress: "#8a5d17"
  status-draft: "#7c5568"
  status-completed: "#45644a"
  status-mixed: "#8e5638"
  dimension-joy: "#d68a5a"
  dimension-fulfillment: "#74927a"
  dimension-reflection: "#a17a97"
  dimension-improvement: "#7d9771"
  dimension-gratitude: "#b8848d"
typography:
  display:
    fontFamily: "Baskerville, Iowan Old Style, Times New Roman, Songti SC, serif"
    lineHeight: 1
  body:
    fontFamily: "Charter, Georgia, PingFang SC, Hiragino Sans GB, serif"
  mono:
    fontFamily: "IBM Plex Mono, SFMono-Regular, Menlo, monospace"
rounded:
  shell: "28px"
  card: "20px"
  control: "12px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  page-shell:
    backgroundColor: "{colors.warm-paper-main}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.shell}"
  calendar-shell:
    backgroundColor: "{colors.calendar-panel}"
    textColor: "{colors.calendar-ink}"
    rounded: "{rounded.shell}"
  calendar-card:
    backgroundColor: "{colors.calendar-surface}"
    textColor: "{colors.calendar-ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.calendar-ink}"
    textColor: "#f8fbff"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  chip-default:
    backgroundColor: "{colors.calendar-surface}"
    textColor: "#334155"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: Daily Light

## Document Map

| 文档 | 职责 |
| --- | --- |
| **本文件 `DESIGN.md`** | 创意方向、页面形态、组件语义、Do/Don't |
| **[docs/design/ui-conventions.md](docs/design/ui-conventions.md)** | 容器层级、圆角/边框 token、共享原语清单（工程必遵） |
| **`docs/plans/`** | 历史决策过程；若与 DESIGN 或代码冲突，以 DESIGN + 代码为准 |

### Changelog 2026-06-12

1. **全站单层卡片制**：每页最多 Surface 底板 + 一层 Card；卡片内用眉题 / hairline / 留白分区，禁止再嵌套 border+bg 子容器。
2. **分析页 IA**：单页四段纵向 scroll + 顶部锚点 tab + scroll spy；section keys 为 `trends / dimensions / correlation / review`。
3. **量化趋势段**：只读读数台（`GET /api/analysis/range`），无评分录入、无热力点选、无补漏 CTA。

视觉参考 mockup：[`docs/plans/analysis-ia-mockups/scheme-d-scroll-tabs.html`](docs/plans/analysis-ia-mockups/scheme-d-scroll-tabs.html)、[`trends-final-preview.html`](docs/plans/analysis-ia-mockups/trends-final-preview.html)。

---

## Overview

**Creative North Star: "温暖档案室里的紧凑工作台"**

这个产品不是通用 SaaS，也不是极简效率工具。全局母系统服务的是“记录、整理、回看”这件事本身，所以主界面保留木纹、纸张、暖色墨迹和书卷体标题，但页面组织已经从“大卡套大卡”改为更平铺的暖色工作台。它应该像一张被摊开认真整理的记录纸，而不是一块匿名后台。

记录日历是这套母系统里的明确子系统。它不是再讲一遍产品氛围，而是承担判断、分发、下一步动作，所以它应当切到更紧凑的工作台 register：保留暖纸张和墨色基调，同时显著降低纹理密度、阴影厚度和冗余高度。

**Key Characteristics**

- 全局界面优先保留温暖、低压、可书写的气质，同时减少整页外框、厚圆角和重复模块间隙。
- **单层卡片制（2026-06-12）**：section 用眉题 + hairline + 留白分区；只有可点击单元或需边界感的数据块才配 Card，纯信息分组不配卡片外壳。
- 顶部导航是全宽暖色工具栏，不再作为居中大卡片悬浮；主导航当前页使用贴近文字的暖棕实线下划线，选中项字号略大。
- 首页、设置页、管理员页优先采用连续工作台：内容顺着一张主纸面展开。
- **分析页**是纵向 scroll 报告体：四段同屏 + 锚点 tab，不是互斥 tab 仪表盘，也不是冷色 SaaS dashboard；职责是读数、理解与后续手动 AI 复盘，不承担补漏推进。
- calendar 优先判断效率，减少装饰性纹理和厚重阴影。
- serif 标题贯穿全站，工作台正文和操作信息更紧凑克制。
- 状态色回答“现在是什么阶段”，维度色回答“这是哪一类记录”。

## Colors

### Global Foundation

- **Warm Wood Base** (`#855a34`)：页面环境色，主要存在于全局背景和氛围纹理里，不直接拿来做高频按钮。
- **Warm Paper Soft** (`#edd8b5`) 与 **Warm Paper Main** (`#f8e9cc`)：主产品的纸面、面板和内容承载底色。
- **Warm Paper Deep** (`#996534`) 与 **Text Ink** (`#302114`)：正文、边界和标题的暖墨色，避免纯黑。
- **Accent Amber** (`#a96f3d`)：强调、选中、选择区域和局部强调使用的暖色点缀。

全局母系统的颜色目标不是“高对比科技感”，而是“可长期停留的记录感”。中性色必须带暖调，不使用纯黑白，不把冷蓝灰扩散到首页、访谈和设置等主叙事页面。

新代码禁止手写 `border-[rgba(...)]` / `bg-[rgba(...)]` 任意值；统一引用 CSS 变量（见 `globals.css :root`）或 Tailwind 命名色（`ink / sand / clay / paper / ember / line`）。

### Calendar Workspace Override

- **Calendar Ink** (`#604529`)：calendar 主动作、活动 segmented、焦点描边和高优先级文字的统一暖墨色。
- **Calendar Panel** (`#f5ecdb`) 与 **Calendar Surface** (`#fff9f0`)：calendar shell、panel、card 的浅暖工作台表面。

#### Status Palette

- **Empty** (`#7a6857`)：未记录或无结果，必须安静、退后。
- **In Progress** (`#8a5d17`)：仍在访谈中。
- **Draft** (`#7c5568`)：已有草稿、待编辑。
- **Completed** (`#45644a`)：已保存可查看。
- **Mixed** (`#8e5638`)：同一天混有多种状态。

#### Dimension Identity

- **Joy** (`#d68a5a`)：开心 · **Fulfillment** (`#74927a`)：充实 · **Reflection** (`#a17a97`)：思考 · **Improvement** (`#7d9771`)：改进 · **Gratitude** (`#b8848d`)：感谢

**The Two-Layer Rule.** 状态色与维度色各司其职，不能互相替代。

**The Warm Workspace Rule.** calendar 收束成更浅、更平、更紧凑的暖色工作台，不能重新长回木纹叠纸页，也不能分叉成蓝灰后台。

## Typography

### Global Foundation

- **Display:** `Baskerville, Iowan Old Style, Times New Roman, Songti SC, serif`
- **Body:** `Charter, Georgia, PingFang SC, Hiragino Sans GB, serif`
- **Mono:** `IBM Plex Mono, SFMono-Regular, Menlo, monospace`（仅程序化数据）

### Calendar Workspace Override

- calendar 保留 serif 标题，尺寸和节奏更紧凑；摘要、动作、统计统一回到 body 信息层。

**The Scannable Sentence Rule.** 工作台文案优先服务扫读，标题短、按钮短。

## Elevation & Radius

### Radius（2026-06-12 三档，与 `globals.css` 一致）

| 档位 | 值 | CSS 变量 | 用途 |
| --- | --- | --- | --- |
| shell | 28px | `--radius-shell` | 页面底板、对话框 |
| card | 20px | `--radius-card` | 唯一卡片层 |
| control | 12px | `--radius-control` | 输入件、小型 tile、图表容器 |
| pill | 999px | — | chip / 胶囊按钮 |

新代码禁止新增 `14/16/18/22/24/26/30/32px` 等中间圆角。calendar 遗留 class 若仍用更大圆角，逐步迁移，不得在新页面复制。

### Shadows & Borders

- 边框两档：`--line-soft`（默认）/ `--line-strong`（选中、强调）。
- 底板保留全局类自带阴影；卡片只允许 `shadow-sm` 或无阴影；hover 最多 `shadow-md`。
- calendar 降级装饰：轻边框 + 浅暖表面 + 低强度阴影（shell `0 16px 34px rgba(103,66,34,0.12)` 等）。

**The Flat-Enough Rule.** 能靠边框、背景和留白成立的，不再叠木纹、纸纹和重阴影。

## Components

### Shared UI Primitives

新页面禁止手写卡片样式；先扩展原语再使用。实现见 [`src/components/ui/`](src/components/ui/)，工程规则见 [ui-conventions.md](docs/design/ui-conventions.md)。

| 原语 | 职责 |
| --- | --- |
| `Surface` | 页面底板（吸收 `page-shell` / `calendar-shell`） |
| `Card` | 唯一卡片层，`interactive` 自带 hover/focus |
| `SectionHeading` | 眉题式分组标题 |
| `Divider` | hairline 分隔线 |
| `ActionButton` | primary / secondary / ghost 三态按钮 |

### Shells

- **Global shells**：`page-shell / paper-panel / paper-sheet / wood-dialog` 允许纹理与暖色，但整页层级优先平铺，避免大卡套大卡。
- **Calendar shell**：浅暖背景、轻阴影，不套木纹。
- **Settings / Home / Admin shell**：一张连续主纸面；控制区用 Divider 分行，不再各自漂浮成大卡。
- **Analysis shell（2026-06-12）**：
  - 单页四段同屏：`trends` / `dimensions` / `correlation` / `review`
  - `SiteHeader` 中区：周期 preset（本周/本月/自定义）+ 四段锚点 tab + contextual chip
  - 导航：tab 点击 → 锚点滚动；用户滚动 → scroll spy 更新 URL `section`
  - 段间：`Divider` + 留白；段内眉题用 `AnalysisSection` / `SectionHeading`
  - **量化趋势**：只读读数台（周期摘要、总分柱线、日志天数色块、8 要素雷达/棒棒糖）；数据来自 `GET /api/analysis/range`
  - **五维全景**：按月聚合（`GET /api/analysis/month`）；**关联 / 复盘**：占位，手动 AI 后续接入
  - 旧 URL `overview|score|rhythm|insights` 自动映射到新 section keys

### Panels and Cards

- **Calendar card**：单日、单维度或摘要块；浅面、轻边框。
- **Global content sections**：纯文案分组、设置行、管理员表格——用眉题 + Divider，**不配** Card。
- **Analysis data blocks**：图表、可点 tile 等需要边界感的块可用一层 Card；段标题区不用 Card。
- **层级预算**：每页最多 Surface + 一层 Card；Card 内禁止再嵌套 border+bg 容器。

calendar 遗留圆角带（`24–32px`）仅作兼容参考，新代码遵循三档 token。

### Chips and Badges

- **Calendar chip / summary chip / status badge / dimension badge**：规则不变；维度 badge 单字 `悦/实/思/改/谢`。

### Actions

- **Primary**：最直接下一步（calendar：`查看当天`、`继续访谈`）。
- **Secondary / ghost**：补充或只读跳转。
- **Disabled**：低对比、去阴影，一眼不可点。

分析页趋势段：**不做**补漏 primary CTA；若保留链接，只用 ghost 级只读「查看来源」。

### Segmented and Navigation Controls

- **View switcher**：月/周/日 segmented，当前项 `Calendar Ink` 填充。
- **Header middle lane**：维度条、calendar toolbar、analysis toolbar 平铺在中区，用 `｜` 分隔，不套独立外框。
- **Analysis anchor tabs**：四段 tab 与 scroll spy 双向联动；不是互斥渲染切换。

### Day Cells and Boards

- **Month day cell**：入口，不是详情页。
- **Week board card**：七天等权比较。
- **Day dimension card**：五维紧凑操作台。

**The One Surface, One Job Rule.** 一个容器只承担一个主任务。

## Do's and Don'ts

### Do

- 保留“温暖记录产品”母系统基调。
- 遵循单层卡片制：Surface + 最多一层 Card + hairline 分区。
- 分析页用单页 scroll + 锚点 tab；趋势段只陈述数据。
- calendar 优先工作台判断效率。
- 状态色与维度色各司其职。
- 标题保留 serif，摘要与操作服务快速扫描。
- 统一按钮三态与 focus-visible。

### Don't

- 不做大卡套大卡、panel 套 panel。
- 不把 calendar 做回木纹厚阴影页或蓝灰后台。
- **分析页**：不做互斥 tab 只渲染一块；不做「建议先看 / 待整合 / 待成文」补漏导向；不做 narrative + 数据 + 证据条三层 dashboard；不用冷色 SaaS 蓝灰。
- 不把设置页做成 dashboard 式多模块堆叠。
- 不用纯黑、纯白或高饱和科技蓝。
- 不手写 rgba 任意值或中间圆角。
- 不新增玻璃拟态、霓虹深色台、通用 SaaS 渐变页等未出现过的视觉家族。
