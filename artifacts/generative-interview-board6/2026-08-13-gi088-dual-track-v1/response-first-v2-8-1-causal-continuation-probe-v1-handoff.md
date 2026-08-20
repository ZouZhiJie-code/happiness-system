# GI-088｜回应优先 v2.8.1 真实连续回合结果交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-19`
- 权威入口：[v2.8.1 真实连续回合因果探针](../../../docs/plans/2026-08-19-gi088-response-first-v2-8-1-causal-continuation-probe.md)

## 当前结果

**父 v2.8 首题产品裁决为 `minor`；v2.8.1 完成真实 Low → High 两次调用。Low 有效且 Codex 可见质量初评通过；High 合同与可见问题质量均失败。产品负责人依据完整相关原文、实际 Low 与实际 High 裁决 `fail`，整体 `No-Go / stop`。**

- 运行身份：`2026-08-19.gi088-response-first-v2-8-1-causal-continuation-probe-v1`
- 计划指纹：`26604324a6ec4e52e83d89f048bfd196d5f33a079b07beefea79978ad0791600`
- 唯一验证变化：使用父 v2.8 的实际 A3、重放 post-state 与 U4，重新生成本轮 Low，再把该实际 Low 交给 High
- 调用：`2/2`；重试、恢复和回退均为 `0`
- Low：HTTP 200、`finishReason=stop`、合同有效、`5798ms`；Codex 可见质量初评 `pass`
- High：HTTP 200、`finishReason=stop`、`5864ms`、completion `358` Token；`taskChange.kind=continue` 不属于合同允许的 `unchanged / set / clear`，因此解析失败且没有 post-state
- 客观完整两段耗时：`11662ms`；低于 45 秒方向门与 60 秒技术硬门。公开回执中的两个通过字段因 High 合同失败被门控为 false，耗时本身未超限
- Token：High 上限 `4000`，completion `358`，`finishReason=stop`；本轮未触发 Token 上限
- High 可见质量：问题再次索取 U1 已经提供的最近比较案例及经过；信息增量审计把已有答案记为 `null`，Codex 初评 `fail`
- 产品负责人裁决：`fail`

## 分层结论

1. Low 自然承接 U3 的纠正和 U4 的继续深挖要求，未新增动机、心理结论或具体体验，初评通过。
2. High 的单一问题焦点在形式上有效，内容重复索取 U1 已回答的信息，用户需要再次讲述同一案例，初评失败。
3. `workingTask` 与 `understanding` 同摘要的下游风险已经出现：状态缺少“尚待共同弄清什么”的增量方向，High 继续该主线后回到已知案例。信息增量审计漏读 U1 也是直接原因，当前证据支持风险发生，不能把全部因果只归给状态同摘要。
4. High 使用合同不接受的状态动作，无法形成可应用的 post-state；完整链路技术与状态门失败。

公开材料只保存身份、指标、状态、哈希和判断摘要，不包含用户、Low 或 High 正文。完整原文和逐项评审继续保存在 Git 排除且权限为 `0600` 的受控目录。

## 证据与发布边界

- 父产品 review 哈希：`d9ebba85b4955a61806fe20f908889224ebdd12385a83fa02871fa7738a65c4c`
- 有效输入哈希：`bd909f063461fdbb1d1ab631b98d18b54b85e840f259a4c770b53336e3472b6c`
- 实际父 A3 哈希：`1fa42423b8412c09427aa297d3d607e860ff82f487700fd132f0c07da6426406`
- Low 响应哈希：`9f1219b2f8ce94dfc01965af79109eb653a07b5557950fdd5c0849499df14177`
- High 响应哈希：`b973db6a30d7ce9b4628717444c986df6c037bf66e43b635af51288f22eb813a`
- 公开证据：[启动卡](./response-first-v2-8-1-causal-continuation-probe-v1-start-card.json)、[结果回执](./response-first-v2-8-1-causal-continuation-probe-v1-receipt.json)、[阶段账](./response-first-v2-8-1-stage-ledger-v1.json)
- 页面接入、提交、推送、部署和 Preview 均为 `not_run`
- Production 继续使用 `event_centered + baseline`

当前停止点已经达到：产品负责人已裁决 `fail`，停止后续模型调用；任何新候选需另行讨论并建立新身份。
