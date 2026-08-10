# GI-087｜“共同任务＋当前探查”历史候选资产

## 为什么建立本候选

GI-085 暴露出 `focus → openPart → visible` 的语义收窄：整体焦点可以保留多个相互影响的内容，下一步却容易把它缩成单侧选择，并在用户选择入口后丢失整段对话仍需弄清的问题。GI-086 的 Thinking 配对没有提供稳定正向证据，当前回到任务结构处理这一根因。

GI-087 使用两层结构：

- `workingTask` 保存整段对话正在共同弄清的问题；
- `nextInquiry` 保存本轮一项可回答内容，以及这份回答将怎样更新共同任务。

## 候选组成

- 最小基础 Prompt 与零评测案例的 Interview Skill；
- 单轮输入合同与输出合同；
- `AUT1 / AUT2 / H1 / H2 / PAUSE / INDEP` 六题输入；
- 六题来源血缘账本，以及 AUT1/AUT2 的版本化逐字摘录；账本记录只读来源、会话／Trace 定位和提取边界；
- 与模型隔离的评测判尺；
- 零调用检查、一次性授权和排他证据写入运行器；
- 透明逐题产品评审模板；
- Manifest、运行计划与授权模板。

原设计将前四题作为历史输入检查点，把旧 AI 回合作为给定上下文；后两题为暂停和独立话题人工护栏。`2026-08-08` 产品负责人确认该设计会让新候选承担旧候选已经造成的语境，无法代表新候选从用户第一段自然表达开始的效果。当前证据身份统一以[六题上下文资格审计](./board7b-working-task-v1-context-eligibility-audit.md)为准。

来源证据分两层：版本化逐字摘录承担可执行事实源并进入来源血缘指纹；Git 排除目录中的原始本机 checkpoint 只承担可选原始回读。干净工作区缺少本机文件时仍可复现全部请求；本机文件存在时会额外逐条核对 id、角色和原文，发现差异立即停止。

## 六题运行结果与当前停止点

- 候选版本：`2026-08-07.board7b-working-task-v1`
- 候选指纹：`e45f431f21819b668422c5da64678ad22fb6ef3f3eee285aa9e9c8fb533321aa`
- 数据指纹：`f2046402a854743d215219a78b35a7447b6bb335c13308d457ef5dbb8cfcd41d`
- 来源血缘指纹：`7f234016d361fd3cc082b4cd6f91bd3ad48df00c63cfd641baf406d08e8f8eac`
- 请求集指纹：`b83d8ae3c34d36f91454b4d27546509872d727474fd98bc7bf2de5ed93d9bfeb`
- 判尺指纹：`901b7fd29af40b930a6272cc7464d7fafd23c5076b0199da0cef1b5c783e7194`
- 执行指纹：`6b909f50b9c98fb1b8fa2d9265010ccf58870bc4bea714482c231fb6b1247c5b`
- 真人工作台执行指纹：`965682241f8fd2b95c87466bd8ab3f0368626af24fe8989406008bbac5205802`
- 基础调用预算：`6`
- 手动技术重试上限：`2`
- 质量重试：`0`
- 自动技术重试：`0`
- 授权状态：`六题一次性授权已消费`
- Run 指纹：`2881fb9d0e1b48f4c8325dfdbe4a813925513a6320cc04f79c27717e0638cfc2`
- 模型调用：`6/6`
- 运行结果：`valid 5；protected_failure 1；model_contract_failure 0；technical_failure 0`
- 重试：`自动技术重试 0；质量重试 0；手动技术重试 0`
- Codex 初评：`可直接使用 1；轻微问题 2；质量失败 2；单例阻断 1`
- 上下文资格：`纯净起点 2；历史条件式探针 3；程序合同探针 1`
- 当前质量门：`原组六题聚合口径停止使用`
- 真人网页轨迹：`六题质量门上下文资格不足；PAUSE 程序风险待纯净同候选轨迹复核；继续关闭`
- Production：`legacy + baseline`

六题运行前的零调用检查已经完成；候选、数据、来源血缘、请求集、判尺和执行指纹均已匹配。一次性授权已经消费，重复执行会在调用前被拒绝。

```bash
npx vite-node -c vitest.config.ts scripts/inspect-board7b-working-task-v1.ts
npx vite-node -c vitest.config.ts scripts/run-board7b-working-task-v1-workbench.ts --check
```

六题运行与真人工作台各自使用独立授权。真人工作台还会绑定六题原始结果、正式评审材料、产品裁决和工作台执行指纹；当前六题上下文资格不足，PAUSE 程序风险也等待纯净同候选轨迹复核，因此工作台授权门保持关闭。

运行结果见 [版本化结果](./board7b-working-task-v1-regression-result.json)、[Codex 独立初评](./board7b-working-task-v1-codex-review.md)、[产品负责人透明裁决](./board7b-working-task-v1-product-review.md)和[六题上下文资格审计](./board7b-working-task-v1-context-eligibility-audit.md)。

若基础运行留下技术失败，产品负责人可以在同一授权预算内逐题触发严格手动重试。本次技术失败为 `0`，因此当前没有可重试题目：

```bash
npx vite-node -c vitest.config.ts scripts/execute-board7b-working-task-v1-regression.ts --retry-case AUT1
```

入口只接受最新结果仍为 `technical_failure` 的题目。每次重试沿用原请求指纹，原失败保持不变；两次预算消费、请求和新结果分别追加记录。质量失败、结构失败和已经成功的题目都会在请求发出前被拒绝。

Codex 独立九维初评继续作为审计前历史记录。原六题逐题裁决已经停止；AUT1 的“可直接使用”和 AUT2 的“轻微问题”按各自证据身份保存。原“最小纯净评测包”计划已由 [GI-088 真人交互开发评测集 v1 与透明 Thinking 对照](../2026-08-09-gi088-human-eval-v1/README.md)覆盖：纠正、动态深入与暂停通过同一候选从纯净起点生成的完整轨迹验证。GI-088 v0 的 `1600` Token 上限失败继续作为历史证据保存。GI-087 的 Prompt、Interview Skill 与任务结构继续作为两种配置共同使用的候选基线；新运行使用 GI-088 v1 指纹和独立授权。
