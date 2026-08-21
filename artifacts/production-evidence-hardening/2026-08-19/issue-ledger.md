# Daily Light 五阶段问题台账

- 文档职责：问题台账
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[`DL-PROD-20260819`](../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## PEH-001｜最新 main 与当前 Production 源码分叉

- 已确认事实：`origin/main=138b595` 的产品快照停在 `2026-08-10`；当前 Production deployment `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2` 于 `2026-08-13` 使用 `event_centered + baseline`，其源码由 `ed8c36d` 封存。两棵源码树不同。
- 产品判断：五阶段工作从最新 main 建立独立分支，同时必须保留线上实际主链。
- Codex 评估：直接从 main 开发并发布会带来日记主链、事件中心入口和已应用数据结构的回退风险。
- 待验证假设：`ed8c36d` 完整对应最终无缓存 Production 构建；现有发布证据、部署 ID 和源码封存支持该血缘，后续 Preview 需再次逐项验证。
- 当前处理状态：已处理。工作分支保留 `origin/main` 父节点，并用提交 `5c36b49` 恢复 `ed8c36d` 的完整源码树。

## PEH-002｜GI-088 封存快照与现场状态冲突

- 已确认事实：实施计划记录的是较早快照；原工作区最终证据已经推进到首题产品 `pass`、真实 CONTINUE Low＋High `2/2`。Low `3967ms`、Codex 初评 `minor`；High `1885ms`、HTTP 200／stop／完整 JSON，但三项状态合同失败；纯时间 `5852ms` 通过，综合技术门为 `false`。Codex 与产品负责人均裁决完整回合 `fail`，后续 `4 not_run`。
- 产品判断：GI-088 与本五阶段解耦，Production 继续使用 baseline。
- Codex 评估：保留运行前冻结边界，同时新增最终结果与 legacy 时延字段语义澄清，可以维持原始运行器和回执指纹并消除当前事实冲突。
- 待验证假设：已由完整阶段账、公开回执、私有指纹和产品负责人裁决交叉验证，不再保留该假设。
- 当前处理状态：已解决。`175` 项成果完成隐私扫描与精确暂存，检查点 `199aa94` 已推送原分支；原工作区干净，私有现场继续保留，清理仍等待最终单独确认。

## PEH-003｜后台总览和用户下钻仍以旧五维数据为主

- 已确认事实：现有漏斗按事件条数统计；总览、候选用户和内容下钻主要读取旧 `InterviewSession`、`JoyEntry` 与 `DailyJournalEntry`。
- 产品判断：管理后台默认展示当前事件中心主链，旧五维保留独立历史区；Golden Set 必须读取当前事件卡和今日日记。
- Codex 评估：只修改三个指标接口会造成顶部总览、漏斗和样本筛选互相矛盾。
- 待验证假设：当前 30 天数据量可以在不增加索引和迁移的情况下满足页面性能门。
- 当前处理状态：阶段 1 已在实现 `7bbe285` 增加合同 v2、当前产品六步漏斗和独立旧链区；远程 CI、Preview 行为验收和只读数据库对账均已通过，Production 已发布且核心回验通过。管理员成功读取保持 pending。证据见[数据口径 v2 回执](./analytics-contract-v2/README.md)。

## PEH-004｜AI 质量同意撤回链路不一致

- 已确认事实：设置页退出请求已统一返回 `participated=false`；原退出清理只撤回反馈并退役 Few-shot，`AICase` 用户信号、回复再生成点踩时间和保存反馈时的并发撤回仍存在残留窗口。
- 产品判断：Golden Set 只使用当前有效同意且撤回时间为空的记录。
- Codex 评估：退出事务需要同步清理反馈、案例信号、回复再生成点踩状态和 Few-shot；反馈保存事务需先锁定用户同意行并在同一事务复核，才能关闭“退出后又重新写入反馈”的并发窗口。
- 待验证假设：专用本地 loopback PostgreSQL 已完成 `18/18` 个并发场景；候选创建、审批、发布、验证启动和反馈保存覆盖两个锁序，另覆盖单候选验证互斥、活跃 Few-shot 保护、双用户稳定锁序、共享候选丢失更新、验证／Few-shot dispatch 租约和影响证据撤回。
- 当前处理状态：本地候选按用户全部 AIGenerationTrace 清理同意绑定的派生状态，覆盖无 AIFeedback 的自动 Bad Case；draft／approved 候选失效并从当前 `evidenceTraceIds` 移除该用户的直接 trace 引用，published／rolled_back 历史状态与原引用保持。共享候选按 ID 稳定顺序逐行加锁后重读，双用户撤回最终引用为 `[]`。真实 PostgreSQL `18/18` 通过，`AIRequestLog=0`、模型调用 `0`、临时 Schema 残留 `0`。公开回执见 [`consent-concurrency-postgres-receipt.json`](./golden-set-v2/consent-concurrency-postgres-receipt.json)。Production 发布与正文读取继续关闭。

## PEH-005｜零模型证明不能只依赖 AIRequestLog

- 已确认事实：现有浏览器脚本依赖未安装的 `playwright` 且覆盖旧五维入口；事件中心模型尝试还会记录在 `AIGenerationTrace.pipelineDecisions`。
- 产品判断：自动 E2E 必须零真实模型调用。
- Codex 评估：需要仅测试环境可启用、Production 启动即拒绝的确定性 AI 替身，并同时断言请求日志和 Trace 的模型执行字段。
- 待验证假设：现有 Provider 注入点足以实现 fail-closed 测试替身，不改变正式路径。
- 当前处理状态：PR #41 已合入 main；push／pull request 两套 E2E 均为 `11/11`，PR Job `AIRequestLog=0`、12 条 Trace 四类违规 `0`、临时 Schema 已删除。Preview 已通过至“需更新”；剩余日记更新与人工片段保护见 `PEH-022`，合并后 CI 稳定修复见 `PEH-023`。Stage 2 Production blocked。

## PEH-006｜月度分析当前数据源与 Production 主链不一致

- 已确认事实：候选已从 `JournalPeriodReport` 的周报、今日日记、旧日记和事件卡去重结果建立确定性材料投影；旧五维 `/analysis` 聚合未进入候选输入。6 条合成边界夹具的输入与输出合同全部通过，其中 2 条低数据量用例验证 Provider 调用为 `0`，其余 4 条候选调用保持 `not_run`；真实用户月 `0`，模型调用 `0`。
- 产品判断：月度个性化洞察只评估当前 Production 用户实际可见的月度材料；本轮证据支持 `No-Go / insufficient_evidence`，Production 继续使用确定性 `AnalysisNarrative`。
- Codex 评估：当前成果物投影、低数据量门、来源日期合同和调用上限已经形成隔离候选；样本级外部评测授权与已发布 Chat Provider 冻结指纹尚未齐备，当前证据无法支持产品接入。
- 待验证假设：未来取得 `external_monthly_eval` 样本级授权并冻结新的运行身份后，最多 6 个真实用户月可以完成逐例产品裁决；该假设不影响本轮 No-Go 完成状态。
- 当前处理状态：阶段 5 已完成评估并封存 `No-Go / insufficient_evidence`；真实用户月 `0`、模型调用 `0`、Production 接入关闭。证据见[月度洞察公开回执](./monthly-insight-v1/README.md)。

## PEH-007｜Production 源码快照缺少文档治理命令

- 已确认事实：`ed8c36d` 的 `package.json` 缺少计划完成门要求的 `docs:check` 和 `docs:inventory`；原分支 `7d39269` 已封存两条自包含治理脚本。
- 产品判断：五阶段每批需要自动检查当前入口、状态词、链接和唯一执行入口。
- Codex 评估：直接复用已封存脚本可以补齐治理门，不影响产品运行代码。
- 待验证假设：新专项文档满足脚本的核心元数据和唯一入口约束。
- 当前处理状态：已复用脚本并登记 npm 命令；等待首次全量文档检查。

## PEH-008｜Production 零业务写入与审计写入需要分开表述

- 已确认事实：受控管理员每次读取正文必须创建 `AdminAuditLog`；严格“Production 零写入”会与该审计义务冲突。
- 产品判断：真实内容访问必须可追溯，用户业务记录保持只读。
- Codex 评估：冻结为“零业务数据写入，`AdminAuditLog` 是唯一允许的治理写入”可以同时满足数据保护与审计要求。
- 待验证假设：现有 `AdminAuditLog` 字段足以保存事件中心 case、管理员、动作和元数据，无需迁移。
- 当前处理状态：已写入总计划；受控正文读取服务待实现。

## PEH-009｜通用 AI 质量同意范围不足以单独授权完整轨迹评审

- 已确认事实：当前隐私说明主要覆盖用户主动反馈关联的回复；完整轨迹进入长期 Golden Set 或外部月度模型评测需要更明确的用途授权。
- 产品判断：真实样本要满足当前同意有效、撤回为空和最小必要使用。
- Codex 评估：首版只使用内部账号，并增加样本级 `full_trajectory_review`／`external_monthly_eval` 私有授权账；每次 shortlist、导出、评审和封存都重查同意与撤回。
- 待验证假设：内部自然使用可以在计划周期内覆盖 30 条 Golden 候选和最多 6 个真实用户月。
- 当前处理状态：本地候选已实现随机 case ID、内部账号、样本级 `full_trajectory_review`、当前 consent epoch、撤回／过期和授权生效时间的联合门；普通用户样本保持排除，覆盖不足时结论记录为 partial／insufficient evidence。Production 正文开关保持关闭。

## PEH-010｜私有副本需要处理后续撤回

- 已确认事实：Production 撤回或删除不会自动级联到本地 `.private` 评审包。
- 产品判断：撤回用户的正文退出当前 Golden 与月度候选。
- Codex 评估：每次第 10 条检查点、最终封存和月度 finalize 前执行 reconciliation；命中撤回时隔离正文，公开证据只保留非内容哈希与撤回回执，并补充替代样本。
- 待验证假设：私有授权账与 Production consent 状态可以通过随机 case 映射稳定对账。
- 当前处理状态：Golden Set v2 本地候选已实现撤回、删除、重新同意、政策版本变化、过期和未来授权的 fail-closed reconciliation；正文事务在归属核验后读取内容，并在返回前二次核验 consent epoch 与写入审计。真实私有样本、检查点和月度候选仍待后续验证。

## PEH-017｜阶段 1 后续 Preview API 再读受到访问路径阻断

- 已确认事实：既有 Preview smoke 已通过管理员、匿名、普通用户、空态、错误态和旧链展开区；本轮独立数据库统计在 `transaction_read_only=on` 下完成。后续再次读取 Preview API 时受到 deployment protection／TLS 路径阻断。
- 产品判断：漏斗六步以已通过的 Preview API 结果和独立 SQL 做逐项对账；留存与质量保留本轮独立 SQL 统计，并明确不声明一次新的 API 逐字段回读。
- Codex 评估：该边界与既有 Preview 行为验收同时成立；Production 正式域名核心权限和产品合同回验已通过，管理员成功读取仍需要白名单内既有内部管理员的合法登录态。
- 待验证假设：白名单内内部管理员取得合法登录态后，可以稳定读取合同 v2；六步漏斗与只读 SQL 的逐项一致性继续沿用发布前已封存证据。
- 当前处理状态：Production `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` 已 READY／PROMOTED，匿名 `401`、普通用户 `403` 和最小产品 smoke 通过；管理员成功读取保持 pending。回退目标 `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2` 为 READY。

## PEH-019｜开发测试工具链依赖存在审计告警

- 已确认事实：`npm audit --omit=dev --registry https://registry.npmjs.org` 返回 `0`；全依赖审计返回 `3 moderate / 1 high / 1 critical`，告警均位于 Vite／Vitest 开发测试工具链，建议修复路径包含 major 升级。
- 产品判断：阶段 1 维持当前 Production 运行依赖和已验证发布身份，开发测试工具链升级进入独立兼容性批次。
- Codex 评估：Production 运行依赖当前审计为零；立即执行 major 升级会扩大本批发布范围并重开完整回归，应在独立分支完成升级、CI 与 Preview 验证。
- 待验证假设：升级后的 Vite／Vitest 可以保持现有 3207 条测试、构建和 E2E 合同稳定。
- 当前处理状态：已登记，阶段 1 不执行自动修复或 major 升级；后续排入独立安全债治理。

## PEH-020｜Production 管理员成功读取缺少合法登录态

- 已确认事实：Production 管理员白名单存在 `1` 个身份；当前执行环境缺少该身份合法凭证，两种受控浏览器环境均无既有登录态。匿名管理接口 `401`、普通用户管理接口 `403` 已通过。
- 产品判断：管理员成功读取只使用白名单内既有内部管理员的合法登录态，不通过变更白名单、重置密码或绕过认证完成。
- Codex 评估：当前证据已覆盖线上权限保护，管理员成功路径继续保持 pending，能够避免把 Preview 管理员验收替代为 Production 管理员读取事实。
- 待验证假设：产品负责人或既有内部管理员提供合法登录态后，合同 v2 页面和三组接口可只读回验且正文访问继续写入 `AdminAuditLog`。
- 当前处理状态：等待合法内部管理员登录态；阶段 1 状态固定为 `Production 已发布·核心回验通过·管理员成功读取 pending`。

## PEH-021｜Production smoke 形成固定验收数据

- 已确认事实：发布后核心 smoke 创建了固定验收账号、`AuthSession` 和空 `InterviewSession`；本轮调用模型端点 `0`，其余产品合同回验通过。
- 产品判断：Production 只承载真实用户链路；本轮验收写入完整封存，清理属于破坏性操作，等待产品负责人单独确认。
- Codex 评估：当前保留数据可以维持发布证据的可追溯性。后续 Production smoke 应使用既有内部账号，或在获得独立授权后采用可审计、可自动回收的验收身份。
- 待验证假设：后续 smoke 可在保持匿名保护、最小写入和零模型调用的同时，完成自动回收与审计闭环。
- 当前处理状态：固定验收账号、`AuthSession` 和空 `InterviewSession` 保留；本轮不执行清理，等待产品负责人单独确认。

## PEH-022｜Stage 2 Preview 日记续跑被验收输入与传输阻断

- 已确认事实：Preview 已通过匿名／普通用户保护、上海日期、【帮我记】完整回应、完成记录、单卡保存和今日日记 draft 生成。首次人工编辑使用 17 字验收标题，超过 UI 的 16 字合同，产品返回 `400 INVALID_JOURNAL_DAILY_AUTOSAVE_REQUEST`；首次纠正前的登录受到 Vercel CLI TLS 阻断。最终 Preview `dpl_5okCGtSkeA7h6uCQUAWv9ur5UtHG` 续跑已通过 16 字以内标题编辑、日记保存和事件卡变化后的“需更新”；调用日记更新前再次遇到 Vercel CLI TLS 阻断，应用未收到该更新请求。
- 产品判断：首次 `400` 归入验收输入错误；应用未收到的两次 TLS 失败归入传输阻断。编辑、保存和需更新获得 Preview 人工证据；日记更新与更新后人工片段保护继续标记 `not_run`。
- Codex 评估：Preview 核心链路的已验证范围已经扩展到“需更新”，人工修改保护仍依赖一次成功更新。Stage 2 工程基础已合入 main，Production 继续使用停止门。
- 待验证假设：网络通道恢复后，同一 Preview 数据可以完成日记更新，并保留更新前的用户人工片段。
- 当前处理状态：保留首次错误、首次 TLS 和续跑 TLS 的独立分账；等待日记更新与人工片段保护最小续跑。Stage 2 Production 还同时受 `PEH-020` 与 `PEH-023` 约束。

## PEH-023｜Stage 2 合并后异步测试波动

- 已确认事实：PR #41 已合入 main merge `77de8d1`，正式域名继续指向阶段 1 Production `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。main run `32337995170` 的零模型 E2E 为 `11/11`；常规测试在 `tests/unit/gi088-evaluation-workbench.test.tsx:508` 等待“同一焦点，容易回答”时单例 `10.176s` 失败，随后构建与 Lint 跳过。Stage 5 同一提交的 push run `32338658277` 全绿；PR run `32338697673` attempt 1 的 test job `96333218076` 在同一文件 `:686` 等待 `GI088_TURN_OUT_OF_DATE`，单例 `30.174s` 后失败；failed-only attempt 2 已主动取消。上述数据来自对应 Job 日志。
- 已确认事实（首轮本地与远程热修复）：首次修复后的全量运行在 `361/377` 文件进度处，`tests/unit/event-centered-interview-workspace.test.tsx` 的跨日期会话用例发生一次时序失败；所选会话标题已经更新，地址栏 effect 尚未完成。旧版精确用例随后完成 `50/50 P4`，仍按这次实际失败修复为等待地址栏 `sessionId=root-2` 与 `entryDate=2026-07-21` 同时更新；修复后精确用例再次完成 `50/50 P4`。GI payload 已恢复用户首次选择“包含提问”的真实路径，fake digest 只承担测试替身；该 payload 完成 `50/50 P4`，完整 GI 文件完成 `20/20 P4`。PR #43 初始 head `9ca5de2` 的 push／pull request 两套 CI 均在 attempt 1 成功。
- 已确认事实（最终文档 head 暴露的第二个时序源）：head `c897d7a` 只改 8 份文档。push run `32343781979` 全绿；pull request run `32343785173` 的 E2E 为 `11/11`，常规测试在同一结构化错误用例等待 `30.194s` 后失败，构建与 Lint 跳过。只读随机顺序复现确认，草稿恢复 effect 的合法 `/operation-events` 请求会在特定调度下抢占按“第 1／2／3 次调用”配置的响应，随后真正的 `/turn` 或 `/start-task` 获得另一份预设结果。
- 已确认事实（最终远程门与 main 合并）：PR #43 final head `a4173d7` 的 push run `32346020465` 与 pull request run `32346025037` 均在 attempt 1 全绿，重试为 `0`；两套 E2E 均为 `11/11`。PR #43 已合入 main merge `795417d`，main push run `32346808393` 的常规测试与零模型 E2E 均全绿。正式域名继续指向阶段 1 Production `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。
- 产品判断：本项按工程发布门完成，Stage 5 产品结论继续使用其隔离评测证据。Stage 2 Production 继续等待 `PEH-020` 与 `PEH-022`。
- Codex 评估：跨日期地址同步与 GI 请求替身是两类独立测试观察问题。GI 的确定性摘要已排除真实 WebCrypto 性能影响；第二轮修复继续保留真实 outbox、幂等键、409 解析和恢复动作，只把两条用例的响应替身改为按接口地址分流，并分别验证目标提交次数。
- 待验证假设：Stage 2 Production 的剩余验收只保留管理员成功读取与日记更新后的人工片段保护，分别由 `PEH-020` 与 `PEH-022` 承担。
- 当前处理状态：`远程工程门与 main CI 已通过·PEH-023 完成`。随机顺序 seed 1～50、8 并发共 `750/750` 通过；两条精确场景 100 轮、12 并发共 `200/200` 通过，未知请求与重复目标请求均为 `0`，原失败 seed 24 已通过。连续三轮全量均为 `3216` 通过、`82` 跳过、`0` 失败；类型检查、Lint、构建 `77/77`、Prisma、文档和差异检查通过；零模型 E2E `11/11`、`AIRequestLog=0`、12 条 Trace 模型违规 `0`、临时 Schema 残留 `0`。PR #43 final head 两套远程门与合入后的 main CI 均全绿，Production 保持 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。

## PEH-024｜Stage 3 安全复核发现授权时间、归属前正文和公开小样本边界

- 已确认事实：首版候选会在 `authorizedAt` 尚未到达时把样本视为有效；完整会话分支查询在完成跨用户／跨日期核验前选择 `lastAssistantQuestion` 与 `draftSummary`；公开元数据按日披露了总量为 `1` 的日期与模式组合。
- 产品判断：样本授权只在生效时间到达后开放；归属不变量通过前保持零正文；公开统计对按日与按月小样本执行统一抑制，总量继续承担收集进度说明。
- Codex 评估：授权状态使用 `sample_authorization_not_started`；详情首查只保留身份和关系元数据；公开日／月桶阈值固定为 `3`，低于阈值时隐藏具体日期或月份及其模式组合，并由合同与资产测试共同约束。
- 待验证假设：样本量增长后，阈值 `3` 仍能在收集透明度与组合重识别风险之间保持平衡；达到 10 条检查点时复核。
- 当前处理状态：详情已增加事件卡／日记 ID、归属和来源链接的正文前元数据门；公开日／月小样本均已抑制，现有 1 条月份桶隐藏。公开资产保持零用户正文、零身份字段、Production 正文读取 `0`、模型调用 `0`。Preview、Production 和真实逐例正文均为 `not_run`。

## PEH-025｜Stage 3 独立终审发现优化候选正文与撤回竞态边界

- 已确认事实：候选列表曾直接返回 Few-shot 的 `inputSnapshot / output` 与验证 `results.candidateOutput`；候选证据页、验证目标、回归与 Few-shot 正文读取缺少同一事务内的 current-consent 双层门和内容审计；活跃 Few-shot 可被新草稿 upsert 改写；验证启动使用读重试且同候选可并发创建多条 running 记录；候选创建、审批、发布与验证采用先读状态后写状态，用户撤回可与这些动作交错；退出清理只从活跃 AIFeedback 起步，遗漏无反馈自动 Bad Case。
- 产品判断：用户当前同意是候选派生、正文读取和状态推进的共同前提；撤回后 draft／approved 候选退出后续流程，published／rolled_back 只承担历史记录；管理列表默认只展示候选、问题簇、发布、Few-shot 与验证元数据；活跃示例和验证任务都要经过候选门。
- Codex 评估：相关用户按稳定顺序取得共享锁、在锁内复核 current consent，再对候选执行 expected-status 原子门，使候选操作与撤回形成可解释的先后关系。候选列表、验证列表与验证 POST 均使用元数据白名单；候选证据、影响证据和验证正文读取同事务审计；两类证据接口返回 `private, no-store`。正常应用路径在候选锁内拒绝重复 running，运行时 active Few-shot 按来源用户当前同意过滤。
- 待验证假设：当前本地回归门可以持续覆盖已知高风险路径；三个 P2 在后续 PR／远程 CI／隔离 Preview 和阶段 4 观察中保持可控，分别由 `PEH-026`、`PEH-027` 和阶段 4 观察门承担。
- 当前处理状态：终审修复与独立复审完成。最终代码节点 `5f5d6cc` 基于 `origin/main@aef37577`，只带入七个 Stage 3 提交；全量回归 `374` 个文件／`3300` 条用例通过，`17` 个文件／`94` 条用例按既有条件跳过，失败 `0`。本轮 PostgreSQL Schema 已删除且残留 `0`，模型调用与 AIRequestLog 均为 `0`。公开回执只声明 pending 候选当前 `evidenceTraceIds` 的直接引用移除，并明确 published／rolled_back 历史引用保留。分支保持未推送，PR 与远程门 pending。

## PEH-026｜撤回成功后的正文外发与临时 dispatch 租约

- 已确认事实：验证和动态 active Few-shot 旧路径会在 current-consent 查询事务提交后才调用 Provider；此时用户可先完成撤回，已读取的正文仍可能随后外发。Provider 调用完成后再复核同意只能阻止结果入库，无法撤回已经发送的内容。
- 产品判断：撤回成功返回后，系统不再发起包含该用户质量改进正文的新请求。已取得来源 User 共享锁并开始的单次 dispatch 可以完成，撤回请求等待该事务结束；撤回先取得更新权时，后续 dispatch 关闭。
- Codex 评估：当前低并发阶段使用最长 `55s` 的 interactive transaction，按稳定 User 顺序持有共享锁并覆盖正文读取、单次 Provider 调用和事务提交。验证及 active Few-shot 禁止通用读重试；Provider、事务超时或提交结果未知时均不自动二次调用。现有 Provider 超时上限 `12s`，`55s` 只承担数据库 fail-closed 外壳。
- 待验证假设：该临时方案在当前内部低并发量下不会造成连接池拥塞、撤回长尾或 P95 明显上升；Stage 4 需观察调用 P95、撤回等待 P95、interactive transaction 时长、连接池占用／耗尽、事务超时和提交结果未知。
- 当前处理状态：验证 dispatch、Provider 失败单次调用和动态 Few-shot dispatch 的真实 PostgreSQL 场景已通过；提交结果未知零自动重试由单元测试覆盖。P2-1 为持久化 dispatch acknowledgment／幂等账本，P2-3 为 `55s` 长事务的容量与超时余量；相关 Schema、Provider 合同、运行账本和观测改造进入独立设计门。

## PEH-027｜验证唯一性、陈旧任务和大规模撤回事务仍需结构治理

- 已确认事实：`AIOptimizationValidation` 当前只有普通索引；正常应用事务可串行拒绝同候选并发 running，但数据库层尚无 partial unique 约束。进程异常可能留下陈旧 running；撤回会按用户全部 trace 扫描并逐候选加锁，数据量增长后事务时长会上升。
- 产品判断：当前 Stage 3 保持无 Prisma Schema 变更；结构迁移、自动恢复和规模优化进入独立停止门，现有收据只证明本轮数据量和应用路径。
- Codex 评估：P2-2 需共同处理数据库级 single-running 约束与孤儿 running 恢复；后续规模方案同时覆盖幂等人工重试、候选分批失效和撤回事务耗时预算。
- 待验证假设：在当前内部样本量下，逐候选稳定加锁可以维持可接受事务时长；样本积累到第 10 条前建立规模基线。
- 当前处理状态：登记为数据库迁移停止门内的结构债。Stage 3 发布候选继续关闭；Stage 4 观察门增加 running 年龄、撤回事务 P95、锁等待和连接池指标。

## PEH-028｜Stage 2 Preview 浏览器验收受到本地传输链路阻断

- 已确认事实：只读诊断确认 Preview deployment、证书和 Deployment Protection 状态正常；请求在到达应用前由本机 Xray／上游 TLS 链路间歇重置。已完成的 Preview 人工范围仍到“需更新”，日记更新与人工片段保护继续等待浏览器续跑。
- 产品判断：Stage 2 浏览器验收保持 blocked，使用稳定网络或稳定线路完成剩余最小续跑后再判断 Production。
- Codex 评估：本项归因传输环境，当前证据不改变 `PEH-022` 已验证范围，也不扩大为产品回归。
- 待验证假设：稳定线路下，同一 Preview 数据可完成日记更新，并保留更新前的用户人工片段。
- 当前处理状态：deployment、证书和 Protection 证据已封存；等待稳定网络／线路。Production 继续使用阶段 1 deployment。

## PEH-029｜Verbose 诊断造成保护凭证终端暴露

- 已确认事实：一次 verbose 诊断在当前本地任务终端显示了 Deployment Protection 绕行请求头及其凭证值；该值未被主动复制到 Git、项目文档、PR 或外发消息，本次公开记录保持敏感值 `0`。
- 产品判断：凭证轮换使用独立授权与平台写入门；本阶段继续完成本地代码和证据验证。
- Codex 评估：终端可见形成凭证治理风险；仓库敏感扫描确认真实凭证命中 `0`，代码与公开证据边界保持通过。
- 待验证假设：完成轮换并使旧凭证失效后，可关闭本项剩余风险。
- 当前处理状态：已登记、零值封存；凭证轮换 pending，等待产品负责人单独授权。

## PEH-030｜Stage 4 第一批拆分需冻结并发恢复现状

- 已确认事实：后端可靠回合与工作区投影已经从生产编排服务拆出，代码边界为 `5` 个文件。隔离 PostgreSQL 验证显示，两个恢复请求竞争同一失败回合时只有一个进入下游并完成，另一个返回 `EVENT_STATE_CHANGED`；现有回合累计 `attemptCount=3`，因此 `resumeAttemptCount=2`。
- 产品判断：第一批以降低主链维护风险、保持用户可见行为和所有公开合同兼容为目标；并发恢复尝试次数作为继承债务显式封存，本批保持现状。
- Codex 评估：成功工作区 JSON、并发恢复结果、单卡与幂等行为已有单元、真实 PostgreSQL、全量回归和零模型 E2E 四层保护。后续若调整恢复计数，需要单独定义用户价值、数据库语义、指标基线和回退门。
- 待验证假设：当前纯拆分在远程 CI 与隔离 Preview 中继续保持 API、SSE、错误码、事件顺序、幂等键和数据库结果兼容；Stage 2 阻断解除并完成 Production 发布后，至少 24 小时／20 次内部有效回应的观察门可支持线上判断。
- 当前处理状态：本地门与 PR 工程门已通过；第一批最终 head `382457b` 已由 PR #45 合入 main merge `548fda5`。合并后的画像测试夹具时间竞争已由 `PEH-032` 闭环；Preview 产品 smoke 继续保持 `transport_blocked`。Production 保持 blocked，正式域名继续运行阶段 1 deployment。回退方式为撤销第一批三个纯拆分／合同提交。

## PEH-031｜Stage 4 第一批 Preview smoke 受 TLS 传输阻断

- 已确认事实：PR #45 head `b004f38` 对应 Preview `dpl_7uHdBKXy9RvZhbWVWrEXWq3jYZAG` 为 Ready。受控 smoke 只尝试一次匿名 `GET /api/interview/event-centered/sessions?limit=1`，非 verbose 请求在 TLS 握手发生 `SSL_ERROR_SYSCALL`；应用响应 `0`、重试 `0`。登录、登录态、事件中心列表读取和最小 session start 均为 `not_run`。
- 产品判断：Preview Ready 与产品冒烟分开记录；当前冒烟状态为 `transport_blocked`，Production 继续关闭，已通过的本地与远程工程证据保持原运行身份。
- Codex 评估：该失败发生在应用收到请求前，当前证据支持本机／上游传输链路阻断，暂不支持产品权限或主链回归归因。账号、权限、环境变量、代码和 deployment 配置均保持原值。
- 待验证假设：稳定网络／线路下，同一 Preview 可完成匿名保护、登录、列表读取和最小 session start；成功读回后再核对 `AIRequestLog` 增量。
- 当前处理状态：业务写入 `0`、模型端点请求 `0`、Production 访问 `0`；`AIRequestLog` 增量因缺少合法只读路径记为 `unconfirmed`。本轮按停止门结束，零重试；最终回执 head 只进入 CI 与 Preview Ready 门，产品 smoke 继续保持 `transport_blocked`。

## PEH-032｜Stage 4 第一批合并后画像测试夹具时间竞争

- 已确认事实：PR #45 合入 main merge `548fda5` 后，唯一 main push run `32363542406` 在 attempt 1 的画像兜底用例失败：期望最近事实为 `fact 0`，实际为 `fact 1`；类型检查与零模型 E2E `11/11` 通过，构建和 Lint 随前序失败跳过。Stage 4 合并差异与画像文件交集为 `0`；合并前后画像测试与产品服务的 Git blob 分别保持 `4d031387` 与 `f84c5b21`。
- 产品判断：本项归入测试隔离与确定性问题，Stage 4 后端产品行为、画像产品逻辑和缓存合同保持原值；Production 继续使用阶段 1 deployment，Stage 4 Production 继续关闭。
- Codex 评估：旧夹具在循环中为每条事实调用实时 `new Date()`，产品逻辑再按 `updatedAt` 选择最近事实；高负载下循环跨越毫秒边界会使 `fact 1` 或 `fact 2` 成为真实最新项。精确用例单跑、完整文件和随机顺序可通过，并发进程压力可稳定暴露同类漂移；仓储与 Prisma 均为模块 mock，当前证据不支持缓存未清理或全局状态污染归因。
- 待验证假设：只把测试夹具的 `createdAt / updatedAt` 固定为 `fact 0` 最新的确定性顺序，即可消除调度敏感性，同时继续验证产品按时间选择最新事实的既有合同。
- 当前处理状态：已解决。最小修复仅修改 `tests/unit/portrait-synthesis.service.test.ts`，产品源码、Schema、依赖和 CI 配置变更均为 `0`。修复后精确用例与完整文件通过，随机顺序 `50/50`、并发进程 `32/32`、全量 `3301` 条通过；类型、Lint `0 errors / 43 inherited warnings`、build `77/77`、零模型 E2E `11/11`、`AIRequestLog=0`、12 条 Trace 与临时 Schema 删除通过。PR #46 已合入 main merge `d98c915`；合并后 main CI run `32365805590` attempt 1 全绿，零模型 E2E `11/11`、模型调用 `0`。

## PEH-033｜事件卡保存后的日记 stale 刷新竞态

- 已确认事实：Stage 4 第二批旧基线的首轮全套零模型 E2E 为 `10/11`；事件卡内容已经保存并展示，今日日记仍显示“已保存”，预期的“需更新／更新日记”未出现。该单例隔离复跑 `1/1`，随后两轮全套连续 `11/11`。独立归因确认同一竞态已经存在于第一批 main 基线；第二批差异严格为事件中心访谈 `4` 个前端文件，与日记读取、保存和来源签名代码交集为 `0`。
- 产品判断：该问题定为 Production P1。第二批源码工程门可以继续，前端 Production 完成状态保持关闭；日记来源变化后，用户必须稳定看到“需更新”并能在更新时保留手工修改。
- Codex 评估：日记页面的异步当天读取可能晚于事件卡保存返回，并用较旧状态覆盖保存后的新状态。修复归属第三批日记工作区候选 `bf45`，由当天数据状态拆分统一处理读取与保存的先后权；第二批保持日记代码改动为 `0`。
- 待验证假设：增加延迟 `GET /api/journal/day` 与事件卡保存响应交错的单元合同后，可以稳定阻止旧读取覆盖新保存状态；修复后零模型 E2E 全套连续 `3` 轮均能通过日记生成、编辑、保存、需更新和人工修改保护。
- 当前处理状态：`Production P1 / frontend source-main allowed / Production blocked`。第二批发布门如实记录所有 E2E 结果；第三批完成交错单元合同、全量门与 E2E 连续三轮前，阶段 4 Production 保持 blocked。

## PEH-034｜Stage 4 第二批前端发布门

- 已确认事实：第二批实现提交 `61dd4cf`、P1 修复提交 `03b8501` 与发布前文档提交 `7976c1c` 基于最新 main merge `d98c915`，只包含事件中心工作区组件、状态 Hook、可靠回合恢复 Hook、工作区单元合同 `4` 个代码／测试文件和 `6` 份发布文档；旧发布线文档提交已退出重放，主线 `PEH-032` 完整保留。Prisma、依赖、CI、E2E 基础设施、日记和画像文件的第二批差异均为 `0`。最终文档 head `5d07f27` 的 push run `32432781058` 全绿；PR run `32432784604` 只有工作区单元测试出现时序失败，其他 `373` 个测试文件和零模型 E2E 通过，详见 `PEH-037`。
- 产品判断：本批只降低事件中心前端维护风险并保持用户可见行为与恢复合同兼容。完整本地门通过后可以推送并创建 PR；合并、Production 发布与 `PEH-033` 日记 P1 修复继续保持独立停止点。
- Codex 评估：工作区状态、请求、outbox 和可靠恢复职责拆出后，现有 Stage 2 地址等待、接口分流、幂等 ID、结构化错误、焦点恢复和内部导航合同继续由定向、压力、全量和浏览器四层回归保护。独立审查发现并关闭的草稿／新 outbox 清理问题由 `PEH-035` 承担。
- 待验证假设：测试时序修复和本次公开回执形成新的最终 head 后，push 与 PR 两套 CI 可全绿，并形成精确对应的 Ready Preview。
- 当前处理状态：`source head passed / final docs head test timing failure / local test repair passed / final remote gates pending / Preview Ready / controlled smoke partially passed / Production blocked`。本地修复后全量 `374` 个文件、`3307 passed / 95 skipped / 0 failed`，类型、目标 Lint、build `77/77`、双 Prisma 通过；零模型 E2E `11/11`、`AIRequestLog=0`、12 条 Trace 的模型违规 `0`，临时 Schema `daily_light_e2e_mt2aakyi_d5ba631f9e` 已删除且残留 `0`。PR #47 source head `7976c1c` 的两套远程门与 Preview Ready 证据继续有效；最终文档 head `5d07f27` 的远程分歧和本地修复见 `PEH-037`。PR 保持未合并，Production 保持 blocked。

## PEH-035｜accepted 回合清理误删下一草稿与新 outbox

- 已确认事实：独立审查发现，accepted outbox A 对应用户消息后来在同分支服务端可见时，新状态 Hook 会清掉用户在恢复读取失败后输入的下一草稿 B；即使 B 与 A 原话完全相同，它仍是新的用户输入。旧 A effect 还会无条件删除同分支持久层 outbox，使已经写入的新 outbox B 丢失。
- 产品判断：该问题按本批 P1 处理，提交与推送在修复和独立复核前暂停。用户在可靠保存后的任何新草稿与新轮次都必须继续保留；A 服务端可见只授权清理 A 自己的 outbox。
- Codex 评估：发送 A 时 composer 已在等待请求前同步清空，accepted-visible cleanup 只承担 outbox 收束。修复将 composer draft 完全移出该清理路径，并让内存与持久层都按 expected `clientTurnId` 条件清除 outbox；持久层不可用时保持内存可用和用户草稿安全。
- 待验证假设：真实组件链路 A accepted → 恢复 GET 失败 → 用户输入与 A 同文的 B → 同分支重挂看到 A，可稳定清 A outbox并保留 B；旧 A 清理遇到新 outbox B 或 `SecurityError` 时不造成新数据丢失。
- 当前处理状态：已解决。提交 `03b8501` 增加同文草稿重挂、outbox CAS 与 `SecurityError` 三项合同；独立单文件复跑 `18/18`，复核结论 `P0=0 / P1=0 / P2=0`。后续定向 `45/45`、压力 `90/90`、全量 `3307 passed / 95 skipped / 0 failed`、类型、Lint、build、双 Prisma 与零模型 E2E `11/11` 全部通过；模型调用 `0`，临时 Schema 残留 `0`。

## PEH-036｜第二批 Preview 列表 smoke 解析口径不一致

- 已确认事实：PR #47 source head `7976c1c` 对应 Preview `dpl_FCiuGt6fnLt9hUm5uWnNHwcvWqHd` 为 Ready。受控 smoke 每步只请求一次：匿名列表返回 `401 AUTHENTICATION_REQUIRED`；固定账号登录返回 `200` 并建立 cookie；登录态返回 `200` 且固定账号匹配；事件中心列表返回 HTTP `200`。验收脚本把接口真实 `{ items, unfinishedCount, unfinishedLimit, nextCursor }` 合同按 `{ sessions: [...] }` 解析，将列表步骤标为失败并立即停止；最小 session start 为 `not_run`。
- 产品判断：本项归入验收脚本口径问题，不形成 Preview 产品失败结论。HTTP `200` 证明登录态列表请求到达应用并成功响应；内容形状本轮未保存为运行回执，不能扩大声明为完整列表字段验收。
- Codex 评估：仓储、路由和前端现役合同均使用 `items`，本批代码没有改变列表响应结构。后续 smoke 脚本应先复用正式 schema 或现役类型，再读取 `items`；修复与重跑进入独立候选，避免改变本轮单步一次、零重试证据身份。
- 待验证假设：将 smoke 解析器对齐 `items` 后，同一固定账号可以继续完成列表内容校验与幂等 session start；该假设本轮保持 `not_run`。
- 当前处理状态：`acceptance_parser_mismatch / product response HTTP 200 / retry 0 / session start not_run`。账号创建 `0`、权限变更 `0`、模型端点请求 `0`、Production 请求 `0`；本轮无 TLS 阻断。按停止门不再请求 Preview，PR 保持未合并，Production 保持 blocked。

## PEH-037｜最终文档 head 暴露菜单用例时序竞态

- 已确认事实：PR #47 最终文档 head `5d07f27` 的 push run `32432781058` 全绿，test 与 E2E 均通过；同 head 的 PR run `32432784604` 中 E2E 通过，常规测试仅 `tests/unit/event-centered-interview-workspace.test.tsx` 的“过期动作发送前阻止”用例失败：按钮已渲染，会话列表同步尚未完成，按钮保持 `disabled`；测试提前点击后未打开菜单，`menuitem` 在 `3050ms` 后超时。该 PR run 其余 `373` 个文件、`3306` 条用例通过，`17` 个文件／`95` 条用例按既有条件跳过。
- 产品判断：本项按测试 P2 处理，产品行为 `P0=0 / P1=0`。列表同步期间按钮保持不可用符合现有用户保护；最终远程门通过前 PR 继续保持未合并，Production 保持 blocked。
- Codex 评估：受控延迟会话列表响应稳定复现了竞态。修复只改测试：用 deferred 响应固定列表未完成窗口，先确认按钮 `disabled`，再释放列表响应并等待按钮 `enabled`，最后执行菜单动作。该合同同时验证交互保护和测试的正确时序。
- 待验证假设：携带该单测修复和公开回执的最终 head 可通过 push 与 PR 两套 CI，并继续精确对应 Ready Preview。
- 当前处理状态：`local test repair complete / final remote gates pending / Production blocked`。目标用例与受控压力通过；全量 `374` 个文件、`3307 passed / 95 skipped / 0 failed`，类型、目标 Lint、build `77/77`、双 Prisma 通过；零模型 E2E `11/11`、`AIRequestLog=0`、12 条 Trace 的模型违规 `0`，临时 Schema `daily_light_e2e_mt2aakyi_d5ba631f9e` 已删除且残留 `0`。本地测试修复和本轮文档保持未提交、未推送，最终远程门保持 pending。
