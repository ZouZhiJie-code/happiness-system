# GI-088 v2.8.1｜真实连续回合因果探针

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-19`
- 权威入口：[`../generative-interview-refactor-map.md`](../generative-interview-refactor-map.md)

## 1. 原因与目标

v2.8 首题已经产生实际可见气泡和实际 post-state。原 v2.8 剩余批次中的 CONTINUE High 会继承这两项结果，但 CONTINUE Low 仍来自历史夹具输入，因此只能证明 High 的因果串联。

v2.8.1 保持 v2.8 High 候选不变，只验证一个真实连续回合：用首题实际气泡、从首题原始 High 重新投影得到的 post-state 和原 U4 构造输入，重新调用 v2.2 Low，再把这次实际 Low 交给 v2.8 High。

## 2. 身份、范围与预算

- 运行身份：`2026-08-19.gi088-response-first-v2-8-1-causal-continuation-probe-v1`。
- High 候选：`2026-08-19.gi088-response-first-v2-8-correction-persistence-high`，保持模型、Prompt、合同、Thinking disabled、无 `reasoningEffort` 和 `maxTokens=4000`。
- Low 候选：`2026-08-17.gi088-response-first-v2-2-factual-low`，保持 Thinking enabled、`reasoningEffort=low` 和 `maxTokens=1280`。
- 数据：只运行 `RPR-REAL-19-CONTINUE`；U4 保持原夹具内容，A3 和语义状态由首题真实结果替换。
- 总预算：Low 一次、High 一次，共两次；并发为一；重试、恢复和回退均为零。
- 原 v2.8 剩余五题退出当前执行，保持 `retired_not_run`；本探针后其他四题继续 `not_run`。

## 3. 父证据与第一停止门

探针绑定 v2.8 首题 start card、公开 receipt 和私有 raw ledger，并执行以下确定性核对：

1. 重算 v2.8 start card 的 `planFingerprint`；
2. 校验公开与私有首题 `responseHash` 一致，且私有 `rawOutput` 重算哈希一致；
3. 从 `rawOutput` 重新 parse、validate，并用当前投影与 merge 逻辑重新生成 post-state；
4. 校验重算 post-state 与私有账本及公开 `postStateHash` 一致；
5. 产品负责人首题 review 必须绑定同一 `responseHash` 和 `postStateHash`；`pass` 或 `minor` 放行，`fail` 阻断。

产品 review 使用 v2.8 首题现有私有路径，并增加：

```json
{
  "evidenceBinding": {
    "caseId": "RPR-REAL-19-CORRECTION",
    "responseHash": "首题实际响应哈希",
    "postStateHash": "首题重算状态哈希"
  }
}
```

## 4. 两次调用与速度门

1. 使用首题实际可见气泡替换历史 A3，使用重算 post-state 替换夹具状态，保留原 U4。
2. 先调用 v2.2 Low。Low 技术与合同有效、总耗时不高于 `15s` 才进入 High；`15–45s` 记速度 No-Go，超过 `45s` 记技术 No-Go。
3. Low 通过后调用 v2.8 High。High 只接收这次实际 Low；不得继续使用历史冻结 CONTINUE Low。
4. 当前真实回合总耗时为本次 Low 加本次 High：目标不高于 `45s`，硬门不高于 `60s`。
5. 任一调用前先记账。Low 失败后 High 保持 `not_run`；所有路径都没有自动重试、恢复或回退。

## 5. 证据、质量与第二停止门

- 私有账本与评审卡保存完整相关原文、首题实际 A3、本次 Low、本次 High、重算 post-state、耗时和技术状态，文件权限为 `600`。
- 公开回执只保存身份、来源哈希、输入哈希、响应哈希、计数、速度、合同状态和产品裁决摘要，不保存正文。
- High 有完整有效正文时生成评审卡。语义自然度、是否重复纠正、是否沿纠正后的状态推进，继续由 Codex 初评和产品负责人根据原文裁决。
- 探针完成后必须等待第二次产品裁决。第二次 review 绑定父 `responseHash/postStateHash`、真实输入哈希、本次 Low 哈希和本次 High 哈希。
- `pass` 或 `minor` 只形成 v2.8.1 探针结论；页面接入、提交、推送、部署、Preview 和 Production 均继续关闭。

## 6. 验证门与停止点

自动验证覆盖：

- start card 指纹重算；
- raw High 重解析、重校验与 post-state 重投影；
- 产品首题 review 的双哈希绑定和 `pass/minor/fail` 门；
- 实际 A3 替换、重算 post-state 继承、U4 保留、历史 A3 与历史 CONTINUE Low 排除；
- Low 失败停止 High、两次调用上限和零重试；
- Low `15s/45s`、完整回合 `45s/60s`；
- 第二产品门、公开隐私和私有 `600` 权限。

当前停止点：实现与本地验证完成后等待产品负责人首题双哈希裁决；不得调用模型。探针真实运行完成后再次等待产品负责人裁决，其他四题继续不运行。
