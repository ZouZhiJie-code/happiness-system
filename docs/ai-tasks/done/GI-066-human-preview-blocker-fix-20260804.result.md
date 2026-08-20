# GI-066 第一轮人工实聊阻断修复｜执行结果

## 结果

任务已完成，候选停在新一轮人工实聊等待状态。第一轮人工 `No-Go` 的六项问题已按四类共同根因修复：语义重复、纠正与状态、消息与恢复、动作与事件列表投影。

## 实现摘要

- 正式问题增加语义需求签名与回答状态；完整回答、否定前提和重复提问纠正会关闭对应需求。
- 纠正拆分为事实 / 判断错误、已有答案未识别、问题前提错误和表达补充；纠正后重新选题，禁止自动虚构判断转变。
- 正式问题次数按认识方向独立计算；“换个问法”保留目标并只增加 repair 次数。
- 用户消息立即进入气泡，以 `clientTurnId` 和服务端消息合并；失败时保留原话与进度。
- 素材达门后全程开放日志；自然语言日志意图直接进入日志流程。
- 已退出事件保留“已退出”标签和只读回看；新增事件创建独立记录。
- 换问入口使用双循环箭头图标，提供悬浮 / 聚焦提示、触屏点击和读屏名称。
- 外层状态保持 v4，内部提问协议升级 v2，历史 v1 可恢复；保存前执行合法性检查。

## 候选血缘

- Strategy `5.65.0`
- Angle Card `2.18.0`
- Few-shot `quality-patterns.2026-08-04.v35`
- Prompt `2026-08-04.event-centered-thought-pilot-v85-gi066-fix`
- Artifact `event-centered-semantic-plan.v17`
- Snapshot `v4`
- Thought Protocol `v2`
- Provider `openai · api.deepseek.com · deepseek-v4-flash`

## 验证

- TypeScript：通过。
- Lint：`0 error / 46 warnings`，警告为仓库既有基线。
- 全量测试：`268` 文件、`2541/2541` 用例通过。
- 生产构建：通过。
- Prisma：Schema 有效，本机隔离库 38 条 migration 全部齐全。
- 差异检查：通过。
- DeepSeek 官方预检：通过。
- 严格 10×3：动作 `30/30`、方向 `30/30`、完整无问题 `30/30`、重复选题错误 `0`。
- 自动 8+2：主链 `8/8`、日志闭环 `8/8`、两条冒烟通过、失败 `0`。
- Board8：运行降级 `0`；日志 AI 接受 `7/8`、标题修复 `1`、全文安全回退 `1/8`；可见 P90 `5.371s`，可操作 P90 `5.410s`。
- 人工工作台页面：HTTP 200，Provider、模型、候选和四条实聊入口均可见。

## 证据

- [候选血缘](../../../artifacts/generative-interview-board8/2026-08-04-gi066-fix-scripted-deepseek-official-preview-v3/candidate-lineage.md)
- [10×3 报告](../../../artifacts/generative-interview-board8/2026-08-04-gi066-fix-thought-stability/report.md)
- [8+2 证据](../../../artifacts/generative-interview-board8/2026-08-04-gi066-fix-scripted-deepseek-official-preview-v3/preview-execution-evidence.md)
- [Board8 审计](../../../artifacts/generative-interview-board8/2026-08-04-gi066-fix-scripted-deepseek-official-preview-v3/board8-preview-candidate-audit.md)

## 剩余风险

- 自动 8+2 属于脚本化模拟，真实体验仍由四条人工实聊裁决。
- 一条日志使用全文安全回退，数量在门槛内；人工实聊需继续观察可读性。
- 本地 Node 访问官方 API 需要读取当前 macOS 系统代理；工作台进程已按该环境启动。
- Production 持续保持 `legacy + baseline`；本任务未执行生产部署、开关切换或生产数据写入。
