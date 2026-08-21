# 当前阶段 Handoff

- 文档职责：当前执行交接
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[`DL-PROD-20260819`](./ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

最后更新：`2026-08-20`

## 0. 当前执行入口｜DL-PROD-20260819

Daily Light 五阶段生产主线完善已获产品负责人确认并进入实施。阶段 1 已发布 Production，正式域名核心回验通过，管理员成功读取保持 pending；阶段 2 热修复已由 PR #43 合入 main merge `795417d`，final head 两套 CI 与 main CI 全绿，Preview 核心主链通过至“需更新”，Production blocked；阶段 3 已由 PR #44 合入 main `ef7bf94`，结论 `P0=0 / P1=0 / P2=3`，样本状态为 `insufficient_samples / collection_pending`；阶段 4 第一、二批已合入 main `a89d5bc`，第三批 PR #48 证据 head `519cc37` 两套首轮 CI 与零模型 E2E 全绿，独立终审 `P0=0 / P1=0 / P2=1`；Preview Ready，产品 smoke 在应用登录前受验收工具配置阻断，main pending，Production blocked；阶段 5 已以 `No-Go / insufficient_evidence` 完成隔离评估，真实用户月 `0`、模型调用 `0`，Production 保持确定性月度总结。总计划、授权、验证门和停止点见 [DL-PROD-20260819](./ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)，过程问题见[五阶段问题台账](../artifacts/production-evidence-hardening/2026-08-19/issue-ledger.md)。

当前工作线事实：

- 当前本地候选分支：`codex/production-evidence-hardening-stage4-journal-release-20260820`
- 当前工作区：`/Users/zouzhijie/Desktop/Happiness-system-stage4-journal-release-20260820`
- 上游五阶段工作分支：`codex/production-evidence-hardening-20260819`
- Stage 4 第三批基线：`a89d5bc`，已包含 PR #47 final head `d71a9b3` 的 source-main 合并结果
- Production 发布头：`a86a4ba`
- 阶段 1 main 合并提交：`305f209`
- 阶段 2 main 合并提交：`77de8d1`
- 阶段 2 热修复 main 合并提交：`795417d`
- 阶段 4 第一批 main 合并提交：`548fda5`
- 画像测试夹具热修 main 合并提交：`d98c915`
- 阶段 4 第二批 main 合并提交：`a89d5bc`
- 正式 deployment：`dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`（READY／PROMOTED）
- 回退 deployment：`dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`（READY）
- Production 模式：`event_centered + baseline`

阶段 4 第一批本地发布线事实：

- 当前三个实现／合同提交为 `768f9d5`、`aeb1d82`、`98b10de`，差异严格收敛为后端可靠回合、工作区投影、原编排服务、成功 JSON 单元合同与 PostgreSQL 并发合同共 `5` 个文件；旧 Stage 2 重复血缘带入数为 `0`。
- 定向回归 `59/59`、隔离 PostgreSQL `2/2`、全量 `3301` 条、零模型 E2E `11/11` 本地通过；`AIRequestLog=0`，12 条 Trace，临时数据库与 E2E Schema 残留均为 `0`。类型、Lint、build `77/77`、两套 Prisma、文档与差异检查通过。
- 成功工作区 JSON 和同一失败回合并发恢复已经 characterization；两个恢复竞争者仅一个进入下游，当前 `resumeAttemptCount=2` 作为继承债务保持。API、SSE、错误码、事件顺序、幂等键、数据库结构和产品行为保持兼容。
- PR #45 初始 head `0a1471d` 的 push run `32361400473` 与 pull request run `32361466403` 均在 attempt 1 全绿、重试 `0`；两套远程零模型 E2E 均 `11/11`、`AIRequestLog=0`、12 条 Trace、临时 Schema 已删除。Preview `dpl_C6VDNrDThi2jkq3o6ADEGtUaszDj` Ready。
- `b004f38` Preview `dpl_7uHdBKXy9RvZhbWVWrEXWq3jYZAG` Ready；受控 smoke 的唯一匿名请求在 TLS 握手发生 `SSL_ERROR_SYSCALL`，应用响应 `0`、重试 `0`。匿名保护 `technical_blocked`，登录、登录态、列表读取与最小 session start 均 `not_run`；业务写入、模型端点请求、Production 访问均 `0`，`AIRequestLog` 增量 `unconfirmed`。
- 第一批最终 head `382457b` 已由 PR #45 合入 main merge `548fda5`；画像测试夹具时间竞争由 `PEH-032` 闭环，PR #46 已合入 main `d98c915`，main CI run `32365805590` attempt 1 全绿、零模型 E2E `11/11`。Preview 产品 smoke 继续保持 `transport_blocked`，Production 继续受 Stage 2 与观察门约束。

阶段 4 第二批前端发布线事实：

- 实现提交 `61dd4cf` 与 P1 修复提交 `03b8501` 基于 `origin/main@d98c915`；差异严格为工作区组件、状态 Hook、可靠回合恢复 Hook 与工作区单元合同 `4` 个文件，旧发布线文档提交带入数为 `0`。
- 独立审查发现 accepted A 可见时可能清除后来输入的同分支草稿 B，且旧 A 清理可能删除新 outbox B。`03b8501` 将 accepted-visible 收窄为只按 `clientTurnId` 条件清 outbox，composer draft 保持原值；真实组件同文 B 重挂恢复、新 B outbox CAS 与 `SecurityError` 三项合同通过，独立复核 `P0=0 / P1=0 / P2=0`，过程问题见 `PEH-035`。
- Stage 2 的跨日期地址等待与按接口地址分流测试继续保留；真实 outbox、幂等 ID、结构化错误与恢复动作保持兼容。本地定向 `45/45`、核心工作区压力 `90/90`、全量 `3307 passed / 95 skipped / 0 failed`、类型、Lint、build `77/77`、双 Prisma、文档和差异检查通过；零模型 E2E `11/11`、`AIRequestLog=0`、12 条 Trace，临时 Schema 残留 `0`。
- 独立终审为 `P0=0 / P1=0 / P2=0`。PR #47 source head `7976c1c` 的 push run `32431840137` 与 pull request run `32431860395` 均在 attempt 1 全绿、重跑 `0`；两套远程 E2E 均 `11/11`、`AIRequestLog=0`、12 条 Trace且临时 Schema 已删除。Preview `dpl_FCiuGt6fnLt9hUm5uWnNHwcvWqHd` Ready 并精确对应 source head。
- 受控 smoke 单次通过匿名保护 `401`、固定账号登录 `200`、登录态 `200` 和事件中心列表 HTTP `200`；验收脚本误把真实 `items` 合同按 `sessions` 解析后停止，session start `not_run`、重试 `0`。账号创建、权限变更、模型端点请求与 Production 请求均为 `0`；详见 `PEH-036`。
- 最终文档 head `5d07f27` 的 push run `32432781058` 全绿；PR run `32432784604` 仅工作区菜单阻断用例在按钮仍不可用时提前点击并超时。受控延迟确认产品保护符合合同，纯测试修复固定“先不可用、列表完成后可用、再执行菜单并阻断请求”的顺序；本地全量 `3307` 条和零模型 E2E `11/11` 通过，详见 `PEH-037`。
- 修复提交 `3478ddb` 后，PR #47 head `246a101` 的 push run `32437800917` 与 pull request run `32437803182` 均 attempt 1 全绿、重跑 `0`；两套常规门均为 `3307 passed / 95 skipped`，两套零模型 E2E 均 `11/11`、`AIRequestLog=0`、Trace `12` 且临时 Schema 已删除。Preview `dpl_HsTBC5gTizMr1sGaqENSTACPMy4T` Ready；菜单测试 P2 已关闭，产品结论保持 `P0=0 / P1=0`。
- 证据 head `d4c1a07` 暴露的测试初始状态前提已由最终 head `d71a9b3` 收敛；PR #47 已合入 main `a89d5bc`。main run `32439906894` attempt 1 全绿，零模型 E2E `11/11`；`PEH-034` 与 `PEH-037` 已按 source-main 关闭。
- 已确认日记 `stale` 刷新竞态存在于第一批 main 基线，前端 `4` 文件引入数为 `0`。该问题定为 Production P1，第三批正在修复，Production 保持 blocked；完整归因见 `PEH-033`。

阶段 4 第三批日记发布线事实：

- 发布线基于 `origin/main@a89d5bc`，依序带入 `8` 笔 patch-id 一致提交形成重放 head `ecb674d`，随后追加并发内容保护提交 `a6cb4a9`；当前本地状态为完成、远程 pending。
- 范围包含日记工作区职责拆分、退出／删号后的恢复数据清理、焦点恢复、同月刷新状态、现役 warning 清理、`stale` 刷新竞态修复、记录／日记／当天读取字段级合并、提交等待期输入保护及真实交错测试。
- 修复后本地门：独立定向 `107/107`；全量 `3332 passed / 95 skipped / 0 failed`；类型、Lint `0 errors / 33 retained warnings`、build `77/77`、双 Prisma、docs `24/847/1` 与差异检查通过。零模型 E2E 全套连续 `3` 轮均 `11/11`、`AIRequestLog=0`、Trace `12`，三份临时 Schema 均删除且残留 `0`。
- 独立终审为 `P0=0 / P1=0 / P2=1`。`PEH-039` 与 `PEH-040` 的人工内容保护 P1 已在 source branch 关闭；唯一 P2 是未来事件卡删除时的来源合并边界，当前无删除入口，见 `PEH-041`。
- PR #48 证据 head `519cc37` 的 push run `32442390634` 与 pull request run `32442422147` 均 attempt 1 全绿、重跑 `0`；两套均为 `3332 passed / 95 skipped`、build `77/77`、Lint `0 errors / 33 warnings`，零模型 E2E 均 `11/11`、`AIRequestLog=0`、Trace `12`，临时 Schema 已删除。
- Preview `dpl_BAux5cqn6ATTqB7DsHZDSu3u6Wxt` Ready；匿名保护单次返回 HTTP `302` 至 Vercel SSO。固定账号登录在应用请求前因验收脚本工作目录解析失败而停止，重试 `0`、业务写入 `0`、模型端点请求 `0`，详见 `PEH-042`。下一门为 final docs head 两套 CI 与 main；正式域名继续使用 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`，Production 保持 blocked。

阶段 3 本地候选事实：

- 原候选 worktree 与分支继续原样保留。最终 worktree：`/Users/zouzhijie/Desktop/Happiness-system-stage3-final-20260820`；分支：`codex/production-evidence-hardening-stage3-final-20260820`；基线：`origin/main@aef37577`。
- 最终发布线只带入七个 Stage 3 提交，代码节点 `5f5d6cc`；64 份非冲突文件与终审版本逐文件一致，6 份冲突文档完整保留 Stage 2、Stage 3 和 Stage 5 事实。旧 Stage 2 提交与 `beedab5` 带入数均为 `0`。
- Production 零正文元数据证据显示完整轨迹可入集数 `0`，状态 `insufficient_samples / collection_pending`；内容开关保持关闭，Production 正文读取 `0`、模型调用 `0`。
- 终审修复候选中，候选列表与验证 POST 只返回候选、问题簇、发布、Few-shot 和验证元数据，初始页面与动作响应均不下发逐例正文；候选证据与影响证据接口使用 `private, no-store`。验证 target／regression／Few-shot、候选证据与影响证据正文统一经过 current-consent 双层门，并在同一事务写入审计。
- 验证与动态 active Few-shot 的 Provider 调用使用最长 `55s` 的临时同意租约：相关 User 共享锁保持到单次调用和事务结束；调用先行时撤回等待，撤回先行时后续正文不会外发。Provider、事务超时或提交结果未知均不自动二次调用。该方案面向当前低并发阶段，连接池、事务时长和撤回等待进入 `PEH-026` 与阶段 4 观察门。
- 撤回覆盖该用户全部 AIGenerationTrace，包含无 AIFeedback 自动 Bad Case；draft／approved 候选一次去重转为 rejected，并只从当前 `evidenceTraceIds` 移除该用户的直接 trace 引用。共享候选按 ID 稳定顺序逐行加锁后重读，双用户撤回不会复活先前引用；published／rolled_back 历史状态与引用保持。
- 第二轮独立复审结论为 `P0=0 / P1=0 / P2=3`。三个 P2 分别为持久化 dispatch acknowledgment／幂等账本、数据库级 single-running 与孤儿 running 恢复、`55s` 长事务容量与超时余量；继续由 `PEH-026`、`PEH-027` 和阶段 4 观察门承担。
- 干净重基线后，专用本地 loopback PostgreSQL `12` 个测试用例、`18/18` 个并发场景再次通过，`AIRequestLog=0`、模型调用 `0`，本轮临时 Schema 已删除且残留 `0`。定向回归 `119/119`；全量回归 `374` 个文件／`3300` 条用例通过、`17` 个文件／`94` 条用例按既有条件跳过、失败 `0`；零模型 E2E `11/11`，12 条 Trace 模型违规 `0`。Lint `0 errors / 43 inherited warnings`，类型、Production build `77/77`、两套 Prisma、文档、敏感扫描与差异检查通过。
- 当前候选未推送、未开 PR、未部署 Preview／Production；真实逐例正文、样本导出、人工评审和产品检查点均为 `not_run`。完整轨迹 `0/30`，Production 正文读取与模型调用均为 `0`。

阶段 1 Production 证据：

- 数据合同实现 `7bbe285`，最终发布头 `a86a4ba`，PR #40 main merge `305f209`；二者源码 tree 均为 `70ca8f4`。最终 CI run `32333975329` 成功，`3207 passed / 82 skipped / 0 failed`，Lint `0 errors / 43 warnings`。
- Preview deployment `dpl_DExPivo5Qqfk97kH9jVahU8yWQ8A` 已通过管理员、匿名、普通用户、空态、错误态和旧链展开区验收。
- `2026-07-22..2026-08-20` 的六步漏斗 Preview API 与独立 SQL 均为 `6 / 5 / 5 / 1 / 1 / 1`，差异为 `0`；数据库事务只读，正文读取、业务写入和临时秘密残留均为 `0`。
- 留存与质量保留本轮独立 SQL 统计；后续 Preview API 再读受到 deployment protection／TLS 路径阻断，逐字段一致性范围继续使用已封存证据。
- Production `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` 已 READY／PROMOTED，正式域名匿名 `401`、普通用户 `403`、注册登录、session、空 joy session 和非法日期合同均通过；模型端点调用 `0`，抽查 `19` 条日志的 `5xx / error / fatal / warning` 均为 `0`。
- 管理员白名单存在 `1` 个身份；当前缺少合法凭证且两种受控浏览器环境均无既有登录态，管理员成功读取保持 pending。完整证据见[数据口径 v2 回执](../artifacts/production-evidence-hardening/2026-08-19/analytics-contract-v2/README.md)。
- smoke 创建的固定验收账号、`AuthSession` 和空 `InterviewSession` 继续保留，清理等待产品负责人单独确认；Production 运行依赖审计为 `0`，Vite／Vitest 开发测试工具链告警进入独立治理。

阶段 2 本地发布线证据：

- 分支已 rebase 到 `origin/main@305f209`，24 个阶段 2 文件边界清楚，Prisma 变更为 `0`。
- rebase 后类型检查、目标 Lint、文档和差异检查通过；guard `9/9`，浏览器 `11/11`，`AIRequestLog=0`、12 条 Trace 四类违规 `0`、临时 Schema 残留 `0`。
- 历史完整三连跑继续保留原始运行身份；PR #41 最终 head 两套远程 CI／E2E 已通过并合入 main `77de8d1`。最终 Preview 已通过编辑、保存和事件卡变化后的“需更新”；日记更新前受到 TLS 阻断，更新与人工片段保护保持 `not_run`。
- main run `32337995170` 出现一个 GI-088 工作台异步单例失败；Stage 5 同一提交的 push run `32338658277` 全绿，PR run attempt 1 又在同一文件等待结构化错误时单例波动，failed-only attempt 2 已主动取消。首次本地修复后的全量运行在 `361/377` 文件进度处又暴露跨日期会话标题与地址 effect 的单次时序差；旧版与修复后的精确用例均完成 `50/50 P4`，修复仍依据实际失败等待地址栏两个字段同时更新。
- GI payload 已恢复真实首次选择路径，fake digest 只作为测试替身；该 payload `50/50 P4`、完整 GI 文件 `20/20 P4`、混合压力 `270/270 P4` 通过。第二轮已改为按接口地址分流，随机顺序 `750/750`、精确场景 `200/200`、连续三轮全量和零模型 E2E `11/11` 均通过。只修改两个测试文件，产品源码 `0`。
- PR #43 final head `a4173d7` 的 push run `32346020465` 与 pull request run `32346025037` 均在 attempt 1 全绿、重试 `0`，两套 E2E 均为 `11/11`；PR #43 已合入 main merge `795417d`，main push run `32346808393` 的常规测试与零模型 E2E 全绿。
- Preview transport 根因已定位为本机 Xray／上游 TLS 链路间歇重置；deployment、证书和 Protection 状态正常。浏览器验收等待稳定网络／线路；一次 verbose 诊断造成保护凭证只在本地任务终端可见，该值未被主动复制到 Git、项目文档、PR 或外发消息，公开记录敏感值为 `0`，凭证轮换等待单独授权。详见 `PEH-028`、`PEH-029`。
- Stage 2 Production 等待 `PEH-020` 与剩余 `PEH-022` 同时完成。正式域名继续使用阶段 1 deployment `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。

阶段 5 隔离候选证据：

- 候选输入只使用当前事件中心月度成果投影、评分趋势和日期引用；原始完整对话不进入候选，Production 页面与接口未接入该能力。
- 6 条合成边界夹具的数据合同全部通过；2 条低数据量用例验证 Provider 调用为 `0`，其余 4 条候选调用保持 `not_run`。
- 获得 `external_monthly_eval` 样本级授权的真实用户月为 `0`，已发布 Chat Provider 配置指纹尚未冻结，因此模型调用和产品负责人逐例裁决均为 `0`。
- 阶段结论为 `No-Go / insufficient_evidence`；评估本身已完成，Production 继续使用确定性 `AnalysisNarrative`。公开证据见[月度洞察 v1 回执](../artifacts/production-evidence-hardening/2026-08-19/monthly-insight-v1/README.md)。

实施并行覆盖数据口径、零模型 E2E 与评测资产；Production 发布按阶段 1 → 2 → 4 串行。GI-088 原工作区的状态冲突已经按最终证据收口，`175` 项成果由检查点 `199aa94` 封存并推送；原分支、worktree 与私有现场继续保留，清理仍等待最终单独确认。该封存不开放新的模型调用，也不改变本轮 Production 范围。

## 1. 交接结论

Daily Light 已具备完整的五维访谈、维度日志、当天整合日志、日历、分析、账户、管理员分析和 AI 质量闭环。事件中心已具备事件级会话、可靠提交、失败恢复、Trace 与事件日志闭环，当前生产主域名为：

```text
https://dailylight.chat
```

`2026-08-11` 产品负责人已确认下一轮网页端体验交接：每条【帮我记】或【陪我聊】记录完成后形成当天时间线事件卡片；用户只在日记页一键生成、查看或更新唯一的今日日记。访谈页不展示日志生成或更新。当前新前端处于构建中，等待产品负责人验收；`2026-08-12` 的旧 UI Preview、页面实现和测试结果作为历史工程证据保留。模型评测和 Production 继续沿用既有授权边界。

日志成果专项已经完成 9 条真人轨迹的今日日记 Prompt v3 评价，9/9 通过当前人工门槛；其中 6 条完成“记录卡 v3 → 今日日记 v3”完整回归，记录卡 v3 的证据范围限定为这 6 条。`dev28＋hidden12` 与 Judge 20 槽位已经形成未执行骨架，私有正文、真人身份映射和隐藏集填充继续留在本地；当前先等待新前端产品验收，再开展固定六案例页面联调和正式评测运行。完整结论见[九条真人轨迹阶段性总结](../artifacts/journal-generation-evaluation/nine-human-trajectory-summary.md)。

## 1.1 2026-08-12 旧 UI Preview 历史工程证据

这组旧候选结果用于后续新前端联调参考，不代表当前新前端已通过产品验收：

- `/interview?mode=event-centered&entryDate=YYYY-MM-DD` 在当天没有会话时先展示“当天工作台”空状态；用户点击【帮我记】或【陪我聊】后才创建会话，已有事件按日期隔离恢复。
- 三阶段进度、当前阶段和保存状态进入顶部导航上下文区域；聊天正文保留给消息与输入框。
- “理解”和“提问”统一使用 dailylight.chat 的 AI 气泡；用户气泡、输入框、焦点、发送和键盘行为沿用现有访谈样式。
- 每条 AI 回复提供赞、踩和重新生成；重新生成菜单包含“更简单一点 / 更具体一点 / 换一个角度”，支持版本切换、Esc 关闭和焦点恢复。
- `/calendar` 的 day / week / month 统一采用归档侧栏 + 报告画布；加载、错误和空状态使用同一骨架，日报、周报和月报接入真实合同。

历史独立 UI Preview：

```text
https://xingfuxitong-myks9m13t-zouzhijies-projects.vercel.app
deployment: dpl_8yNo4LoHehdowfuCtsdm4BU3w417 (Ready)
```

历史页面入口：

```text
/interview?mode=event-centered&entryDate=2026-08-12
/calendar?view=day&date=2026-08-12
/calendar?view=week&date=2026-08-12
/calendar?view=month&date=2026-08-12
```

Preview 使用独立验收数据库，`INTERVIEW_EVENT_CENTERED_MODE=event_centered`、`INTERVIEW_EVENT_CENTERED_STRATEGY=baseline`，GI-088 评测开关关闭；Production `https://dailylight.chat` 保持现行版本和配置。

历史验证记录：高保真改动专项 `36/36` 通过，TypeScript 类型检查、Lint（0 errors）和差异检查通过；远程 Vercel Preview 构建为 `Ready`，并完成了空工作台、访谈启动、事件保存、日报/周报/月报结构的浏览器核验。当前新前端完成产品验收后，再按固定六案例 Preview 契约开展新一轮页面联调。

AI 质量链路已经从“收集案例”推进到“验证候选、全量发布、按版本观察七天、支持人工回滚”。访谈意图识别已于 `2026-07-21` 全量启用；小流量阶段的运营重点是持续收集真实用户 Trace 与反馈，优先记录意图识别问题，并由管理员按需运行评估和候选生成，再对通过验证的候选执行发布。

事件中心当前采用“理清想法”单角度 MVP。GI-066 的 DeepSeek 官方预检、严格 `10×3` 和单角度自动 `8+2` 已通过，继续作为历史技术证据；最新真人实聊因提问目标偏移、重要线索遗漏、同义重复和纠正后错误重规划判定为 `No-Go`，候选失效，剩余人工批次停止。

`GI-067 / GI-068～074` 已冻结板块 4 七个产品批次，`GI-075～080` 已冻结板块 5 六类规则，方法 `v1.0` 已冻结。板块 6 当前建设正式评测资产；GI-081 已归档为临时 Prompt 诊断基线，GI-087 作为 GI-088 基础候选保留。GI-088 v0～v7r4 继续保存诊断、恢复、状态、平台和真人证据。v8 A1 完成 `10` 次提交后以 `1/4 early_stopped` 收口，产品负责人裁决为 `通过 / direct_use / target triggered`；Codex 保留“礼貌回应＋明确停止”多一次调用的轻微问题。v8r1 A1 随后确认控制误停单例阻断，其原 run 按 `running`、A2 活动、已完成轨迹 `1`、Provider 调用 `2` 且均为 `valid` 只读保留。v8r2 已完成 P0／P1、八项 Preview 开门差额、最终初始化幂等和全绿静态门；行为 commit `5281bc53f2b04be9c31adb6d7f4710ac818883a8`、Execution fingerprint `96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c` 与 READY Preview 已形成。全新 run `b816d468-e3c3-4459-a822-04f95b1e78cd` 回读为 `ordinal=2 / revision=0 / running / 0/12 / gate=pending / high_only / high / calls=0`，当前等待 12 项真人验收。旧预发布零内容 run 已行政停止并脱敏排除。候选质量、板块 7 正式接入、板块 8 与发布范围均未裁决；约 `200` 轮以上容量优化继续排除。Production 保持 `legacy + baseline`。

## 2. 当前生产事实

- 唯一生产主域名：`https://dailylight.chat`
- 兼容入口：`https://www.dailylight.chat`
- `dlight.cc.cd` 已于 `2026-07-20` 从 Vercel production aliases 中移除并废弃
- 当前事件中心发布策略：Production 保持 `legacy + baseline`；GI-067 / GI-068～080 产品规则已冻结，板块 6 正在建设正式评测资产；GI-088 v8r1 因 A1 单例阻断退出最终通过候选。v8r2 最终初始化幂等、不可变版本、静态门和私有 Preview 已收口，当前 deployment `dpl_YRUQitffCQH264xiksHpLMviQZLy` 为 `READY`，Vercel Linux 远程构建的两套 Prisma Client 已通过登录存储验收；当前 run `b816d468-e3c3-4459-a822-04f95b1e78cd` 保持 `running 0/12 / gate=pending / high_only / high / calls=0`，等待产品负责人完成 12 项真人验收。质量、板块 7 正式接入、板块 8 和发布范围继续等待裁决，`optional + generative` 保持关闭
- Vercel production 的 `APP_URL` 为 `https://dailylight.chat`
- `2026-07-21` 历史 production deployment：`dpl_3CrHUAqd4MtrMc5PTSsNitrwB4Nr`，状态为 `Ready`
- `2026-07-21` 历史 production alias：`https://xingfuxitong-dhg8kgt7f-zouzhijies-projects.vercel.app`
- `2026-07-21` 已完成访谈意图识别全量发布：正式环境采用 `enforce`，上一正式版本 `dpl_7jpZCQTZukzFY8XMVD6wcsQScxrc` 与 `legacy` 档位共同保留为 P0 问题的即时回退入口。
- `2026-07-20` 已合并 UserTurn 可靠提交改造（PR #36，`ce1e2afbefe98eb79a21faf3d02869fe377085f4`）；`InterviewUserTurn` 与 AI 候选审核理由两条 migration 已应用到 production，公开 smoke 和同 `clientTurnId` 的重放校验通过。
- 访谈维度选择页的内容层会完整伸展到可用视口，页面底部背景保持连续。
- 本地验收快捷登录在 production 返回 `404`
- 生产公开 smoke 已覆盖首页、登录、注册、协议页和 session
- AI 质量效果接口在未登录状态返回 `401`

部署和域名操作以 `docs/vercel-preview-production-lane.md` 为事实源。

## 3. 已完成产品能力

### 3.1 五维访谈与日志

- `joy / fulfillment / reflection / improvement / gratitude` 已完成理论对齐深化
- 五维均具备专属抽取、fallback、阶段推进、完成标准、正文生成、质量门和短标题治理
- 用户停止边界与自然语言日志整理意图优先处理
- `question_repair` 走服务端确定性重问，并避免重复回卷
- `thinkingSummary`、正文、标题和质量门共享服务端语义解释层
- stitched 多事件日志保留完整 supporting moments
- 访谈回复、维度日志和当天整合日志均可恢复与保存
- 用户回复采用两阶段持久化：`InterviewUserTurn` 先保存原话和提交位置，AI 处理成功后再完成本轮；失败或取消后，页面可用同一 `clientTurnId` 继续生成
- 访谈意图识别 v1 已完成全量启用：`legacy` 保持既有决策，`shadow` 记录新旧判断对照，`enforce` 让新决策参与访谈推进。Production 与 Preview 当前均采用 `enforce`；`legacy` 作为 P0 问题的即时回退档位。
- 事件中心已交付事件级会话、可靠原话提交、用户气泡即时显示、失败续接、退出记录回看和事件日志闭环；历史四角度数据与代码继续兼容。
- `GI-065` 的“理清想法”单角度验证目标继续约束【陪我聊】；新记录由用户在【帮我记】与【陪我聊】之间明确选择。`GI-067 / GI-068～074` 已冻结目标产品规则，兼容两段式链路和历史 baseline 能力仍只代表既有实现，新候选等待板块 5～7。
- 事件日志支持来源快照、标题/正文编辑、自动暂存、正式保存、刷新恢复和当天事件标签重开；事件中心反馈通过 `generationTraceId` 连接现有 AI 质量链路。
- 按意图重新生成已完成正式发布：新会话的正式追问支持简单、具体、换角度、深入、轻一点与纠正理解；每组最多保留三个版本，历史换问法通过分支保留原对话，日志边界锁定已存在后续回答的历史路径。
- 重新生成的加载、替换和版本切换都发生在目标回复原位置。纠正理解支持 `Enter` 提交、`Shift + Enter` 换行；操作区维持静态禁用入口，气泡承担唯一加载状态。
- 访谈页站内 header 导航直接完成路由切换；浏览器刷新或关闭访谈页面时继续通过 `beforeunload` 保存会话恢复标记并提供离开保护

`improvement` 与 `gratitude` 的自动化验收样例已齐备，后续仍可继续进行端到端产品文风打磨。

### 3.2 日历、分析与画像

- `/calendar` 支持 month / week / day 三层记录工作台
- 天级数据统一按 `Asia/Shanghai` 整天窗口归档
- `/analysis` 使用 `trends / dimensions` 两段纵向滚动结构；历史 `overview / score / rhythm` 归一到 `trends`，历史 `insights / correlation / review` 归一到 `dimensions`
- 幸福 8 要素评分入口位于访谈页当天评分工作区
- `/profile` 支持记忆库、画像合成和演变视图
- 记忆系统由 `memoryEnabled` 控制，默认关闭
- 共享交互体验已收口：按钮与交互卡片有即时按下反馈，segmented 使用可重定向 spring，画像与分析支持横向 swipe，移动端日志书页支持拖动关闭，菜单与确认弹窗具备完整键盘和焦点管理

### 3.3 管理员能力

- `/admin/analytics` 支持总览、候选用户和内容级下钻
- `/settings/ai-runtime` 支持 AI 配置草稿、测试、发布、历史和回滚
- 管理员权限统一由 `ADMIN_USERNAMES` 白名单控制
- 内容级查看统一写入 `AdminAuditLog`
- Prisma `P1001 / P1017 / P2024` 等临时连接问题在管理员只读路径中会重试一次，并投影为友好错误状态

## 4. AI 质量闭环现状

### 4.1 用户侧

- 访谈回复和日志统一使用赞、踩图标
- 赞与踩均支持专属标签和自由文本
- 点赞允许空提交，点踩要求标签或文本
- 再次点击已保存图标会撤回反馈
- 反馈当前状态与 revision 历史均绑定 `Trace_ID`
- 质量改进默认参与，注册和登录会维护政策版本与审计时间
- 兼容退出请求返回 `409 AI_QUALITY_PARTICIPATION_REQUIRED`

### 4.2 自动化侧

- 每个用户可见生成物绑定 `AIGenerationTrace`
- 每次模型调用绑定 `AIRequestLog`
- 每条 Trace 运行规则评估，高风险和稳定抽样进入 LLM Judge
- `AIEvaluation` 保存评分与扣分原因
- `AICase` 保存 Goodcase / Badcase / Review 分类
- 手动运行先评估最多 20 条待处理 Trace，再扫描最近 7 天案例
- 定时任务继续执行每日评估和每周聚类
- 候选使用 `dedupeKey` 防止相同证据重复生成

### 4.3 发布侧

- 候选路径：System Prompt、Few-shot、Engineering
- System Prompt 和 Few-shot 要求管理员批准并完成回放验证
- `AIOptimizationValidation` 保存目标和回归案例结果
- `AIPromptRelease.validationId` 绑定发布采用的验证记录
- System Prompt Trace 使用 `+opt:{candidateId}` 归因
- Few-shot Trace 使用 `+fs:{fingerprint}` 归因
- 全量发布和回滚均由管理员确认
- 审核页面采用“状态摘要 + 候选队列 + 连续审核区”工作台；退回调整要求填写 `4–300` 字原因，并在历史记录中保留处理人、时间和理由

### 4.4 效果复盘

- 基线读取发布前 7 天
- 观察期最长 7 天
- 回滚或同路径新版本发布会提前截止当前窗口
- 指标覆盖生成数、赞踩、同一问题、严重问题、失败和延迟；同一问题按标准化后的具体问题键计算，缺少问题码时显示“口径不足”
- 页面结论包括继续观察、低样本、人工复核、建议保留和建议回滚
- 管理员可查看脱敏“需关注”与“正向反馈”真实对话

完整规则见 `docs/ai-quality-loop.md`。

访谈功能的产品架构、主链时序和逐节点图解统一收录在 [访谈功能图谱](./diagrams/README.md)。

## 5. 数据与迁移

AI 质量迁移顺序：

- `20260719010000_add_ai_generation_trace`
- `20260719020000_add_ai_evaluation`
- `20260719030000_add_ai_feedback_and_consent`
- `20260719040000_add_ai_optimization_engine`
- `20260719050000_default_ai_quality_and_candidate_dedupe`
- `20260719060000_add_ai_candidate_validation`
- `20260720010000_bind_prompt_release_validation`
- `20260720153000_add_ai_optimization_review_reason`

访谈用户提交恢复迁移：

- `20260720120000_add_interview_user_turn`
- `20260720210000_add_interview_intent_assessment`
- `20260720223000_add_interview_response_regeneration`

第一条 migration 新增 `InterviewUserTurn`、动作与状态枚举、`InterviewMessage.userTurnId`，并建立同会话 `clientTurnId` 唯一约束和待处理状态索引。第二条 migration 为同一提交记录增加意图评估、决策、分类器版本与评估时间，支持安全重放和分阶段发布。

第三条 migration 为会话、消息和用户动作增加回复版本与分支字段，并新增 `InterviewBranchCheckpoint` 和 `AIResponseRegeneration`。它已于 `2026-07-21` 应用到 production；当前 production 数据库有 30 条 migration。

`2026-07-20` 已完成生产数据安全清理：

- 固定验收管理员账号已删除
- 固定验收 Trace、反馈、评估、案例、候选、运行和审计记录已删除
- 真实用户候选与业务数据得到保留
- `npm run acceptance:ai-quality:seed` 已增加远程数据库保护

事件中心 MVP 复用现有 `InterviewSession`、`InterviewEvent`、`JournalEventEntry`、`AIGenerationTrace` 和 `AnalyticsEvent`；本轮实现没有新增数据库表或 migration。事件中心日志接口为：

- `POST /api/interview/event-centered/session/start`
- `GET /api/interview/event-centered/session/[id]`
- `POST /api/interview/event-centered/session/respond/stream`
- `POST /api/interview/event-centered/session/turn`
- `POST /api/interview/event-centered/journal/generate`
- `GET/PATCH /api/interview/event-centered/journal/[id]`
- `POST /api/interview/event-centered/journal/[id]/save`

验收脚本规则：

- 默认只写本地数据库
- 远程隔离测试库要求 `ALLOW_REMOTE_AI_QUALITY_ACCEPTANCE_SEED=I_UNDERSTAND`
- production 环境主动终止

## 6. 验证基线

最近一次已记录的全量代码验证来自 `2026-08-04` GI-066 阻断修复候选：

- 全量测试：`268` 个测试文件、`2541/2541` 个用例通过
- 严格 `10×3`：动作、方向和完整无问题均为 `30/30`，重复选题错误 `0`
- 自动 `8+2`：主链 `8/8`、日志闭环 `8/8`、两条冒烟通过、运行降级 `0`
- `npm run lint`：`0 error / 46 warnings`，警告为仓库既有基线
- `npx tsc --noEmit`、生产构建、Prisma validate、隔离库 migrate status 和差异检查通过

该快照只证明 GI-066 当时候选的技术状态。最新真人体验 `No-Go` 已使候选失效；GI-067 新候选需要重新完成对应验证。

AI 质量发布与效果观察专项验证：

- `10` 个测试文件
- `30` 个测试通过
- 覆盖验证门、System Prompt/Few-shot 归因、七天窗口、结论规则、证据分页、审计、确认弹窗、骨架、空态和错误重试

流动交互专项回归入口：

- 流动交互专项历史回归：`7` 个测试文件、`50` 个测试通过；当前总量以全量快照与事件中心专项为准
- `tests/unit/sliding-segmented-control.test.tsx`
- `tests/unit/horizontal-pager.test.tsx`
- `tests/unit/action-menu.test.tsx`
- `tests/unit/confirm-dialog.test.tsx`
- `tests/unit/site-header-calendar.test.tsx`
- `tests/unit/site-header-analysis.test.tsx`
- `tests/unit/analysis-shell.test.tsx`

## 7. 下一步运行主线

### 7.0 当前交付顺序

0. Daily Light 新前端正在构建；完成产品验收后接入固定六案例 Preview，验证五条只读回放和 v7r4 A1 编辑更新流程。`dev28＋hidden12` 与 Judge 20 保持未执行骨架，页面 Preview 通过后再启动填充、运行和准入；Production 继续等待独立决策。
1. v8r1 run 保持只读；专用评测库快照已经确认 A1 完成、A2 活动、两次 Provider 调用均有效。完整用户内容继续只保存在私有运行目录。
2. v8r2 已在同一个开发周期收口高精度控制决策、调用结果落账、陈旧快照保护、人工证据治理、run 生命周期、工作台恢复和八项 Preview 开门差额。
3. 最终初始化幂等、全量验证、行为清单、不可变 commit `5281bc53f2b04be9c31adb6d7f4710ac818883a8`、Execution fingerprint `96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c` 和私有 Preview 已收口；当前 deployment `dpl_YRUQitffCQH264xiksHpLMviQZLy` 为 `READY`，虚构账号登录返回 `401 INVALID_CREDENTIALS` 且 deployment error logs 为 `0`，全新 run `b816d468-e3c3-4459-a822-04f95b1e78cd` 回读为 `ordinal=2 / revision=0 / running / 0/12 / gate=pending / high_only / high / calls=0`。
4. 当前工作流暂停等待产品负责人完成 12 项 Thinking high 真人验收。旧预发布 v8r2 零内容 run 已行政 `early_stopped` 并作为脱敏排除记录；真人质量与发布未裁决，约 `200` 轮以上容量优化继续排除。板块 7 正式接入与板块 8 继续等待，Production 保持 `legacy + baseline`。

### 7.1 上线后收集真实反馈

1. 生产流量继续统一进入 `https://dailylight.chat`；事件中心在获得板块 8 授权后按 `optional + generative` 开放。
2. 前 `10` 次有效事件会话逐条审计，观察事件中心回复和日志的赞踩、标签与文本。
3. 确认 Trace、反馈、事件漏斗和 Prompt 版本血缘持续写入。
4. 记录生成式降级、重复追问、修正理解、停止后追问、未完成表达和日志来源异常；P0 问题出现 1 条即进入修复与回退判断，P1 问题按语义家族归类后排期。

### 7.2 生成与验证候选

1. 管理员进入 `/admin/ai-quality`，先处理事件中心真实案例中的高频共同根因。
2. 先按待发布、待验证、待审核查看候选；需要补充数据时点击“检查最近回复”。
3. 阅读问题的通俗说明、背景、证据与回复对照。
4. 批准证据充分的候选。
5. 执行回放验证，并检查目标案例与正向回归案例。

### 7.3 发布与七天复盘

1. 对通过验证的候选执行“全量应用”；需要调整时退回并记录原因。
2. 核对新 Trace 的 `+opt` 或 `+fs` 版本标记。
3. 在效果观察区查看绝对数量、比例和真实案例。
4. 严重问题触发时优先人工回滚到 `legacy + baseline`。
5. 事件中心累计 `30` 次有效事件会话后，每轮只挑选一个真实共同根因进入候选验证；原工作集、隐藏集、准入集和完整轨迹保留为重大变更回归资产。
6. 七天结束后根据“建议保留 / 人工复核 / 建议回滚”做最终决定。

## 8. 仍需持续关注

- 板块 5 已冻结 GI-075～080 六类规则，落地验证仍待板块 7 正式候选承接。
- 板块 6 的 GI-088 v8r2 意图控制、评测底座、最终初始化幂等、不可变版本和 `READY` Preview 已收口；当前 run `b816d468-e3c3-4459-a822-04f95b1e78cd` 保持 `ordinal=2 / revision=0 / running / 0/12 / gate=pending / high_only / high / calls=0`，等待产品负责人完成 `12` 项 Thinking high 独立最终评测。真人质量与发布未裁决，板块 7 正式接入和板块 8 继续等待。
- GI-066 自动层通过、真人体验 `No-Go` 和候选失效三类状态继续分开保存；Production 授权前保持 `legacy + baseline`。
- 小流量下样本增长较慢，低于 5 条时以真实对话判断为主
- Few-shot 依赖持续有效的点赞与 85 分以上评估
- Engineering 候选需要进入正常研发、测试和部署流程
- `improvement / gratitude` 继续安排真实用户端到端文风验收
- 记忆系统默认关闭，启用前需要确认 embedding 配置与隐私口径
- 日历、访谈和分析仍有少量 `0.64–0.68rem` 的遗留辅助标签；后续触及对应区域时按 `0.75rem` 核心控制基线逐步收口
- `/api/transcribe` 仍为 stub

## 9. Canonical 文档

- 项目事实与协作约束：`AGENTS.md`
- 快速入口与命令：`README.md`
- 系统分层和数据流：`docs/architecture.md`
- HTTP 接口合同：`docs/integration-guide.md`
- 运维、迁移和冒烟：`docs/operator-runbook.md`
- AI 质量完整规则：`docs/ai-quality-loop.md`
- Vercel 与生产域名：`docs/vercel-preview-production-lane.md`
- 生成式访谈当前状态与依赖：`docs/generative-interview-refactor-map.md`
- GI-067 七批次架构与冻结结论：`docs/technical/interview-event-centered/04x-board4-gi067-interview-question-strategy-global-framework.md`
- GI-074 评测体系与下游交接：`docs/technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md`
- GI-088 当前真人验收与正式证据：`artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md`
- GI-088 v8r2 已完成实施合同：`docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md`
- GI-088 v8r2 执行结果：`docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.result.md`
- GI-088 v8r1 事故与部署时快照：`artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md`
- 事件中心公共产品协议：`docs/technical/interview-event-centered/04-four-angle-common-interview-protocol.md`
- 历史板块 7 Preview 候选：`docs/technical/interview-event-centered/04o-board7-mvp-preview-candidate-handoff.md`
- 前端设计规范：`DESIGN.md`、`docs/design/ui-conventions.md`
- 五维理论：`docs/theory/*.md`
