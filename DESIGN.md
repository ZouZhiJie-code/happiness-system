---
name: 幸福系统
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
  card-xl: "32px"
  card-lg: "28px"
  card-md: "24px"
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
    rounded: "{rounded.card-xl}"
  calendar-shell:
    backgroundColor: "{colors.calendar-panel}"
    textColor: "{colors.calendar-ink}"
    rounded: "{rounded.card-xl}"
  calendar-card:
    backgroundColor: "{colors.calendar-surface}"
    textColor: "{colors.calendar-ink}"
    rounded: "{rounded.card-md}"
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

# Design System: 幸福系统

## Overview

**Creative North Star: "温暖档案室里的紧凑工作台"**

这个产品不是通用 SaaS，也不是极简效率工具。全局母系统服务的是“记录、整理、回看”这件事本身，所以主界面保留木纹、纸张、暖色墨迹和书卷体标题，但页面组织已经从“大卡套大卡”改为更平铺的暖色工作台。它应该像一张被摊开认真整理的记录纸，而不是一块匿名后台。

记录日历是这套母系统里的明确子系统。它不是再讲一遍产品氛围，而是承担判断、分发、下一步动作，所以它应当切到更紧凑的工作台 register：保留暖纸张和墨色基调，同时显著降低纹理密度、阴影厚度和冗余高度。这里的目标不是脱离品牌，而是在同一产品里给出一块更高效率的暖色操作区。

**Key Characteristics**

- 全局界面优先保留温暖、低压、可书写的气质，同时减少整页外框、厚圆角和重复模块间隙。
- 顶部导航是全宽暖色工具栏，不再作为居中大卡片悬浮在页面上方。
- calendar 优先判断效率，减少装饰性纹理和厚重阴影，并压缩首屏垂直占用。
- serif 标题贯穿全站，但工作台正文和操作信息更紧凑克制。
- 状态色负责“这件事现在处于什么阶段”，维度色负责“这是哪一类记录”。
- 所有动作都应当先表达“下一步去哪里”，再表达“页面说明”。

## Colors

### Global Foundation

- **Warm Wood Base** (`#855a34`)：页面环境色，主要存在于全局背景和氛围纹理里，不直接拿来做高频按钮。
- **Warm Paper Soft** (`#edd8b5`) 与 **Warm Paper Main** (`#f8e9cc`)：主产品的纸面、面板和内容承载底色。
- **Warm Paper Deep** (`#996534`) 与 **Text Ink** (`#302114`)：正文、边界和标题的暖墨色，避免纯黑。
- **Accent Amber** (`#a96f3d`)：强调、选中、选择区域和局部强调使用的暖色点缀。

全局母系统的颜色目标不是“高对比科技感”，而是“可长期停留的记录感”。中性色必须带暖调，不使用纯黑白，不把冷蓝灰扩散到首页、访谈和设置等主叙事页面。

### Calendar Workspace Override

- **Calendar Ink** (`#604529`)：calendar 主动作、活动 segmented、焦点描边和高优先级文字的统一暖墨色。
- **Calendar Panel** (`#f5ecdb`) 与 **Calendar Surface** (`#fff9f0`)：calendar shell、panel、card 的浅暖工作台表面，用来让信息先于装饰被看见。

#### Status Palette

- **Empty** (`#7a6857`)：未记录或无结果，必须安静、退后。
- **In Progress** (`#8a5d17`)：仍在访谈中，带轻暖感，但不能混同全局强调色。
- **Draft** (`#7c5568`)：已有草稿、待编辑，使用偏梅紫的中强度状态色。
- **Completed** (`#45644a`)：已保存可查看，使用稳定苔绿色。
- **Mixed** (`#8e5638`)：同一天或同一组信息混有多种状态，使用偏陶土色，避免和 completed / draft 混淆。

#### Dimension Identity

- **Joy** (`#d68a5a`)：开心
- **Fulfillment** (`#74927a`)：充实
- **Reflection** (`#a17a97`)：思考
- **Improvement** (`#7d9771`)：改进
- **Gratitude** (`#b8848d`)：感谢

**The Two-Layer Rule.** 状态色永远先回答“现在是什么状态”，维度色永远只回答“这是哪个维度”。两套语义不能互相替代，不能让某个维度天生看起来像某种完成状态。

**The Warm Workspace Rule.** calendar 可以从全局暖色母系统里继承圆角、serif 标题和整体产品气质，但它的默认表面必须收束成更浅、更平、更紧凑的暖色工作台，不能重新长回木纹叠纸页面，也不能再分叉成蓝灰后台。

## Typography

### Global Foundation

- **Display Font:** `Baskerville, Iowan Old Style, Times New Roman, Songti SC, serif`
- **Body Font:** `Charter, Georgia, PingFang SC, Hiragino Sans GB, serif`
- **Mono Font:** `IBM Plex Mono, SFMono-Regular, Menlo, monospace`

这套字体不是为了做“现代 UI 中性化”，而是保留书写、纸本、回望一天的情绪。标题承担节奏和气质，正文承担阅读和叙述，二者都避开无差别的系统 sans。

### Hierarchy

- **Display**：用于首页主标题、访谈关键标题、calendar 日期和维度标题。行高紧，字重不靠极粗取胜，而靠字形气质和留白建立层级。
- **Body**：用于正文、摘要、状态说明、空态和错误态。默认应该易读、舒展，不追求极窄行高。
- **Mono**：仅用于程序化数据或技术辅助信息，不进入产品主体表达。

### Calendar Workspace Override

- calendar 保留 serif 标题体系，但尺寸和节奏要明显更紧凑。
- 日期数字、维度标题、面板 headline 可以继续用 display。
- 摘要、动作标签、状态说明、辅助统计统一回到更克制的 body 信息层。
- 任何工作台短句都优先“扫描可读”，不写成长篇说明卡。

**The Scannable Sentence Rule.** 在 calendar 里，文案首先是判断辅助，不是产品介绍。标题短、摘要短、按钮短，所有句子优先服务扫读。

## Elevation

### Global Foundation

全局母系统用纹理、渐变、内高光和浅阴影制造实体感。`page-shell`、`paper-panel`、`paper-sheet`、`wood-dialog` 都不是纯平面色块，但它们现在优先作为铺底 surface 或局部编辑 pane，不再默认承担“整页大卡片”的角色。默认装饰密度要让内容先被看见，而不是让壳层先被看见。

常见层级语言包括：

- 深阴影，例如 `0 28px 92px rgba(86, 55, 27, 0.18)`
- 暖色环境光，例如 `0 16px 44px rgba(146, 92, 47, 0.16)`
- 顶部高光、重复纹理、固定背景颗粒

### Calendar Workspace Override

calendar 明确降级装饰性层次，改用轻边框、浅暖表面和低强度阴影：

- shell：`0 16px 34px rgba(103, 66, 34, 0.12)`
- card：`0 10px 22px rgba(108, 69, 36, 0.08)`
- panel：以内高光加很浅的外阴影表达分层

交互层级依赖更克制的位移和描边，而不是更厚的材质感：

- hover 位移通常只到 `-1px` 或 `-0.5` 级别
- focus-visible 统一使用 `2px` 暖墨描边，颜色跟 `Calendar Ink` 对齐
- disabled 状态取消阴影、取消强调、降低对比

**The Flat-Enough Rule.** calendar 需要可读的层级，但不需要额外戏剧性。任何新增面板如果已经能靠边框、背景和留白成立，就不要再叠木纹、纸纹和重阴影。

## Components

### Shells

- **Global shells**：`page-shell / paper-panel / paper-sheet / wood-dialog` 组成主产品母系统。它们允许有纹理、暖色和实体感，但整页层级应优先平铺，避免大卡套大卡。
- **Calendar shell**：`calendar-shell` 是工作台壳层，必须保持浅暖背景、轻阴影和大圆角，不再套用木纹或厚纸面效果。

### Panels and Cards

- **Calendar panel**：作为月/周/日视图的内容容器，承担布局分区，不承担额外叙事。
- **Calendar card**：承载单日、单维度或单块摘要，默认浅面、轻边框、柔和阴影。
- **Calendar muted card**：用于空态、占位、次要说明块，必须明显退后，不能抢主卡片。

所有 calendar 卡片都应遵守统一圆角带：

- workspace 外壳：`32px`
- pane / 大卡：`28px`
- 单元卡 / day card：`24px` 到 `26px`

### Chips and Badges

- **Calendar chip**：轻量信息和次级动作基底，承担“今天”“统计摘要”“轻链接按钮”等角色。
- **Calendar summary chip**：统计类 capsule，不做强强调，只做快扫。
- **Calendar status badge**：回答完成状态，必须用状态色，不可滥用维度色。
- **Calendar dimension badge**：calendar 当前的可见 badge 使用单字 `悦 / 实 / 思 / 改 / 谢`，位置稳定、视觉稳定；辅助技术仍需暴露完整维度名，不因为状态不同而改语义。

### Actions

- **Primary action**：深色实心胶囊按钮，表示最直接的下一步，例如 `查看当天`、`继续访谈`、`继续编辑`。
- **Secondary action**：轻链接或轻按钮，表示补充操作，不抢主决策。
- **Disabled action**：必须一眼看出不可推进，使用低对比、虚线边框、去阴影处理，并保留清楚的不可用文案。

calendar 中的动作层级不可漂移：

- 主按钮是推进
- 次按钮是补充
- disabled 不是“弱主按钮”，而是“当前不能做”

### Segmented and Navigation Controls

- **View switcher**：月 / 周 / 日切换使用分段控件，当前项使用 `Calendar Ink` 深色填充。
- **Prev / Next / Today**：作为 header 工作台控件存在，尺寸一致，优先紧凑和快扫，不做视觉主角。
- **Header middle lane**：访谈维度条与 calendar toolbar 都必须收进同一套中区框体里，共用高度预算、左右 gutter 和圆角节奏。

### Day Cells and Boards

- **Month day cell**：只保留日期、状态符号，以及“已保存结果优先”的单字维度 token 或 `已完成`。它是入口，不是详情页。
- **Week board card**：七天等权比较，统一高度，统一结构，统一主动作出口。
- **Day dimension card**：五维紧凑操作台，统一高度、统一按钮尺寸、统一 badge 语法。

**The One Surface, One Job Rule.** 一个容器只承担一个主任务。月格子负责扫分布，周卡负责横向比较，日卡负责分发动作。不要在同一表面里同时塞说明、统计、正文和操作。

## Do's and Don'ts

### Do

- 保留“温暖记录产品”的母系统基调，让首页、访谈和设置仍然像可停留的书写空间。
- 在 calendar 中优先工作台判断效率，让用户先看到状态、入口和下一步。
- 让状态色和维度色各司其职，状态优先级高于装饰。
- 让标题保留 serif 气质，但让摘要、操作、统计全部服务快速扫描。
- 统一主按钮、次按钮、禁用态和 focus-visible，不允许每个视图各写一套规则。
- 使用短句文案，尤其在 empty / loading / error / fallback 场景里保持工作台语气。

### Don't

- 不把 calendar 再做回木纹、纸纹、厚阴影堆叠页。
- 不让 calendar 再分叉成蓝灰后台产品。
- 不使用纯黑、纯白或高饱和科技蓝替换现有母系统。
- 不让维度色承担完成状态语义，也不让状态色反向充当维度身份。
- 不新增仓库里从未出现过的视觉家族，例如玻璃拟态 dashboard、霓虹深色台、通用 SaaS 渐变页。
- 不把 disabled 做成“看起来还能点”的弱可点击态。
- 不回到大段说明型文案，尤其不能让工作台页面重新长出解释产品用途的厚重导语。
