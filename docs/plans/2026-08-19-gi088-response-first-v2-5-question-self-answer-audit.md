# GI-088｜回应优先 v2.5 候选问题自答审计

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-19`
- 权威入口：[生成式访谈重构总 Map](../generative-interview-refactor-map.md)
- 父失败证据：[v2.4 首题交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-4-null-task-aligned-high-quality-v1-handoff.md)

## 1. 为什么继续改 High

v2.4 首题已经证明完整上下文、冻结 Low、空主线状态对齐、来源引用和结构化提交可以共同工作。模型在内部主线中引用了 U1、U2、U3，随后提出的问题却再次索取 U1 已给出的触发情境和 U2 已给出的愤慨感受。当前问题因此收敛为：High 能看到旧答案，却缺少一项可复核的候选问题淘汰过程。

现有 Interview Skill 已要求模型检查“问过什么、回答过什么、还缺什么、答案怎样改变认识”。这段原则提醒仍停留在文字层，v2.5 将检查过程形成模型必须交付的中间结果。

外部方法只承担设计参考：

- [Learning to Ask Good Questions](https://aclanthology.org/P18-1255/)：问题需要补充缺失信息，且预期答案具有价值；
- [Know What You Don’t Know](https://aclanthology.org/P18-2124/)：回答问题和判断上下文能否回答需要分别处理；
- [Chain-of-Verification](https://aclanthology.org/2024.findings-acl.212/)：先形成候选，再独立核验并修订，可以降低对初始生成的依赖；
- [Follow-up Question Generation for Asynchronous Interviews](https://intellang.github.io/papers/3-IntelLanG_2020_paper_3.pdf)：访谈追问模型会生成已经被回答的问题，完整对话历史与有限追问是直接改进方向。

## 2. 唯一主要因素

候选身份：`2026-08-19.gi088-response-first-v2-5-question-self-answer-high`

运行身份：`2026-08-19.gi088-response-first-v2-5-question-self-answer-high-quality-v1`

High 在原有语义结果之外增加内部 `informationGainAudit`：

```ts
informationGainAudit: {
  candidates: Array<{
    question: string;
    existingAnswer: {
      summary: string;
      evidenceRefs: string[];
    } | null;
    worthAsking: boolean;
  }>;
}
```

模型方法固定为：

1. 先从完整有效上下文提出少量候选问题；新建内部主线时继续继承此前用户已经给出的信息。
2. 每个候选问题都只使用仍有效的用户原文尝试作答。
3. 已有原文足以回答时，填写 `existingAnswer` 和来源，并把 `worthAsking` 设为 `false`。
4. 原文尚未覆盖、且答案会改变当前认识时，`existingAnswer=null`、`worthAsking=true`，才允许进入可见问题。
5. 原文尚未覆盖但价值不足时，保持 `existingAnswer=null`、`worthAsking=false`。
6. 可见问题必须与审计中通过的候选按顺序完全一致；找不到高价值缺口时允许零提问。
7. 默认选择一个问题；确有同一回答焦点且各自都能增加信息时，继续允许一至三个问题句。

程序只检查字段、用户来源、结构和模型自身声明的一致性。语义重复与问题价值继续由模型方法、Codex 初评和产品负责人原文裁决承担。

固定因素：v2.2 冻结 Low、六题输入及判尺、`deepseek-v4-pro`、Thinking high、High `maxTokens=4000`、并发 1、状态合同、可见投影、60 秒硬门、重试／恢复／回退 0。v2.4 候选、运行器、原始结果和 No-Go 身份保持原样。

## 3. 预算、质量门与停止点

新离线预算最多 `6` 次：首题 `1` 次，其余五题 `5` 次。先运行 `RPR-REAL-19-CORRECTION`：

- HTTP 200、目标模型、`finishReason=stop`、JSON、来源、审计映射和状态合同全部有效后，才进入内容评审；
- 两段超过 `60s`、截断、解析失败、来源错误、审计映射错误或状态合同失败时立即停止，语义质量记为未评价；
- 逐例按“完整相关原文 → 冻结 Low → High 原始输出 → 可见追加 → 技术与 Token → Codex 逐问映射 → 产品负责人裁决”交付；
- 首题是硬案例，产品负责人裁决 pass 后才运行其余五题；minor 或 fail 都停止当前候选。

完整六题要求五个硬案例全部 pass，软案例最多一个 minor；完整两段中位耗时不高于 `45s`，每例不高于 `60s`。零问题仍需判断是否遗漏了值得推进的缺口。

`4000` Token 在 v2.4 首题只剩 `253` Token 余量，当前保持固定以维护单因素归因。若 v2.5 触发 `finishReason=length`，本轮记为 Token 容量不足、语义效果未知；下一身份只调整 Token 上限。

页面接入、提交、推送、部署和 Preview 等待离线六题 Go。Production 继续使用 `event_centered + baseline`。

## 4. 实施与验证

1. 新建独立 v2.5 候选、严格解析、审计来源校验和审计—可见问题一致性检查。
2. 新建独立运行器、私有账本、原文优先评审卡、公开启动卡、回执、阶段账和交接。
3. 自动验证覆盖：已有答案候选退出、未知且值得问的候选进入、未知但低价值候选退出、零问题、非法来源、可见问题映射、冻结 Low、四题空主线与两题已有主线、预算和隐私边界。
4. 运行前检查评测规范 SHA、目标模型、专项测试、类型、定向 Lint、JSON、私有权限、`docs:check` 和 `git diff --check`。
5. 首题形成真实输出后先交付产品负责人；离线质量门通过后再设计页面、恢复、Preview 和发布验证。

## 5. 当前状态

- 产品授权：产品负责人已授权 Codex 自主确定计划并持续解决该问题。
- 实施状态：`已确认·实施中`。
- 模型调用：`0/6`。
- 结果状态：待验证。
- 当前停止点：完成 v2.5 静态验证后，只运行首题并交付原文裁决。
