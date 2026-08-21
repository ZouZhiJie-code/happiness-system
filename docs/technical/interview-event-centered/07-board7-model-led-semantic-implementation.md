# 板块 7｜模型主导语义判断的候选实现与验证

- 文档职责：当前专项
- 文档状态：现役
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)

产品决策状态：`当前运行合同 v1 已确认；继承 GI-067 / GI-068～080 冻结结论；GI-081～088 的旧候选、结果和运行身份只承担历史证据职责`

落地验证状态：`v1.9 隔离 Preview 产品裁决 4/4 pass；Production 候选部署实施中；正式域名 baseline`

Production：`正式域名保持 event_centered + baseline；v1.9 Preview 产品裁决 4/4 pass；快照、备份、回退与发布状态机本地门禁完成；候选部署实施中`

工作方法：[生成式访谈 AI 产品工作方法 v1.0](./00-generative-interview-ai-product-working-method.md)（`已冻结`）

总状态导航：[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)

上游产品架构：[04x｜GI-067 全局架构](./04x-board4-gi067-interview-question-strategy-global-framework.md)

板块 5 输入：[稳定性、用户控制与交互收束](./05-board5-stability-user-control-and-interaction-scope.md)

板块 6 输入：[生成式访谈质量评测 v1](./04j-generative-quality-evaluation-v1.md)

板块 8 交接：[Preview、Go/No-Go 与 Production 授权](./04p-board8-preview-go-no-go-production-authorization.md)

> 本文是生成式访谈实现层的唯一当前入口。当前职责和现行规则只在这里维护；总 Map、Handoff、评测文档和问题台账只保存状态、证据与本页链接。GI-081～088 的诊断过程统一归入历史证据。

## 完整回应优先 v1.6 隔离 Preview 运行合同｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 当前专项 | [v1.9 Production 发布工具](../../plans/2026-08-20-gi088-complete-response-first-v1-9-production-release-runner.md) |
| 可见链路 | 一次调用生成一条完整气泡；`deepseek-v4-pro`、Thinking disabled、`1280` Token、45 秒硬门 |
| 后台链路 | 第二次调用只整理事实与纠正；同模型、Thinking disabled、`1600` Token、20 秒硬门；零可见写权限 |
| 正式一致性 | 当前策略强制选择 Pro；后台解析使用 v1.7 来源对齐并保存真实原文片段 |
| 工程门 | 发布工具 `11/11`、v1.9 相关 `101/101`、全量 `3694` 条测试、Lint、类型、两套 Prisma、Production build、文档与差异检查通过 |
| Preview 技术结果 | 首条可见内容 `4026ms` 就绪；后台 `3341ms` 完成且气泡冻结；重复提交复用原结果，新增模型调用 `0` |
| 当前状态 | v1.9 Preview 产品裁决 `4/4 pass`；可见预算 `15/15`；发布状态机本地门禁通过；候选部署实施中；正式域名 baseline |

## 完整回应优先 v1.7 后台来源对齐合同｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 当前专项 | [v1.9 局部边界与继续优先级](../../plans/2026-08-20-gi088-complete-response-first-v1-9-local-boundary-continue.md) |
| 语义责任 | 模型继续选择事实、摘要、类别与纠正目标；自然度、忠实度和重要性由原文评审 |
| 来源责任 | 实质字符连续逐字唯一匹配时，程序容忍空白／标点差异并保存用户原文真实片段；其他变化继续拒绝 |
| 复用范围 | v1.6 前六条实际可见输出冻结；补两条可见输出；八条后台重新调用 |
| 运行配置 | 可见仍为 `1280` Token／45 秒；后台仍为 `1600` Token／20 秒；Thinking disabled |
| 实际结果 | 新调用 `10/10`；八条可见与八条后台技术有效；Codex 可见 `6 pass / 2 minor / 0 fail`、后台 `8 pass / 0 minor / 0 fail` |
| 当前状态 | v1.9 Preview Codex `4/4 pass`；等待产品负责人验收，Production baseline |

## 完整回应优先 v1.8 明确推进义务｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 当前专项 | [v1.8 明确推进义务](../../plans/2026-08-20-gi088-complete-response-first-v1-8-explicit-progress-obligation.md) |
| 触发条件 | 用户明确说继续、深挖、换方向，或点名想讨论的对象／差别 |
| 模型责任 | 直接兑现本轮动作；上一条未回答问题本轮视为已跳过；选择一个有依据且尚未回答的新层，或给出可纠正理解和低负担入口 |
| 明确避免 | 重复、改写、缩窄上一问题；询问是否讨论用户已经点明的方向；把未回答的旧选项作为条件继续追问 |
| 程序责任 | 策略身份、来源、预算、权限、超时、幂等、持久化和写入权；不判断新层是否有价值 |
| 固定配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、单次可见调用；后台事实独立 |
| 当前状态 | `已确认·实施中 / 结果待验证` |

## 完整回应优先 v1.6 新案例稳定性复验合同｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 当前专项 | [v1.6 新案例稳定性复验](../../plans/2026-08-20-gi088-complete-response-first-v1-6-fresh-stability-replay.md) |
| 可见责任 | 冻结 v1.6，一次调用独立交付完整回应；承接、意图兑现和一个新入口共同形成一条自然回复 |
| 后台责任 | 冻结后台 facts v1，只整理用户明确事实与纠正，不改写可见气泡 |
| 数据 | 八个未参与 v1.6 调优的封存检查点；完整相关对话；每例从初始语义状态开始 |
| 程序责任 | 身份、来源、预算、调用前记账、超时、隐私和确定性合同；不硬判语义自然度与问题价值 |
| 运行配置 | 可见 `1280` Token／45 秒；后台 `1600` Token／20 秒；Thinking disabled；各一次调用 |
| 实际结果 | `12/16`；六条可见有效、前五条后台有效，第六条因一处标点变化触发来源合同 |
| 当前状态 | `No-Go / stop`；由 v1.7 来源对齐接续，Production baseline |

## 完整回应优先 v1.6 后台状态合同｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 当前专项 | [v1.6 后台状态与上线准备](../../plans/2026-08-20-gi088-complete-response-first-v1-6-background-state-readiness.md) |
| 可见责任 | v1.6 首个调用独立拥有整条用户可见回应，完成后冻结 |
| 后台责任 | 第二个调用只输出用户事实和纠正；每条事实必须绑定当前用户原话，允许空结果 |
| 程序责任 | 持久任务、调用前记账、一次预算、顺序应用、迟到失权、幂等、隐私和失败恢复 |
| 明确排除 | 后台不生成问题、开放方向、气泡、动机、心理结论或第三方心理 |
| 运行配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1600` Token、20 秒、一次尝试 |
| 实际结果 | `8/8 technical_valid`；中位 `4388ms`、最长 `11318ms`；Codex `7 pass / 1 minor / 0 fail` |
| 持久任务实现 | 同事务创建任务；调用前记账；结果先保存后应用；顺序处理；写入权失效取消；后台失败不阻断后续任务；复用现有 Trace，无数据库迁移 |
| 本地验证 | 专项 `84/84`、全量 `3649` 条、类型、Lint、两套 Prisma 与 Production build 通过 |
| 当前状态 | `本地接入已验证·产品待确认`；真实 Preview 与发布待验证 |

## 完整回应优先 v1.6 对比式覆盖卡｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 接入身份 | `2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage` |
| 当前专项 | [v1.6 对比式覆盖](../../plans/2026-08-20-gi088-complete-response-first-v1-6-contrastive-coverage.md) |
| 唯一变化 | 在 v1.5 语义层规则后增加两个跨场景对比例子，展示同层近义追问和跨到未答层的差异 |
| 语义责任 | 用户已经明确回答感受时，默认吸收并转向影响、期待、行为、规律或其他真正未答层 |
| 程序责任 | 继承 v1.5：明确停止硬保护，普通问号数量只观察，单气泡原样保存 |
| 运行配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、单次调用、45 秒硬门 |
| 实际结果 | `8/8 technical_valid`；中位 `2915ms`、最长 `5152ms`；Codex `7 pass / 1 minor / 0 fail` |
| 当前状态 | `待确认`；关系题一处未确认感受等待产品裁决，页面、后台状态、Preview 与发布未进入 |


## 完整回应优先 v1.5 语义信息层覆盖结果卡｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 接入身份 | `2026-08-20.gi088-complete-response-first-v1-5-semantic-layer-coverage` |
| 当前专项 | [v1.5 语义信息层覆盖](../../plans/2026-08-20-gi088-complete-response-first-v1-5-semantic-layer-coverage.md) |
| 目标选择 | 先按事件、感受、想法、需要、行为、关系意义、变化规律和影响盘点已回答层，再选一个未覆盖层 |
| 承接责任 | 只自然转述用户明确内容；原因、动机、目标和第三方心理缺少原文时不进入陈述 |
| 程序责任 | 继承 v1.4：明确停止硬保护，普通问号数量只观察，单气泡原样保存 |
| 运行配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、单次调用、45 秒硬门 |
| 实际结果 | `8/8 technical_valid`；中位 `3509ms`、最长 `5324ms`；Codex `6 pass / 1 minor / 1 fail` |
| 当前状态 | `No-Go`；产品裁决 pending，由 v1.6 接续 |


## 完整回应优先 v1.4 有依据的意图兑现卡｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 接入身份 | `2026-08-20.gi088-complete-response-first-v1-4-grounded-intent-owner` |
| 当前专项 | [v1.4 有依据的意图兑现](../../plans/2026-08-20-gi088-complete-response-first-v1-4-grounded-intent-owner.md) |
| 可见责任 | 先确定本轮意图、已知内容、一个未答目标和理解依据，再输出一至两个短段落的完整回应 |
| 依据边界 | 第三方原因、用户动机和心理目标缺少直接原文时省略；问题能够从完整原文回答时删除并重选 |
| 程序责任 | 明确停止后零提问；普通问号数量只作观察，程序保存一个连续回答焦点片段 |
| 运行配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、单次调用、45 秒硬门 |
| 当前状态 | `已确认·实施中`；新预算 `0/8`，结果、页面、后台状态、Preview 与发布待验证 |


## 完整回应优先 v1.3 纯文本可见负责人卡｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 接入身份 | `2026-08-20.gi088-complete-response-first-v1-3-visible-text-owner` |
| 当前专项 | [v1.3 纯文本可见负责人](../../plans/2026-08-20-gi088-complete-response-first-v1-3-visible-text-owner.md) |
| 父结果 | v1.2.1 调用 `8/8`，全部 HTTP 200／stop、正文非空且未截断；合同 `0/8`，结构化首调技术 No-Go |
| 可见责任 | 首个调用只输出一至两个短段落的完整中文回应；自然承接后选择未答新层、低负担入口或自然停止；问题共同服务一个回答焦点 |
| 程序责任 | 保存原话；校验中文、内部词泄漏、明确停止、预算和写入；问号数量只记录观察，不承担非停止场景的语义拦截 |
| 后台状态 | 最多一次独立调用；只整理事实、纠正和开放方向，失败不阻断、不追加、不改写可见回应 |
| 运行配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、一次尝试、45 秒硬门 |
| 运行结果 | `8/8` HTTP 200／stop、正文完整；中位 `3731ms`、最长 `4956ms`；程序合同 `6/8 valid`，两条被问号硬门误拦截 |
| 内容初评 | Codex `5 pass / 1 minor / 2 fail`；产品负责人裁决待确认 |
| 当前状态 | `待确认`；页面、后台状态、Preview 与发布 `not_run`，Production baseline |

## 完整回应优先 v1.2.1 JSON 模式单因素结果卡｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 接入身份 | `2026-08-20.gi088-complete-response-first-v1-2-1-json-mode-off` |
| 当前专项 | [v1.2.1 JSON 模式单因素验证](../../plans/2026-08-20-gi088-complete-response-first-v1-2-1-json-mode-off.md) |
| 父结果 | v1.2 调用 `8/8`，全部 HTTP 200／stop、低于 15 秒且未触发 Token 上限；合同 `4/8` 有效，另 `4/8` 收到非空但不完整的 JSON，技术 No-Go |
| 唯一变化 | Provider 请求省略 `response_format=json_object`；模型输出 Schema、本地解析与状态投影保持固定 |
| 运行配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、一次尝试、45 秒硬门 |
| 预算与质量门 | 同一 `3＋5` 实际消费 `8/8`；合同 `0/8`，未进入逐题语义评审 |
| 实际结果 | `8/8` HTTP 200／stop、正文非空；合同 `0/8`，全部 `INVALID_SCHEMA`；中位 `5402ms`、最长 `11488ms` |
| 当前状态 | `No-Go`；由 v1.3 纯文本首调接续，Preview 未进入，Production baseline |

## 完整回应优先 v1.2 最小生产合同结果卡｜2026-08-20

| 项目 | 当前合同 |
|---|---|
| 接入身份 | `2026-08-20.gi088-complete-response-first-v1-2-minimal-envelope` |
| 当前专项 | [v1.2 最小生产合同](../../plans/2026-08-20-gi088-complete-response-first-v1-2-minimal-envelope.md) |
| 父结果 | v1.1 生产合同调用 `8/8`，全部 HTTP 200／stop／15 秒内；合同仅 `2/8` 有效，两个有效输出均只复述后结束；质量 No-Go |
| 可见责任 | `response` 是模型唯一可见正文，页面只显示一个气泡；问句只作为该正文中可核对的一部分 |
| 状态责任 | 同一输出只提交最多四条本轮事实、一个问题或停止动作、可选纠正引用；程序确定性映射后原子提交 |
| 运行配置 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`1280` Token、一次尝试、45 秒硬门 |
| 隔离与兼容 | 新策略 `complete_response_v1_2`；`baseline`、历史 `generative` 与 v1.1 证据保持兼容；无需数据库迁移 |
| 质量门 | 接入后重新运行相同 `3＋5`；每题展示完整相关原文和实际输出；页面 Preview 最多 `15` 次 |
| 实际结果 | `8/8` HTTP 200／stop；`4/8` 合同有效，`4/8` 非空 JSON 不完整并报 `Unexpected end of JSON input`；中位 `3497.5ms`、最长 `6376ms` |
| 当前状态 | `No-Go`；由 v1.2.1 单因素接续，Preview 未进入，Production baseline |

## 完整回应优先 v1.1 离线结果卡｜2026-08-19

| 项目 | 本专项当前答案 |
|---|---|
| 父结果 | v1 一次调用完整返回 `8/8`，中位 `3087ms`、最长 `6976ms`；RPR-REAL-22 缺低负担入口并新增前提，RPR-REAL-21 复述用户刚给结论，Codex 两题 fail，质量 No-Go；产品裁决 pending |
| 产品决策 | 生成完整回应前先选择一个尚未回答的新信息目标，用户明确继续时进入新层，负担但未停止时保留低负担入口，明确停止时零追问 |
| 候选与运行身份 | `2026-08-19.gi088-complete-response-first-v1-1-new-information-target`；`2026-08-19.gi088-complete-response-first-v1-1-quality-v1` |
| 可见职责 | 一次调用拥有全部可见表达权；Low 与 High 可见追加退出当前实现 |
| 状态职责 | 生产首版复用 `one_call`，最小状态与回复原子提交；页面只展示 `naturalResponse` 一个气泡 |
| 唯一变化 | 模型在组织回应前先选一个未答新增信息目标；每轮最多一处有依据且可纠正的解释与一个主问题 |
| 模型 | `deepseek-v4-pro`、Thinking disabled、Temperature `0.2`、`maxTokens=1280`、零重试／恢复／回退 |
| 提问原则 | 检查意图、问过与答过的信息、预期增量和回答负担；问题数量只观察，主问题只服务一个新增信息目标 |
| 评测 | 同一 `3＋5` 已完成 `8/8`；重试／恢复／回退 `0`；结果逐条交付原文与实际输出 |
| 技术结果 | `8/8 technical_valid / stop`；中位 `3406ms`、最长 `4621ms`；`1280` Token 未截断 |
| Codex 初评 | `7 pass / 1 minor / 0 fail`；硬门长上下文题 `RPR-REAL-21` minor |
| 当前状态 | `awaiting_product_review`；产品负责人裁决 pending，暂不宣称离线 Go |
| 当前状态 | `已确认·实施中`；真实运行、页面、Preview 和发布待验证 |

当前专项：[完整回应优先 v1.1 新信息目标](../../plans/2026-08-19-gi088-complete-response-first-v1-1-new-information-target.md)。v1.1 结果见[公开交接](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-1-quality-v1-handoff.md)与[阶段账](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-1-stage-ledger-v1.json)。

## 1. 当前运行合同

合同版本：`2026-08-16.gi088-board7-current-runtime-contract-v1`

### 1.1 五类主体职责

| 主体 | 当前职责 |
|---|---|
| Prompt | 说明本轮目标、有效输入、用户边界和输出格式 |
| Interview Skill | 回顾已探索内容、寻找新的意义缺口、控制回答负担并组织自然回应 |
| 模型 | 结合完整有效上下文判断语义重复、单一回答焦点、下一步价值和自然表达 |
| 程序 | 保存用户原话、提供有效状态、管理预算、显示、提交和恢复；记录问号数量供观察与复核 |
| 产品负责人 | 裁决回应是否真正推进、表达是否自然，以及候选能否进入下一阶段 |

这里的 `Interview Skill` 指最终 System Prompt 中的一段访谈方法。运行时，程序把基础 Prompt、Interview Skill、有效上下文和输出合同合并后发送给模型；它与 Codex 本地使用的 `SKILL.md` 属于两类资产。

### 1.2 当前单一回答焦点与重复追问规则

| 规则 | 当前解释 |
|---|---|
| 单一回答焦点 | 两到三个问句可以共同服务一个回答目标；用户能够用一段连贯表达覆盖时，属于单一回答焦点 |
| 独立多任务 | 同一回应要求用户分别处理不同事件、人物、时间范围、行动选择或判断任务时，形成多个回答焦点 |
| 问号数量 | 只作 Trace、观察和人工复核线索，不承担显示或质量拦截 |
| 语义重复 | 模型结合完整有效上下文判断新问题是否仍在索取用户已经给过的信息；产品质量评测承担最终裁决 |
| 候选问题自答 | 模型先用有效用户原文尝试回答每个候选问题；已有答案的候选退出，尚未覆盖且预计能改变认识的候选才进入可见问题 |
| 新问题价值 | 新问题需要进入尚未探索、并且能够改变当前理解的层面；原文无法回答且价值不足时同样退出 |
| 用户控制 | 用户明确停止、保存、结束、换一个等客观控制由程序稳定执行 |

### 1.3 已退出的规则

| 历史规则或结果 | 当前替代关系 |
|---|---|
| v5“一轮一个可见问句、一个问号” | 已由 v6“单一回答焦点”取代 |
| `VISIBLE_RESPONSE_MULTIPLE_QUESTIONS` | 只保留旧运行身份中的技术事实；当前质量合同不使用它拦截回应 |
| 两段式候选中的“整段最多一个问句” | 属于错误继承，已经退出当前候选与验证规则 |
| 旧信息增益 A/B 的 A1、B1 | 只保留在错误合同下的诊断证据，不能承担正式信息增益归因 |

## 2. 当前候选与验证状态

| 项目 | 当前状态 |
|---|---|
| 回应优先 v2.2 | 候选 `2026-08-17.gi088-response-first-v2-2-factual-low`；完整六题运行 `2026-08-17.gi088-response-first-v2-2-low-full-quality-v2` 技术与合同有效 `6/6`、中位耗时 `3.797s`；产品负责人依据完整上下文和实际输出裁决 `6/6 pass`，Low 已冻结 |
| 回应优先 v2.3 | `2026-08-17.gi088-response-first-v2-3-grounded-high`；检查点实际运行 `1/3`，HTTP 200，High 耗时 `38.384s`、Low＋High `41.725s`；completion `2000`、reasoning `1985`、`finishReason=length`，只返回 42 个字符的不完整 JSON，合同有效 `0/1`、语义质量 `not_evaluated` |
| High `4000` Token 探针 | `2026-08-17.gi088-response-first-v2-3-high-token-4000-probe-v1`；同题 `1/1`，High `37.066s`、两段 `40.407s`；completion `2072`、reasoning `1898`、`finishReason=stop`，完整 JSON `596` 字符。本题 Token 方向通过；`workingTask=null` 时提交 `understandingChange=add` 触发状态合同失败 |
| 回应优先 v2.4 | `2026-08-17.gi088-response-first-v2-4-null-task-aligned-high-quality-v1`；首题 `1/1` 技术与合同有效，High `51.656s`、两段 `54.997s`，completion `3747`、reasoning `3311`；建立新主线后保存认识，原状态错误消失；Codex 与产品负责人内容裁决均为 fail，No-Go |
| 回应优先 v2.5 | 候选 `2026-08-19.gi088-response-first-v2-5-question-self-answer-high`；运行 `2026-08-19.gi088-response-first-v2-5-question-self-answer-high-quality-v1`；首题预检 HTTP 200、目标模型可用，正式调用 HTTP 200，High `60.013s`、两段 `63.354s`，正文 `0` 字符并记 `TIMEOUT`；`1/6`，其余 `5 not_run`，语义未评价 |
| 回应优先 v2.6 | 候选 `2026-08-19.gi088-response-first-v2-6-low-effort-audited-high`；运行 `2026-08-19.gi088-response-first-v2-6-low-effort-audited-high-quality-v1`；首题 HTTP 200、`finishReason=stop`、合同有效，High `56.668s`、两段 `60.009s`，超硬门 `9ms` |
| 回应优先 v2.7 | 候选 `2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high`；运行 `2026-08-19.gi088-response-first-v2-7-thinking-disabled-audited-high-quality-v1`；首题 HTTP 200、`finishReason=stop`、合同有效，High `1.847s`、两段 `5.188s`，45／60 秒门均通过；reasoning 缺失、Token 为 `null` |
| v2.7 可见与语义 | 可见理解 `null`、问题 `0`、审计候选 `0`；可见 Low-only 体验 Codex pass，完整 High 因纠正未保存而 Codex fail，产品负责人裁决 pending |
| v2.7 因果断点 | 空主线与空认识保持 `unchanged/none`；后续 CONTINUE 夹具预置主线、认识与失效项，无法证明本轮真实连续性 |
| 回应优先 v2.8 | 候选 `2026-08-19.gi088-response-first-v2-8-correction-persistence-high`；运行 `2026-08-19.gi088-response-first-v2-8-correction-persistence-high-quality-v1`；唯一因素为 High 增加 audit-first 的 `correctionPersistenceAudit` |
| v2.8 固定因素 | 模型、Thinking disabled、`4000` Token、冻结 Low、六题用户原文与判尺、问题审计、JSON 主体、首题可见理解 `null`、问题 `0` 及 45／60 秒门均固定 |
| v2.8 首题技术 | HTTP 200、`finishReason=stop`、合同有效；High `4.445s`、两段 `7.786s`，45／60 秒门均通过；prompt `3007`、completion `369`、reasoning `null` |
| v2.8 状态与可见 | 审计 `persist`，引用 `U3`、标记 `A2` 被替代；主线 `set_new`、认识 `add`；真实 post-state 已生成，High 可见理解 `null`、问题 `0` |
| v2.8 质量与因果 | 可见体验和纠正持久化 Codex pass；`workingTask` 与 `understanding` 同摘要形成 `state-role minor`；产品负责人原文裁决 `minor` |
| v2.8 原预算与门 | 独立账 `1/6`，其余 `5 retired_not_run`；原 runner 退役，真实 CONTINUE 转入 v2.8.1 |
| v2.8.1 验证范围 | 候选仍为 v2.8；运行身份 `2026-08-19.gi088-response-first-v2-8-1-causal-continuation-probe-v1`；只验证真实 `RPR-REAL-19-CONTINUE`，严格 Low → High，各 1 次；首题产品裁决 `minor`，当前可运行 |
| v2.8.1 因果门 | 首题响应与 post-state 哈希绑定；冻结候选重新解析 High 并重放状态；High 输入绑定本次实际 Low；两次调用后立即进入第二产品停止门 |
| v2.8.1 Prepare | 计划指纹 `26604324…91600`；父计划指纹重算、raw High 重解析校验、post-state 重投影与哈希一致性均通过；公开启动卡／回执和 `0600` 私有账本已生成 |
| v2.8.1 CLI 门 | 实际 execute 在 Provider 前因缺少产品负责人双哈希裁决停止；Low／High 均未开始 |
| v2.8.1 预算与状态 | 新账 `2/2`，重试／恢复／回退 0；Low `5798ms` pass；High `5864ms`、合同失败、无 post-state、重复询问 U1 已回答案例；产品裁决 fail，整体 No-Go；Preview `0/15 not_run` |
| 回应优先 v2.9 | 候选 `2026-08-19.gi088-response-first-v2-9-separated-open-gap-high`；运行族 `2026-08-19.gi088-response-first-v2-9-two-turn-causal-quality-v1`；当前首题 `2026-08-19.gi088-response-first-v2-9-correction-gate-v1` |
| v2.9 预算与停止门 | 总上限 `7`；纠正题 High 已完成 `1/1`；真实 CONTINUE Low＋High 已完成 `2/2`，后续 `4 not_run`；当前停在完整原文产品门 |
| v2.9 固定与边界 | v2.2 Low、`deepseek-v4-pro`、Thinking 关闭、High `4000` Token、数据与时间门冻结；页面、Preview 与发布 not_run，Production baseline |
| v2.9 首题技术与速度 | HTTP 200、`finishReason=stop`、合同有效；High `3325ms`、冻结 Low `3341ms`、观察两段 `6666ms`；prompt `1981`、completion `151`、总计 `2132`；45／60 秒门与 `4000` Token 门通过 |
| v2.9 首题状态与可见 | `understandingChange=add/correction`，依据 `U3`、标记 `A2` 被替代；`openTaskChange=none`，post-state `workingTask=null` 且认识数为 1；High 可见理解 `null`、问题 `0` |
| v2.9 首题裁决 | Codex 初评与产品负责人裁决均为 `pass`；真实 CONTINUE 继承父实际气泡和 post-state，U4 保持冻结 |
| v2.9 真实 CONTINUE 结果 | Low 有效、`3967ms`、Codex minor；High HTTP 200／stop／完整 JSON、`1885ms`，没有覆盖判断或开放任务，三项状态合同失败；纯时间 `5852ms` 通过，整体技术门 false；Codex 与产品均裁决完整回合 fail |
| 回应优先 v2.1 速度 | Low 三题耗时 `4.848 / 4.664 / 4.960s`，中位数 `4.848s`；当前三题速度门通过 |
| 回应优先 v2.1 合同与质量 | HTTP 200、合同有效、正文完整均为 `3/3`；Codex 私有初评 `0 pass / 0 minor / 3 fail`，形成 No-Go |
| 关键结果 | v2.7 关闭 Thinking 后首题两段从 v2.6 的 `60.009s` 降至 `5.188s`，技术和合同通过；可见体验 Codex pass，完整 High Codex fail |
| 旧信息增益 A/B | A1、B1 均 HTTP 200 且正文可解析；按当前单一回答焦点规则均可显示 |
| 产品质量判断 | A1、B1 都在语义上重复索取已经探索过的信息 |
| 归因边界 | 原 A/B 请求携带废弃的单问号规则，原身份无法承担正式信息增益归因；B2、A2 保持 `not_run` |
| 当前候选方向 | v2.9 首题已证明纠正认识可以在开放任务为空时保存；真实 CONTINUE 的实际 High 选择零推进，产品裁决 fail，本轮停止且不预同步新候选 |
| v2.9 当前结果 | [真实纠正后继续结果](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-9-causal-continuation-gate-v1-handoff.md)；纠正首题产品 pass，当前 `2/2`，后续 `4 not_run` |
| v2.8.1 当前专项 | [真实连续回合因果探针](../../plans/2026-08-19-gi088-response-first-v2-8-1-causal-continuation-probe.md)；调用 `2/2`，产品裁决 fail，No-Go / stop |
| v2.8 历史专项 | [Correction-persistence High](../../plans/2026-08-19-gi088-response-first-v2-8-correction-persistence-high.md)；`1/6`，其余 `5 retired_not_run` |
| v2.8 公开证据 | [首题交接](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-8-correction-persistence-high-quality-v1-handoff.md)与[阶段账](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-8-stage-ledger-v1.json)只保存摘要、指标、状态引用与哈希 |
| v2.7 当前专项 | [Thinking-disabled Audited High](../../plans/2026-08-19-gi088-response-first-v2-7-thinking-disabled-audited-high.md)；`1/6`，其余 `5 not_run` |
| v2.7 公开证据 | [首题交接](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-7-thinking-disabled-audited-high-quality-v1-handoff.md)与[阶段账](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-7-stage-ledger-v1.json)只保存摘要、指标与哈希 |
| v2.6 公开证据 | [首题交接](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-6-low-effort-audited-high-quality-v1-handoff.md)与[阶段账](../../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/response-first-v2-6-stage-ledger-v1.json)只保存摘要、指标与哈希 |
| 页面与发布 | 回应优先页面接入、真实页面验收和 Preview `not_run`；Production 保持原有边界 |

`relationship_claim_status_v1` 的两题探针继续作为历史诊断：HTTP 200 `2/2`、正文等待后技术有效 `0/2`，语义状态未知。它不改变上表的当前提问合同。

## 3. 继承的产品与评测输入

板块 7 以 `GI-068～080` 冻结规则、板块 6 正式评测资产和当前工程事实为输入。旧候选中的字段、Prompt、模型参数和程序门只在重新核对当前合同后复用。

| 所需输入 | 当前状态 | 对板块 7 的影响 |
|---|---|---|
| `GI-068～074` 产品架构与评测方法 | `已冻结·高置信度；落地验证未启动` | 直接继承，保持结论关闭 |
| 板块 5 产品行为约定 | `GI-075～080 六类规则完成 6/6` | 继承模式、来源、纠正、恢复和用户控制；提问负担以本页当前合同为准 |
| 板块 6 正式评测资产 | `真实问题回归集 v1.2 已封存；QR-04 判尺保持有效` | 技术有效、语义质量和产品体验分别裁决 |
| 工程事实 | 事件中心、可靠提交、恢复、日志、Trace、Provider 与发布隔离已有现役实现 | 候选只改变本轮明确因素，程序稳定边界继续复用 |
| Production | `event_centered + baseline` | 保持当前主链；`legacy + baseline` 只承担应急回退与历史身份 |

### 3.1 候选启动条件

1. 总 Map、板块 5、板块 6 与本页的当前范围、状态和 Production 边界一致。
2. 每轮先绑定候选、Prompt、Interview Skill、数据集、评测规范和执行身份的完整版本与指纹。
3. 产品负责人已经确认本轮产品决定、质量门、预算和停止点。
4. 历史规则进入新候选前，逐项说明当前依据、责任主体和自动失败后果。

### 3.2 直接继承的冻结事实

板块 7 只负责实现与验证以下产品事实，保持产品结论关闭：

| 决策 | 冻结事实 | 对候选实现的约束 |
|---|---|---|
| `GI-068` | 每次新记录显式选择【帮我记】或【陪我聊】；记录内保持所选模式；模式变化统一执行“结束当前记录后，在新记录入口重新选择模式”；跨模式不继承次数、认识、材料或支线 | 候选必须提供清楚的记录级模式、独立上下文和结束后新入口；【帮我记】执行用户表达后零追问及多片段单篇日志 |
| `GI-069` | 【陪我聊】阶段 1 形成有用户来源、单一、可修正的临时工作焦点；用户焦点拥有主线权；定位常规 `0～1` 问，第 2 问只用于第一问已有定位进展且仍有两条证据接近、路径不同的竞争方向 | 候选需要保留焦点、来源、修正和阶段回返所需事实；统一计数合同继承 `GI-075` |
| `GI-070` | 阶段 2 反映优先；模型自主选择直接认识、一个贴近体验的问题或暂停；常规 `0～1` 问，第 2 问只用于第一问已有进展后补足同一焦点的小连接，或首次“说不清”时提供真正更轻的新入口；未纠正的 AI 认识可自然确认并进入日志 | 正常语义判断由模型承担；程序提供计数、来源、控制和输出边界 |
| `GI-071` | 阶段 3 围绕用户主动打开的一个未解部分动态深化；依据认识变化、剩余价值和回答负担问停；阶段 3 无数字问题上限 | 候选需要向模型提供连续有效语境及当前未解部分；程序不新增阶段 3 数字上限 |
| `GI-072` | 高频回答状态使用统一处理顺序；决策支持、外部信息、独立事件和话题差异只修正当前动作、证据和风险边界 | Prompt／Interview Skill 承载跨场景原则和代表案例，正常链路不建立逐场景语义路由表 |
| `GI-073` | 含正式问题的动作使用同一 AI 回合内“理解回应＋主回应”；直接认识、成果、开放和暂停使用单段主回应；阶段与内部推理对用户隐藏 | 候选需要实现一致的用户可见消息合同，并保留单轮一个主要动作 |
| `GI-074` | 使用六步评测闭环、三类评测单位、逐维 `2/1/0/N/A`、分级风险、冷启动和运行集，以及两模式 `4＋2` Preview | 板块 7 按板块 6 的正式资产验证候选，输出可复核 Trace 与运行报告；局部技术通过不承担端到端发布授权 |

### 3.3 当前开放实施问题

以下内容等待后续候选逐项验证：

- 基础 Prompt 与 Interview Skill 的正式内容、版本和运行时合并方式；
- 完整对话、已探索内容、当前任务、认识、未解部分、负担信号与来源状态怎样投影给模型；
- 首段回应与后台结构化分别采用哪些模型、推理强度和输出合同；
- 后台语义决定由模型提交到什么粒度，程序如何投影为兼容结构；
- 首段显示、后台提交、失败恢复、幂等、输入锁定和两段式页面状态怎样接入；
- Trace、评测运行器、候选血缘、Preview 与发布隔离采用哪些具体接口。

### 3.4 正式输入合同

#### 产品输入

1. `GI-068～074` 的冻结决策、适用范围、正反案例和硬失败。
2. 板块 5 六类产品行为约定：阶段 1～2 计数、问题修复、回复版本、焦点纠正、中断与失败恢复、成果或暂停后的交互收束。
3. 两种模式从入口、对话、日志到结束记录的完整用户路径。
4. 当前 MVP 范围、排除范围与 Production 边界。

#### 评测输入

1. 板块 6 冻结的评测单位、结果分类和逐维评分卡。
2. 硬边界集、开发集、独立准入集和受影响完整轨迹。
3. AI Judge 说明、人工复核规则、阻断项和报告模板。
4. 板块 8 两模式 `4＋2` 所需的候选血缘、回放和冒烟要求。

#### 工程事实输入

1. 当前事件中心的会话、消息、可靠提交、恢复、日志和 Trace 事实。
2. 当前 Provider、模型、运行配置、兼容链路和发布隔离状态。
3. 现有确定性保护、测试资产、已知限制与真实运行证据。
4. `04m / 04n / 04o` 及相关历史候选中可复用的技术事实和失败原因。

## 4. 候选实施、验证和退出要求

### 4.1 固定输出

板块 7 完成时需要交付以下内容：

1. **候选实现规格**：说明用户路径、模型职责、程序职责、上下文、调用、状态、消息、恢复、日志和兼容方案。
2. **接口与状态合同**：记录公开接口、内部结构、持久化、迁移、兼容和回退影响；具体字段以当时验证后的方案为准。
3. **Prompt／Interview Skill 资产**：保存目标、原则、优先级、代表案例、版本及输入输出约束。
4. **Trace 与候选血缘**：能够复核本轮有效输入、候选版本、最终动作、用户可见输出、失败位置、恢复结果和评测结果。
5. **验证报告**：按板块 6 的对象、数据集、评分卡和准入门报告确定性检查、模型评测、完整轨迹与差异检查结果。
6. **板块 8 交接包**：提供 Preview 候选标识、配置快照、`4＋2` 运行入口、已知风险、回退入口和人工验收注意事项。
7. **状态同步**：更新总 Map 与相关专项，清楚区分已确认实现事实、待验证假设、失败候选和历史证据。

### 4.2 候选设计与验证顺序

板块 7 启动后按以下顺序推进：

1. **核对输入**：逐项确认板块 5 行为约定和板块 6 评测资产完整，发现冲突时回到对应上游板块处理。
2. **读取当前实现**：确认现有会话、可靠提交、恢复、日志、Trace、Provider 和发布隔离的真实边界。
3. **提出最小候选**：一次明确一个主要变化对象，并说明用户价值、兼容范围、风险与预期证据。
4. **确认上下文资格**：单轮从用户第一段自然表达开始；多轮 AI 回合全部来自同一候选和同一 Trace；历史与合同探针分轨保存。
5. **冻结候选规格**：产品负责人确认后再形成开发执行计划；产品规则继续以板块 4～6 为准。
6. **实现与客观验证**：完成结构、计数、来源、控制、安全、恢复、兼容和构建检查。
7. **运行质量评测**：依次使用目标开发子集、相邻风险、独立准入集和受影响完整轨迹。
8. **形成候选裁决**：通过全部板块 6 准入门后生成板块 8 交接；失败时保留候选、证据和单一变量归因。

具体测试数量、阈值和人工复核比例以板块 6 当时冻结的正式资产为准。

### 4.3 退出条件

板块 7 只有在以下条件全部满足后才能交接板块 8：

1. 板块 5 与板块 6 的正式输入完整，候选没有重开 `GI-068～074` 的产品结论。
2. 模型语义自主与程序硬保护拥有清楚、可测试且无冲突的实现边界。
3. 两模式目标路径、用户控制、记录隔离、恢复、日志和兼容链路完成候选实现。
4. 候选通过板块 6 规定的硬边界、开发回归、独立准入和受影响完整轨迹。
5. Trace、候选血缘、失败归因、已知风险、配置快照和回退入口可供复核。
6. 板块 8 所需的两模式 `4＋2` 运行与人工验收材料齐备。
7. 总 Map、板块 5～8 专项和候选报告中的状态、版本、依赖及 Production 边界一致。

板块 7 退出只代表新候选具备进入真人 Preview 的资格。Go/No-Go 与 Production 发布继续由板块 8 和产品负责人单独裁决。

## 5. 历史候选与历史证据

以下内容均为历史身份，用于说明规则怎样形成、哪些路线已经失败以及哪些工程事实可以复用。历史段落中的“当前”“正式”“单轮一问”等词只描述对应版本当时的合同。

### 5.1 GI-081 隔离诊断子步

产品负责人已确认在板块 6 完整退出前开放一个小范围真实输出诊断，帮助板块 6 根据实际模型问题扩建判尺。该子步不改变板块 7 正式启动门。

固定范围：

1. 数据使用三条已核验的隔离 Preview 真人决策点和三条目标案例，模式分布为【帮我记】`2`、【陪我聊】`4`。
2. 候选 A 使用一次结构化调用，同时产生语义与可见回应；候选 B 使用语义与表达两阶段。
3. 两种候选共同固定 `deepseek-v4-flash`、温度 `0.2`、Thinking 关闭和同一产品规则。
4. 基础生成请求为 `18`，全批最多 `3` 次技术失败重试，质量重试为 `0`。
5. 当前[候选确认包](../../../artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/board7a-six-case-ab-v1-confirmation.md)指纹为 `32703f687342868a359f3b682b216f0a8965b0608096781f535f4303adc68248`。产品负责人完成单独授权后，六题运行使用 `18/18` 次基础生成请求，技术重试 `0`、质量重试 `0`，两组共 `12` 段用户可见回应均达到技术终态。
6. 产品负责人完成盲评后再揭晓架构和候选 B 的结构化语义；Codex 初评继续独立保存。
7. 只有单例阻断为 `0`、至少 `4/6` 可用、普通质量失败最多 `2/6` 的候选可以进入两条完整轨迹；完整轨迹另行授权。

该子步使用独立评测数据、Prompt、结构、运行器、预算和 Trace 文件。公开 API、页面、数据库、线上 Prompt、配置和运行开关保持原样；Production 继续使用 `legacy + baseline`。

产品负责人完成盲评后，两种候选按产品裁决均为可直接使用 `4/6`、质量失败 `2/6`、单例阻断 `0`，机械满足上述门槛；候选 B 在 H2 获得唯一相对偏好。方法复核发现，模型实际收到用户任务、模式、预置完整对话和最新用户消息编号；案例数据中的 `stage / evaluationFocus / hardBoundaries / allowedActions` 未进入模型输入。H1、H2、H3 和 T3 的前置 AI 回合也未由当前候选产生，因此只承担条件式局部诊断。共享 Prompt 同时包含模式任务、问停方法、表达要求和证据约束，已经触及板块 7 的产品策略；其证据身份固定为“GI-081 临时 Prompt 下的诊断基线”，用于发现真实失败，架构胜出和正式 Prompt 正确性继续开放。完整结论见[六题揭晓与对照](../../../artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/board7a-six-case-ab-v1-reconciliation.md)。

### 5.2 GI-082 单任务双分支补证

产品负责人确认使用一个真实【陪我聊】任务，让匿名分支甲、乙从相同模式和第一段用户材料开始，各自保持完整上下文。用户只依据当前分支及共同事实卡自然回答；后续问题、回答和新认识允许分叉。最终比较用户目标、焦点与来源、下一问价值、认识结果、负担、控制、失败和阻断，不按相同后续文本做逐轮强配对。

本轮终点为访谈结果分类，暂不运行日志链路。每次用户输入只触发当前分支的一次用户可见回合；匿名身份和结构化语义在两条分支完成盲评前保持封存。建议基础请求上限 `18`、技术失败重试上限 `3`、质量重试 `0`；预算只约束本轮评测资源。

当前[运行确认包](../../../artifacts/generative-interview-board7/2026-08-06-board7a-chat-e2e-ab-v1/board7a-chat-e2e-ab-v1-confirmation.md)与[用户事实卡](../../../artifacts/generative-interview-board7/2026-08-06-board7a-chat-e2e-ab-v1/board7a-chat-e2e-ab-v1-user-fact-card.md)已建立。等待产品负责人提供第一段真实表达和希望弄清的目标；随后冻结完整 Prompt、匿名映射、包指纹与预算，再提交独立运行授权。当前模型调用 `0`。

GI-082 的双分支方法及模型调用 `0` 状态继续保留。当时执行入口由 GI-083 收窄为一次调用透明诊断，先用最简单可行结构发现一条真实轨迹中的问题；重复证据持续指向语义判断与表达生成互相干扰时，再建立两阶段候选做单变量比较。该入口现已由 GI-088 覆盖。

### 5.3 GI-083 四层分工与一次调用透明诊断

产品负责人确认以下职责：

| 层 | 当前职责 | 本轮产物 |
|---|---|---|
| 基础 Prompt | 当前模式、用户可能没有预设目标、共同优先级、允许动作和输出格式 | `2026-08-07.gi083-direct-base-prompt-v1` |
| Interview Skill | 完整语境、焦点、问停、纠正、回答负担和自然表达；没有预设目标、并存感受、用户纠正、再次说不清四个代表例说明判断方法 | `2026-08-07.gi083-direct-interview-skill-v1.1` |
| 程序保护 | 模式保持、单轮一问、用户原话来源、上下文隔离、用户控制、手动技术恢复和终态封存 | 本机工作台与确定性校验 |
| 评测案例 | 代表场景、长尾表达、真实失败、九维判尺、根因和回归证据 | 原始 Trace、聊后感受、脱敏裁决 |

本轮固定使用 `deepseek-v4-flash` 一次完成语义判断与可见回应，温度 `0.2`、Thinking 关闭、质量重试 `0`、自动技术重试 `0`。内部最小结构为 `semantic.action / focus / evidenceRefs / questionGoal / limitReason` 与 `visible.understanding / response`。证据只引用当前轨迹中的用户原话；提问最多一个问题，承接、形成认识和暂停保持零问题。

v0 需要在运行前填写事实卡、预设目标、已知／未知内容和成功标志，会提前整理真实用户思路。它在模型调用 `0` 时由 v1 校正替代，全部文件继续作为历史证据保存。

v1 本机工作台只绑定 `127.0.0.1`，每次启动生成随机令牌并进入 `awaiting_start`。产品负责人点击【开始真实体验】后，由网页生成本机批准记录、唯一 `trajectoryId`、运行指纹和 checkpoint，并把固定开场“此刻你想聊点什么？”作为 `A0` 写入完整上下文；该步骤模型调用 `0`。产品负责人回答后直接与 DeepSeek 交流，每次发送只触发一次请求，刷新直接恢复 checkpoint；技术失败保留原失败并等待手动重试。页面始终展示动作、焦点、原话证据、提问目标或暂停原因。

产品负责人结束时只记录 `better / same / worse` 和可选理由。轨迹封存后，Codex 才读取本机材料，独立完成结果分类、九维评分、单例阻断检查、根因归类和板块 6 回填建议。轨迹终点停在访谈结果，日志生成、编辑和保存进入正式轨迹。

[GI-083 v1 候选包](../../../artifacts/generative-interview-board7/2026-08-07-board7a-chat-e2e-single-v1/README.md)当前 v1.1 指纹为 `2ceb7bb37e196f47dbd70fcd6ffaf0cf3b4c7727ae2e8721e62b593751dbbe46`。完整对话、原始模型输出和逐轮 Trace 只保存到 Git 排除的 `artifacts/local-runtime/`；正式资产只接收产品负责人确认的脱敏副本、裁决、根因、版本和指纹。

GI-083 的产品负责人真实轨迹仍停在网页开始之前。工程自测已使用三条合成轨迹完成 `5/5` 次真实 DeepSeek 请求，技术失败与程序拦截均为 `0`；启动前官方认证、一次发送一次请求、刷新恢复、终态封存和访问控制均通过。两次额外情绪推断作为产品质量证据保留。其 Prompt、Skill、结构和工作台继续保存为诊断演进证据，当前正式资产入口由 GI-084 承接。

### 5.4 GI-084 基础 Prompt v0 与 Interview Skill v0 候选

产品负责人确认基础 Prompt、Interview Skill、程序保护和评测案例四层最小分工，并确认首版采用一次调用。基础 Prompt 只服务【陪我聊】，身份为“思考访谈者”，固定用户结果、优先级、来源边界、四个动作、完整语境输入和结构输出合同。Interview Skill 保存焦点、认识增量、下一问价值、回答负担、纠正、材料有限、精简提问手法和三个对照式微案例。

每轮结构保存阶段、动作、当前焦点与关系、认识变化、失效状态、开放部分、提问判断、负担信号、暂停原因和用户可见回应。模型输出本轮差量；程序稳定合并状态、维护焦点血缘、阶段 1～2 回答机会、失效身份、单轮一问和恢复。评测答案、预期动作、案例标签与隐藏目标保持在模型输入边界外。

[GI-084 正式资产候选包](../../../artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0/README.md)版本为 `2026-08-07.board7b-prompt-skill-v0`，候选指纹为 `84c17021fe079d9b3060092ea279dc3c41bfc0bb34addcaa51912fcfabf45541`。包内包含完整 Prompt、标准 `SKILL.md`、最小语义合同、三个案例及各自反事实变体、事实卡模板、授权卡模板、版本清单、只读本机工作台和无网络测试。

当前静态结果为 Skill 格式校验通过、专项测试 `8/8`、清单与候选指纹一致。事实卡和运行授权保持 `pending`，工作台只提供本机读取入口，模型请求端点、Provider、API Key、数据库与 Production 数据均不进入运行包。第一次执行停止于完整资产与本机检查完成，DeepSeek 请求数保持 `0`。

GI-084 后续形成 v0.1～v0.4 开发血缘。v0.1、v0.2、v0.3 分别在独立授权下完成 `8` 次回归，结果均为 `No-Go`；v0.3 已达到结构 `8/8`，剩余失败集中在语义焦点和开放部分将相互影响的材料缩成类别选择。v0.4 只增加一个对照案例，在模型运行前按产品负责人要求关闭，调用 `0`。旧 8 题现承担开发回归身份。

### 5.5 GI-085 semantic-frame-first v1 根因候选与回归结果

GI-085 当前状态为`真实回归已完成·No-Go`。候选从四个职责重新建立：基础 Prompt 保存身份、用户结果、优先级和事实源；Interview Skill 保存用户控制、焦点、认识变化、唯一开放部分、问停和自然表达方法；模型输入只投影完整对话、当前活动语义、可返回归档焦点的最小索引和程序计算的提问边界；输出合同固定字段、空值与跨字段约束。

根因结构收敛为一条语义血缘：`focus → understandingDelta → openPart → visible`。`openPart` 是下一问唯一语义来源，回答机会字段只声明 `new / reuse`。当前焦点切换时，旧焦点必须唯一进入失效、归档或重要支线；可返回归档焦点保留原账本，用户后续否定时同步退出索引和账本；归档焦点与同回合新增支线都参与去重。模型看到语义引用和可行动边界，原始次数账本、失效历史、状态合并算法、幂等和恢复字段留在程序。用户控制先更新有效语境，再从更新后的语境选择提问、形成认识、承接或暂停；一个问题只请求一项可以直接回答的内容。

当前继续使用一次调用。v0.3 的错误起点位于语义选点，增加独立表达调用只会执行同一错误方向。两阶段候选的触发条件固定为：至少两个全新题材中，`focus` 与 `openPart` 均正确，用户可见回应仍持续偏离 `openPart`。

[GI-085 候选包](../../../artifacts/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1/README.md)候选指纹为 `fdc347aa9f952881dbf8c436cbd83302aec12358e446b01c210c57ee21f71f88`，数据指纹为 `e6b2599f0c076ba04bb1f37486bd46b283d97dc2ac7c40a227a870a35723e1d1`，请求集指纹为 `56589e0159911c8076960d0d0b84f4b9fb8079729efbbf2c40a81e90f35e7b71`，执行指纹为 `23081c845deb279396bfac8e77ebcc2e16e4148074225b96193b16c91f9597f4`。候选包包含从头改写的 Prompt、Skill、模型输入合同、输出合同、自包含状态迁移、8 个隔离输入、独立判尺、运行计划、一次性授权模板和静态验证记录。

8 次回归固定覆盖：旧秋招两个决策点各一次、两个全新关系迁移场景各两次、独立内容反事实一次、用户暂时放下一侧一次。全新案例与常驻模型资产隔离；运行输入只传完整对话与语义语境，案例编号、判尺、预期答案和 Production 数据留在模型输入边界外。一次性授权已消费 `1` 次，DeepSeek 调用 `8/8`，质量重试与自动技术重试均为 `0`。

静态完成标准已经满足：候选、数据、8 个精确请求、判尺与执行指纹可重复生成；Skill 格式、输出结构、来源、焦点引用、单轮一问、回答机会和自包含状态迁移通过；两个额外新题材的独立前向检查通过；仓库只读检查和正式执行命令已验证，缺少授权时在凭据读取与模型请求前终止。

[8 次隔离回归结果](../../../artifacts/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1/board7b-semantic-frame-v1-regression-result.json)与[Codex 初评](../../../artifacts/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1/board7b-semantic-frame-v1-regression-review.md)显示：结构有效 `7/8`、程序保护拦截 `1/8`、技术失败 `0`；已知开发回归 `1/2`、全新关系迁移 `1/4`、反事实 `2/2`、普通质量失败 `4`、单例阻断 `0`。固定准入门判定 `No-Go for real trajectory`，真实网页轨迹保持关闭。

八题均形成了与用户材料一致的工作焦点，剩余失败集中在 `openPart`：模型会把相互影响的关系压成先选一侧、单侧倾向或模型预设类别。下一停止点为产品讨论“关系焦点进入 `openPart` 时必须保持什么”，并划分 Interview Skill、输出合同与评测各自承担的内容。产品负责人的逐题体验裁决继续单独保存；任何新候选和模型运行均需要新版本、新指纹与新授权。

### 5.6 GI-086 Thinking 能力校准

产品负责人确认先校准模型能力。GI-086 直接读取并哈希绑定 GI-085 的基础 Prompt、Interview Skill、输出合同、输入合同和四个代表输入，模型可见内容保持一致；同一 `deepseek-v4-flash` 分别使用 Thinking 关闭与 `reasoning_effort=high`。四组首发顺序交错，总预算 `8`，质量重试与自动技术重试均为 `0`。

两个问题样本分别覆盖秋招的远近关系和半年项目／读研申请的相互影响；两个护栏样本覆盖独立话题与用户暂缓伴侣话题。产品负责人采用全程透明评审，同时看到配置、最终回答、语义结构、校验结果、耗时与 Token。“整体牵引、单点追问”只承担评测成功判断，当前不进入 Prompt 或 Skill。

GI-086 已完成 `8/8` 次同期对照，固定门判定 No-Go。其四题小样本只支持停止当前 Thinking 路线；Thinking 的通用能力与真实使用差异继续保持开放。

[GI-086 运行结果](../../../artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/board7b-thinking-capability-v1-result.json)与[透明评审材料](../../../artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/board7b-thinking-capability-v1-transparent-review.md)已经生成。Run 指纹为 `627da7ad0cea7b00b222d69ec5762718941fcf986bd8962af67bdb8ee9fadee0`；调用 `8/8`，结构有效 `6`、程序保护 `1`、技术失败 `1`。P1 关闭组触发单轮一问保护，P3 high 组返回空内容，单题能力结论保持开放。

产品负责人已经完成透明裁决，P1、P2、P4 均判相当，P3 判关闭组更好。[Codex 独立九维初评](../../../artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/board7b-thinking-capability-v1-codex-review.md)判 P1 high 更差、P2 high 更好、P4 相当，P3 质量结论开放。两套判断均未满足问题样本 `2/2` high 更好的固定门，因此 GI-086 判定 No-Go，返回任务结构讨论。

### 5.7 GI-087 “共同任务＋当前探查”候选

产品负责人确认从任务结构修正 GI-085 暴露的语义收窄。候选使用稳定 `workingTask` 保存整段聊天正在共同弄清的问题，以 `nextInquiry.answerTarget / taskEffect` 保存当前一项回答内容及其推进作用。临时选择聊天入口只改变当前探查；用户明确纠正、放下或说明内容独立时，任务才收窄或切换。相关条件并入共同任务，独立或暂时搁置的内容进入可返回任务。

程序验证稳定任务引用、来源、回答机会、阶段计数、单轮一问、状态一致性、恢复和隔离。`ask` 必须同时具备共同任务、当前探查、回答机会和理解回应；其余动作清空当前探查。基础 Prompt 继续精简，Interview Skill 只增加跨场景任务方法，秋招等六题案例保持在评测输入侧。

首轮筛选固定使用秋招首段、先拿 offer 后继续探索、两种感受并存纠正、旧问题问偏后的新重点、再次说不清并停止、两件事互不相关六个检查点。原设计把前四题作为历史真人检查点，并允许旧模型回合承担给定上下文；后两题为人工护栏。运行预算为 `6` 次基础调用和最多 `2` 次手动技术重试，质量重试与自动技术重试均为 `0`。

[GI-087 候选包](../../../artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1/README.md)已完成一次性六题隔离运行。Run 指纹为 `2881fb9d0e1b48f4c8325dfdbe4a813925513a6320cc04f79c27717e0638cfc2`；DeepSeek 调用 `6/6`，结构有效 `5`、程序保护 `1`、模型合同失败 `0`、技术失败 `0`，自动技术重试、质量重试和手动技术重试均为 `0`。PAUSE 同时继续当前任务并把同一任务加入可返回列表，程序保护拒绝整轮结果。

产品负责人完成 AUT1“可直接使用”和 AUT2“轻微问题”两项判断后，在 H1 发现旧候选的“爽还是轻松”问题污染了上下文。六题进一步审计为：AUT1、INDEP 属于纯净起点；AUT2、H1、H2 属于历史条件式探针；PAUSE 属于人工状态下的程序合同探针。原组六题质量门和剩余逐题裁决停止使用，完整结论见[上下文资格审计](../../../artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1/board7b-working-task-v1-context-eligibility-audit.md)。PAUSE 冲突继续作为程序风险保留，等待纯净同候选轨迹复核；真人工作台继续关闭。

### 5.8 GI-088 上下文纯净与影响因素调优

产品负责人确认当前候选评测采用以下输入血缘：

1. 首轮质量判断从用户第一段自然表达开始；固定零调用开场只承担入口文案。
2. 后续 AI 回合全部由同一候选、同一版本、同一轨迹实际生成；真人或行为脚本根据实际回应继续对话。
3. 旧候选与人工 AI 回合单独保存为历史、恢复或程序合同探针，不进入当前候选质量通过率和真人轨迹开放门。
4. Trace 在评分前先验证模型、Prompt、Skill、上下文、状态、程序和数据血缘；输入资格不合格时停止当前质量评分。

当前调优以影响模型效果的因素为单位：模型与生成参数、基础 Prompt、Interview Skill、上下文、任务与输出结构、程序保护与反馈、交互流程。每轮先用 Trace 定位主要因素，再只改变一个主要因素并形成新版本、新指纹和同口径回归。跨场景重复缺口才进入 Prompt 或 Skill；长尾案例进入评测资产；客观稳定边界进入程序保护。

该协议延续方法 v1.0 的规则分流和单变量归因，方法核心、GI-068～080 与 Production 状态保持原样。

#### GI-088 当时执行入口｜真人交互开发评测集 v1

原“最小纯净评测包”计划由 [`GI-088 真人交互开发评测集 v1 与透明 Thinking 对照`](../../../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v1/README.md)覆盖。历史计划、GI-087 资产和 GI-088 v0 运行证据继续保存，原上下文准入、任务结构、调用数和失败证据仍然有效。

当前评测运行器固定实现：

1. `12` 项任务验证 A1～A8 八项能力，并用新话题复测 A2／A3／A4／A6；产品负责人在网页中使用真实内容主动触发目标行为，任务说明不进入模型上下文。
2. 每项先保存固定零调用 `A0` 和产品负责人一次输入的真实 `U1`；Thinking 关闭轨迹先完成，high 轨迹再从相同 `A0＋U1` 建立独立分支。两条分支不共享后续消息、状态或 Trace。
3. 两组共同哈希绑定 GI-087 基础 Prompt、Interview Skill、输出结构和输入格式，共同使用 `deepseek-v4-flash`、JSON，并共同省略应用层 `max_tokens`。关闭组温度 `0.2`；开启组只增加 `reasoning_effort=high`，有效温度为 `N/A`。
4. 页面全程展示候选配置、动作、共同任务、当前探查、用户原话来源、耗时、Token 和技术状态。隐藏推理不读取、不保存、不展示。
5. 每次用户发送对应一次模型请求；刷新恢复，重复提交幂等；质量问题保留原结果；技术失败由产品负责人选择手动重试或保留后直接评价。
6. Preview 使用访问保护和独立评测数据库；整批可以封存并只读导出。Production 路由、数据库、Prompt、配置和运行开关不接入该运行器。

建设阶段已使用假 Provider 完成完整流程、自动检查和 Preview 部署。v0.3～v0.5 的技术冒烟、输出合同澄清和严格 Schema 结果继续保存。v0 formal batch 共执行 `9` 次模型调用，A2 high 同一轮三次把 `1600` completion Token 全部用于 reasoning，形成应用上限过低的直接证据。v1 保持基础 GI-087 指纹 `e45f431f21819b668422c5da64678ad22fb6ef3f3eee285aa9e9c8fb533321aa` 与有效候选指纹 `58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`，共同移除两组应用层 Token 上限；数据集指纹为 `93c9808b6f805caea801eeb06d8d0bac46d35a08df68257d74c03cdfc1774e29`，执行指纹为 `4b65801390264df957189efbc968c9b2584e212154e98671370b8167e7ff70b2`。

产品负责人完成 A1～A8 共 `8` 项、`16` 条轨迹后主动提前结束。v1 共 `66` 次调用，其中 high 出现 `12` 次空内容、`7` 次超时和 `17` 次手动重试；产品负责人和 Codex 均观察到 high 在 `6/8` 组的内容优势。前 8 项只读核验、独立评分、阻断与 Bad Case 总账已形成。response format 探针已判定移除参数 No-Go；Thinking 模式四次探针已完成，high 与 disabled 均为 `2/2 valid`，主要影响因素未确认。

当前批次迭代会话已经完成 Codex 九维初评、完整结果核验、问题和根因关系与一个主要影响因素建议。产品负责人确认后，同一会话继续下一候选开发和静态验证；任何真实模型调用、Preview 批次和部署继续等待单独授权。下一候选就绪后暂停，下一批真人评测继续由网页承接。

### 5.9 v5～v8 规则演进与本次错误继承

| 版本或身份 | 当时结果 | 当前用途 |
|---|---|---|
| v5 | 将回答负担映射为“一轮一个可见问句、一个问号” | 历史过度修复证据；现行合同已退出 |
| v6 | 恢复为单一回答焦点；A1、A2 共 11 条可见 ask 中，独立多任务为 0，产品负责人确认通过 | 当前提问负担规则的产品证据 |
| v7 | 建立连续性状态底座，同时保留空正文、恢复和程序合同风险 | 历史连续性与可靠性证据 |
| v8～v8r2 | 继续完善问前决策、来源、控制、幂等和恢复 | 历史候选与回归来源，不自动转化为当前候选 |
| `2026-08-16.gi088-visible-information-gain-ab-v1` | A1、B1 在旧“整段最多一个问句”合同下触发 `VISIBLE_RESPONSE_MULTIPLE_QUESTIONS` | 只证明旧请求携带废弃规则；不支持信息增益效果归因 |

v5、v6 的完整判尺与真人结果继续由[板块 6 质量评测文档](./04j-generative-quality-evaluation-v1.md)和[GI-088 问题台账](../../../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-current-issue-ledger.json)保存。旧 A/B 的原始运行回执保持原身份；当前合同只在本页维护。

### 5.10 更早的实现证据
| 历史文档 | 保留用途 | 当前状态 |
|---|---|---|
| [04m｜极简两段式 v3 实施交接](./04m-board7-minimal-two-stage-v3-execution-handoff.md) | 两段职责拆分、兼容适配、协议负担和停止门证据 | `历史 v3 候选与 v70/v70 stop 证据` |
| [04n｜Provider v4→v5 语义骨架规格](./04n-board7-semantic-skeleton-v1-spec.md) | 语义骨架、来源校验、用户文案分层及 v72/v5 失败证据 | `历史规格与停止证据` |
| [04o｜MVP Preview 候选交接](./04o-board7-mvp-preview-candidate-handoff.md) | GI-057～066 的候选血缘、自动验证、恢复与日志闭环，以及真人 No-Go 证据 | `历史候选交接；GI-066 候选失效` |

使用历史证据时必须标明来源候选、当时产品前提、验证结果和当前适用范围。历史架构、字段、Prompt、模型参数、版本号、自动通过和 Preview 结论均保持历史身份；新候选需要从当前冻结事实和正式评测资产重新论证。

## 6. Production 边界

当前阶段允许更新产品与实现讨论文档，并在板块 7 获得明确执行授权后开展隔离候选开发和离线验证。以下权限继续保持关闭：

- Production 模式、Provider、Prompt、模型、环境变量和运行开关变更；
- Production 数据写入、迁移、生成式模型运行和真实用户扩量；
- 将局部技术通过、历史自动结果或候选实现直接视为发布授权；
- 在板块 8 Go/No-Go 之前开放 `optional + generative`。

Production 继续保持 `event_centered + baseline`；`legacy + baseline` 只承担应急回退与历史运行身份。任何 Preview 运行、Production 切换、部署或数据操作均等待对应阶段的计划与验证门。

## 7. 当前交接

- 当前合同：`2026-08-16.gi088-board7-current-runtime-contract-v1` 是生成式访谈实现层的唯一当前职责与提问规则入口。
- 当前候选：v2.8 `2026-08-19.gi088-response-first-v2-8-correction-persistence-high` 保留产品负责人 `minor` 的历史父证据；v2.2 Low 完整六题 `6/6 pass` 继续冻结。当前候选为 v2.9 `2026-08-19.gi088-response-first-v2-9-separated-open-gap-high`。
- 父验证：v2.8.1 使用实际 A3、重放 post-state 与 U4 完成 Low → High，调用 `2/2`；产品负责人裁决 `fail`，整体 No-Go。
- 当前验证：v2.9 纠正首题产品 `pass`；真实 CONTINUE 独立身份已完成 `2/2`，Low Codex `minor`，High 合同失败，Codex 与产品均裁决完整回合 `fail`，本轮 No-Go，后续 `4 not_run`。
- 旧 A/B 边界：A1、B1 按当前规则均可显示，产品负责人判断两者都存在语义重复；旧请求携带废弃单问号规则，正式信息增益归因无效。
- 活跃模型方法：每个候选问题先用完整有效用户原文尝试作答；已有答案、或尚未知但价值不足的候选退出，审计通过的问题才允许进入可见结果。
- 活跃程序规则：程序校验审计字段、用户来源、结构和模型自身声明的一致性；同一回答焦点继续允许一至三个相关问题句；问号数量只作观察。
- 下一步：本轮 No-Go 已封存；不运行 `RPR-LC-21` 等后续四题，不预同步新候选；页面、Preview 与发布继续关闭。
- 产品链路：回应优先页面接入、真实页面验收、完整回归、Judge、独立准入和真人 Preview 均未运行。
- Production：`event_centered + baseline` 保持现役；生成式能力继续关闭。
