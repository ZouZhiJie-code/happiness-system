# Tech Design

> 历史设计摘要。
> 从 `2026-04-29` 起，这个文件不再作为实时事实源。

当前 canonical 文档请看：
- `README.md`
- `AGENTS.md`
- `docs/architecture.md`
- `docs/integration-guide.md`
- `docs/operator-runbook.md`
- `docs/handoff.md`
- `docs/theory/joy-alignment.md`
- `docs/theory/fulfillment-alignment.md`
- `docs/theory/reflection-alignment.md`
- `docs/theory/improvement-alignment.md`
- `docs/theory/gratitude-alignment.md`
- `docs/theory/dimension-draft-template.md`

## 1. 为什么保留这个文件

这个文件保留是为了说明项目最初的设计目标和演进背景，而不是为了描述当前代码的全部事实。

最初设计关注的是：
- 用 AI 访谈替代手写幸福日志
- 先把 `joy` 维度做通
- 保持流程可控、可恢复、可测试

这些原则现在仍然有效，但代码已经明显超出最初草案：
- 已进入多维度通用框架
- joy / fulfillment / reflection / improvement / gratitude 已完成理论对齐深化
- 日志工作区已经从结构摘要转向正文优先

## 2. 当前与原始设计稿的主要差异

### 2.1 维度范围

原始设计稿默认“第一版只实现 joy”。

当前真实代码是：
- 五个维度枚举和前端壳子都已经存在
- joy / fulfillment / reflection / improvement / gratitude 已完成理论对齐深化
- improvement / gratitude 已完成理论规格、结构字段扩展、AI 抽取独立化、fallback 抽取、访谈推进、专属提问策略、完成收束、正文生成、质量门、fallback draft 和标题治理，但仍需要端到端产品验收与文风打磨

### 2.2 数据结构

原始设计稿主要围绕 legacy joy 字段：
- `event`
- `feeling`
- `whyItMattered`
- `happinessType`
- `selfPattern`

当前真实代码已经加入：
- `snapshotData`
- `payload`
- joy 专属细槽位
- `pendingDecision`
- 事件级 `progressData`

### 2.3 日志工作区

原始设计稿还没有当前这套完整交互定义。

当前真实产品行为是：
- 右侧日志面板只保留关闭按钮和正文编辑区，不再展示“日志”标题
- 用户只看对话和日志正文
- 结构化线索只保留在系统内部
- 再生成已有 draft 时保留旧稿，并在完成后自动替换

### 2.4 API 面

原始设计稿里的接口清单已经过时。

当前请以 `docs/integration-guide.md` 为准，特别是：
- 已存在 `respond/stream`
- 已存在 `pause / complete / reopen`
- 已存在 `draft/generate / draft/save`
- 已存在 `journal-entry/[id]`

## 3. 仍然成立的核心原则

虽然这个文件不再是事实源，但这些原则仍然成立：
- 不允许只靠 prompt 控制访谈流程
- 关键 AI 输出必须结构化校验
- 会话必须可恢复
- 日志生成必须可以编辑后再保存
- 产品重点不是“会聊天”，而是“稳定完成日志记录”

## 4. 接下来如果要看什么

如果你是：

- 想看当前代码怎么工作
  去 `docs/architecture.md`

- 想看真实接口
  去 `docs/integration-guide.md`

- 想看本地怎么启动和排障
  去 `docs/operator-runbook.md`

- 想看 joy / fulfillment / reflection / improvement / gratitude 维度为什么现在这样设计
  分别看：
  - `docs/theory/joy-alignment.md`
  - `docs/theory/fulfillment-alignment.md`
  - `docs/theory/reflection-alignment.md`
  - `docs/theory/improvement-alignment.md`
  - `docs/theory/gratitude-alignment.md`
