# ChatGPT × Codex 任务交接

这个目录承接 ChatGPT 与 Codex 的本地协作。

## 工作流

1. ChatGPT 先读取 `AGENTS.md`、`README.md`、`docs/handoff.md` 和相关源码。
2. ChatGPT 生成完整方案，并写入 `inbox/`。
3. 在本项目目录打开 Codex，输入：`执行最新 ChatGPT 方案`。
4. Codex 将任务移动到 `running/`，按方案修改、验证并生成结果。
5. 完成任务进入 `done/`；遇到阻塞进入 `blocked/`。
6. ChatGPT 使用任务编号读取执行结果，继续规划下一步。

## 目录状态

- `inbox/`：等待 Codex 执行的 `ready` 任务
- `running/`：Codex 当前正在执行的任务
- `done/`：已完成任务和结果
- `blocked/`：需要人工决策或外部条件的任务

任务文件在进入队列后保持方案内容稳定。执行结果使用同一任务编号生成 `<task_id>.result.md`。

## 任务格式

每个任务必须包含以下章节：

- 目标
- 背景与现状
- 实施范围
- 具体步骤
- 影响文件
- 验收标准
- 验证方式
- 约束与风险

任务元数据至少包含 `task_id`、`status`、`project`、`created_at` 和 `title`。

## 安全边界

ChatGPT 只写入 `inbox/`。Codex 负责代码修改、测试和本地验证；提交、推送、部署使用独立指令。
