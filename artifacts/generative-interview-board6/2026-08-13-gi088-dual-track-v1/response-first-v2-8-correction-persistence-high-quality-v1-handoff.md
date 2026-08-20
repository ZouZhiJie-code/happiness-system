# GI-088｜回应优先 v2.8 首题结果交接

- 文档职责：历史证据
- 文档状态：历史证据
- 最后核验：`2026-08-19`
- 权威入口：[v2.8 执行专项](../../../docs/plans/2026-08-19-gi088-response-first-v2-8-correction-persistence-high.md)

## 当前结果

**首题技术、速度、合同、可见体验和纠正持久化通过；内部状态职责为 Codex `minor`，产品负责人基于原文裁决 `minor`。**

v2.8 首题完整返回，来源、状态、纠正持久化审计和问题审计合同均有效。冻结 Low＋High 总耗时为 `7.786s`，通过 45 秒速度方向门和 60 秒技术硬门。首题修复了 v2.7 的状态丢失：纠正进入真实 post-state，可见行为继续保持 Low-only。post-state 的 `workingTask` 与 `understanding` 使用同一摘要，Codex 依据两者“尚待弄清的任务／已经知道的认识”的不同职责，将完整状态记为 `state-role minor`。产品负责人基于完整相关原文裁决 `minor`；本结果只覆盖首题，不承担完整六题 Go。

- 候选：`2026-08-19.gi088-response-first-v2-8-correction-persistence-high`
- 运行：`2026-08-19.gi088-response-first-v2-8-correction-persistence-high-quality-v1`
- 计划指纹：`1a77552220ed2a46c8b20e7e8db5a04ffe4c6856d1aef53f9075fbf0af414e7a`
- 候选指纹：`340fb8bd52f1d3f67d08c1628b84ac8308cc1dad28a54cf4b2f2560a00179b4c`
- 候选文件 SHA：`c17089c03282c45e15bfcf3e7dc5ef7c74297d40290aeef6d22e2ef534b9aaf0`
- 首题：`RPR-REAL-19-CORRECTION`
- 技术与合同：HTTP 200、目标模型正确、`finishReason=stop`、校验问题 `0`
- 耗时：High `4.445s`；冻结 Low `3.341s`；完整两段 `7.786s`
- Thinking：`disabled`；`reasoningPresent=false`；`reasoningTokens=null`
- Token：prompt `3007`、completion `369`、总计 `3376`
- 可见追加：理解 `null`，问题 `0`
- 调用：`1/6`，其余 `5 not_run`；重试、恢复、回退均为 `0`

## 状态修复与 Codex 分层初评

纠正持久化审计选择 `persist`，以 `U3` 为纠正依据，把 `A2` 标记为被替代；状态计划为主线 `set_new`、认识 `add`。应用状态变化后，post-state 形成一条引用 `U3` 的当前主线和一条引用 `U3` 的认识，旧接纳含义没有进入活动状态。

Codex 分层初评为：

1. 技术、速度和结构合同通过；
2. 冻结 Low 保持原文，High 可见理解为空、问题为 `0`，可见体验 `pass`；
3. 完整 High 已保存与 `U3` 对齐的纠正后状态，纠正持久化 `pass`；
4. 当前主线与认识使用同一摘要，状态职责 `minor`。该缺口可能在后续表现为重复确认、过早结束或旧主线复活；首题尚未出现这些可见后果。

当前结论只覆盖纠正首题。产品负责人已在受控对话中查看完整相关用户输入、冻结 Low 和实际 High，并裁决 `minor`；真实 `RPR-REAL-19-CONTINUE` 随后由 v2.8.1 使用本题实际气泡和 post-state 独立验证。

公开证据只保存摘要、指标、状态引用与哈希，不保存用户、Low 或 High 正文。

## 公开证据哈希

- 请求指纹：`5d5396c8ef929290a28c3981b05639011a35686bdaaf95cc6a4daaab3554a881`
- 冻结 Low 哈希：`df15169aca894d310e3e686dc1d105827e81983b823ab15d25e1b8761e2059c8`
- High 响应哈希：`ccd38aaac808d7b76510c6bfa46b350072481cdaebad049c60d432157881ef62`
- post-state 哈希：`85a9cfebb928dba00a94b8a5c0f365e9ddb5ab683af9683116da75bba59b6ca4`

## 当前停止点

原 v2.8 runner 的其余五题保持 `not_run` 并退役。首题产品裁决 `minor` 后已进入[v2.8.1 真实连续回合因果探针](../../../docs/plans/2026-08-19-gi088-response-first-v2-8-1-causal-continuation-probe.md)。页面接入、提交、推送、部署和 Preview 均为 `not_run`；Production 继续使用 `event_centered + baseline`。

公开证据：[启动卡](./response-first-v2-8-correction-persistence-high-quality-v1-start-card.json)、[结果回执](./response-first-v2-8-correction-persistence-high-quality-v1-receipt.json)、[阶段账](./response-first-v2-8-stage-ledger-v1.json)。私有原文和逐项评价继续保存在 Git 排除的受控目录。
