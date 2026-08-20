# 板块 7｜Provider v71 语义骨架首轮运行报告

- 运行日期：`2026-08-02`
- 用户授权：`授权运行首轮六例`
- 候选：策略 `5.49.0`；第一段 `v71-semantic-skeleton`；第二段 `v71-visible`；`deepseek-v4-flash`；两段式；thinking 关闭
- 运行范围：确认包中的六个首轮场景
- 终局状态：`技术中止 / stop`

## 实际消耗

- 只读模型预检：`1`
- 生成请求：`3`
- 已运行场景：`1/6`（`SF4-F-READY-01`）
- 未运行场景：`5/6`
- 账本状态：`aborted`，同一首轮预算已封存

证据见：[预算账本](../2026-08-01/board7-provider-v71-semantic-frame-first-pass-budget.json)、[授权记录](./board7-provider-v71-semantic-frame-first-pass-approval.json) 和 [逐场景 checkpoint](./board7-provider-v71-semantic-frame-first-pass-run.checkpoint.json)。

## 已运行场景

`SF4-F-READY-01` 的第一段成功返回 `ready → complete`，事实证据可追溯。第二段两次均返回自然中文成果回应，但顶层成功状态写为 `expressible`；当前结构协议只接受 `ok` 或 `cannot_express`，两次均触发 `INVALID_SCHEMA`。因此整轮按既定停止规则中止。

这次运行暴露两层问题：

1. 技术协议：第二段 Prompt 未把成功状态的固定值 `ok` 写明，模型稳定使用 `expressible`；已补充离线 Prompt 契约与回归测试，当前预算不再重跑。
2. 产品判尺：本例预期属于 `user_articulated`，现有兼容映射因两条证据和一条关系投影为 `ai_synthesized`。来源分流的系统判定仍需在下一轮计划中复核。

第二段没有形成可接受的结构化用户可见结果，因而本轮不产出质量通过结论，也不将原始自然文本计为用户体验通过。

## 当前结论与停止边界

- 首轮六例未达到技术完整门，板块 7 保持“落地验证阻断”。
- 隐藏集、工作集、准入、盲评和板块 8 继续等待。
- 后续模型运行需要新的确认包与独立预算授权。
- Production 继续 `legacy + baseline`。
