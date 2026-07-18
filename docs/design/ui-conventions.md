# UI 设计规范：单层卡片制（2026-06-12）

本文件是 **[DESIGN.md](../../DESIGN.md) 的工程实现附录**：容器层级、圆角/边框 token、共享原语清单。创意方向与页面形态以 DESIGN.md 为准；分析页 IA 详见 DESIGN.md「Analysis shell」与 [2026-06-12-analysis-scroll-anchor-design.md](../plans/2026-06-12-analysis-scroll-anchor-design.md)。

本规范约束全站（除访谈页消息区与首页品牌区外）的视觉容器结构。适用页面（持续）：分析页、日历周/日视图、设置全家桶、管理员页面等。访谈页和日历月视图是本规范的参照样板。

## 1. 层级预算（核心规则）

每个页面最多两层视觉容器：

1. **底板（Surface）**：每页只有一个，承载页面背景、外边框和外阴影。对应 `page-shell` / `calendar-shell` 全局类。
2. **卡片（Card）**：底板之内最多一层。卡片内部禁止再出现任何带 `border + 背景色` 的容器；内部分区只允许：
   - 文字层级（标题字号/字重/颜色）
   - 分隔线（hairline）
   - 留白（spacing）
   - chip / badge / pill（小型行内标签，不算容器层）
   - 引用式排版（左侧竖线 + 缩进，无封闭边框）

被废弃的中间层：`paper-sheet` 包裹内容区、`calendar-panel` 作为 shell 与 card 之间的过渡层、`calendar-card-muted` 作为卡片内子卡。

## 2. 卡片资格

只有以下两类元素才允许成为卡片：

- **可点击单元**：日历天卡、评分要素按钮、热力日格、维度操作行等，需要 hover/focus 反馈的交互实体。
- **需要从背景突出的数据单元**：如评分趋势图、维度洞察卡这类需要边界感的独立内容块。

纯信息分组（说明文案、配置摘要、统计列表、表单分区）一律不配卡片，用 `SectionHeading + Divider + 留白` 表达。

## 3. 圆角档位（3 档）

| 档位 | 值 | 用途 | CSS 变量 |
| --- | --- | --- | --- |
| control | `12px` | 输入件、小型可点 tile、卡片内图表容器 | `--radius-control` |
| card | `20px` | 唯一卡片层 | `--radius-card` |
| shell | `28px` | 页面底板、对话框 | `--radius-shell` |

chip、pill、按钮继续使用 `rounded-full`，不占档位。禁止新增 `rounded-[14px/16px/18px/22px/24px/26px/30px]` 等中间值。

## 4. 边框与阴影档位

- 边框 2 档：`--line-soft`（默认）/ `--line-strong`（选中、强调态）。
- 阴影：底板用全局类自带阴影；卡片只允许 `shadow-sm` 或无阴影；hover 态最多 `shadow-md`。禁止手写 `shadow-[...]` 任意值。

## 5. 颜色

暖纸色系全部保留。新代码禁止手写 `border-[rgba(...)]` / `bg-[rgba(...)]` 任意值，必须引用：

- CSS 变量：`--paper-main`、`--text-main`、`--text-dim`、`--text-faint`、`--line-soft`、`--line-strong`、`--amber` 等（见 `globals.css :root`）。
- Tailwind 命名色：`ink / sand / clay / paper / ember / line` 等（见 `tailwind.config.ts`）。
- 共享原语组件内封装的语义 class。

维度色（悦/实/思/改/谢）继续由 `src/features/calendar/presentation.ts` 投影，属于既有 token，不受本条限制。

## 6. 共享原语（src/components/ui/）

| 组件 | 职责 |
| --- | --- |
| `Surface` | 页面底板，吸收 `page-shell` / `calendar-shell` 差异 |
| `Card` | 唯一卡片原语，`interactive` 态自带 hover/focus-visible |
| `SectionHeading` | 眉题式分组标题（替代手写 `archive-label` 组合） |
| `Divider` | hairline 分隔线，横/竖两向 |
| `ActionButton` | primary / secondary / ghost 三态按钮 |
| `SlidingSegmentedControl` | 带滑块的 segmented 切换；变体 `soft / calendar / admin / underline` |
| `HorizontalPager` | 横向分页内容轨，与 segmented 联动；按需开启 `swipeable` 与 `onRequestChange` |
| `DimensionStatusDot` | 访谈维度状态灯（灰 / 黄呼吸 / 红 / 绿） |

页面组件不再手写卡片样式；需要新形态时先扩展原语，再使用。

## 8. 动效原语（2026-06-12）

滑块与分页动效统一走共享原语，禁止各页手写 thumb / track transition。

| 场景 | 控件 | 内容区 |
| --- | --- | --- |
| 分析页 8 要素雷达/棒棒糖 | `SlidingSegmentedControl` soft | `HorizontalPager` |
| 日历 月/周/日 | `SlidingSegmentedControl` calendar | URL 整页切换（不做 pager） |
| 画像 三 tab | `SlidingSegmentedControl` underline | `HorizontalPager` |
| 访谈五维 | `SlidingSegmentedControl` admin + `DimensionStatusDot` | `HorizontalPager` |
| 管理员 复盘/监控 | `SlidingSegmentedControl` admin | URL replace（不做 pager） |

动效参数：点击重定向采用无回弹 spring，响应窗口约 `0.32–0.4s`；拖动释放允许轻微边界阻尼并继承释放速度。`prefers-reduced-motion: reduce` 时统一降级为约 `160ms` 的交叉淡入淡出。样式类前缀：`.ui-segmented-control*`、`.ui-horizontal-pager*`（见 `globals.css`）。

## 7. 例外

- 访谈页消息气泡、`liquid-composer` 输入框、日志 `paper-sheet` 编辑面：已是目标形态，不动。
- 首页品牌广告页：营销排版，不受层级预算约束。
- 模态对话框（如删除确认）：算 shell 档，内部同样适用"卡片内禁再嵌套"规则。
