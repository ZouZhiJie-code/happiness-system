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
- 当前处理状态：阶段 1 已在实现 `7bbe285` 增加合同 v2、当前产品六步漏斗和独立旧链区；远程 CI、Preview 行为验收和只读数据库对账均已通过，Production 发布继续待执行。证据见[数据口径 v2 回执](./analytics-contract-v2/README.md)。

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
- 当前处理状态：阶段 2 待实现。

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
- Codex 评估：该边界不推翻既有 Preview 行为验收；Production 发布仍需正式域名的权限、页面和关键指标回验，发布前状态保持 pending。
- 待验证假设：阶段 1 合入并部署正式环境后，正式域名可稳定回读合同 v2，六步漏斗与同一只读 SQL 口径继续一致。
- 当前处理状态：证据边界已封存；阶段 1 为 `Preview Ready / Production 待发布`，回退目标为 `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`。
