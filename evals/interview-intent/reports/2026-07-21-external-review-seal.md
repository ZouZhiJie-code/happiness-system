# 访谈意图外部独立评审封存记录

日期：`2026-07-21`

评审数据版本：`intent-eval-v1.8-external-sealed`

候选版本：`interview-intent-v1`

## 1. 封存目的

上一组24条案例已经参与执行侧复核和产品裁决，继续承担长期回归职责。本轮新增24条未参与规则优化的表达，用于外部评审人独立判断候选版本的真实泛化表现。

## 2. 覆盖范围

- 共24条，编号`INT-EVAL-229`至`INT-EVAL-252`。
- 覆盖明确控制、内容与控制混合、上下文短回答、引用转述与修正、压力反馈、恢复语境六类场景。
- 覆盖开心、充实、思考、改进、感谢五个维度。
- 包含10条P0和14条P1案例。
- 评审页面只展示上一句问题、用户原话和系统意图结果，金标准持续隐藏。

## 3. 候选结果冻结

- 最终候选结果由19条规则＋模型合并结果和5条确定性结果构成。
- 19次模型调用全部返回合法结构化结果，未发生provider fallback。
- 独立评审完成前，当前24条不参与规则、提示词和金标准调整。

## 4. 完整性指纹

| 资产 | SHA-256 |
|---|---|
| `v1/external-review-cases.json` | `1ee5821a8b2d38e5a345cb252888d1b0e6e2561f8a62f337c7997452bd5c0680` |
| `reviewer/generated/review-packet-external-review-hybrid.json` | `aa59afa74d5fc5f1109c9314cb84a5e95c92adcb59653a4d89e297437c65a927` |

任何影响案例或候选结果的修改都会改变指纹，并需要重新登记为新的评审版本。

## 5. 验收入口

- 共享Preview稳定地址：`https://xingfuxitong-zouzhijie-code-zouzhijies-projects.vercel.app`
- 评审路径：`/intent-review`
- 当前部署：`dpl_G2tKukBcsaapnTSNPzyiANuduUxA`
- 当前部署状态：`Ready`
- 共享访问密钥和隔离评审账号通过本次验收单独交付，不写入仓库。

## 6. 当前状态

候选结果已冻结并发布。产品负责人随后授权当前执行主体直接完成24条评分，结果记录在`2026-07-21-internal-external-set-review.md`。该结果用于产品修正和发布判断，并保留内部复核属性；外部独立评审可按后续对外证据需要补充。
