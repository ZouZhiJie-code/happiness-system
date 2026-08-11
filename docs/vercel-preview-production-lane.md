# Vercel Preview / Production Lane

最后更新：`2026-08-10`

## 当前生产域名

- 唯一生产主域名：`https://dailylight.chat`
- 兼容访问域名：`https://www.dailylight.chat`
- `dlight.cc.cd` 已从 Vercel production aliases 中移除并正式废弃。
- 事件中心候选 Provider 合同为 DeepSeek 官方 API 的 OpenAI 兼容接口，运行时 Provider 为 `openai`，默认地址为 `https://api.deepseek.com`。`GI-067 / GI-068～080` 与方法 `v1.0` 已冻结，板块 6 继续资产化评测。GI-088 v0～v8r1 保留各自的失败、恢复、平台、状态和真人证据；v8 以 `1/4 early_stopped` 获产品通过，v8r1 A1 确认控制意图误停的单例阻断并进入历史只读。v8r2 使用官方 V4 Pro 与 Thinking high，P0／P1、八项开门差额、最终初始化幂等、不可变版本和全绿静态门已收口；当前 Preview deployment `dpl_5wqmDbg7ZMyf8zmaRgvXSh5N1Aa3` 已 `READY`，Vercel Linux 远程生成两套 Prisma Client 后，登录存储与 error logs 验收通过；新 run `ce893fe6-e9e2-4445-9153-deca3b1571ce` 为 `running 0/12 / gate=pending / high_only / high / calls=0`，等待 12 项真人验收。质量与发布未裁决，约 `200` 轮以上容量优化继续排除。Ark 变量和适配器只承担历史兼容。Production 继续保持 `legacy + baseline`。
- `2026-07-21` 历史生产 deployment：`dpl_3CrHUAqd4MtrMc5PTSsNitrwB4Nr`，状态为 `Ready`，production alias 指向 `https://xingfuxitong-dhg8kgt7f-zouzhijies-projects.vercel.app`。
- `2026-07-21` 访谈意图识别已使用`enforce`全量发布；`dailylight.chat`与`www.dailylight.chat`均指向当前版本，上一正式版本`dpl_7jpZCQTZukzFY8XMVD6wcsQScxrc`保留为即时回退入口。
- `2026-07-21` 已完成按意图重新生成的 production 发布；`20260720210000_add_interview_intent_assessment` 与 `20260720223000_add_interview_response_regeneration` 已应用，生产数据库当前有 30 条 migration。
- `2026-07-20` 已完成 UserTurn 可靠提交改造的 production 发布：`20260720120000_add_interview_user_turn` 与 `20260720153000_add_ai_optimization_review_reason` 已应用，公开 smoke 与同 `clientTurnId` 重放校验通过。
- 本文后续出现的 `dlight.cc.cd` 仅用于保留 `2026-05` 历史发布与排障证据，当前命令、验收和回调配置统一使用 `dailylight.chat`。

## 目标

把 Daily Light 的首条正式托管平台主线固定为 `Vercel`，先解决：

- preview / production 用哪条平台路线
- 环境变量怎么分层
- 每次部署完最小要验什么

这份文档只定义首条可执行主线，不展开 VPS、自建网关或多云冗余。

## 为什么先选 Vercel

- 当前仓库是标准 `Next.js App Router` 应用，没有必须先走 VPS 的技术约束。
- 当前最缺的是“从本地代码到一个可访问预发布环境”的闭环，不是服务器控制权。
- Vercel 对这类应用的首条 preview / production 路线更短，和当前批次目标一致。

## 环境合同

### Preview

使用 [`.env.preview.example`](../.env.preview.example) 作为平台环境变量清单来源。

至少要填的用户自定义变量：

- `DATABASE_URL`
- `AI_PROVIDER=openai`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`）
- `INTERVIEW_INTENT_V2_MODE=enforce`，用于验证访谈意图识别的正式决策链路
- `INTERVIEW_REGENERATION_ENABLED=true`，用于验证回复换问法与版本切换
- `INTERVIEW_EVENT_CENTERED_MODE=legacy`，板块 7 候选交付继续使用五维默认入口；板块 8 Preview 才切换为 `optional` 或 `event_centered`
- `INTERVIEW_EVENT_CENTERED_STRATEGY=baseline`，板块 7 与 Production 保持确定性策略；板块 8 Preview 才允许 `generative`

可选：

- `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID`
- `EVENT_CENTERED_GENERATIVE_MODEL=deepseek-v4-flash` 是通用事件中心兼容默认值；GI-088 v8r1／v8r2 私有候选使用独立 `deepseek-v4-pro` 运行策略，Production 继续留空并保持安全档位
- `VOLCENGINE_ARK_API_KEY`、`VOLCENGINE_ARK_MODEL`、`VOLCENGINE_ARK_BASE_URL`，仅用于历史回退兼容
- `EVENT_CENTERED_JUDGE_DEEPSEEK_MODEL`、`EVENT_CENTERED_JUDGE_TIMEOUT_MS`，事件中心评测 Judge 配置

规则：

- Preview URL 合同不再要求一律手填 `APP_URL`
- 如果项目启用了 Vercel 的 system environment variables 暴露，可优先使用 `https://${VERCEL_URL}` 作为当前 deployment URL，或按需要使用 `https://${VERCEL_BRANCH_URL}` 作为 branch 级 preview URL
- 如果项目没有暴露上述 system env，才回退为手工维护 `APP_URL`
- 当前批次还没有直接证据证明 `xingfuxitong` 已启用该能力；依赖这条路径前，必须额外验证项目设置里的 `Automatically expose System Environment Variables` 开关，以及部署运行时是否能读到 `VERCEL=1`
- preview 数据库必须和本地库、生产库隔离

#### 2026-08-09～10 GI-088 私有评测 Preview

- 当前真人验收与正式证据入口为 [`GI-088 v8r2 资产`](../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)，实施合同见[已完成评测底座加固任务](./ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)；v8r1 事故与部署快照继续见 [`v8r1 历史资产`](../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md)；
- 访问链路依次通过 Vercel Deployment Protection、Daily Light 应用登录和 `ADMIN_USERNAMES ∩ GI088_EVALUATOR_USERNAMES`；
- 应用登录与评测数据共用一个专属 Preview 物理库，分别使用 `gi088_app_preview`、`gi088_evaluation_v0` schema，两者均不指向 Production；
- `GI088_EVALUATION_ENABLED` 只在该 Preview 设为 `I_UNDERSTAND`；模型请求还要求作用域与当前执行指纹精确匹配；
- 正式批次使用 `batch`，两个技术冒烟分别使用 `smoke_off`、`smoke_high` 和独立 UUID；
- Production 的 `/preview/gi088-evaluation`、`/api/preview/gi088/session`、`/api/preview/gi088/smoke` 统一返回 `404`。
- v2 diagnostic 已完成评测底座与两轮空内容诊断；response format 探针按精确授权完成 `6/6`，移除参数候选 No-Go；Thinking 模式探针按精确授权完成 `4/4`，high 与 disabled 均有效，主要影响因素未确认。产品负责人随后停止继续复现 DeepSeek 内部原因，确认 v3 使用 Thinking high 可见答案自动恢复。v3 deployment 为 `dpl_6ByMq3r9E8LvyTwZh3R87usLpro3`，执行指纹 `3b79fe68…70d23b`；A1 双轨迹完成后批次在 `1/12` 提前结束，消费 `8/40`。本组空内容与自动恢复均为 `0`，两边第 4 轮共同命中回答机会边界。v4 阶段 2→3 自然转场候选已完成本地静态验证，执行指纹 `0206fd34…b1d0a`；产品负责人已授权私有 Preview、新批次和最坏 `40` 次调用，deployment `dpl_H2MD53kihsYYjH3uh6RQ1gWjdQhV` 已 Ready。登录与 `0/12` 空白批次回读通过，模型调用仍为 `0`，可以开始 A1。浏览器标签修正版 `dpl_4xGhPcZQcd5pDTPbXPxzjmXHZhXV` 已 Ready，并绑定固定别名 `xingfuxitong-gi088-v4-stage-transition.vercel.app`；当前已登录批次继续使用首次 deployment。Production 继续保持 `legacy + baseline`。
- v5 High-only 候选完成私有 Preview 与 `0/12` 空白批次回读，未发生真人模型调用。v6 取消新轮次的单问号程序拦截与自动整理，保留问号观测并要求所有可见 ask 在结束轨迹前完成人工分类；当前共 `4` 项、活动分支仅 `high`、执行指纹 `a5042e97…c094d`、最坏调用预算 `48`。deployment `dpl_5Rq7gTnovApDY97b4pg8k7YJf33r` 已 Ready，固定入口为 `xingfuxitong-gi088-v6-single-focus.vercel.app`；专用评测库批次 `37517d91-a258-423a-bb26-a58c97357e68` 回读为 `0/4`、模型调用 `0`。v5 与更早 Preview 保持只读，Production 继续保持 `legacy + baseline`。
- v8 批次 `cdc6f41b-f441-4587-9d2f-4b5fe9c1dc60` 以 `1/4 early_stopped` 收口并获产品通过。v8r1 deployment `dpl_HPBafL2QmHd6UsUXQ8kWVbUvKJAQ` 目标为 Preview，状态 `READY`；页面为 `https://xingfuxitong-5l1ns4sci-zouzhijies-projects.vercel.app/preview/gi088-evaluation`。部署创建时，专用评测库 run `5123d795-5c19-408d-9b98-7767eaa7892c` 回读为 `running 0/12`、模型调用 `0`，执行指纹 `40da54f2…bf8f82`；随后 A1 真人运行确认控制意图误停的单例阻断。兼容迁移后只读回读为 `running`、活动任务 A2、已完成轨迹 `1`、Provider 调用 `2` 且均有效。该 Preview 与原 run 保持历史只读，Production 继续保持 `legacy + baseline`。
- v8r2 最终行为 commit 为 `e01c9ed5fa0334d8d717dbed2643791f1045e04d`，Execution fingerprint 为 `55c0c9b0ef31f46bf638c3a90fd6323c1ef7ad83a14d367d4e2e2fe3cc34b34e`。当前 Preview deployment `dpl_5wqmDbg7ZMyf8zmaRgvXSh5N1Aa3` 已 `READY`，URL 为 `https://xingfuxitong-8d1e2o7m1-zouzhijies-projects.vercel.app`；部署源码修复 commit 为 `e01c9ed5fa0334d8d717dbed2643791f1045e04d`，Vercel Linux 远程构建生成主库与评测库两套 Prisma Client。虚构账号登录返回 `401 INVALID_CREDENTIALS`，deployment error logs 为 `0`。run `ce893fe6-e9e2-4445-9153-deca3b1571ce` 回读为 `ordinal=3 / revision=0 / running / 0 of 12 / gate=pending / high_only / high / calls=0`。初始化已使用绑定最终指纹的新 `clientOperationId`。旧预发布零内容 run 已行政 `early_stopped`，其零调用、零真人和质量未评测只作为脱敏排除记录。Production 保持 `legacy + baseline`。

#### 2026-07-21 访谈意图独立验收环境（历史记录）

- 当时候选 deployment：`dpl_2riNe1YjW9Ybt4ycq1JyHPZmMTz1`，状态为`Ready`。
- 当时候选地址：`https://xingfuxitong-moaqpx0k6-zouzhijies-projects.vercel.app`。
- 固定分支地址：`https://xingfuxitong-zouzhijie-code-zouzhijies-projects.vercel.app`。
- 意图策略：`INTERVIEW_INTENT_V2_MODE=enforce`。
- Preview数据库：`daily_light_preview_intent`，与生产数据库保持数据库级隔离。
- Preview使用独立应用账号访问数据；当前29条数据库迁移均已应用，其中包含回复重新生成迁移。
- 已创建一份空白独立评审账号。运行时注册成功后，Preview数据库中同名账号数量为1，生产数据库中同名账号数量为0。
- 评审密码、访问保护参数和数据库凭据只通过本次验收交付，不写入仓库文档。
- 独立评审统一使用[意图识别独立评审评分卡](../evals/interview-intent/reviewer/2026-07-20-independent-intent-assessment-scorecard.md)；五维端到端只承担下游采用验证。
- 独立评审页面：`/intent-review`，只在非Production环境开放；当前展示新封存案例`INT-EVAL-229–252`，页面已通过评审账号登录、HTTP 200、案例内容和浏览器进度保存验证。
- Preview管理员只读观察入口：`/api/dev/intent-observation`，只返回意图、策略、快照、Trace和抽取调用统计，不返回用户原话；Production环境固定关闭。
- [五维采用与20轮运行观察](../evals/interview-intent/reports/2026-07-21-preview-adoption-and-20-turn-observation.md)已通过：五维5/5，普通访谈20/20，每轮恰好一次抽取调用，服务端P50 9.17秒、P95 9.99秒。

#### 2026-08-03 事件中心 GI-057 候选复验与条件回退顺序

- 板块 7 已完成事件中心 MVP Preview 候选交付，候选交接见 [`04o-board7-mvp-preview-candidate-handoff.md`](technical/interview-event-centered/04o-board7-mvp-preview-candidate-handoff.md)。
- 板块 8 已冻结 `GI-050–055`，确认 `GI-056` 核心产品原则并确认 `GI-057` 产品方案；当前专项事实源为 [`04p-board8-preview-go-no-go-production-authorization.md`](technical/interview-event-centered/04p-board8-preview-go-no-go-production-authorization.md)，实现与复验细节见 [`04q-board8-gi057-event-recording-routing-and-candidate-reverification.md`](technical/interview-event-centered/04q-board8-gi057-event-recording-routing-and-candidate-reverification.md)。GI-055 候选 Preview、GI-056 候选和旧 `80%` 报告保留为历史，GI-057 候选已使用新的策略版本、候选起始时间和根会话去重规则建立独立报告。
- GI-055 把事件中心调整为复盘默认路径：独立 Preview 中先形成“事件事实 + 个人反应”，再展示四个平等角度；第一检查点不再提供输入或事件日志，选角度后进入正常首问。
- 五维入口继续默认保留；事件中心可选入口使用 `INTERVIEW_EVENT_CENTERED_MODE=optional`，事件中心策略使用 `INTERVIEW_EVENT_CENTERED_STRATEGY=generative`。
- 生成式链路固定使用 `deepseek-v4-flash`、温度 `0.2`、thinking 关闭；普通回合为同一模型两段调用，生成式技术失败后直接进入确定性 baseline，baseline 降级不追加模型请求。
- 事件日志生成、编辑、自动暂存、正式保存、刷新恢复和事件标签重开均已在本地专项测试中覆盖；没有新增 migration。
- GI-055 历史候选曾完成板块 8 内部 Preview：`8/8` 主链、日志闭环 `8/8` 和速度门通过；旧报告的降级统计混入控制动作与历史回合，当前只作为历史工程证据。GI-056 新候选完成 `8/8` 主链、`8/8` 日志闭环和五维默认冒烟；按新口径统计真实生成式尝试 `20`、控制动作 `12`、运行降级 `8`、最大连续 `3`、最近 20 回合降级率 `40%`，因此 `optional + generative` 未达到发布门，事件主链进入 `optional + baseline` 条件路径。Production 切换仍要求 `8/8` 主链、一票阻断为 `0`、至少 `6/8` 通过、最多 `2/8` 轻微条件通过、baseline 降级最多 `2/8`、日志闭环 `8/8`，并获得产品负责人单独批准。
- 速度通过线为中位数 `≤8s`、P90 `≤15s`；中位数 `≤10s`、P90 `≤20s` 可条件发布；超过条件线进入修复。
- 事件中心候选四角度最小体验最终回应和旧确定性回归继续作为历史资产；GI-056 新增来源引用、标题修复、普通遗漏诊断、纠正硬拦截、控制动作排除和候选版本过滤测试。
- 修复后候选 v2 的轻量闭环保留为历史，不计入当前发布门。GI-055 候选当前执行证据见 [`Preview 执行证据`](../artifacts/generative-interview-board8/2026-08-02-preview/preview-execution-evidence.md)；旧结果为 `8/8` 主链、`8/8` 日志闭环、速度门通过，旧降级统计已转为历史。GI-056 新候选已使用 `--candidate-started-at`、`--strategy-version` 和 `--root-sessions` 过滤只读审计，报告单列真实生成式尝试、确定性控制动作、运行降级、日志 AI 接受、标题修复和全文安全回退。
- GI-056 候选血缘与报告见 [`candidate-lineage.md`](../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/candidate-lineage.md)、[`board8-preview-candidate-audit.json`](../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/board8-preview-candidate-audit.json) 和 [`board8-preview-candidate-audit.md`](../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/board8-preview-candidate-audit.md)，均为历史证据。GI-057 候选冻结后新增独立目录、候选血缘和 v3 审计报告；报告继续按首条有效内容排序、根会话去重，并只读输出入口识别、控制动作、正式生成式回合、修复和日志闭环字段。
- GI-057 候选版本为策略 `5.52.0`、角度卡 `2.14.0`、Few-shot `quality-patterns.2026-08-03.v31`、语义 / 可见 Prompt `v74-gi057-source-contract`、语义产物 `event-centered-semantic-plan.v7`。候选代码、模型、Prompt、策略或角度卡发生变化时，当前 Preview 结果失效并从头重跑。
- 当前执行顺序为：定向测试 → TypeScript / 全量测试 / 构建 / Prisma 只读校验 → 独立 Preview → Board8 v3 只读审计 → 产品负责人 Go/No-Go → 单独 Production 授权。Production 配置、部署和开关在授权前保持原状。
- GI-057 当前已完成工程验证与独立 Preview：全量 `261` 个测试文件、`2448/2448` 个用例通过，TypeScript、生产构建、Prisma schema validate 和差异检查通过；8 条主链和 8 条日志闭环完成，Board8 v3 报告记录正式生成式尝试 `12` 次、运行降级 `3` 次、回应等待中位数 `50.877s`、P90 `77.999s`。候选自动发布门 No-Go，候选血缘、执行证据与历史阻塞记录见 [GI-057 候选目录](../artifacts/generative-interview-board8/2026-08-03-gi057-candidate/candidate-lineage.md)。
- GI-057 生产授权保持关闭。当前已确认事件和日志主链可以由 `optional + baseline` 承接；下一步由产品负责人判断共同根因修复范围，若确认多个独立根因则重新打开方案。共享 Production 未执行迁移、部署或开关切换。

#### 2026-08-03 事件中心 GI-058 发布阻断修复与真实性能校准

- GI-058 已完成发布阻断修复实现：补齐 `visibleResponseReadyMs` 与 `interactiveReadyMs` 双延迟口径，回合内复用 `TurnContext`，事件记录与确定性控制跳过生成式 checkpoint，修复 canonical hash，增加角度 `closed` 状态，保留来源安全硬门，并按真实 Provider 调用修正 Board8 统计。
- GI-058 候选版本为策略 `5.56.0`、语义产物 `event-centered-semantic-plan.v8`、语义 / 可见 Prompt `v76-gi058-origin-correction`、逻辑模型名 `deepseek-v4-flash`；候选 Provider 为 `openai`（DeepSeek 官方 API），地址为 `https://api.deepseek.com`。Preview 数据库为 `happiness_board8_preview_20260803_gi058_local`，与共享数据库隔离。
- Ark 旧配置下的候选 v1 已完成 `8/8` 主链、`8/8` 日志生成编辑保存恢复、第一检查点、角度关闭恢复和五维默认入口回归。只读 Board8 报告记录正式生成式尝试 `15` 次、最终 baseline `15` 次，事件记录入口 `14` 次，确定性控制 `8` 次，日志保存 `8/8`；该报告保留为历史工程证据。
- Ark 旧配置的 `/models` 与最小聊天请求曾返回 HTTP `403 AccountOverdueError`，该记录只保留历史追溯。DeepSeek 官方 API 最小预检和 GI-058 `8+2` 全量重跑已完成。
- 当前 Preview 结果：`8/8` 主链、`8/8` 日志闭环和两条冒烟通过；正式生成式回合最终 baseline `2/11`、最大连续 `1`，完整文本可见中位数 / P90 `0.04s / 6.64s`，可继续操作中位数 / P90 `0.09s / 6.71s`，日志 LLM 接受 `8/8`、全文 fallback `0`。技术发布门通过，等待产品负责人独立 Go/No-Go。
- 当前状态：`optional + generative` 保持未授权；Production 配置、部署版本、数据库和开关继续保持 `legacy + baseline`。本轮没有 Production 部署、迁移或开关切换。
- 证据入口：[GI-058 专项](technical/interview-event-centered/04r-board8-gi058-release-blocking-repair-and-performance-calibration.md)、[候选血缘](../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/candidate-lineage.md)、[Provider 前置检查](../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/provider-preflight.md) 和 [Board8 审计](../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/board8-preview-candidate-audit.md)。

#### 2026-08-03 事件中心 GI-059 提问思路、深聊完成与真实体验复验

- GI-058 保留技术通过记录，产品负责人后续人工体验裁决为 `No-Go`，候选失效。
- GI-059 候选为策略 `5.57.0`、角度卡 `2.15.0`、Few-shot `v32`、Prompt `v77`、语义产物 `v9`、日志 Prompt `v3-gi059-compact`；Provider 使用 DeepSeek 官方 API，Preview 数据库为本机隔离库 `happiness_board8_preview_20260803_gi059_local`。
- 脚本化 `8+2` 已完成主链 `8/8`、日志闭环 `8/8`、两条冒烟和四条深聊有效问答。Board8 审计记录最终 baseline `10/17`、最大连续 `5`，完整文本可见 P90 `25.39s`、可继续操作 P90 `25.42s`，自动发布门为 `No-Go`。
- 模型耗时 P90 `27.77s`，非模型耗时 P90 `0.08s`；下一步聚焦官方 API 模型调用稳定性。新候选通过自动发布门后，产品负责人再使用 `/preview/board8-gi059-review` 完成四条真实事件和四条风控角色卡。
- Production 配置、部署版本、数据库和开关继续保持 `legacy + baseline`。本轮未执行 Production 迁移、部署或开关切换。
- 证据入口：[GI-059 专项](technical/interview-event-centered/04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)和[Board8 审计](../artifacts/generative-interview-board8/2026-08-03-gi059-scripted-deepseek-official-preview-r4/board8-preview-candidate-audit.md)。

#### 2026-08-04 事件中心 GI-060–GI-064 历史自动技术证据

- GI-059 的产品规则继续有效；GI-059 脚本化候选的降级和性能 `No-Go` 保留为历史证据。
- GI-060–GI-064 在不改变当时体验规则的前提下完成回合性能、语义哈希、角度关闭、有限来源关系、定向修复、审计分账和 Few-shot 来源占位符隔离。GI-064 历史候选为策略 `5.62.0`、Prompt `v82`、语义产物 `v14`，使用 DeepSeek 官方 API 的 `openai` 兼容链路、`https://api.deepseek.com` 和 `deepseek-v4-flash`。
- 独立 Preview 完成 `8/8` 主链、`8/8` 日志闭环、第一检查点和旧五维默认入口两条冒烟；正式生成式最终 baseline `2/18`、最大连续 `1`，完整文本可见中位数 / P90 `3.85s / 4.97s`，可继续操作中位数 / P90 `3.89s / 5.00s`，日志 AI 接受 `8/8`、全文 fallback `0`。自动发布门通过。
- GI-066 改变提问策略、完成标准、模型职责和评测方式后，原本机 8 条人工实聊计划停止；GI-064 只保留技术追溯价值。
- Production 配置、部署、数据库和开关继续保持 `legacy + baseline`。
- 证据入口：[GI-060–GI-064 专项](technical/interview-event-centered/04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)、[候选血缘](../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/candidate-lineage.md)、[Preview 执行证据](../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/preview-execution-evidence.md)和[Board8 审计](../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/board8-audit/board8-preview-candidate-audit.md)。

#### 2026-08-04 事件中心 GI-066 历史冻结与 GI-067 重开（历史记录）

- GI-066 新会话单点验证“理清想法”，其产品协议、候选血缘、自动通过和真人 `No-Go` 均作为历史证据保留。
- 当日产品专项为 [`04w-board4-gi067-thought-question-strategy-first-principles.md`](technical/interview-event-centered/04w-board4-gi067-thought-question-strategy-first-principles.md)。当时只确认板块 4 设计、板块 7 实现、板块 8 真人验收的推进流程，具体策略仍待冻结。
- 当日计划要求 GI-067 冻结并完成板块 7 实现后，先执行 DeepSeek 官方 API 预检和新候选自动验证，再建立真人工作台。该生产授权原则继续有效。

#### 2026-08-05 事件中心 GI-067 / GI-068～074 冻结与新交付顺序

- 七个产品批次已经全部冻结，板块 4 产品决策完成。当前状态源为 [`生成式访谈重构总 Map`](generative-interview-refactor-map.md)，当前开放问题源为[`板块 5 专项`](technical/interview-event-centered/05-board5-stability-user-control-and-interaction-scope.md)，评测交接见[`04x-07｜GI-074`](technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md)。
- 当前先完成板块 5 的问题计数、修复、回复版本、焦点纠正、失败恢复与交互收束，再由板块 6 建立正式评测资产；GI-068 的记录级模式边界直接继承。板块 7 随后交付新候选、自动回归、Trace 和 Provider 预检证据。
- 板块 8 使用两模式 `4` 条计分轨迹与 `2` 条冒烟执行真人 Preview。真人 Go/No-Go 通过后继续等待产品负责人单独批准 Production。
- GI-050～066 的旧候选、脚本化矩阵和工作台继续作为历史回归与归因资产，不承担新候选发布授权。

### Production

使用 [`.env.production.example`](../.env.production.example) 作为正式环境清单来源。

规则：

- Production URL 合同可由显式 `APP_URL` 或暴露后的 Vercel system env 满足
- 如果依赖 Vercel system env，生产指向应来自 `https://${VERCEL_PROJECT_PRODUCTION_URL}`；该变量在 Vercel 文档中定义为项目生产域名，即使在 preview deployment 中也会提供生产域语义
- 如果项目未暴露 system env，才要求手工维护 `APP_URL`
- 当前仓库已经拿到一条可接受的 direct runtime readback 证据：`2026-05-19` 在手动 preview deployment `https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app` 上，通过受保护的 `GET /api/debug/runtime-env` 返回了 `VERCEL_PROJECT_PRODUCTION_URL=xingfuxitong.vercel.app`
- 因为 Vercel 官方定义这个变量“即使在 preview deployment 中也总是会被设置”，所以当前 production URL 合同可以按 system env 路径视为已闭环；显式 `APP_URL` 仍可作为替代路径，但不再是当前 launch gate 的阻断项
- 生产库和 preview 库必须隔离
- 如果记忆系统暂时不开，`VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID` 可以先留空；该变量属于历史 Ark embedding 兼容路径
- `INTERVIEW_INTENT_V2_MODE=enforce`是当前正式行为；`legacy`保留为出现P0问题时的即时回退档位
- `INTERVIEW_EVENT_CENTERED_MODE=legacy` 与 `INTERVIEW_EVENT_CENTERED_STRATEGY=baseline` 是当前生产安全默认值；板块 8 Preview 达标并获得产品负责人单独批准后，才切换到 `optional + generative`
- `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` 和 `DEEPSEEK_BASE_URL` 是共享聊天 Provider 合同；GI-066 已使用 DeepSeek 官方 API 完成历史官方预检和自动 Preview。基于 GI-067 / GI-068～074 的新候选固定使用 `deepseek-v4-flash`，仍需在板块 7 重新形成候选版本并完成官方预检。`EVENT_CENTERED_GENERATIVE_MODEL` 与 Judge 变量继续服务于 Preview/评测候选，Production 事件中心仍保持 `legacy + baseline`

## 最小发布步骤

1. 在 Vercel 创建项目并连接当前仓库
2. 把 preview 环境变量按 [`.env.preview.example`](../.env.preview.example) 填入平台；这里指 AI / 数据库类用户自定义变量，不再把 `APP_URL` 作为“无条件必须手填”的第一选择
3. 确认 [package.json](../package.json) 保留主库与评测库两次 `prisma generate` 的 `postinstall`
4. 确认根目录 [vercel.json](../vercel.json) 同时保留 `framework: "nextjs"` 和“生成两套 Prisma Client 后再执行 `pnpm run build`”的 `buildCommand`
5. Preview 使用 Vercel Linux 远程构建；macOS 本机产物不进入 `vercel deploy --prebuilt`
6. 首次部署前确认 `.vercelignore` 已排除 `.worktrees`、`.claude`、`.omx`
7. 如果本次发布包含 `20260720210000_add_interview_intent_assessment` 或 `20260720223000_add_interview_response_regeneration`，先对目标数据库执行 `npx prisma migrate deploy`；Preview与Production当前均采用`enforce`。重新生成验收环境设置 `INTERVIEW_REGENERATION_ENABLED=true`。
8. 等首个 preview 部署完成后：
   如果当前 preview 开启了 Deployment Protection，当前已验证通过的自动化 smoke 路径是 `vercel-curl` transport；在任意 `.worktrees/...` 目录执行时，`scripts/launch-acceptance-runner.mjs` 也会自动把 Vercel cwd 回退到父 repo 根目录。执行：

```bash
ACCEPTANCE_TRANSPORT=vercel-curl \
ACCEPTANCE_VERCEL_SCOPE="your-vercel-scope" \
ACCEPTANCE_BASE_URL="https://your-preview-url.vercel.app" \
node scripts/product-smoke.mjs joy 2026-05-19
```

   匿名 raw preview root 仍可能返回 `401 Vercel Authentication Required`；这不再阻断 `vercel-curl` 自动化 smoke。

   `product-smoke.mjs` 默认先登录并复用固定账号 `preview_acceptance`，只有首次缺失时才注册。需要切换另一组固定凭据时，显式设置 `PRODUCT_SMOKE_USERNAME / PRODUCT_SMOKE_PASSWORD`；脚本不再为每次运行生成新用户。

   当前 `scripts/product-smoke.mjs` 的自动化覆盖范围只到：
   - 固定验收账号复用或首次注册
   - 登录 / session 建立
   - `POST /api/interview/session/start`
   - `invalid_entry_date` 拒绝路径

   它当前不自动覆盖更深的 `joy -> respond -> wrap_up -> draft generate -> draft save` 主链。
   这部分如果需要证据，必须由 controller 手工 deep link / API 链路补证，不能混写成 “product-smoke 已自动覆盖”。

   如果 preview 没有开启保护，仍可直接执行：

```bash
SMOKE_BASE_URL="https://your-preview-url.vercel.app" npm run smoke:public
```

9. smoke 通过后，再决定要不要开放给真实试用

事件中心 Board 8 才能执行的额外步骤：

1. 完成板块 5 用户控制与交互规则、板块 6 GI-074 正式评测资产，并由板块 7 交付冻结候选、自动回归和 Provider 预检证据。
2. 使用独立 Preview 数据库和 Preview 账号执行两模式 `4` 条计分轨迹、`2` 条冒烟、日志闭环和旧五维默认入口隔离检查。GI-050～066 的四角度与脚本化矩阵继续作为历史回归资产，不直接承担新候选裁决。
3. 真人轨迹满足 GI-074 及届时冻结的板块 5～6 门槛，且一票阻断为 `0` 后形成 Go/No-Go。
4. Go/No-Go 通过后暂停，等待产品负责人单独批准；批准后先保存 Production 配置和 deployment ID，再按新候选冻结配置设置事件中心模式、策略与模型。
5. 部署到 `https://dailylight.chat` 后，冒烟验证五维默认入口、事件次级入口、对话、事件日志生成 / 编辑 / 保存 / 恢复、反馈与观测事件，并记录开启时间。
6. 从开启时间后的 `event_centered_first_content_submitted` 开始，按根会话去重审计前 `10` 次。执行只读报告：

```bash
DATABASE_URL="<只读或受控数据库连接>" \
npm run report:event-centered:board8 -- \
  --since="<Production 开启时间，ISO 8601>" \
  --output-dir="artifacts/generative-interview-board8/production-first10"
```

事件中心 Production 分层回退：

1. AI 质量、事实、纠正、停止或来源问题，立即切换 `optional + baseline`。
2. 前 `10` 次累计达到 `3` 次或连续达到 `3` 次生成式降级，切换 `optional + baseline`。
3. 最近 `20` 个有效回合降级率超过 `20%`，切换 `optional + baseline` 并归因。
4. 日志生成或保存主链连续 `2` 次无法通过自动恢复，切换 `event_recovery + baseline`，关闭事件新写入并检查恢复。
5. 跨用户、隐私、原话或数据损坏，立即停止相关写入；读路径受影响时切换 `legacy + baseline`。
6. 回退后保留已有事件、日志、原话、事实和 Trace。`optional + baseline` 可以作为板块 8 的条件发布结果。

## URL 合同补充说明

- 相关平台文档路径：`Vercel -> Environment Variables -> System Environment Variables`
- 当前这条 launch lane 认可两种 URL 合同实现：
  1. 显式维护 `APP_URL`
  2. 依赖 Vercel system env，在运行时拼出 `https://${VERCEL_URL}` / `https://${VERCEL_BRANCH_URL}` / `https://${VERCEL_PROJECT_PRODUCTION_URL}`
- 只要选择第 2 条路径，就不能只看 `vercel env ls`。`vercel env ls` 只能证明用户自定义变量现状，不能单独证明 system env 是否已向 deployment 暴露。
- 因此，任何把 Preview / Production 判定为“URL 合同已满足”的结论，都必须附带一条额外证据：项目设置中 `Automatically expose System Environment Variables` 已开启，且部署构建或运行时能读到 `VERCEL=1`
- 当前已经到位的证据分两层：
  - `vercel env pull` 只足以作为 preview deployment URL 的旁证：`VERCEL=1` + `VERCEL_URL`
  - 真正关闭 production URL 合同的是 direct runtime readback：在 preview runtime 上直接读到 `VERCEL_PROJECT_PRODUCTION_URL`
- 当前仓库用于这条 direct readback 的最小验证面是：
  - route：`GET /api/debug/runtime-env`
  - script：`node scripts/runtime-env-readback.mjs`
  - guardrails：登录态 + `ENABLE_RUNTIME_ENV_READBACK=1` + `RUNTIME_ENV_READBACK_TOKEN` + 只读白名单字段

## 当前仓库的构建注意事项

- 这个仓库使用 Prisma；在 Vercel 上如果只依赖默认依赖缓存，`Prisma Client` 可能不会自动重新生成。
- 当前仓库保留 `postinstall` 生成两套 Prisma Client，并由 [vercel.json](../vercel.json) 的 `buildCommand` 在 `next build` 前再次生成。后一步负责避开 Vercel 依赖缓存，并保证主应用与 GI-088 评测 Client 同时进入当前 Linux 构建产物。
- [vercel.json](../vercel.json) 继续把 framework 固定为 `nextjs`；该配置同时防止项目后台残留 `Other` preset 导致 Preview 域名在部署 `Ready` 后返回 `404`。
- Preview 部署固定上传源码交给 Vercel Linux 远程构建。本机 `vercel build` 只用于本地检查；macOS 产物不再通过 `vercel deploy --prebuilt` 发布，避免把 `darwin-arm64` Prisma engine 带入 Linux 运行时。
- 如果未来要在部署时顺带执行数据库迁移，再单独评估是否引入 `prisma migrate deploy`，不要和“先把 preview 构建打通”混成同一个步骤。

## 最小 smoke 范围

当前脚本 [scripts/http-smoke.mjs](../scripts/http-smoke.mjs) 会检查：

- `/`
- `/login`
- `/register`
- `/legal/terms`
- `/legal/privacy`
- `/api/auth/session`

通过标准：

- 页面型路由返回 `200`
- `/api/auth/session` 返回 `200`
- `/api/auth/session` 的 JSON 里存在 `authenticated: boolean`
- 如果设置了 `SMOKE_BYPASS_SECRET` 或 `VERCEL_AUTOMATION_BYPASS_SECRET`，脚本会先走一次 Vercel bypass cookie 流，再检查上述路由；当前受保护 preview 的仓库基线以这条路径为准

## 2026-05-19 审计快照

审计命令：

```bash
# run from the linked xingfuxitong project root
vercel env ls --scope zouzhijies-projects
```

执行前提：
- 当前 shell 必须位于已 link 到 `zouzhijies-projects/xingfuxitong` 的仓库根目录
- 如果不在这个项目根目录执行，就必须先显式切到该目录，或用其他方式把命令固定到 `xingfuxitong`，否则这条审计结果不具备可复现性

审计对象：
- Vercel team：`zouzhijies-projects`
- project：`xingfuxitong`

当前真实结果：
- `Development / Preview / Production` 三套环境都只看到了 `DATABASE_URL` 与 `DIRECT_URL`
- 没有看到 `AI_PROVIDER`
- 没有看到 `VOLCENGINE_ARK_API_KEY`
- 没有看到 `VOLCENGINE_ARK_ENDPOINT_ID`
- 没有看到 `VOLCENGINE_ARK_BASE_URL`
- 没有看到用户自定义 `APP_URL`
- 也没有看到可选的 `VOLCENGINE_ARK_EMBEDDING_ENDPOINT_ID`

结论：
- 当前平台环境状态低于本文件定义的 Preview / Production 合同
- 这里能被直接确认的阻断项仍然是 AI 变量缺失；仅凭这次 `vercel env ls` 结果，不能把“没有看到 APP_URL”单独等同于 URL 合同必然失败，因为系统环境变量不会通过这条命令显式列出
- 当前仍然不能把 Preview / Production 视为“可验证真实 AI 主链”的环境：一方面 AI 变量明确缺失；另一方面如果要依赖 Vercel system env，还缺少 `Automatically expose System Environment Variables` 已开启的直接证据
- 产品主链 smoke 仍可以先覆盖公开页和无 AI 前置的 API，但涉及访谈、日志生成、画像 AI 直出和完整部署 URL 语义时，当前平台配置仍不满足上线 readiness

## 2026-05-19 跟进结果

后续动作：
- 已把 `AI_PROVIDER`、`VOLCENGINE_ARK_API_KEY`、`VOLCENGINE_ARK_ENDPOINT_ID`、`VOLCENGINE_ARK_BASE_URL` 写入 `Development / Preview / Production`
- 已触发一版新的 preview redeploy：
  - `https://xingfuxitong-8w6xmyh95-zouzhijies-projects.vercel.app`
  - `vercel inspect` 返回 `Ready`

新增证据：
- 复查 `vercel env ls --scope zouzhijies-projects` 后，四个 AI 必填变量已经出现在 `Development / Preview / Production`
- `vercel env pull --environment=preview` 与 `vercel env pull --environment=production` 的拉取结果里都出现了：
  - `VERCEL=1`
  - `VERCEL_TARGET_ENV`
  - `VERCEL_URL`
- 这说明当前项目至少已经暴露出一条可直接用于 deployment URL 语义的 system env 路径；到这一步，`APP_URL` 不再是当前 launch lane 的直接阻断项

仍未直接通过 `env pull` 证实的部分：
- 本轮拉取结果里没有直接看到 `VERCEL_BRANCH_URL` 或 `VERCEL_PROJECT_PRODUCTION_URL`
- `VERCEL_URL` 在 pulled env 文件里还是空字符串
- 但这不再阻断 URL 合同收口，因为后续 direct runtime readback 已经补上了更高优先级证据

本机验证边界与重试结果：
- 先前 shell 侧的 `fetch failed` / `UND_ERR_CONNECT_TIMEOUT` 不能直接作为 preview 不可用证据：同机系统代理当时已经启用并指向 `127.0.0.1:7897`，且 `verge-mih` 正在监听，但执行命令的 shell 没有显式带上 `HTTP_PROXY` / `HTTPS_PROXY`
- 在显式代理条件下，`curl` 访问 `https://google.com` 与 `https://*.vercel.app` 已可成功返回，因此当前可用代理路径上的基础网络 / DNS 不再构成 blocker
- 匿名直打 preview root 的 raw 响应是 `Vercel Authentication Required (401)`，说明 public/anonymous 路径当前受 Deployment Protection 或鉴权策略约束
- 在显式代理加 `vercel curl` 的控制侧重试里：
  - `GET /api/auth/session` 返回 `200`，body 为 `{\"authenticated\":false,\"user\":null}`
  - `GET /login`、`GET /register`、`GET /legal/terms` 均返回 `200`
  - `GET /interview` 在未登录态下返回 `307` 并跳转到 `/login?next=%2Finterview`
  - `GET /` 返回 `401 Vercel Authentication Required` 以外的真实首页 HTML，而不是 Vercel 认证拦截页
- 在同一条显式代理加 `vercel curl` 路径上，controller 手工 deep-chain 已被正向证明可用：
  - 测试账号 `smoke_1779197755` 执行注册返回 `200`，并建立 `dl_session` cookie
  - 带 cookie 请求 `GET /api/auth/session` 返回 `200`，且 `authenticated=true`
  - 带 cookie 请求 `GET /login?next=/calendar` 返回 `307` 到 `/calendar`
  - `POST /api/interview/session/start` 以 `dimension=joy`、`entryDate=2026-05-19` 返回 `200`，`status=collect_event`，并给出开场问题
  - 第一次 `respond` 后 `turnCount=1`，阶段推进到 `probe_pattern`
  - 第二次 `respond` 后 `missingSlots=[]`
  - 用户发送“先这样，直接整理成日志。”后，session 进入 `wrap_up`，且 `draftGenerationUnlocked=true`，`pendingDecision.kind=event_complete`，`completionMode=user_override_partial`
  - `draft generate` 返回标题为“状态轻起来”的 `draftEntry`，状态为 `draft`
  - `draft save` 返回同一条 `draftEntry`，状态为 `saved`
  - session 最终状态为 `completed`
- 这组重试证据表明：当前已不再是“这台机器到 `vercel.app` 没有可用网络路径”，也不是“应用已经无法返回页面 / API 响应”；匿名 raw preview root 的 `401` 与 smoke gate 更一致地指向 Deployment Protection / auth strategy

当前结论：
- 已被直接证实的 AI 环境变量阻断已解除
- preview URL 合同在当前仓库接受的最小证据面上可视为已满足：system env 路径至少已通过 `VERCEL=1` + `VERCEL_URL` 得到证据支持
- production URL 合同现在也已闭环：`APP_URL` 仍为空，但手动 preview deployment `https://xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app` 的 guarded runtime readback 返回了
  - `VERCEL_TARGET_ENV=preview`
  - `VERCEL_URL=xingfuxitong-nd5yfetul-zouzhijies-projects.vercel.app`
  - `VERCEL_PROJECT_PRODUCTION_URL=xingfuxitong.vercel.app`
  - `APP_URL=null`
- 这条证据符合官方对 `VERCEL_PROJECT_PRODUCTION_URL` 的定义：它是项目 production 域名，且即使在 preview deployment 中也会设置
- 当前剩余 blocker 已不再是“平台缺少 AI 变量”，也不再是“可用代理路径上的网络 / DNS 不通”
- 受保护 preview 的自动化 smoke auth path 已固定为 `vercel-curl`：匿名 raw preview root 仍是 `401`，但最小自动化 smoke 已不再被 Deployment Protection 卡住
- 当前自动化脚本证据与 controller 手工补证必须分开读：
  - `product-smoke.mjs` 自动化：只覆盖最小 auth/session/start/invalid_entry_date
  - controller 手工 deep-chain：补到 `joy -> draft generate -> draft save`
- `runtime-env-readback.mjs` 自动化：用于 guarded runtime env 直读，不属于公开 smoke 面

## 当前刻意不开放的能力

- `/api/transcribe` 继续视为关闭态，不纳入 preview smoke
- 没有真实转写模型前，不开放语音入口

## 暂不做的事

- 不先上 VPS
- 不先做多环境矩阵
- 不先做复杂灰度发布

## 2026-05-25 生产 AI 恢复收口（历史 Ark 运行时记录）

以下内容记录当时的 Ark 运行时排障过程，保留用于历史追溯。候选与目标聊天 Provider 已统一为 DeepSeek 官方 API；共享运行时完成授权切换前，Ark 变量和适配器继续承担运行兼容路径。

这轮 production 真实问题已经从“域名是否可用”收敛成两层：

1. 生产 AI env 曾被写成 `$VOLCENGINE_...` 占位字面值
2. production 库缺少 `20260521120000_add_admin_analytics_tables`，注册链路会在 `AnalyticsEvent` 处失败

处理结果：

- 已把 production 的 Ark 配置修回真实字面值
- 生产 AI 路径不再依赖原先那个跨项目不可访问的 `endpoint`
- 改为优先使用直连模型：

```bash
AI_PROVIDER=volcengine-ark
VOLCENGINE_ARK_MODEL=deepseek-v3-2-251201
VOLCENGINE_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

- `VOLCENGINE_ARK_ENDPOINT_ID` 仍可保留为兼容 fallback，但当前 production 不再依赖它
- 已在 production 执行 `npx prisma migrate deploy`，补齐 `20260521120000_add_admin_analytics_tables`

直接证据：

- guarded runtime readback 在短时验证窗口内对 `https://dlight.cc.cd` 返回：
  - `ai.available=true`
  - `ai.state=ready`
  - `ai.configSummary.modelSource=VOLCENGINE_ARK_MODEL`
  - `ai.probe.status=200`
- 这说明 production runtime 已能真实打到 Ark，而不是只停在 fallback
- 验证完成后，`ENABLE_RUNTIME_ENV_READBACK` 已重新改回关闭态；当前 `GET /api/debug/runtime-env` 在 production 返回 `404 RUNTIME_ENV_READBACK_DISABLED`

当前结论：

- `dlight.cc.cd` 已接入 `zouzhijies-projects/xingfuxitong`
- public 站点可用，生产 AI provider 可用，production 数据库基线可用
- 剩余 launch 风险已不再是 Vercel AI env 合同，而是独立的中国大陆样本与最终人工回归

## 2026-05-26 生产 auth 错误发布收口

这轮 production 问题表现为：感谢维度访谈继续提交时，用户看到类似网络不可用的失败；线上无登录直打 `respond/stream` 一度返回 Vercel HTML `500`。

根因收敛：

1. 已过期或缺失的登录状态没有在 stream 路由进入 SSE 前被统一识别。
2. 旧 production deployment 仍停在修复前版本；PR 合并和 CI 通过后，`dlight.cc.cd` 仍指向 5 小时前的 Vercel deployment。

发布前先确认代码与线上不是同一层问题：

```bash
gh pr view 20 --json state,mergedAt,mergeCommit,url
gh run view 26437689871 --json status,conclusion,headSha,workflowName,url
vercel ls --scope zouzhijies-projects
vercel inspect https://<current-production-deployment>.vercel.app --scope zouzhijies-projects
```

如果 `vercel ls` 最新 production deployment 创建时间早于合并提交，说明代码已合并但线上仍是旧版本。此时应从干净的 `origin/main` worktree 部署，避免把本地主目录的未提交改动带到 production：

```bash
git fetch origin main
git worktree add /private/tmp/happiness-prod-deploy origin/main
mkdir -p /private/tmp/happiness-prod-deploy/.vercel
cp .vercel/project.json /private/tmp/happiness-prod-deploy/.vercel/project.json
cd /private/tmp/happiness-prod-deploy
vercel --prod --scope zouzhijies-projects
```

生产验证口径：

```bash
curl -I https://dlight.cc.cd

curl -m 25 -i -H 'Content-Type: application/json' \
  -d '{"dimension":"gratitude"}' \
  https://dlight.cc.cd/api/interview/session/start

curl -m 25 -i -H 'Content-Type: application/json' \
  -d '{"action":"reply","sessionId":"session-1","userMessage":"hi","inputMode":"text"}' \
  https://dlight.cc.cd/api/interview/session/respond

curl -m 25 -i -H 'Content-Type: application/json' \
  -d '{"action":"reply","sessionId":"session-1","userMessage":"hi","inputMode":"text"}' \
  https://dlight.cc.cd/api/interview/session/respond/stream
```

本次发布证据：

- Production deployment: `https://xingfuxitong-p0aqce49d-zouzhijies-projects.vercel.app`
- Alias: `https://dlight.cc.cd`
- Vercel deployment id: `dpl_gmxvc6SEyf9Qo1TLQzZkuyQ8o2Zz`
- `GET /` 返回 `HTTP/2 200`
- `POST /api/interview/session/respond` 无登录返回 `HTTP/2 401` 和结构化 `AUTHENTICATION_REQUIRED`
- `POST /api/interview/session/respond/stream` 无登录返回 `HTTP/2 401` 和结构化 `AUTHENTICATION_REQUIRED`

当前结论：

- 这类问题应先区分三层：代码是否已合并、CI 是否通过、production alias 是否已经指向包含修复的 deployment。
- 对用户可见的正确行为是提示“登录状态已失效，请重新登录后回到当前页面继续”，不能再暴露 `NETWORK_UNAVAILABLE` 或 Vercel HTML `500`。
- stream 路由的 auth 检查必须发生在创建 SSE 响应前；否则错误容易绕过普通 JSON 错误处理。
