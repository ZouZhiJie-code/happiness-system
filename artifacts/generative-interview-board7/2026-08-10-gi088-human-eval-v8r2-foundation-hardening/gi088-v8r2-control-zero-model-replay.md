# GI-088 v8r2 控制意图零模型回放

## 结论

原事故类别与语义近邻均由确定性控制决策完成，回放过程的 Provider factory、授权函数和 Provider `complete` 调用均为 `0`。正式证据只保留脱敏分类，真人原话留在私有运行证据。

最终验证 commit：`e01c9ed5fa0334d8d717dbed2643791f1045e04d`。

## 控制矩阵

| 脱敏用例 | 场景类别 | 最终动作 | 程序接管 |
| --- | --- | --- | --- |
| C01 | 事件内解释疲惫，仍有理解目标 | `none` | 否 |
| C02 | 停止事件内行为，明确允许继续访谈 | `none` | 否 |
| C03 | 当前疲惫，仍明确继续 | `none` | 否 |
| C04 | 回答负担与当前访谈停止并存 | `stop_follow_up` / mixed | 是 |
| C05 | 否定生成并继续访谈 | `none` | 否 |
| C06 | 第三方要求生成成果 | `none` | 否 |
| C07 | 引号内第三方停止表达 | `none` | 否 |
| C08 | 事件内容与当前访谈停止并存 | `stop_follow_up` / mixed | 是 |
| C09 | 更早生成命令被后续继续命令撤回 | `none` | 否 |
| C10 | 否定切换维度 | `none` | 否 |
| C11 | 普通内容中的视角变化 | `none` | 否 |
| C12 | 否定停止 | `none` | 否 |
| C13 | 礼貌回应并继续 | `none` | 否 |
| C14 | 普通事件内容 | `none` | 否 |
| C15 | 纯停止 | `stop_follow_up` / pure | 是，零调用暂停 |
| C16 | 礼貌回应加纯停止 | `stop_follow_up` / pure | 是，零调用暂停 |

## 关键回放结果

- A1 原事故语义类别保持为普通事件内容，`finalAction=none`、`programTakeover=false`，继续访谈。
- 最后有效命令规则保留全部候选及顺序，被撤回候选标记为 `effective=false`。
- 转述、引号、第三方和否定表达保留为证据，不执行控制动作。
- 纯停止在 Foundation Service 直接提交 deterministic pause，Call Ledger 为 `0`，同时创建可人工复核的程序介入记录。
- 混合内容加停止最多允许一次 Provider dispatch，用于吸收真实内容后强制暂停。
- 未授权模型暂停最多使用一次自动恢复额度，Question Skill v1.1 已删除自主暂停权限。

## 证据来源与命令

- `tests/unit/interview-control-decision-v2.test.ts`
- `tests/unit/gi088-deterministic-state.test.ts`
- `tests/unit/gi088-foundation-service.test.ts`
- `tests/unit/gi088-question-decision.test.ts`
- 命令：`npx vitest run tests/unit/interview-control-decision-v2.test.ts tests/unit/gi088-deterministic-state.test.ts tests/unit/gi088-foundation-service.test.ts tests/unit/gi088-question-decision.test.ts`
- 结果：全部通过；同时包含在全量 `2930 passed / 0 failed` 静态门中。

## 隐私与调用边界

- 模型探针：`0`
- 真人内容提交：`0`
- 隐藏推理读取／保存／展示：`0`
- 正式证据中的 owner、用户原话与数据库身份：`0`
