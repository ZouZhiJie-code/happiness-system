# 访谈意图评测资产

产品目标、数据集设计、上线门槛和更新规则统一参考：

- [访谈意图评测与上线事实源](../../docs/interview-intent-evaluation-source-of-truth.md)

## 当前资产

| 资产 | 用途 |
|---|---|
| `v1/seed-cases.json` | 第一批40条开发集案例 |
| `v1/formal-variants.json` | 开发集与验证集的语义家族变体 |
| `v1/blind-cases.json` | 当前第七轮封存盲测案例 |
| `v1/external-review-cases.json` | 24条独立产品评审案例；当前已完成评审并转入回归治理 |
| `reports/` | 保存每个重要版本的基线与上线评测报告 |
| `reviewer/generated/gold-dataset-120.json` | 物化后的120条意图金标准 |
| `reviewer/generated/review-packet-blind-hybrid.json` | 隐藏标准答案的24条独立评审候选结果 |
| `reviewer/generated/review-packet-external-review-hybrid.json` | 面向外部评审人的新24条隐藏金标准候选结果 |
| `reviewer/results/2026-07-20-execution-side-review.json` | 24条执行侧人工复核的逐条结果 |
| `reviewer/results/2026-07-21-internal-external-set-review.json` | 新封存集24条内部逐项复核结果 |
| `reviewer/results/2026-07-21-independent-intent-review.json` | 产品负责人完成的24条独立评审结果 |

## 案例维护规则

1. 每条案例使用稳定编号 `INT-EVAL-001`。
2. 案例内容同时描述产品期望和可检查结果。
3. 同义改写使用相同或可追溯的 `semanticFamily`。
4. 新案例先进入开发集。
5. 经过产品和理论复核后更新案例版本。
6. 数据集规模、划分和门槛变化同步更新事实源。
7. 盲测失败案例转入开发回归，并使用新编号、新表达补位。

## 运行入口

```bash
npm run eval:interview-intent
npm run eval:interview-intent:core
```

运行结果会逐条展示案例是否通过。P0案例全部通过、P1达到事实源门槛后，版本才能进入下一发布阶段。

当前正式回归版本为 `intent-eval-v1.0+intent-eval-v1.7-blind-adjudicated`，规则层评测达到`120/120`，规则＋模型评测连续3次达到`24/24`。

共享Preview稳定地址为`https://xingfuxitong-zouzhijie-code-zouzhijies-projects.vercel.app`，意图评审路径为`/intent-review`。共享访问密钥由Vercel单独管理，不写入评测资产。

当前发布判断：

- [正式离线上线门槛报告](./reports/2026-07-20-formal-release-gate.md)：通过。
- [意图识别核心评测报告](./reports/2026-07-20-intent-core-release-gate.md)：自动化核心门槛通过。
- [执行侧人工复核报告](./reports/2026-07-20-intent-execution-side-review.md)：核心加权分98.1%，发现3条字段偏差和1条合理歧义，相关裁决现已完成。
- [四条分歧裁决报告](./reports/2026-07-20-intent-adjudication-resolution.md)：裁决与修正完成，真实模型连续3次24/24。
- [新外部评审封存记录](./reports/2026-07-21-external-review-seal.md)：保留24条候选结果与完整性指纹的评审前证据。
- [新封存集内部复核报告](./reports/2026-07-21-internal-external-set-review.md)：19条正确、4条部分正确、1条错误，加权分94.2%，暂缓进入线上对照观察。
- [独立产品评审报告](./reports/2026-07-21-independent-intent-review.md)：23条完全正确、1条P1内容边界问题，P0为10/10，加权分99.17%，核心门槛通过。
- [五维采用与20轮运行观察](./reports/2026-07-21-preview-adoption-and-20-turn-observation.md)：五维5/5，普通访谈20/20，服务端P50为9.17秒、P95为9.99秒。
- [五维Preview体验报告](./reports/2026-07-20-preview-experience-gate.md)：P0通过，P1待优化。
- [全量发布报告](./reports/2026-07-21-production-enforce-release.md)：`INT-EVAL-252`已修正，正式环境已使用`enforce`全量启用新意图识别。
