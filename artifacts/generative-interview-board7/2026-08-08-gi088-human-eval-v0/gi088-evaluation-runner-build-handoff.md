# GI-088 v0.5｜历史评测运行器建设交接卡

当前身份：`v0 建设与运行历史；正式批次已停在 A2 high，现行入口为 GI-088 v1`

## 建设目标

该版本完成了私有 Preview 真人评测工作台、独立评测存储、双分支、裁决、封存、只读导出、自动测试和部署验证。v0 正式批次最终累计 `9` 次调用，并在 A2 high 连续三次耗尽 `1600` completion Token 后停止。当前运行说明见 [`GI-088 v1`](../2026-08-09-gi088-human-eval-v1/README.md)。

## 固定输入

- 当前评测方案：`2026-08-08.gi088-human-eval-v0`；
- 任务：A1～A8，加 A2／A3／A4／A6 四次新话题复测；
- 每项共同起点：固定零调用 `A0` 加产品负责人一次输入的真实 `U1`；
- 两条独立轨迹：Thinking 关闭先完成，high 后完成；
- 共同候选：GI-087 Prompt、Interview Skill、输入与 `workingTask＋nextInquiry` 结构，两臂同时加载 GI-088 `burdenSignal` 可空编码澄清；
- 模型：`deepseek-v4-flash`，JSON，`maxTokens=1600`；
- 唯一变量：关闭组温度 `0.2`；开启组 `reasoning_effort=high`；
- Production：`legacy + baseline`。

## 必须交付

1. 产品负责人登录和 Preview 访问保护；
2. Preview 专用评测数据库；
3. 12 项任务进度和 24 条轨迹；
4. 一次发送一次请求、刷新恢复、重复提交保护；
5. 技术失败手动重试并保留原失败；
6. 配置透明、语义 Trace、耗时和 Token；
7. 每条轨迹和每组对照裁决；
8. 整批封存和只读导出；
9. 假 Provider 全链路、定向测试、类型、Lint、构建、敏感信息和 Production 范围检查；
10. Preview 部署地址、候选指纹和运行说明。

## 授权与停止点

- 建设与假 Provider 验证：已授权；定向测试 `37/37`、TypeScript、定向 ESLint、Prisma、本地与 Vercel Preview 构建均通过。
- Base GI-087 候选指纹：`e45f431f21819b668422c5da64678ad22fb6ef3f3eee285aa9e9c8fb533321aa`。
- Effective candidate 指纹：`58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`。
- 数据集指纹：`73be5280bfcd5626fbec2fe743c5d7d6b03221df6107b8d20ebfacc91d2c50d1`。
- 当前执行指纹：`3bea0a9e01205a8a2cf6723b35cffc4272cf44da5cee077d0c0609fee45d4113`。
- 历史 formal batch Preview 部署：`dpl_EhDcw5vVpHbLzAPFQp9wXJ2aNCiW`；当时访问地址为 `https://xingfuxitong-34pbcz5so-zouzhijies-projects.vercel.app/preview/gi088-evaluation`。
- 隔离验收：应用登录、session、A1 关闭组程序保护状态读回与 Production page／session／smoke `404` 均通过；当前作用域为 `batch`。
- 当时运行检查点：A1 关闭组首轮正式调用 `1` 次并触发 `ASK_QUESTION_COUNT_INVALID:2`；页面恢复部署新增模型调用 `0`。
- 历史冒烟：v0.3 off `valid`，v0.3 high `EMPTY_CONTENT`，v0.4 high 因 `burdenSignal` 无信号对象和空证据被严格 Schema 拦截；三条记录继续保留。
- v0.5 冒烟：off 请求 `b1389fce-5488-45ac-b300-f6ce3c52f132` 为 `valid`；high 请求 `bb756d3c-af07-4072-9bb5-8e88209a2167` 为 `valid`。累计技术冒烟 DeepSeek 调用 `5`，其中 v0.5 调用 `2`；正式真人评测调用 `1`。
- 数据审计：v0.4 空批次 `a12756bb-024a-4135-b727-ac13db13a1db` 经核验为 `0` 消息、`0` 回合、revision `0`，定向删除 `1` 条；冒烟记录完整保留。
- 技术冒烟：v0.5 off、high 已逐臂完成并封存；严格 Schema、零自动重试和失败保留继续生效。
- 正式真人评测：v0 已停止并保留原始批次；v1 从全新 `0/12` 批次开始。
- Production 发布、线上 Prompt、公共 API、生产数据库、配置和运行开关：继续关闭。

## 建设完成后的协作

真人评测期间由网页和评测数据库保存连续性，Codex 会话可以关闭。整批 `24` 条轨迹封存后开启一条批次迭代会话，连续完成独立九维初评、共同复盘、根因关系、一个主要影响因素选择、下一候选开发和静态验证。下一候选就绪后结束该会话。
