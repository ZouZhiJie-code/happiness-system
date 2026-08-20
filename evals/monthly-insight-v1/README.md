# 月度个性化洞察 v1 隔离候选

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-19`
- 权威入口：[`DL-PROD-20260819`](../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 边界

该候选只消费当前事件中心月度成果投影、评分趋势和日期引用。原始完整对话不进入候选输入，Production 的确定性 `AnalysisNarrative` 保持不变。

记录少于 3 天或已保存成果少于 3 条时，程序直接返回确定性说明，模型调用为 0。满足门槛的用例最多调用 12 次，并发 1、单次尝试 1、重试 0、最大 completion Token 1200。

## 资产

- [`start-card.json`](./start-card.json)：冻结决策、身份、权限、预算和停止点；
- [`prompt.md`](./prompt.md)：候选 Prompt；
- [`skill.md`](./skill.md)：内容边界与写作要求；
- [`synthetic-cases.json`](./synthetic-cases.json)：6 个程序边界月；
- [`contract.ts`](./contract.ts)：严格输出合同和来源／日期校验；
- [`manifest.json`](./manifest.json)：当前准备状态和运行边界。

## 当前停止点

候选代码与合成夹具完成本地验证后，先读取已发布 Chat Provider 的脱敏配置指纹，再校验最多 6 个内部账号真实用户月的样本级授权。私有材料只进入 `artifacts/production-evidence-hardening/2026-08-19/monthly-insight-v1/.private/`。模型执行与产品负责人逐例裁决仍按启动卡停止门推进。
