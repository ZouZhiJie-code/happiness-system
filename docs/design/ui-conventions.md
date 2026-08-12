# UI 设计规范：单层卡片与流动交互

最后更新：`2026-08-12`

本文件是 **[DESIGN.md](../../DESIGN.md) 的工程实现附录**：容器层级、圆角/边框 token、共享原语与交互验收基线。创意方向与页面形态以 DESIGN.md 为准；`docs/plans/` 中的设计稿保留历史决策过程。

本规范约束全站产品界面的视觉容器结构，包含访谈消息区、日记、日历、分析、设置和管理员页面。首页品牌区按营销叙事单独处理。

## 1. 层级预算（核心规则）

每个页面最多两层视觉容器：

1. **底板（Surface）**：每页只有一个，承载页面环境和必要边界。对应 `page-shell` / `calendar-shell` 全局类。
2. **卡片（Card）**：底板之内最多一层。卡片内部禁止再出现任何带 `border + 背景色` 的容器；内部分区只允许：
   - 文字层级（标题字号/字重/颜色）
   - 留白（spacing）
   - chip / badge / pill（小型行内标签，不算容器层）
   - `InlineStatus` / `SourceDrawer` 这类承担明确交互职责的紧凑原语

Divider 只用于重复列表、表格或相邻操作区的明确边界。标题、空状态、说明文案和普通内容段落通过字号与留白分组。

被废弃的中间层：`paper-sheet` 包裹内容区、`calendar-panel` 作为 shell 与 card 之间的过渡层、`calendar-card-muted` 作为卡片内子卡。日记与周期报告正文使用单一 `ReadingSurface`。

## 2. 卡片资格

只有以下两类元素才允许成为卡片：

- **可点击单元**：日历天卡、评分要素按钮、热力日格、维度操作行等，需要 hover/focus 反馈的交互实体。
- **需要从背景突出的数据单元**：如评分趋势图、维度洞察卡这类需要边界感的独立内容块。

纯信息分组（说明文案、配置摘要、统计列表、表单分区）不配卡片，使用 `SectionHeading + 留白` 表达。重复列表项之间可以使用 Divider。

## 3. 圆角档位（3 档）

| 档位 | 值 | 用途 | CSS 变量 |
| --- | --- | --- | --- |
| control | `12px` | 按钮、输入件、小型可点 tile、卡片内图表容器 | `--radius-control` |
| card | `20px` | 唯一卡片层、消息、阅读面 | `--radius-card` |
| shell | `28px` | 页面底板、对话框 | `--radius-shell` |

chip、badge 和紧凑筛选项可以使用 `rounded-full`。按钮统一使用 control 档。禁止新增 `rounded-[14px/16px/18px/22px/24px/26px/30px]` 等中间值。

## 4. 边框与阴影档位

- 边框 2 档：`--line-soft`（默认）/ `--line-strong`（选中、强调态）。
- 阴影：普通内容、消息、阅读面与静态卡片无阴影；交互卡片 hover 最多 `shadow-sm`；菜单和对话框等浮层按层级使用轻阴影。禁止手写 `shadow-[...]` 任意值。

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
| `PageHeading` | 页面唯一主标题；工作台用 UI 字体，日记和报告可选 display |
| `SectionHeading` | 20px 分区标题或 16px 条目标题，不自动附加装饰线 |
| `InlineStatus` | 与当前操作贴近的加载、成功、提醒和失败状态 |
| `ReadingSurface` | 日记与周期报告的单一阅读面，正文使用 body 衬线 |
| `SourceDrawer` | 按需展开来源与生成细节 |
| `Divider` | 重复列表、表格或明确操作区的边界，横/竖两向 |
| `ActionButton` | primary / secondary / ghost 三态按钮 |
| `SlidingSegmentedControl` | 带滑块的 segmented 切换；变体 `soft / calendar / admin / underline` |
| `HorizontalPager` | 横向分页内容轨，与 segmented 联动；按需开启 `swipeable` 与 `onRequestChange` |
| `DimensionStatusDot` | 访谈维度状态灯（灰 / 黄呼吸 / 红 / 绿） |
| `ActionMenu` | 自适应上下展开、方向键导航与焦点恢复 |
| `ConfirmDialog` | 焦点圈定、Escape、危险操作安全初始焦点与焦点恢复 |

页面组件不再手写卡片样式；需要新形态时先扩展原语，再使用。

## 7. 字体与字号

- 工作台、导航、聊天、按钮、输入、状态与工具信息默认继承 `font-ui`。
- 日记和周期报告标题显式选择 `font-display`；正文由 `ReadingSurface` 使用 `font-body`。
- 页面标题：紧凑桌面 `28px`，大桌面 `32px`；每个主画布只保留一个。
- 分区标题：`20px`；条目标题：`16px`；正文：`15px`；辅助信息：`13px`。
- 标题下最多保留一句说明；状态文案只表达当前结果与下一步动作。

## 8. 即时反馈

- `ActionButton`、header 动作、交互卡片、导航项和日历格统一提供 pointer-down 反馈。
- 按钮缩放约 `0.97`，大卡片缩放约 `0.985`；disabled / `aria-disabled` 保持静止。
- 反馈只使用 `transform / opacity / color / box-shadow`，避免触发布局重排。
- `button` 与主要交互原语统一使用 `touch-action: manipulation`，横向分页容器使用 `touch-action: pan-y`。

## 9. 动效原语

滑块与分页动效统一走共享原语，禁止各页手写 thumb / track transition。

| 场景 | 控件 | 内容区 |
| --- | --- | --- |
| 分析页 8 要素雷达/棒棒糖 | `SlidingSegmentedControl` soft | `HorizontalPager` |
| 日历 日/周/月 | `SlidingSegmentedControl` calendar | URL 整页切换（不做 pager） |
| 画像 三 tab | `SlidingSegmentedControl` underline | `HorizontalPager` |
| 访谈五维 | `SlidingSegmentedControl` admin + `DimensionStatusDot` | 保留业务状态切换；按页面配置决定是否使用 pager |
| 管理员 复盘/监控 | `SlidingSegmentedControl` admin | URL replace（不做 pager） |

动效参数：点击重定向采用无回弹 spring，响应窗口约 `0.32–0.4s`；拖动释放使用约 `10px` 原始位移判定、1:1 跟手、速度投影和轻微边界阻尼。`prefers-reduced-motion: reduce` 时关闭拖动，并把 spring 收敛为约 `160ms` 的短缓动；弹层使用短透明度过渡。样式类前缀：`.ui-segmented-control*`、`.ui-horizontal-pager*`（见 `globals.css`）。

## 10. 响应式工具栏与弹层

- 小于 `1024px` 时，`SiteHeader` 使用“品牌与主导航 + 上下文工具栏”两行布局。
- 上下文工具栏使用横向滚动和左右渐隐边缘；选中的分析段落和 segmented 项在溢出时滚入可见区域。
- 日志书页桌面从右侧进入；移动端从底部进入，并支持向下拖动关闭。
- `ActionMenu` 根据触发点上下空间自动翻转；支持 ArrowUp / ArrowDown / Home / End / Escape。
- `ConfirmDialog` 圈定 Tab 焦点，关闭后恢复触发元素焦点；危险操作默认聚焦取消按钮。

## 11. 环境偏好

- `prefers-reduced-motion: reduce`：关闭平滑滚动、横向拖动和缩放按压，spring 改为短缓动，弹层保留短透明度过渡。
- `prefers-reduced-transparency: reduce`：顶栏、输入区、菜单和弹窗改用近实色背景，关闭 blur。
- `prefers-contrast: more`：提升 `--line-soft / --line-strong / --text-dim / --text-faint` 对比度。
- 工具文字、状态和图表标签使用系统 UI 字体；新增或调整的核心控制字号最低 `13px`，非关键刻度与装饰标记可按空间单独评估。

## 12. 例外

- 首页品牌广告页：营销排版，不受层级预算约束。
- 模态对话框（如删除确认）：算 shell 档，内部同样适用"卡片内禁再嵌套"规则。
