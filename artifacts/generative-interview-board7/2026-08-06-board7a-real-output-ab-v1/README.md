# GI-081｜板块 7A 六题真实输出资产入口

状态：`产品盲评与架构揭晓已完成；证据身份固定为 GI-081 临时 Prompt 下的诊断基线；当前不选择架构`

用途：保存临时 Prompt 下单次结构化生成与“语义判断＋表达生成”两种调用结构的真实输出、人工裁决和失败证据，为板块 6B 提供真实问题。该目录只承担诊断基线，无法证明正式 Prompt 正确或裁决正式架构胜出；板块 7 正式实现继续等待板块 6。

本目录包含三条已核验的隔离 Preview 真人决策点。材料仅用于内部评测，外部分享前需要再次检查脱敏和授权范围。

## 当前结论入口

- [产品负责人盲评封存](./board7a-six-case-ab-v1-product-review.md)
- [架构揭晓、双方对照与方法结论](./board7a-six-case-ab-v1-reconciliation.md)
- [六题原始盲评填写文件](./board7a-six-case-ab-v1-blind-review-run.md)

六题中 T1、T2 从用户首条输入开始；H1、H2、H3、T3 只承担给定上下文后的条件式局部诊断。当前数字门槛不承担架构胜出或完整轨迹授权。

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

## 独立评审与揭晓证据

- [Codex 独立盲评封存件](./board7a-six-case-ab-v1-codex-review-sealed.md)
- `board7a-six-case-ab-v1-reveal.json`

候选 A、B 均机械达到 `4/6` 可用门槛；证据有效性复核后，架构胜出继续保持开放。完整轨迹仍需产品负责人另行授权。

Production 继续保持 `legacy + baseline`。
