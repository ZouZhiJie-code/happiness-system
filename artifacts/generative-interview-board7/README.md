# Board 7 评测与候选资产索引

最后更新：`2026-08-10`

当前状态：`v7 两条真人连续轨迹已封存；v7r1 Prefix 兼容 No-Go；v7r2 Ark Flash 本地实现与自动验证通过，等待 Preview 回读和 0/2 空白批次`

## 当前入口

- [GI-088 v7r2｜Thinking high Ark Flash](./2026-08-10-gi088-human-eval-v7r2-ark-flash/README.md)
- [v7r2 manifest](./2026-08-10-gi088-human-eval-v7r2-ark-flash/gi088-human-eval-v7r2-ark-flash-manifest.json)
- [v7r2 静态验证](./2026-08-10-gi088-human-eval-v7r2-ark-flash/gi088-v7r2-ark-flash-static-validation.md)

当前候选固定使用 Ark REST `deepseek-v4-flash-ga-260731`、Thinking high 与 `json_object`。本地实现和自动验证已经通过；Preview 部署、页面回读和 `running 0/2` 空白批次仍待完成。Production 继续保持 `legacy + baseline`。

## 直接上游证据

- [v7 连续性底座封存结论](./2026-08-09-gi088-human-eval-v7-continuity-baseline/README.md)
- [v7 连续性静态验证](./2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-v7-continuity-static-validation.md)
- [v7r1 Prefix 兼容 No-Go](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/README.md)
- [v7r1 manifest](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-human-eval-v7r1-visible-continuation-manifest.json)
- [Flash / Pro 脱敏聚合结果](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-flash-pro-model-comparison-v1-result.json)
- [Flash / Pro 对照结论](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-flash-pro-model-comparison-v1-decision.md)
- [Ark Flash 平台对照结论](./2026-08-10-gi088-human-eval-v7r1-visible-continuation/gi088-ark-flash-platform-probe-v1-decision.md)

## GI-088 历史候选

- [v6 单一回答焦点](./2026-08-09-gi088-human-eval-v6-single-focus/README.md)
- [v5 High-only 可靠性](./2026-08-09-gi088-human-eval-v5-high-reliability/README.md)
- [v4 阶段转场](./2026-08-09-gi088-human-eval-v4-stage-transition/README.md)
- [v3 空正文恢复](./2026-08-09-gi088-human-eval-v3-empty-recovery/README.md)
- [v2 diagnostic](./2026-08-09-gi088-human-eval-v2-diagnostic/README.md)
- [v1 真人交互开发评测集](./2026-08-09-gi088-human-eval-v1/README.md)
- [v0 运行器与 Token 上限失败历史](./2026-08-08-gi088-human-eval-v0/README.md)

这些目录只公开版本说明、脱敏 manifest、最终裁决、静态验证和聚合探针结论。公开副本会把可关联运行记录的 UUID 替换为 `redacted-operational-id`；包含真人逐字输入、Trace 定位符或完整请求的 manifest、运行计划、脚本和测试持续留在 `artifacts/local-runtime/`。

## 实现血缘

- [GI-084 基础 Prompt 与 Interview Skill](./2026-08-07-board7b-prompt-skill-v0/README.md)
- [GI-085 semantic-frame-first](./2026-08-07-board7b-semantic-frame-v1/README.md)
- [GI-086 Thinking 能力校准说明](./2026-08-07-board7b-thinking-capability-v1/README.md)
- GI-087 的公开包只保留 Prompt、Skill、输出合同、manifest 和来源规则；真实历史摘录、真人结果与逐字输入留在本机受控目录。

历史候选继续承担回归和归因职责。当前产品事实以总 Map 与 v7r2 入口为准。
