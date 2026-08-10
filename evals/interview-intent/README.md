# 访谈意图评测入口

当前公开状态：`评测方法与运行代码公开；逐条语料和运行结果保留在本机受控目录`

## 为什么采用这一边界

历史意图评测语料混合了产品要求、历史 Bad Case、匿名真实对话和人工扩写。逐条记录缺少可独立核验的公开授权标记，因此本次 GitHub 精简包只保留方法、字段设计、运行器和聚合结论，不公开用户表达、逐条模型结果或人工评审包。

## 公开入口

- [访谈意图评测与上线事实源](../../docs/interview-intent-evaluation-source-of-truth.md)
- 规则与评测实现：`src/features/interview/intent/`
- 报告生成器：`scripts/report-interview-intent-eval.ts`
- 独立评审包生成器：`scripts/generate-interview-intent-core-review.ts`

## 本机受控资产

以下内容继续保存在原工作区或 `artifacts/local-runtime/`：

- `v1/` 中的逐条开发、盲测和外部评审语料；
- `reviewer/generated/` 与 `reviewer/results/` 中的逐条结果；
- `reports/` 中可能引用用户表达或运行定位信息的历史报告。

需要重新运行时，应先从受控来源恢复数据，并重新确认使用范围、隐私边界和模型调用授权。Production 当前行为不受本目录变化影响。
