# GI-087｜共同任务与当前探查候选

状态：`历史基线；公开包已脱敏；当前迭代已进入 GI-088 v7r2`

Production：`legacy + baseline`

## 1. 候选解决的问题

GI-087 将连续访谈组织为“共同任务＋当前探查”：系统保留整段对话正在共同弄清的内容，同时每轮只选择一个有推进价值的当前入口。用户纠正、切换或暂停时，旧理解按来源失效或进入可返回状态。

## 2. 历史结论

- 六题筛查完成 `6` 次模型调用，其中 `5` 次结构有效、`1` 次触发程序保护。
- 后续上下文资格审计确认，部分案例含旧候选生成的前置语境，无法继续承担 GI-087 的独立质量证明。
- 真人逐字输入、历史摘录、原始输出、Trace、逐题裁决和授权记录持续保留在本机受控目录。
- GI-087 的 Prompt、Skill 和输出合同继续作为 GI-088 的公开实现血缘；当前质量与发布判断以总 Map 和 GI-088 v7r2 为准。

## 3. 公开资产

- [Base Prompt v1](./board7b-base-prompt-v1.md)
- [Interview Skill v1](./conduct-daily-light-thinking-interview/SKILL.md)
- [输出合同 v1](./board7b-output-contract-v1.md)
- [轮次输入合同 v1](./board7b-turn-input-v1.md)
- [脱敏 manifest](./board7b-working-task-v1-manifest.json)
- [回归计划元数据](./board7b-working-task-v1-regression-plan.json)
- [评审判尺](./board7b-working-task-v1-rubric.md)

回归计划只保存数量、指纹、门槛和停止条件。可以重建个人经历的来源摘录、逐字输入和完整运行结果均未进入公开包。

## 4. 当前入口

- [生成式访谈重构总 Map](../../../docs/generative-interview-refactor-map.md)
- [GI-088 v7r2 Ark Flash](../2026-08-10-gi088-human-eval-v7r2-ark-flash/README.md)
