# GI-088 v7｜连续性底座静态验证

验证日期：`2026-08-10`

状态：`完整静态验证通过；Preview READY；0/2 零调用回读通过`

## 1. 指纹检查

`npm run eval:gi088:inspect` 已通过，模型调用为 `0`：

- Effective candidate：`49b038e61e2796d5bccb5296699fb0edd5653307745bf3f383e0a9d3dc839d00`；
- 数据集指纹：`a3f7c40632ca5c87fbbf8e018f5b3585eaba8919b2bb085da4058deef88e17c5`；
- 执行指纹：`fb1e480296fb161e71e913b05cce06135c1643919afdf5cd85a69e7fe092dfe1`；
- `branchOrder=[high]`、`taskCount=2`、单轨迹上限为 `null`、单次用户提交最多 `3` 次；
- 整批精确最坏调用记为 `unbounded_by_trajectory`。

## 2. 已通过的定向验证

- v7 语义变化合同覆盖 `none / add / revise`、程序编号、修订保持编号、负担信号 `unchanged / set / clear`、非提问自然承接和旧字段拒绝。
- Service 覆盖第 13、25 次调用继续成功；自动恢复两次失败后只开放一次人工生成；成功只提交一条回答和一次状态；最终失败、重复申请和并发标签页无法产生第四次调用。
- Service 覆盖已完成任务按 `taskId` 只读回看，下一任务仍保持待开始。
- Workbench 覆盖任务回看、稳定评价区、终态自动下载与再次下载、Toast 与持久行内状态、`aria-busy` 和恢复血缘。
- v6 单一焦点、v4 阶段转场和 OpenAI Provider 分阶段超时回归通过。

## 3. 完整静态验证

- 相关 Vitest：`8` 个文件，`124/124` 通过；
- `npm run typecheck`：通过；
- 相关 ESLint：通过；
- `prisma validate --schema prisma/evaluation/schema.prisma`：通过；
- Next.js production build：通过，仅保留与本候选无关的仓库既有 warning；
- 正式 JSON 解析：通过；
- `git diff --check` 与新文件 whitespace check：通过；
- `npm run eval:gi088:inspect`：通过，模型调用 `0`。

## 4. Preview 与隔离回读

- deployment：`dpl_J5Z8B61j5GxycUNcxr1buPjkfQ8T`，`READY`；
- 固定入口：`https://xingfuxitong-gi088-v7-continuity.vercel.app/preview/gi088-evaluation`；
- 批次：`542af23d-ba18-4ee7-bb89-c1250481f0b9`，`running`、`0/2`、revision `0`；
- 页面标题、Thinking high 单轨迹、“本轨迹不设上限”和执行指纹已回读一致；
- 候选、数据集和执行指纹均通过精确校验；
- Codex 模型调用 `0`；
- Production Preview 页面和 session API 均返回 `404`。
