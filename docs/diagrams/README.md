# 访谈功能图谱

最后更新：`2026-08-05`

这组图面向产品讨论。阅读顺序先看静态能力，再看动态时序，随后按具体节点下钻。

跨会话讨论访谈优化时，先阅读[访谈产品优化地图](../interview-product-optimization-map.md)。它按用户结果划分五个核心模块，并标明模块依赖、衡量边界和当前讨论位置。

## 1. 总览

| 图 | 回答的问题 | 文件 |
|---|---|---|
| 访谈产品优化地图 | 后续产品优化按哪些模块推进，模块之间怎样相互影响 | [PNG](./interview-product-optimization-map.png) · [Draw.io](./interview-product-optimization-map.drawio) |
| 访谈功能架构图 | 当前访谈功能由哪些能力域组成 | [PNG](./interview-function-architecture.png) · [Draw.io](./interview-function-architecture.drawio) |
| 访谈主链时序图 | 用户进入、回复、恢复、生成日志和保存时，各模块如何协作 | [PNG](./interview-feature-sequence.png) · [Draw.io](./interview-feature-sequence.drawio) |
| Daily Light 版本一：五维度产品功能架构 | 五维度入口、访谈、日志、当天成果与长期沉淀由哪些功能域组成 | [PNG](./dailylight-v1-five-dimensions-function-architecture.png) · [Draw.io](./dailylight-v1-five-dimensions-function-architecture.drawio) |
| Daily Light 版本二：事件中心产品功能架构 | 事件入口、事件复盘、四个角度、事件日志与目标演进由哪些功能域组成 | [PNG](./dailylight-v2-event-center-function-architecture.png) · [Draw.io](./dailylight-v2-event-center-function-architecture.drawio) |

功能架构图只表达“有什么能力以及归属关系”。主链时序图只表达“这些角色按什么顺序协作”。

正式追问的按意图重新生成已进入主链：目标消息通过检查点恢复可替代路径，活动分支决定后续访谈、日志和日历读取的内容。交互、版本与发布事实见 [按意图重新生成](../interview-response-regeneration.md)。

事件中心目标产品的当前状态见[生成式访谈重构总 Map](../generative-interview-refactor-map.md)，板块 5 开放问题见[当前专项](../technical/interview-event-centered/05-board5-stability-user-control-and-interaction-scope.md)，评测与下游边界见[GI-074](../technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md)；现有两段式实现与日志闭环见[历史板块 7 Preview 候选交接](../technical/interview-event-centered/04o-board7-mvp-preview-candidate-handoff.md)，HTML 页面材料见[事件中心原型目录](../prototypes/interview-event-centered/README.md)。板块 8 的 Preview 与生产授权继续单独验收。

本轮更新的主图同时保留了可直接导回 Draw.io 的内嵌源数据 PNG：

- [访谈功能架构图](./interview-function-architecture.drawio.png)
- [访谈主链时序图](./interview-feature-sequence.drawio.png)
- [服务端输出控制图](./interview-server-output-control-architecture.drawio.png)
- [状态落库与恢复图](./interview-persistence-recovery-architecture.drawio.png)

## 2. 访谈节点

| 主题 | 产品关注点 | 文件 |
|---|---|---|
| 意图识别 | 系统如何区分正常内容、边界、整理日志、问题修复等表达，并通过 `legacy / shadow / enforce` 逐步启用 | [PNG](./interview-intent-recognition-functional-architecture.png) · [Draw.io](./interview-intent-recognition-functional-architecture.drawio) |
| 槽位提取 | 用户原话怎样形成五维结构化事件档案 | [PNG](./interview-slot-extraction-functional-architecture.png) · [Draw.io](./interview-slot-extraction-functional-architecture.drawio) |
| 证据校验与状态合并 | 候选槽位怎样经过确认、否认和状态合并 | [PNG](./interview-evidence-validation-state-merge.png) · [Draw.io](./interview-evidence-validation-state-merge.drawio) |
| 动作决策 | 系统怎样决定继续追问、收束、转维度或提供选择 | [PNG](./interview-action-decision-architecture.png) · [Draw.io](./interview-action-decision-architecture.drawio) |
| 追问目标规划 | 下一问需要补充哪类信息、采用什么回答难度 | [PNG](./interview-question-planning-architecture.png) · [Draw.io](./interview-question-planning-architecture.drawio) |
| 上下文与 Prompt | 当前状态、事件、对话和规则怎样组装为模型任务 | [PNG](./interview-context-prompt-architecture.png) · [Draw.io](./interview-context-prompt-architecture.drawio) |
| 模型生成 | 模型怎样生成思路摘要和候选问题 | [PNG](./interview-model-generation-architecture.png) · [Draw.io](./interview-model-generation-architecture.drawio) |
| 服务端输出控制 | 模型结果怎样经过检查、重写、兜底和流式输出 | [PNG](./interview-server-output-control-architecture.png) · [Draw.io](./interview-server-output-control-architecture.drawio) |
| 状态落库与恢复 | 用户原话怎样先保存，失败后怎样继续生成，会话怎样恢复 | [PNG](./interview-persistence-recovery-architecture.png) · [Draw.io](./interview-persistence-recovery-architecture.drawio) |

节点六至节点十另有文字事实说明：

- [节点六：上下文与 Prompt](../../artifacts/interview-nodes/node6/analysis.md)
- [节点七：模型生成](../../artifacts/interview-nodes/node7/analysis.md)
- [节点八：服务端检查与输出控制](../../artifacts/interview-nodes/node8/analysis.md)
- [节点九：前端流式接收与展示](../../artifacts/interview-nodes/node9/analysis.md)
- [节点十：状态落库与恢复](../../artifacts/interview-nodes/node10/analysis.md)

这些说明用于产品理解，代码与 [系统架构文档](../architecture.md) 继续作为当前事实源。
