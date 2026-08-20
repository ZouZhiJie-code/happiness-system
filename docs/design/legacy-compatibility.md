# Daily Light 旧页面兼容与紧急回退边界

最后更新：`2026-08-13`

## 1. 目的

本文件集中记录退出目标产品主文档的旧入口、旧组件、适用环境和退出条件。它服务历史数据读取、回归检查和 Production 紧急回退。

Production 当前使用 `event_centered + baseline`。目标产品的视觉 Preview、隔离测试数据库和正式发布分别使用独立授权门；上一正式部署与 `legacy + baseline` 继续承担紧急回退。

## 2. “旧 Calendar”的精确定义

“旧 Calendar”包括：

- 旧五维月历、七天周操作台和五维日操作台。
- 悦／实／思／改／谢维度状态卡、对应日格和旧完整日志入口。
- 旧 Calendar 专属的卡片层级、状态色和页面布局。

目标产品继续使用：

```text
/calendar?view=day|week|month&date=YYYY-MM-DD
```

该地址承载新版日记、周记、月记及其归档侧栏和开放式时间轴，属于当前目标产品。

## 3. 旧能力清单

| 范围 | 旧入口／组件 | 当前用途 | 适用环境 | 退出条件 |
| --- | --- | --- | --- | --- |
| 五维访谈 | joy／fulfillment／reflection／improvement／gratitude 入口与工作台 | 历史数据回看与紧急回退 | 回退模式 `legacy + baseline` | 新版记录链路持续稳定、回退窗口结束并获得清理授权 |
| 旧 Calendar | 五维月／周／日操作台与相关展示组件 | 历史读取与紧急回退 | 回退模式与内部回归 | 新版 `/calendar` 持续稳定、历史读取核验完成并获得清理授权 |
| 旧完整日志 | `DailyJournalEntry` 与五维整合日志页面 | 已保存历史内容只读回看、周期素材兼容 | Production、数据迁移验证 | 历史内容可在新版日记【历史记录】稳定读取且回退演练通过 |
| 旧分析 | `/analysis?section=trends|dimensions`、幸福评分与五维聚合 | Production 分析页和旧数据核对 | Production、管理员回归 | `/insights` 新版趋势与画像通过真实数据验收并获得发布授权 |
| 旧画像 | `/profile` 与旧分页／滑动结构 | 历史画像读取与兼容跳转 | Production | `/profile` 到新版画像映射通过，旧数据继续可追溯 |
| 旧记忆 | 旧记忆接口与演示内容 | 内部兼容和历史证据 | 内部页面 | 新记忆系统完成产品专项与独立发布 |
| 历史视觉候选 | 旧高保真 Preview、双栏候选和截图 | 工程对照与问题复盘 | 本地／受保护 Preview | 保留只读证据，不进入目标设计规范 |

## 4. 兼容设计规则

以下规则只允许在旧组件和回退环境继续存在：

- 五维 segmented 与维度色身份。
- 旧分析页的趋势／五维记录锚点、横向分页和幸福评分呈现。
- 旧 Calendar 的月格、周板和五维日卡。
- 旧完整日志右侧书页和历史候选的页面层级。
- 历史接口需要的旧名称和状态映射。

新页面不复制这些结构。目标设计合同统一从 [DESIGN.md](../../DESIGN.md) 和 [ui-conventions.md](./ui-conventions.md) 读取。

## 5. 回退要求

- 回退只切换用户入口、运行模式和兼容路由，保留新版产生的数据。
- 回退前确认旧读取链路能够忽略或安全承接新版数据。
- 视觉候选、隔离数据库结果和自动化通过不构成回退删除依据。
- 每次 Production 切换都需要记录目标版本、上一版本、数据库兼容、恢复步骤和产品负责人授权。

当前回退点：

- 上一正式 deployment：`dpl_ATtwPhXLvmHURAutRzKyimNSWyir`；
- 入口模式：`INTERVIEW_EVENT_CENTERED_MODE=legacy`；
- 访谈策略：`INTERVIEW_EVENT_CENTERED_STRATEGY=baseline`；
- 新版数据与五条新增迁移均保留，回退期间只切换入口和部署，不删除数据。

## 6. 文档维护

新增目标产品规则进入 DESIGN 或 ui-conventions。新增旧页面事实进入本文件。历史候选的详细证据继续保留在对应 `docs/plans/` 与 `artifacts/`，本文件只维护可执行的兼容范围和退出条件。
