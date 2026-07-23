# Batch C｜AI 内容评测与发布前抽检

## 1. 为什么建立这层评测

Batch C 把访谈成果变成用户会长期保存和阅读的正文。事件日志需要忠实整理当前事件；“今天看见的自己”需要把多件事件之间的共同证据说清楚。两类内容一旦出现事实虚构、事件串线或过度推断，会直接降低用户对整条访谈链路的信任。

本评测采用 MVP 范围，聚焦会改变用户结果的高风险问题。页面状态、编辑保存、并发与恢复继续由功能测试覆盖。

## 2. 正式案例目录

案例保存在：

```text
tests/evals/event-centered-batch-c/
├── cases/
│   ├── event-journal.cases.ts
│   └── daily-self-insight.cases.ts
├── catalog.ts
├── fixtures.ts
├── rules.ts
├── runner.ts
└── types.ts
```

当前共 `32` 条正式案例：

| 评测组 | 数量 | 主要覆盖 |
|---|---:|---|
| 事件日志 | 16 | 事实忠实、纠正、事件隔离、角度线索、诊断、建议、内部结构 |
| 今天看见的自己 | 16 | 两事件逐字证据、共同短语、空结果、日志原文、串线、稳定结论 |

正反案例各自携带稳定编号、用户结果原因和预期拦截项。静态规则预检会逐条核对冻结预期，方便后续修改质量门时立即看到能力变化。

## 3. MVP 质量门

### 事件日志

- 事件叙事只使用当前有效事实。
- 被纠正、撤回或退出主线的旧事实不会进入正文。
- 另一事件、其他用户或其他账号内容不能进入当前成果。
- “我看见的”逐条关联当前有效角度成果，并保留全部可写入成果。
- 新增数字、情绪、动机、因果、后续行动和长期人格结论会被拦截。
- 心理诊断、强制建议和内部字段会被拦截。

### 今天看见的自己

- 至少两个不同事件共同支持同一个有意义的短语。
- 每个来源都有一段逐字存在于对应事件日志的摘录。
- 每段摘录都包含同一个 `sharedEvidencePhrase`。
- 证据不足时稳定返回空线索，完整日志正文保持原状。
- 线索使用“今天、暂时、这几件事”等阶段性表达。
- 稳定人格、生活方式、关系方向、心理诊断、建议和内部结构会被拦截。
- 当天完整日志按事件顺序保留每篇标题和正文原文。

## 4. 运行方式

### 免费规则预检

这条命令只执行本地规则与案例契约，不调用模型：

```bash
npx vitest run tests/evals/event-centered-batch-c-outcomes.test.ts

vite-node -c vitest.config.ts \
  scripts/run-event-centered-batch-c-outcomes-eval.ts \
  --mode=rules \
  --all \
  --output=artifacts/evals/batch-c/rules-report.json
```

### 小样本真实模型与 Judge

策略模型与 Judge 复用 Batch B 的同一套评测配置和超时：

- `DEEPSEEK_API_KEY` + `DEEPSEEK_MODEL` + 可选 `DEEPSEEK_BASE_URL`
- 或 `EVENT_CENTERED_JUDGE_ARK_API_KEY` + `EVENT_CENTERED_JUDGE_ARK_ENDPOINT_ID` + 可选 `EVENT_CENTERED_JUDGE_ARK_BASE_URL`
- 缺少独立评测配置时，沿用现有 chat provider 回退。
- `EVENT_CENTERED_EVALUATION_TIMEOUT_MS` 同时控制生成与 Judge。

建议先跑 `8` 条分层样本：

```bash
vite-node -c vitest.config.ts \
  scripts/run-event-centered-batch-c-outcomes-eval.ts \
  --mode=model \
  --sample=8 \
  --seed=20260723 \
  --judge \
  --checkpoint=artifacts/evals/batch-c/model-v1.checkpoint.json \
  --output=artifacts/evals/batch-c/model-v1.report.json
```

中断后使用完全相同的模式、样本、随机种子与 Judge 设置恢复：

```bash
vite-node -c vitest.config.ts \
  scripts/run-event-centered-batch-c-outcomes-eval.ts \
  --mode=model \
  --sample=8 \
  --seed=20260723 \
  --judge \
  --checkpoint=artifacts/evals/batch-c/model-v1.checkpoint.json \
  --resume \
  --output=artifacts/evals/batch-c/model-v1.report.json
```

全量模型运行需要显式追加 `--all --confirm-full-model-replay`，用于阻止误触发付费调用。

## 5. Trace 与复用边界

- 结构协议直接复用线上 `eventJournalDraftSchema` 与 `journalDailyInsightDraftSchema`。
- Prompt 直接复用线上事件日志 Prompt 与当天线索 Prompt。
- 规则预检直接复用线上事件日志质量门、当天线索证据门和完整日志原文检查。
- Provider 选择、生成与 Judge 共用配置、超时和结构化输出重试直接复用 Batch B runner。
- checkpoint 每完成一条案例原子写入；已完成且已有 Judge 结果的案例会在恢复时跳过。
- 真实生成链路继续把线上结果记录到 `AIGenerationTrace`；离线评测文件只保存案例编号、候选结构、规则结论与 Judge 结论，不保存账号隐私。

## 6. 发布前人工抽检

Preview 发布前由 AI 产品经理完成一层人工抽检：

1. 查看全部规则失败、Judge 失败和规则/Judge 分歧案例。
2. 事件日志与当天线索各随机查看至少 `3` 条自动通过案例。
3. 逐条确认事实来源、纠正生效、事件隔离、表达自然度和证据充足度。
4. 任一心理诊断、可能造成伤害的强制建议或跨账号内容泄露直接阻断。
5. 其他风险进入修复清单，修复后使用同一 checkpoint 口径重跑。

本底座当前只完成规则预检能力。真实模型与 Judge 小样本在 Preview 内容策略冻结后运行，完整付费回放需要 LeadAgent 明确启动。
