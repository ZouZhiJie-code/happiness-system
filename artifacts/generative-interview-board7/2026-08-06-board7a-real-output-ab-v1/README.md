# GI-081｜板块 7A 六题真实输出资产入口

状态：`18/18 次基础生成完成；技术重试 0；质量重试 0；等待产品负责人完成盲评与架构揭晓`

用途：比较单次结构化生成与“语义判断＋表达生成”两种离线候选结构，为板块 6B 提供真实模型问题。该目录只承担诊断证据，板块 7 正式实现继续等待板块 6。

本目录包含三条已核验的隔离 Preview 真人决策点。材料仅用于内部评测，外部分享前需要再次检查脱敏和授权范围。

## 产品负责人当前入口

- [六题盲评填写文件](./board7a-six-case-ab-v1-blind-review-run.md)

盲评完成前，保持架构映射和 Codex 独立判断封存。

## 运行前冻结快照

- [候选确认包](./board7a-six-case-ab-v1-confirmation.md)
- [完整 Prompt](./board7a-six-case-ab-v1-prompts.md)
- [历史来源只读核验](./board7a-six-case-ab-v1-source-readback.md)
- [运行前盲评模板](./board7a-six-case-ab-v1-blind-review.md)
- `board7a-six-case-ab-v1-manifest.json`
- `board7a-six-case-ab-v1-approval-template.json`

这些文件保存调用前的范围、指纹、预算和授权状态。文件中的“模型调用 0”“等待运行”等状态属于冻结快照，运行完成后继续原样保留。

## 运行与技术证据

- `board7a-six-case-ab-v1-approval.json`
- `board7a-six-case-ab-v1-budget.json`
- `board7a-six-case-ab-v1-run.checkpoint.json`
- `board7a-six-case-ab-v1-run.json`
- `board7a-six-case-ab-v1-preflight-incidents.json`

## 盲评完成后使用

- [Codex 独立盲评封存件](./board7a-six-case-ab-v1-codex-review-sealed.md)
- `board7a-six-case-ab-v1-reveal.json`

揭晓后分别检查候选 A、B 的单例阻断、`4/6` 可用门槛和普通质量失败数量。完整轨迹仍需产品负责人另行授权。

Production 继续保持 `legacy + baseline`。
