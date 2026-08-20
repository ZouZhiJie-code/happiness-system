# GI-088 v7r4｜官方 DeepSeek V4 Pro 静态验证

验证日期：`2026-08-10`

状态：`本地自动验证、Production build、Preview 部署与 0/2 回读均通过`

## 1. 版本、指纹与配置

`npm run eval:gi088:inspect` 已通过，模型调用为 `0`：

- Effective candidate：`f527c74873e774a146878f00312a11384e0913cbb0bd0867db6652455934c702`；
- 数据集指纹：`0ebccea51837785b610efc3a87074fd5ef997dc4627d993b77669d3327bb9c34`；
- 执行指纹：`945d0bf5a0de783c0e831a2f8f988f81a48289f3ef355c5a3bb7eaebf4a92b98`；
- v7r3 零模型状态基线执行指纹：`f3f112e73be9579a635a339c07225a03d8771765aca554796e21410cf4fefda7`；
- 运行配置：官方 `api.deepseek.com`、`deepseek-v4-pro`、Thinking high、`json_object`；
- 等待策略：响应头 `15s`、正文空闲 `45s`、单次总上限 `60s`。

## 2. 定向自动验证

- 13 个相关测试文件：`152` 项通过、`6` 项历史客户端恢复测试跳过、失败 `0`；
- 覆盖确定性来源合并、返回旧任务、未知来源保护、400 条长血缘、纯停止零调用、混合停止、并发幂等和程序接管停止；
- 覆盖 Pro 官方地址、模型、专用凭据、Thinking high、JSON 输出与配置偏离时调用前停止；
- 覆盖语义变化、阶段转场、单一回答焦点、恢复总上限、工作台暂停态和历史 Trace 读取；
- `npm run typecheck`：通过；
- 目标 Prisma schema：通过；
- 目标文件 ESLint：通过；
- `npm run build` 与 Vercel Production build：通过，保留与本候选无关的仓库既有 warning；
- `git diff --check`：通过。

全量测试共 `2817` 项：`2809` 项通过、`6` 项跳过、`2` 项失败。两项失败均为工作区已有历史基线未同步：旧 Preview 环境变量快照和 GI-086 历史执行指纹；本轮 GI-088 定向测试与构建均已通过。

## 3. v7r3 私有零模型回放

- 回放源 SHA256：`cf42c7f747143fa8f217f8790fe01d8cc77b8adef97ea6e6ea7b8858888373f1`；
- A1 U8：识别“新内容＋停止”，有效动作收口为暂停，下一问清空；
- A2 U7：模型本轮 `1` 条来源由程序合并为 `7` 条完整任务来源，阶段 3 状态通过；
- 回放模型调用：`0`；正式证据不包含用户原话、模型原始输出或隐藏推理。

## 4. Preview 回读

- Deployment：`dpl_G4bfiVDTNfsP7aMF94uMsp3KfVxe`，状态 `READY`；
- 页面：`https://xingfuxitong-q2is93zhx-zouzhijies-projects.vercel.app/preview/gi088-evaluation`；
- 保护通道页面回读：HTTP `200`，包含 `GI-088` 与 `v7r4`；
- 批次：`954f144c-b26b-487a-ac3e-74f84183ad09`；
- 批次状态：`running 0/2`；
- 活动分支：`high`；
- 初始化模型调用：`0`。

## 5. 真人收口更新

产品负责人随后完成 A1、A2 两条 Thinking high 轨迹。批次以 `sealed 2/2` 收口，整体裁决为 `No-Go`：V4 Pro 可靠性达到继续使用条件；两次程序保护与连续停止提问进入 v8 修复。脱敏结果见 [v7r4 真人评测收口](./gi088-v7r4-human-eval-closure-summary.md)。Production 保持 `legacy + baseline`。
