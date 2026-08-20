# Daily Light 五阶段生产主线完善

- 文档职责：当前专项与总计划
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[`docs/README.md`](../../README.md)
- 任务编号：`DL-PROD-20260819`
- 当前本地候选分支：`codex/production-evidence-hardening-stage3-release-20260820`
- 当前工作区：`/Users/zouzhijie/Desktop/Happiness-system-stage3-release-20260820`
- 上游五阶段工作分支：`codex/production-evidence-hardening-20260819`

## 1. 目标与当前事实

本专项在 GI-088 生成式策略继续隔离的前提下，完善当前 Production 的证据、回归、代码结构和月度洞察评估能力。正式产品继续运行 `event_centered + baseline`；生成式访谈、月度 AI 洞察和数据库迁移继续关闭。

当前 Production 事实：

- 正式域名：`https://dailylight.chat`
- deployment：`dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`（READY／PROMOTED）
- 发布时间：`2026-08-20`
- 运行模式：`event_centered + baseline`
- 源码血缘：最终发布头 `a86a4ba`，tree `70ca8f4` 与 main 合并提交 `305f209` 的 tree 完全一致
- 回退目标：`dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`（READY），承担上一版 `event_centered + baseline` 回退

## 2. 实施范围

### 阶段 1｜Production 数据口径 v2

- 管理后台漏斗按唯一用户和顺序到达计算当前产品六步主链：打开当天、首次提交内容、获得完整回应、保存事件卡、生成今日日记、保存今日日记。
- 旧五维漏斗独立展示并保留一个兼容周期。
- 留存统一使用 `Asia/Shanghai` 自然日和首次事件卡保存 cohort。
- `staleRate` 使用 `JournalDailyEntry.sourceSignature` 与当天有效事件卡重建签名计算。
- 增加恢复开始、成功、失败事件及 fallback、异常退出、恢复率、P50/P95 时延。
- 本阶段只改读取层与埋点，不修改 Prisma Schema，不回写历史数据。

### 阶段 2｜零模型端到端回归

- 引入 `@playwright/test`、临时 PostgreSQL Schema、固定账号和仅测试环境启用的确定性 AI 替身。
- 覆盖 `1440×900` 与 `1024×768`，数据库并发用例串行执行。
- 覆盖登录、两种记录方式、可靠恢复、幂等并发、日记生成更新、跨天和管理后台对账。
- 同时断言 `AIRequestLog` 增量为 `0`，且生成 Trace 中模型实际执行、Provider 尝试与 LLM 来源均为 `0`。

### 阶段 3｜Production 日志 Golden Set v2

- 先完成 AI 评测启动卡，再按有效同意、未撤回、内部账号优先筛选记录。
- 正文只通过受控管理员读取，访问写入 `AdminAuditLog`；原文进入 Git 排除的 `.private`，权限保持目录 `0700`、文件 `0600`。
- Production 保持业务数据零写入，`AdminAuditLog` 是正文访问唯一允许的治理写入；首版只使用有效同意且具有样本级完整轨迹评审授权的内部账号。
- 建立 30 条真实完整链路；第 10 条和第 30 条由产品负责人完成最终裁决。
- 本阶段复盘既有输出，新增模型调用为 `0`。

### 阶段 4｜Production 主链重构

- 后端拆分会话生命周期、可靠回合、baseline 编排、工作区投影、事件卡收束和埋点。
- 事件中心前端拆分状态 Hook、outbox、消息输入、侧栏和错误恢复。
- 当天日记工作区拆分数据、事件卡、生成更新、编辑保存和时间线。
- 保持 API、SSE、数据库、错误码、幂等键、事件名和开关兼容；历史 `InterviewShell` 与 `joy-interview.service.ts` 继续封存。

### 阶段 5｜月度个性化洞察 Go/No-Go

- Production 继续使用确定性 `AnalysisNarrative`。
- 候选只在本地或隔离 Preview，输入限于月度聚合、趋势、证据摘录和日期引用。
- 候选输入从当前 `JournalPeriodReport` 材料优先级投影；现有旧五维 `/analysis` 聚合不承担评测数据源。
- 少于 3 个记录日或 3 条保存成果时模型调用为 `0`。
- 最多 6 个合成边界月与 6 个已同意真实用户月，调用上限 12、并发 1、重试 0。
- 本计划只形成 Go/No-Go；Go 仅授权下一轮接入设计。

## 3. 并行与发布顺序

开发并行分为三条：

1. 数据合同、留存与恢复观测；
2. Playwright、临时数据库与零模型证明；
3. Golden Set／月度候选的隐私、启动卡和离线资产。

生产发布保持串行：阶段 1 → 阶段 2 → 阶段 4。每次先完成本地门和 Preview，再进入 Production；阶段 3 以私有评审资产为主，阶段 5 停在候选结论。

## 4. 验证门

每个代码阶段至少通过相关专项测试，并在发布前通过：

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx prisma validate`
- `npm run docs:check`
- `git diff --check`

阶段 2 还要求浏览器全套本地连续三次通过，自动 E2E 模型实际调用为零。阶段 4 每批要求 API、SSE、错误码、事件顺序和数据库结果兼容。

## 5. 授权与停止点

本计划已授权：计划内 Production 只读数据访问、提交、推送、Preview 部署，以及阶段 1、2、4 通过验证门后的 Production 发布。

继续使用独立停止门：

- 数据库迁移；
- GI-088 新调用和生成式策略发布；
- 月度 AI 洞察上线；
- 计划外模型预算；
- 删除分支、worktree、私有现场或其他破坏性清理。

阶段 1 已发布 Production，工程验证、Preview 行为、只读数据库对账和正式域名核心 smoke 已通过；管理员成功读取保持 pending。其余阶段继续使用各自当前状态。任何核心回归、内容丢失、恢复失败、权限回归或线上指标恶化都会暂停对应批次并回退到上一正式 deployment。

## 6. 当前进度

| 阶段 | 状态 | 当前证据 |
|---|---|---|
| 0. 保护现场与工作线 | 已完成 | GI-088 `175` 项成果完成指纹与隐私检查；最终 No-Go 状态已由检查点 `199aa94` 封存并推送，原工作区干净，分支与私有现场继续保留 |
| 1. 数据口径 v2 | Production 已发布·核心回验通过·管理员成功读取 pending | 发布头 `a86a4ba`；main merge `305f209`；Production `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`；正式域名权限保护与最小产品 smoke 通过 |
| 2. 零模型 E2E | 已合入 main·热修复远程门与 main CI 全绿·Preview 通过至需更新·Production blocked | PR #41 合入 `77de8d1`；PR #43 final head 两套 CI 全绿并合入 `795417d`，main CI 全绿；日记更新与人工保护待跑 |
| 3. Golden Set v2 | 本地安全候选完成·并发门通过·收集 pending | 零正文元数据盘点确认完整轨迹可入集数 `0`；隔离 PostgreSQL 双锁序 `2/2` 通过，安全门与公开隐私合同完成，正文开关保持关闭，未推送／未部署 |
| 4. 主链重构 | 待验证 | 等待阶段 2 回归保护 |
| 5. 月度洞察评估 | No-Go / insufficient_evidence | 当前成果物投影与 6 条合成合同已验证；2 条低数据量用例 Provider 调用 `0`，其余 4 条候选调用 `not_run`；真实用户月 `0`、模型调用 `0`，Production 保持确定性 `AnalysisNarrative` |

问题、归因和处理状态统一记录在[问题台账](../../../artifacts/production-evidence-hardening/2026-08-19/issue-ledger.md)。

### 阶段 1 发布前证据封存｜2026-08-20

- 远程 CI run `32331657275`：类型检查、全量测试、构建和 Lint 全绿；CI 原始日志记录 `3205 passed / 82 skipped / 0 failed`。
- Preview deployment `dpl_DExPivo5Qqfk97kH9jVahU8yWQ8A`：管理员、匿名、普通用户、空态、错误态和旧链展开区通过。
- `2026-07-22..2026-08-20`、`Asia/Shanghai`：Preview API 与独立 SQL 的六步漏斗均为 `6 / 5 / 5 / 1 / 1 / 1`，逐项差异为 `0`。
- 数据库事务为只读，用户正文读取 `0`、业务写入 `0`、临时秘密残留 `0`。留存与质量保存独立 SQL 统计；后续 Preview API 再读受到 deployment protection／TLS 路径阻断，本轮不声明新的留存与质量 API 逐字段回读。
- 该发布前检查点的 Production 仍使用 `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`；当前正式版本见下方发布后证据。完整公开零正文证据见[数据口径 v2 回执](../../../artifacts/production-evidence-hardening/2026-08-19/analytics-contract-v2/README.md)。

### 阶段 1 Production 发布后证据封存｜2026-08-20

- 最终发布头 `a86a4ba` 经 PR #40 合入 main merge `305f209`；两者源码 tree 均为 `70ca8f4366be6a8cb968385050b0aa3d10bbdbc7`。
- 最终 CI run `32333975329` 成功：`360` 个测试文件通过、`16` 个跳过，`3207` 条用例通过、`82` 条跳过、`0` 失败，Lint 为 `0 errors / 43 warnings`。
- Production `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` 为 READY／PROMOTED，`https://dailylight.chat` 已指向该版本；回退目标 `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2` 为 READY。
- 正式域名匿名管理接口 `401`、普通用户管理接口 `403`，注册登录、session、空 joy session 和非法日期合同均通过；模型端点调用 `0`。发布后 `19` 条日志中 `5xx / error / fatal / warning` 均为 `0`。
- smoke 创建固定验收账号、`AuthSession` 和空 `InterviewSession`；当前保留并等待产品负责人单独确认清理。后续治理见 `PEH-021`。
- 管理员白名单存在 `1` 个身份；当前执行环境缺少合法凭证且两种受控浏览器环境均无既有登录态，Production 管理员成功读取保持 pending。
- Production 运行依赖审计为 `0`；全依赖审计的 `3 moderate / 1 high / 1 critical` 位于 Vite／Vitest 开发测试工具链，已进入 `PEH-019` 独立治理。

### 阶段 2 PR 前证据封存｜2026-08-20

- 独立发布分支已 rebase 到 `origin/main@305f209`，重复的阶段 1 测试治理提交自动移除；差异收敛为 24 个阶段 2 文件，Prisma 变更为 `0`。
- rebase 后实现提交为 `5d0e795`，本地验证头为 `f12bf27`；类型检查、目标 Lint、文档检查和差异检查均通过，零模型 guard 为 `9/9`。
- 安全 E2E 使用本机 loopback 专用测试库完成 `11/11`：1440×900 覆盖 10 项，1024×768 覆盖 1 项；`AIRequestLog=0`、12 条 Trace 四类模型调用违规为 `0`，临时 Schema 已删除且残留为 `0`。
- 历史完整三连跑继续由[零模型 E2E 原始回执](../../../artifacts/production-evidence-hardening/2026-08-19/e2e-zero-model/README.md)承担；当前单轮只证明 rebase 后发布线未发生工程漂移。
- 该 PR 前检查点结束时，分支推送、Pull Request、远程 CI、Preview 人工主链和 Production 发布均为 pending；当前状态见下方 PR／Preview 证据。阶段 2 Production 继续受阶段 1 管理员成功读取门约束。

### 阶段 2 PR／Preview 证据封存｜2026-08-20

- PR #41 head `e7e1541` 的 push run `32336448157` 与 pull request run `32336474525` 均成功：`361` 个测试文件通过、`16` 个跳过，`3216` 条用例通过、`82` 条跳过、`0` 失败；构建 `77/77`，Lint `0 errors / 43 warnings`。
- 两套远程零模型 E2E 均为 `11/11`；PR Job 记录 `AIRequestLog=0`、12 条 Trace 四类调用违规 `0`，临时 Schema 已删除。
- Preview `dpl_GAU2uR8BpbTsP4FQhhnqaGBmv4Sr` 为 Ready；人工 smoke 已通过匿名／普通用户保护、上海日期、【帮我记】完整回应、完成记录、单卡保存和今日日记 draft 生成。
- 首次编辑因验收标题 17 字超过 UI 16 字合同而返回预期结构化 `400`；纠正前的首次重新登录在应用收到请求前遇到 Vercel CLI TLS 阻断。最终 Preview `dpl_5okCGtSkeA7h6uCQUAWv9ur5UtHG` 已通过编辑、保存和来源变化后的“需更新”；调用日记更新前再次受到 TLS 阻断，日记更新与更新后人工片段保护保持 `not_run`，详见 `PEH-022`。
- PR #41 最终 head `553d488` 的 push run `32337508459` 与 pull request run `32337511943` 均成功，随后合入 main merge `77de8d1`。本次合并只生成 Preview，Production 继续使用阶段 1 deployment `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。
- 当前结论为 `已合入 main / 热修复远程门与 main CI 全绿 / Preview 通过至需更新 / Production blocked`；Production 等待 `PEH-020` 与 `PEH-022` 同时完成。

### 阶段 2 合并后 CI 问题封存｜2026-08-20

- main run `32337995170` 的零模型 E2E 为 `11/11`；常规测试出现一个 GI-088 工作台异步单例失败，`360` 个测试文件通过、`16` 个跳过、`1` 个失败，`3215` 条用例通过、`82` 条跳过、`1` 个失败。构建与 Lint 随前序失败跳过。
- Stage 5 同一提交的 push run `32338658277` 全绿；PR run `32338697673` attempt 1 的 test job `96333218076` 在同一测试文件等待结构化错误 `GI088_TURN_OUT_OF_DATE`，单例 `30.174s` 后失败，failed-only attempt 2 已主动取消。本项按测试同步波动入账，不改写 Stage 5 产品结论。
- 首次本地修复后的全量运行在 `361/377` 文件进度处出现跨日期会话单次时序失败：界面标题已经更新，地址栏 effect 尚未完成。旧版精确用例随后 `50/50 P4` 通过，仍按实际失败修复为等待 `sessionId` 与 `entryDate` 同时更新；修复后精确用例再次 `50/50 P4` 通过。
- GI payload 保持用户首次选择“包含提问”的真实路径，fake digest 只作为测试替身；payload 精确用例 `50/50 P4`、完整 GI 文件 `20/20 P4` 通过。
- `PEH-023` 首轮本地工程门已通过。最小修复范围固定为 `tests/unit/gi088-evaluation-workbench.test.tsx` 与 `tests/unit/event-centered-interview-workspace.test.tsx`，产品源码变更 `0`；该版本连续三轮全量均为 `3216` 通过、`82` 跳过、`0` 失败，零模型 E2E 为 `11/11`、`AIRequestLog=0`、12 条 Trace 模型调用违规 `0`、临时 Schema 残留 `0`。PR #43 初始 head 的 push／pull request 两套 CI 均在 attempt 1 成功、重试 `0`，Preview Ready。
- 只改 8 份文档的 head `c897d7a` 中，push run `32343781979` 全绿；pull request run `32343785173` 的 E2E `11/11`，常规测试再次在结构化错误场景等待 `30.194s` 后失败。随机顺序 seed 24 已确认后台 `/operation-events` 抢占按调用序号配置的预设响应。第二轮修复改为按接口地址分流；随机顺序 `750/750`、精确场景 `200/200` 通过，连续三轮全量均为 `3216` 通过、`82` 跳过、`0` 失败，零模型 E2E `11/11` 且模型调用违规 `0`；该节点结束时新 head 远程门待验证，最终结果见下一项。
- PR #43 final head `a4173d7` 的 push run `32346020465` 与 pull request run `32346025037` 均在 attempt 1 全绿，重试 `0`，两套零模型 E2E 均为 `11/11`。PR #43 已合入 main merge `795417d`；main push run `32346808393` 的常规测试与零模型 E2E 全绿。Production 继续使用阶段 1 deployment `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。
- 原始本地三连跑 [`receipt.json`](../../../artifacts/production-evidence-hardening/2026-08-19/e2e-zero-model/receipt.json) 与阶段 1 Production 回执继续保留各自运行身份。

### 阶段 3 本地安全候选｜2026-08-20

- 独立 worktree `/Users/zouzhijie/Desktop/Happiness-system-stage3-release-20260820` 从 `origin/main@77de8d1` 建立，分支为 `codex/production-evidence-hardening-stage3-release-20260820`。提交序列为 `34acb1f`、`1b4820d`、`7c87119`；当前未推送、未开 PR。
- Golden Set v2 已具备随机 case ID、内部账号与样本级 `full_trajectory_review` 联合门、当前 consent epoch／撤回／过期／未来授权 reconciliation、统一 `404`、默认关闭正文开关、Serializable 读取事务和审计后返回。
- AI 质量退出会在同一事务撤回反馈、清理 `AICase` 用户信号与回复再生成点踩时间、退役 Few-shot，并拒绝引用撤回 trace 的 draft／approved 优化候选；反馈保存通过参数化 `FOR SHARE` 锁与事务内二次同意校验关闭并发重写窗口。优化 Bad Case、Good Trace 和历史候选证据正文读取都要求当前有效同意。
- 详情读取在根身份、用户、日期、记录方式、完整分支归属通过前只查询元数据；公开 Production 盘点按日小样本阈值 `3` 抑制，资产测试确认零用户正文与零身份字段。
- Production 零正文元数据盘点结论为 `insufficient_samples / collection_pending`：事件链候选 `1`，已保存完整日记链 `0`，完整轨迹可入集数 `0`。Production 正文读取 `0`、模型调用 `0`、样本映射创建 `0`。
- 专用本地 loopback PostgreSQL 真实并发撤回门 `2/2` 通过：保存先持共享锁后撤回等待；撤回先持排他锁后保存等待并以 `CONSENT_REQUIRED` 关闭。两种最终状态均为同意已撤回、活跃反馈／案例用户信号／再生成点踩／活跃或候选 Few-shot／待发布优化候选为 `0` 或已失效；`AIRequestLog=0`、模型调用 `0`，临时 Schema `daily_light_stage3_consent_63ebafb0f93f` 已删除且残留 `0`。公开回执见 [`consent-concurrency-postgres-receipt.json`](../../../artifacts/production-evidence-hardening/2026-08-19/golden-set-v2/consent-concurrency-postgres-receipt.json)。
- 最终本地门：Stage 3 定向 `12` 个文件、`77/77` 通过；`npm run typecheck`、`npx prisma validate`、`npm run docs:check` 和 `git diff --check` 通过；全仓 Lint 为 `0 errors / 43` 条既有 warnings，文档检查覆盖 `24` 份核心文档、`846` 个本地链接和 `1` 个当前入口。
- 当前停止点：正文开关继续关闭；Preview、Production、真实逐例正文、样本导出、人工评审、第 10／30 条产品裁决均为 `not_run`。隔离 PostgreSQL 并发门与本地完整回归已经完成，下一门为分支推送／PR 和后续发布裁决。
