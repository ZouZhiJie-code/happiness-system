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

- 已确认事实：数据库服务层支持撤回并退役反馈／Few-shot；当前设置页面会提交退出请求，API 与上层 service 返回 `409 AI_QUALITY_PARTICIPATION_REQUIRED`。
- 产品判断：Golden Set 只使用当前有效同意且撤回时间为空的记录。
- Codex 评估：在生产读取前先统一撤回合同，才能证明已撤回用户会被稳定排除。
- 待验证假设：修复可在现有字段和数据库能力内完成，无需 Schema 变更。
- 当前处理状态：待实现与回归；Production 数据读取前置门。

## PEH-005｜零模型证明不能只依赖 AIRequestLog

- 已确认事实：现有浏览器脚本依赖未安装的 `playwright` 且覆盖旧五维入口；事件中心模型尝试还会记录在 `AIGenerationTrace.pipelineDecisions`。
- 产品判断：自动 E2E 必须零真实模型调用。
- Codex 评估：需要仅测试环境可启用、Production 启动即拒绝的确定性 AI 替身，并同时断言请求日志和 Trace 的模型执行字段。
- 待验证假设：现有 Provider 注入点足以实现 fail-closed 测试替身，不改变正式路径。
- 当前处理状态：PR #41 已合入 main；push／pull request 两套 E2E 均为 `11/11`，PR Job `AIRequestLog=0`、12 条 Trace 四类违规 `0`、临时 Schema 已删除。Preview 已通过至“需更新”；剩余日记更新与人工片段保护见 `PEH-022`，合并后 CI 稳定修复见 `PEH-023`。Stage 2 Production blocked。

## PEH-006｜月度分析当前数据源与 Production 主链不一致

- 已确认事实：`/analysis` 的旧月度聚合主要读取 `JoyEntry + DailyJournalEntry`；Production 的事件中心月度成果由 `JournalPeriodReport`、`JournalDailyEntry` 和 `JournalEventEntry` 承担。
- 产品判断：月度个性化洞察只评估当前 Production 用户实际可见的月度材料。
- Codex 评估：直接在现有 `AnalysisNarrative` 占位层接模型会评到旧链数据，应先增加当前成果物的确定性材料投影。
- 待验证假设：`JournalPeriodReport` 现有 material precedence 足以承接候选输入，无需原始完整对话。
- 当前处理状态：阶段 5 前置实现项；候选模型调用保持 `0`。

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
- 当前处理状态：已形成隐私门；普通用户样本保持排除，覆盖不足时结论记录为 partial／insufficient evidence。

## PEH-010｜私有副本需要处理后续撤回

- 已确认事实：Production 撤回或删除不会自动级联到本地 `.private` 评审包。
- 产品判断：撤回用户的正文退出当前 Golden 与月度候选。
- Codex 评估：每次第 10 条检查点、最终封存和月度 finalize 前执行 reconciliation；命中撤回时隔离正文，公开证据只保留非内容哈希与撤回回执，并补充替代样本。
- 待验证假设：私有授权账与 Production consent 状态可以通过随机 case 映射稳定对账。
- 当前处理状态：待实现为 Golden v2 和月度候选的强制门。

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
- 产品判断：本项按工程发布门处理，Stage 5 产品结论继续使用其隔离评测证据。Stage 2 Production 等待两个测试文件完成远程复核。
- Codex 评估：跨日期地址同步与 GI 请求替身是两类独立测试观察问题。GI 的确定性摘要已排除真实 WebCrypto 性能影响；第二轮修复继续保留真实 outbox、幂等键、409 解析和恢复动作，只把两条用例的响应替身改为按接口地址分流，并分别验证目标提交次数。
- 待验证假设：按接口地址分流后，后台观测请求的先后顺序不再改变 `/start-task`、`/turn` 与 `/session` 的业务响应；新 head 可以在重试为 `0` 的本地全量门和 push／pull request 两套远程 CI 中稳定通过。
- 当前处理状态：`第二轮本地工程门通过·远程待验证`。随机顺序 seed 1～50、8 并发共 `750/750` 通过；两条精确场景 100 轮、12 并发共 `200/200` 通过，未知请求与重复目标请求均为 `0`，原失败 seed 24 已通过。连续三轮全量均为 `3216` 通过、`82` 跳过、`0` 失败；类型检查、Lint、构建 `77/77`、Prisma、文档和差异检查通过；零模型 E2E `11/11`、`AIRequestLog=0`、12 条 Trace 模型违规 `0`、临时 Schema 残留 `0`。新 head 的 push／pull request 两套远程门待执行。
