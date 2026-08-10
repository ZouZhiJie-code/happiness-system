# 事件中心重构 HTML 原型

本目录保存事件中心重构四个产品批次的可操作 HTML 设计材料。

当前对照口径：Batch C 已形成冻结实现对照并已接入 MVP 候选；板块 7交接以 [04o｜板块 7 生成式访谈 MVP Preview 候选交接](../../technical/interview-event-centered/04o-board7-mvp-preview-candidate-handoff.md) 为准，Batch D 的发布验收由板块 8单独承接。

## 文件约定

```text
batch-a-core-runtime.html
batch-b-ai-interview.html
batch-c-outcomes-and-pages.html
batch-d-release-observability.html
```

对应批次进入正式前端开发前创建 HTML 文件；已完成批次继续保留 HTML 作为实现对照，确保原型使用该批次已经确认的产品规则和最新页面实现。

当前原型：

- `batch-a-core-runtime.html`：事件标签、三阶段进度、访谈工作台与日历适配。
- `batch-b-ai-interview.html`：第一/第二检查点、四角度中度复盘、深度回应、问题修复、回复版本与失败恢复。内含三套检查点/成果呈现方案，推荐使用「A · 对话内纸笺」；其中事件日志区域保留为 Batch C 接入前的历史原型状态。
- `batch-c-outcomes-and-pages.html`：事件日志生成、技术降级、编辑、700ms 自动暂存、正式保存、刷新恢复、再记一件和移动端底部 sheet 的冻结实现对照。

## 原型要求

1. 一份 HTML 集中承载当前批次的完整用户流程。
2. 同一场景支持切换两至三个关键布局或交互方案。
3. 使用现有暖纸色视觉系统、尺寸、圆角、边框和动效基线。
4. 标注直接复用、扩展和新增内容。
5. 根据批次范围模拟空白、进行中、检查点、生成中、完成、失败和恢复状态。
6. 提供推荐方案、选择原因和各方案主要取舍。
7. HTML 通过键盘操作、焦点可见、对比度和 reduced-motion 基础检查。

HTML 用于产品设计选择。方案确认后，正式页面继续复用`src/components/ui/`、现有访谈组件、日志工作区和日历组件。
