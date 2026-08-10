# GI-088 v2 Diagnostic｜静态验证记录

验证日期：`2026-08-09`

状态：`静态验证通过；Thinking 模式探针 4/4 已核验；Preview／Production 变化 0`

## 1. 指纹只读检查

`npm run eval:gi088:inspect` 通过：

- 评测版本：`2026-08-09.gi088-human-eval-v2-diagnostic`；
- Effective candidate：`58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`；
- 数据集指纹：`ab74f00de4fb07315045ac5f2d7aff58fc9d8585fe3a00cf18cb2e6d724c7052`；
- 执行指纹：`96a555c6ecef0efd8ff2946bbf7ec9c7ee6b717157520a1e6944bb888b29f943`；
- `modelGenerationCalls=0`。

`npm run eval:gi088:probe:empty:inspect` 通过：

- 来源快照、v1 评测／候选／执行指纹匹配；
- E1、E2、E3 三个来源请求哈希匹配；
- Provider／模型／主机为 `openai / deepseek-v4-flash / api.deepseek.com`；
- 探针指纹：`7c0fbbb98bc9c3804a5614e90acd0ecb4b13f023e3b96ddf68820a241c6c9b65`；
- 授权预算：`6`，自动重试：`0`；
- `modelGenerationCalls=0`、`executionAuthorized=false`。

`npm run eval:gi088:probe:thinking:inspect` 通过：

- 来源快照、v1 评测／候选／执行指纹与 response format 探针指纹均匹配；
- E1 与 E3 的来源请求哈希匹配；
- 调用顺序固定为 E1 high→disabled、E3 disabled→high；
- 每个 case 两臂的 `messagesHash` 一致，实际请求均省略 temperature 与 `max_tokens`；
- 探针指纹：`7179da479b614c6380709fc1094034f489d4803d11741b852522616dee7e3498`；
- 授权预算：`4`，技术重试、质量重试和 fallback 均为 `0`；
- `modelGenerationCalls=0`、`executionAuthorized=false`。

精确授权执行后核验通过：

- 授权 ID：`981e1baa-7a44-4843-92d5-a7d11f63f5ec`；
- 精确指纹：`7179da479b614c6380709fc1094034f489d4803d11741b852522616dee7e3498`；
- 账本状态：`4 completed / 0 reserved`；
- 调用上限：生成调用 `4/4`，自动重试、质量重试与 fallback 均为 `0`；
- 请求血缘：`4/4` 哈希匹配；
- 结果：high `2/2 valid`、disabled `2/2 valid`，超时与取消均为 `0`；
- 私有目录权限 `0700`，账本与脱敏摘要权限 `0600`；正常完成后排他锁已释放；
- 脱敏摘要 SHA256：`b75d31a7798edc8aa9160dcd6dcb1683ec6bcdb55af82cb380c5e0dad0f22ee5`；
- 私有账本 SHA256：`774ad769b5b2bd3b074535d28fbe4832562b626615216108d2a2b9bdb6eccf72`。

## 2. 自动验证

以下检查通过：

- GI-088 Service、Workbench、OpenAI Provider 与 response format 探针当前复验：`4` 个测试文件，`71/71`；
- 当前 Thinking 模式探针、response format 探针与 OpenAI Provider 定向复验：`3` 个测试文件，`41/41`；
- TypeScript：`npm run typecheck`；
- 相关文件 ESLint；
- GI-088 Prisma schema：`npm run prisma:gi088:validate`；
- Next.js production build：`npm run build`；
- JSON 资产解析与差异检查。
- Thinking 探针执行路径可从本地 `.env.local` 读取 DeepSeek 凭据；文件权限为 `0600`、Git 忽略生效，tracked 文件凭据命中为 `0`。

Build 保留仓库其他模块已有的 ESLint warning；本次相关文件无新增 warning 或 error。

## 3. 已覆盖的不变量

1. v1 与 v2 使用独立评测／服务／执行版本，v1 记录保持原状态。
2. `early_stopped` 只发生在完整任务边界；终态时间、数据库状态和只读性一致。
3. 部分导出明确区分完成任务与未执行任务。
4. 任务触发提示和判定标准只进入评测页面与数据集指纹，不进入模型消息或请求哈希。
5. Provider 分阶段计时保留旧 `timeoutMs` 的硬总截止兼容语义；安全诊断不保存可见正文、用户原话或隐藏推理正文。
6. 空内容配对探针默认只读；真实运行要求精确指纹、授权 UUID、六次预算和显式确认。
7. 每个探针调用先落账；崩溃后的不确定预留状态阻止自动重放。
8. Thinking 模式探针在读取账本前先原子获取排他锁；同一授权的并发进程会在产生 Provider 调用前停止。
9. 公开摘要只保留白名单错误码与安全诊断；用户原文、Prompt、原始输出和隐藏推理正文保持在 `local-runtime`，上游 Request ID 只输出 SHA256 或 `null`。

## 4. 停止点

Thinking 模式四次配对探针已完成并形成脱敏结果与裁决。high 未复现空内容，Thinking 主要影响因素未确认。产品负责人随后停止继续复现，并确认进入 v3 Thinking high 可见答案自动恢复候选。新的真人复测调用、Preview 新批次和 Production 变化继续等待单独授权。
