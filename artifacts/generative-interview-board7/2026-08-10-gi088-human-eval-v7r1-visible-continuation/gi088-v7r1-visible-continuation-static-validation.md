# GI-088 v7r1｜Thinking high 可见答案 Prefix 续写静态验证

验证日期：`2026-08-10`

状态：`本地定向验证与 Production build 通过；兼容探针失败；Preview 部署与空白批次按门禁停止`

## 1. 指纹检查

`npm run eval:gi088:probe:prefix:inspect` 已通过，模型调用为 `0`：

- Effective candidate：`63acaede24844272886ea798c435d7f59ab14deb989b734d842b60ab48ee7242`；
- 数据集指纹：`6753507247d257de1fef9105c7aa4e8102b749f91512130942b1a2507158f44e`；
- 执行指纹：`58a516fab81305bc7f3bec3bed74650385950923d79c0b53f002ebffe2ac1a04`；
- Prefix 探针指纹：`8bfde44d369845ecbee3ec909f0c53ff50865ea48bc13ddfb2453c94b9f6d4e5`；
- `branchOrder=[high]`、`taskCount=2`、单轨迹上限为 `null`、单次用户提交最多 `3` 次。

## 2. 已通过的定向验证

- Provider 覆盖 Beta Prefix 地址、Thinking high、JSON mode、`reasoning_content`、`{` 前缀和共享截止。
- 一次性隐藏思考对象无法重复消费或序列化；隐私哨兵不会进入诊断、状态、Trace、客户端或错误。
- Service 覆盖首次空正文后 Prefix valid 只提交一条回答和一次语义状态；Prefix 失败进入人工兜底；其他恢复不串联。
- Service 覆盖并发、刷新、重复请求和每段原话最多三次调用。
- Workbench 覆盖流式安全事件、持久行内状态、`aria-busy`、温和 Toast 和同一 HTTP 请求内恢复。
- v7 语义变化、A7 式 `revise`、`none`、负担信号和 v1～v7 读取兼容回归通过。

## 3. 完整验证结果

- 相关 Vitest：`8` 个文件，`124` 项通过、`6` 项 v3/v7 历史客户端恢复测试跳过、失败 `0`；
- `npm run typecheck`：通过；
- 相关 ESLint：通过；
- `prisma validate --schema prisma/evaluation/schema.prisma`：通过；
- `npm run build`：通过，仅保留与本候选无关的仓库既有 warning；
- `git diff --check` 与 v7r1 新文件 whitespace check：通过；
- `npm run eval:gi088:probe:prefix:inspect`：通过，模型调用 `0`。

## 4. 兼容探针

- 探针指纹：`8bfde44d369845ecbee3ec909f0c53ff50865ea48bc13ddfb2453c94b9f6d4e5`；
- 实际调用：`1/1`；自动重试 `0`；降级 `0`；
- 私有结果文件与 reservation 权限均为 `0600`，父目录为 `0700`；
- 安全结果：`UPSTREAM_HTTP_ERROR`；DeepSeek 返回 `response_format json_object should not be used with prefix`；
- 错误发生在模型生成前的参数校验阶段，未产生可见答案，也未触发第二次调用。

裁决：当前 DeepSeek 接口无法同时使用 Prefix 与 `response_format=json_object`。v7r1 运行兼容性 No-Go；Preview deployment 和 `0/2` 建批停止，Production 保持 `legacy + baseline`。下一候选进入 Thinking high 模型对照讨论。

## 5. 后续 Flash / Pro 对照

产品负责人确认后已执行 3 组同请求模型对照，探针指纹为 `ffa0c4b8c4985c15671df10abc15381f8abac1914c518d787aaf98f9198b88de`。实际调用 `6/6`，重试 `0`，降级 `0`；新增探针测试 `6/6`、连同历史空正文与 Provider 回归共 `39/39` 通过，Typecheck、限定 ESLint 和差异检查通过。

Flash 返回 `2/3` 可见答案并再次出现一次 `EMPTY_CONTENT`；Pro 返回 `3/3` 可解析可见 JSON，其中一项命中历史问号数量保护。完整结果见 [模型对照结果](./gi088-flash-pro-model-comparison-v1-result.json)。

## 6. 火山 Ark Flash 平台对照

- 合成兼容检查：`1/1`，Thinking high、`json_object` 与可见 JSON 均成功；
- 历史案例主探针：`3/3` 调用完成，重试 `0`、降级 `0`；
- E1 首次被 15 秒响应头截止，随后执行 `1/1` 等待策略校正；校正指纹为 `3d2d6b6f48bc787638a08150883908dc221868669af84104027b01745bc1df2a`；
- 最终三案例可见正文 `3/3`、`EMPTY_CONTENT=0`、旧合同通过 `2/3`；
- Ark Provider Thinking 参数与探针相关回归共 `44/44` 通过；
- Typecheck 与限定 ESLint 通过；隐藏思考正文、用户原话、Prompt、原始输出和 API Key 均未进入正式证据。

Codex 初评：火山 Ark Flash 是当前综合最优讨论候选。最佳接入方式为 REST Chat Completions 与现有 TypeScript OpenAI-compatible Provider；Ark 非流式请求的响应头截止与总时长统一为 60 秒。Preview 和 Production 均未变化。
