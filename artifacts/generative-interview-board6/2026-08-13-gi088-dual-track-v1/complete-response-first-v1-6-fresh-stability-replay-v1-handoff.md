# GI-088 v1.6 新案例稳定性复验结果交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈重构总 Map](../../../docs/generative-interview-refactor-map.md)

## 结果

- 运行身份：`2026-08-20.gi088-complete-response-first-v1-6-fresh-stability-replay-v1`。
- 预算：`12/16` 已消费并完成，剩余 `4 not_run`；重试、恢复和回退均为 `0`。
- 六条可见回应均为 `technical_valid`；中位 `3277ms`、最长 `4916ms`、最高 completion `96/1280`。
- 前五条后台事实为 `technical_valid`；第六条 `RPR-REAL-20` 为 `program_gate_failure`；后台中位 `5886.5ms`、最长 `16816ms`、最高 completion `1437/1600`，均未截断。
- 停止原因：一条后台事实引用在语义字符上与用户原文一致，但把原文逗号改成句号，触发 `FACT_QUOTE_NOT_IN_SOURCE_USER_MESSAGE`。其余字符未变化，未观察到来源编造。
- 六条可见回应的内容初评和产品裁决尚未封存；本轮停止标签只覆盖后台来源合同。

## 下一步

新候选只增加空白／标点来源对齐：实质字符必须连续、逐字、唯一匹配，最终证据由程序从用户原文截取。前六条可见回应保持冻结，补完两条可见回应后对八题后台事实重新验证。

页面、Preview、提交、推送、部署与 Production 切换均未运行；Production 保持 `event_centered + baseline`。
