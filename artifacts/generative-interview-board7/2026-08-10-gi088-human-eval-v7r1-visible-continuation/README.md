# GI-088｜v7r1 Thinking high 可见答案 Prefix 续写

状态：`No-Go；本地实现与自动验证通过，兼容探针确认 DeepSeek 拒绝 Prefix 与 JSON Output 组合；Preview 部署和建批停止`

评测版本：`2026-08-10.gi088-human-eval-v7r1-visible-continuation`

服务版本：`2026-08-10.gi088-visible-continuation-service-v7r1`

恢复策略：`2026-08-10.gi088-deepseek-prefix-continuation-v1`

合同版本：`2026-08-10.gi088-semantic-delta-contract-v2.1`

Effective candidate：`63acaede24844272886ea798c435d7f59ab14deb989b734d842b60ab48ee7242`

数据集指纹：`6753507247d257de1fef9105c7aa4e8102b749f91512130942b1a2507158f44e`

执行指纹：`58a516fab81305bc7f3bec3bed74650385950923d79c0b53f002ebffe2ac1a04`

Production：`legacy + baseline`

## 1. 为什么进入 v7r1

v7 两条真人轨迹已经完成，连续性工作台、无限轨迹、认识修正和自然长聊进入了真实体验。批次同时出现了 Thinking high 在正常完成思考后仍未返回可见正文的情况；自动普通重试也可能连续得到空正文，最终打断对话。原始技术事件完整保留在 v7 封存结果中。

DeepSeek 官方说明 JSON Output 偶发返回空正文。v7r1 保留模型、Thinking high、JSON mode、用户原话、上下文、语义状态和输出合同，只改变空正文后的恢复方式：复用本次已经完成的隐藏思考，续写最终可见 JSON。

## 2. v7r1 唯一范围

1. 首次响应必须同时满足 HTTP 200、`finish_reason=stop`、隐藏思考非空、可见正文为空，才允许 Prefix 续写。
2. 续写使用 DeepSeek `/beta/chat/completions`，保留原配置并追加 assistant Prefix `{`。
3. 隐藏思考只存在于同一服务请求的一次性内存对象；只能消费一次，无法序列化。
4. 首次调用与 Prefix 续写共享 60 秒总等待上限。
5. Prefix 成功只提交一条可见回答和一次语义状态，轮次记为 `complete_after_auto_recovery`。
6. Prefix 失败后开放 v7 已有的一次人工“再次生成”；人工调用使用普通 Thinking high，随后停止。
7. 同一段用户原话最多三次调用：首次、一次自动 Prefix、一次人工生成。其他恢复不会与 Prefix 串联增加调用。
8. 生效输出合同只包含 `understandingChange / burdenSignalChange`；v1～v7 继续只读兼容。

## 3. 隐私边界

- 隐藏思考正文不会进入数据库、日志、错误对象、Trace、导出、客户端或持久化请求哈希。
- Trace 只保留隐藏思考的存在性、长度、Token 数、Prefix 策略和脱敏指纹。
- 页面持续显示恢复状态并设置 `aria-busy`；温和提示不抢焦点，也不承担唯一信息来源。
- Production 全程保持 `legacy + baseline`。

## 4. 真人验收

本批只使用 Thinking high，共两项、两条轨迹：

1. A1：形成认识后明确纠正一处，再继续至少一轮，必须产生有效 `revise`；
2. A2：自然长聊，检查阶段 3、页面连续性和真实恢复。

两条轨迹合计至少 10 次用户提交。达到通过标准时，`N` 次提交最多产生 `N+1` 次调用；理论最坏为 `3N`。整条轨迹继续不设总轮次上限。

## 5. 证据

- [Manifest](./gi088-human-eval-v7r1-visible-continuation-manifest.json) 记录版本、指纹、恢复分账、探针和部署回读。
- [静态验证](./gi088-v7r1-visible-continuation-static-validation.md) 记录自动测试、类型、Lint、Prisma、构建、探针和差异检查。
- Prefix 兼容探针固定 1 次合成调用，重试与降级均为 0，只保存安全诊断。
- v8 统一问前决策继续等待后续可靠性候选通过真人门。

## 6. 兼容探针裁决

2026-08-10 已按固定指纹执行唯一一次合成兼容探针，调用预算 `1`、重试 `0`、降级 `0`。DeepSeek 在生成前返回参数错误：`response_format json_object should not be used with prefix`。

这项结果确认当前模型接口无法同时满足“Thinking high、JSON Output、Prefix 续写”三项冻结条件。v7r1 因运行兼容性 No-Go，停止 Preview 部署和 `0/2` 建批；Production 未变化。下一候选进入 Thinking high 模型对照讨论，v8 继续等待可靠性门。

## 7. Flash / Pro 模型对照

产品负责人随后确认执行同一官方 API 下的模型单变量对照。3 个历史空正文请求分别由 Flash 和 Pro 各执行一次，共 `6/6`，重试与降级均为 `0`。

- Flash：`2/3` 返回有效可见答案，E3 再次 `EMPTY_CONTENT`；
- Pro：`3/3` 返回可解析的可见 JSON，其中一项命中历史 v1 的严格问号数量保护；
- Pro 三次等待为 `22.0 / 25.4 / 42.5` 秒，明显长于 Flash；
- 同平台同请求下出现 Flash 空正文、Pro 可见答案，形成模型相关影响的方向性证据。

完整脱敏结果见 [模型对照结果](./gi088-flash-pro-model-comparison-v1-result.json) 与[讨论结论](./gi088-flash-pro-model-comparison-v1-decision.md)。该轮结束时建议讨论 `v7r2 Thinking high Pro`；后续火山 Ark 对照继续更新综合选择，Production 保持不变。

## 8. 火山 Ark Flash 平台对照

随后使用同三条历史空正文请求对火山 Ark `deepseek-v4-flash-ga-260731` 执行定向对照。主探针 3 次、E1 等待策略校正 1 次，另有 1 次合成接口兼容检查；全部重试和降级均为 0。

- E1 校正后 15.8 秒完成并通过合同；
- E2 7.0 秒完成并通过合同；
- E3 9.8 秒返回可见正文，命中 `OUTPUT_SCHEMA_INVALID`；
- 三条请求可见正文 `3/3`，`EMPTY_CONTENT=0/3`；
- 与官方 Pro 同为 `3/3` 可见正文，等待明显更短。

当前 Codex 初评调整为：`火山 Ark Flash 是下一真人候选的综合最优选择`。接入方式采用 REST Chat Completions 与仓库现有 TypeScript OpenAI-compatible Provider，非流式响应头等待与总时长统一为 60 秒。公开证据只保留脱敏聚合数据与[平台对照结论](./gi088-ark-flash-platform-probe-v1-decision.md)；关联真人 Call、Turn、原始请求与模型输出继续留在本机受控目录。Preview、评测建批和 Production 均未变化。
