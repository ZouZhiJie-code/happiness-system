# GI-088 v7r2｜Thinking high Ark Flash 静态验证

验证日期：`2026-08-10`

状态：`本地自动验证与 Production build 通过；等待 Preview 部署和 0/2 回读`

## 1. 指纹与运行配置

`npm run eval:gi088:inspect` 已通过，模型调用为 `0`：

- Effective candidate：`63acaede24844272886ea798c435d7f59ab14deb989b734d842b60ab48ee7242`；
- 数据集指纹：`ea2d42c59850222bed72b59213263bed21d9660fb6d21937af533d5800e88a6c`；
- 执行指纹：`deb5f242d0fb5edea5f2a2d874ee7c029bfbefde62223fef8125dfb4ae175275`；
- `branchOrder=[high]`、`taskCount=2`、单轨迹上限为 `null`、单次用户提交最多 `3` 次；
- Provider 固定为 Ark REST `deepseek-v4-flash-ga-260731`；Thinking high 与 `json_object` 保持；
- 响应头、正文空闲和总时长均为 `60s`；新轮次 Prefix 续写为关闭状态。

## 2. 定向验证

- Ark 运行配置只读取专用凭证，冻结北京 REST 地址和模型；缺少凭证或地址偏离时在调用前停止。
- OpenAI-compatible Provider 对 Ark 发送 `thinking.enabled + reasoning_effort.high + response_format.json_object`，省略应用温度和 Token 上限。
- 首次空正文进入普通同 high 自动恢复；第二次失败进入一次人工兜底；调用链最多三次。
- 旧 v7r1 Prefix 一次性对象只执行释放，不在 v7r2 消费；历史 Trace 字段继续可读取和展示。
- v7 语义变化、A7 式 `revise`、`none`、负担信号、阶段转场、问号观测和无限轨迹保持回归通过。
- 页面只显示 Ark Flash Thinking high、两项任务、60 秒等待策略和完整恢复血缘。

## 3. 验证结果

- 相关 Vitest：`5` 个文件，`100` 项通过、`6` 项历史客户端恢复测试跳过、失败 `0`；
- `npm run typecheck`：通过；
- 目标文件 ESLint：通过；
- `prisma validate --schema prisma/evaluation/schema.prisma`：通过；
- `npm run build`：通过，仅保留与本候选无关的仓库既有 warning；
- `git diff --check`：通过；
- `npm run eval:gi088:inspect`：通过，模型调用 `0`。

## 4. 待完成的 Preview 回读

- 部署当前 v7r2 候选到受控 Preview；
- 通过部署保护和应用权限回读评测页面；
- 初始化 `running 0/2` 空白批次；
- 确认初始化模型调用为 `0`；
- 确认 Production 页面、接口、运行模式与数据保持原状。

当前停止点为完成上述 Preview 回读，再交由产品负责人执行两条 Thinking high 真人轨迹。Production 环境、Production 模型与正式用户数据保持当前状态。
