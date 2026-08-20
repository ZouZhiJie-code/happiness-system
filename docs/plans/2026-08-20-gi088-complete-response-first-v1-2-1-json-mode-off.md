# GI-088｜完整回应优先 v1.2.1 JSON 模式单因素验证

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 1. 为什么继续

v1.2 的八次请求全部在 `6.4s` 内完成，且只使用 `51～373/1280` completion Token；四条结果完整通过最小合同，另外四条在 HTTP 200、`finishReason=stop` 后出现 `Unexpected end of JSON input`。这说明首要阻力已经收敛到 JSON 传输稳定性。

本轮只验证一个因素：取消 Provider 的 `response_format=json_object`。模型仍按同一 Prompt 输出同一严格 JSON，本地仍使用同一 Schema 解析和校验。

## 2. 身份、固定项与预算

| 项目 | 冻结值 |
| --- | --- |
| 候选 | `2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off` |
| 运行 | `2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off-quality-v1` |
| 唯一行为变化 | Provider `response_format: json_object → omitted` |
| 固定 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、一次调用、一次尝试、45 秒、v1.2 Prompt／Schema／投影、同一 3＋5 八题 |
| 新预算 | 最多 `8` 次；开发 `3`、回归 `5`；并发 `1`；重试、恢复、回退 `0` |
| Production | `event_centered + baseline` |

原始响应诊断写入私有账本只增强可观察性，不改变模型输入、请求或产品行为。

## 3. 验证门

- 总规范 SHA、候选、Prompt、Schema、数据、父回执、Provider、Runner 和产品实现源码在访问密钥前冻结。
- 八题均需 HTTP 200、`finishReason=stop`、正文可解析、最小合同有效、Thinking 关闭、单例不高于 `15s`、无 length。
- 普通语义问题完成整批后统一评审；连续两次技术失败、严重内部泄漏、忽略明确停止或预算失控立即停止。
- 技术门通过后，逐题按“完整相关用户输入 → 实际 AI 输出 → Codex 初评 → 产品负责人裁决”交付。
- 五个硬案例全部由产品负责人判为 pass，软案例最多一个 minor，整批零 fail，才进入隔离 Preview。

## 4. 后续边界

- 技术与离线质量通过后，完成本地页面链路、单气泡、问题状态、事实写入、纠正、刷新恢复和错误回退验证。
- 随后部署隔离 Preview，最多 `15` 次真人交互；产品负责人页面验收通过后才切换 Production，并保留 baseline 一键回退。
- 页面、Preview、提交、推送、部署和 Production 当前均保持待验证。

