# Event-centered Batch B 历史证据清单

最后更新：`2026-08-06`

状态：`历史评测与回归证据；不承担当前生成式候选或 Production 授权`

## 1. 长期保留内容

根目录中的以下文件继续作为历史证据保留：

1. `event-centered-batch-b-formal*.json`：阶段性正式运行结果；
2. `event-centered-batch-b-*-human-review.md`：对应批次的人工评审；
3. `event-centered-batch-b-rules-*.json`：当时使用的规则快照；
4. 不带 `.checkpoint` 的 probe、sample 和 smoke JSON：代表性运行结果；
5. 被历史评测文档直接引用的四份 checkpoint。

继续原位保留的四份引用 checkpoint：

- `event-centered-batch-b-formal.checkpoint.json`
- `event-centered-batch-b-formal-v2.checkpoint.json`
- `event-centered-batch-b-formal-v11.checkpoint.json`
- `event-centered-batch-b-v24-smoke-24.checkpoint.json`

引用来源为 [`04e-batch-b-evaluation-and-badcases.md`](../docs/technical/interview-event-centered/04e-batch-b-evaluation-and-badcases.md)。

## 2. 本地过程文件

`2026-08-06` 复核了根目录全部 `36` 份历史 checkpoint。其中 `32` 份在代码和文档中均无引用，已移动到：

`artifacts/local-runtime/legacy-batch-b-checkpoints/`

同批 `event-centered-batch-b-formal-v13.resume.log` 也进入该目录。这些文件用于历史断点和运行排障，可以重新生成，不进入长期版本化资产。

## 3. 使用边界

- 当前产品状态以 [`generative-interview-refactor-map.md`](../docs/generative-interview-refactor-map.md) 为准；
- 当前板块 6 判尺与真实输出校准以 [`04j`](../docs/technical/interview-event-centered/04j-generative-quality-evaluation-v1.md) 为准；
- 旧 Batch B 的自动通过、规则版本和 checkpoint 只用于解释历史问题和回归风险；
- Production 继续保持 `legacy + baseline`。
