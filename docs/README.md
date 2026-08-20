# Daily Light 文档导航

- 文档职责：知识导航
- 文档状态：现役
- 最后核验：`2026-08-20`
- 权威入口：本文件

最后更新：`2026-08-20`

用途：让新的 AI、开发者或产品协作者在五分钟内找到当前事实、开放问题、实现说明和评测证据。

## 1. 当前状态

当前执行入口：[DL-PROD-20260819](./ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

- 五阶段生产主线完善已获产品负责人确认并进入实施；当前专项为 [DL-PROD-20260819](./ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)，状态 `已确认·实施中`。阶段 1 已发布 Production，正式域名核心回验通过，管理员成功读取保持 pending；阶段 2 热修复已合入 main `795417d` 且远程门与 main CI 全绿，Preview 通过至“需更新”，Production blocked；阶段 3 已形成未推送本地安全候选，隔离 PostgreSQL 并发门 `2/2` 通过，样本状态为 `insufficient_samples / collection_pending`；阶段 5 已形成 `No-Go / insufficient_evidence` 结论。正式域名继续运行阶段 1 deployment `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。公开证据见[数据口径 v2 回执](../artifacts/production-evidence-hardening/2026-08-19/analytics-contract-v2/README.md)、[零模型 E2E 回执](../artifacts/production-evidence-hardening/2026-08-19/e2e-zero-model/README.md)与[Golden Set v2 入口](../artifacts/production-evidence-hardening/2026-08-19/golden-set-v2/README.md)。
- 五阶段原工作线通过基线提交 `5c36b49` 对齐当时 Production 源码 `ed8c36d`；Stage 3 发布候选从 `origin/main@77de8d1` 建立独立 worktree。分叉原因和处理证据见[问题台账 PEH-001](../artifacts/production-evidence-hardening/2026-08-19/issue-ledger.md)。
- 本轮范围为数据口径 v2、零模型端到端回归、Production 日志 Golden Set v2、主链重构和月度个性化洞察 Go/No-Go。阶段 1、2、4 逐步 Preview／Production；阶段 3 私有评审；阶段 5 保持隔离。
- GI-088、生成式访谈发布、数据库迁移、月度 AI 洞察 Production 上线和破坏性清理继续使用独立停止门。Stage 3 正文开关保持关闭，Production 正文读取 `0`、模型调用 `0`；Production 继续运行 `event_centered + baseline`。

- 全站产品架构已统一为“首页 → 记录 → 日记 → 认识自己”；第二轮视觉基线已验收并恢复，后续字体与色阶增强候选已否决并转入历史证据；基线隔离功能 Preview、真实闭环复验和发布前运行依赖安全验证已经完成。
- `/insights?section=trends|portrait|memories` 已形成新版「认识自己」候选：趋势与画像只读取新版事件记录和日／周／月记，记忆页显示“即将上线”。
- 第二轮验收基线已于 `2026-08-13` 发布 Production，正式域名为 `https://dailylight.chat`，运行模式为 `event_centered + baseline`；生成式访谈候选和 GI-088 发布范围继续关闭。
- 项目级 [AI 评测总规范 v1.0](./ai-evaluation-standard.md)与[专项模板 v1.0](./templates/ai-evaluation-specialty-template.md)已获产品负责人确认并冻结生效；任何新的评测运行先完成总规范启动卡，再进入当前专项。
- `GI-068～080` 保持关闭；
- 生成式访谈工作方法 `v1.0` 已冻结；
- 板块 6 继续进行中；
- `GI-081` 六题真实输出与盲评已经完成，当前作为临时 Prompt 诊断基线；
- `GI-083` v0/v1 保留一次调用透明诊断历史；产品负责人轨迹调用 `0`，v1.1 工程合成自测 `5/5` 次请求通过；
- `GI-084` v0.1～v0.3 三轮回归均为 No-Go，v0.4 在运行前关闭；
- `GI-085` semantic-frame-first v1 已完成 8 次隔离回归并判定 No-Go，真实网页轨迹关闭；
- `GI-086` Thinking 能力校准已完成 `8/8` 次调用、产品透明裁决与 Codex 九维初评；固定门 No-Go，Thinking 通用能力保持开放；
- `GI-087` 已把任务结构调整为稳定的 `workingTask` 与单轮 `nextInquiry`；六题隔离筛选已经完成；
- `GI-088` v1 原计划 `12` 项、`24` 条同起点轨迹；产品负责人完成 A1～A8 共 `8` 项、`16` 条轨迹后主动提前结束。基础 GI-087 指纹为 `e45f431f…3321aa`，有效候选指纹为 `58074d31…08b884`，执行指纹为 `4b658013…f70b2`；
- v1 前 8 项的评价与比较数据完整，已形成只读封存快照；系统状态仍为 `running`、`sealedAt=null`。本批共 `66` 次调用，其中 high 出现 `12` 次空内容、`7` 次超时和 `17` 次手动重试；产品负责人和 Codex 均观察到 high 内容优势。产品负责人已确认保留 high、按 `EMPTY_CONTENT → TIMEOUT → 输出合同 → 内容与边界` 分阶段迭代；
- v2 diagnostic 评测底座已完成：支持 `early_stopped`、8/12 部分导出、逐任务目标触发确认和安全分阶段诊断。空内容 response format 探针 `6/6` 已判定移除参数 No-Go，Thinking 模式探针 `4/4` 形成 inconclusive。产品负责人随后停止继续复现 DeepSeek 内部原因，并确认 v3 唯一主要因素为“Thinking high 可见答案自动恢复”；
- v3 候选已完成本地验证并部署私有 Preview：产品负责人完成 A1 的 off/high 两条轨迹后，以证据充分为由在 `1/12` 提前结束，调用消费 `8/40`。本组 `EMPTY_CONTENT=0`、自动恢复 `0`，因此空内容恢复真人效果保持未判定；两边第 4 轮均命中 `NEW_ANSWER_OPPORTUNITY_UNAVAILABLE`，已确认属于回答机会边界与模型动作不一致，并与 Thinking 开关无关。完整脱敏复盘见 [A1 定向真人评测复盘](../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v3-empty-recovery/gi088-v3-targeted-human-eval-summary.md)；该候选未进入 Production；
- v4 阶段 2→3 自然转场候选已完成 A1 两条轨迹并以 `1/12` 提前结束；阶段转场形成单例真人证据，原执行指纹 `0206fd34…b1d0a` 与完整 Trace 继续只读保留；
- v4 实际完成 A1 两条轨迹并以 `1/12 early_stopped` 只读封存，共 `10` 次调用。high 后两轮均在本地 `30s hard_total` 被截断；off/high 各出现一次双问题保护。产品负责人确认后续只保留 Thinking high；v5 将等待改为 `15s 响应头＋45s 正文空闲＋60s 总上限`，并增加单问合同与一次自动纠正。私有 Preview 已 Ready，High-only `0/12` 空白批次与零调用回读通过，等待登录后开始 A1；
- v5 尚未发生真人模型调用。产品负责人复核后确认严格“一个问号”会过度限制自然澄清、举例和选项，因此 v6 把控制单位恢复为“一个独立回答任务”。产品负责人完成 A1、A2 两条 Thinking high 轨迹后确认原有问题解决，并以 `2/4 early_stopped` 收口；11 条可见 ask 中，同一焦点自然可答 `9`、同一焦点表达偏重 `2`、独立多任务 `0`，A3、A4 标记未执行；
- v7 两条 Thinking high 真人轨迹已经完成并封存，批次暴露“思考正常结束、可见正文为空且普通自动恢复仍可能失败”的可靠性问题。v7r1 的 Prefix 兼容探针确认 DeepSeek 拒绝 Prefix 与 `response_format=json_object` 同时使用，因此判定 No-Go；
- v7r2 的两条 Ark Flash 真人轨迹已经封存：共 `15` 次用户提交、`20` 次调用，首次直接成功 `10` 次、自动恢复成功 `3` 次、状态保护 `2` 次；两项均由产品负责人判为 `minor_issue`。已确认根因集中在确定性状态合同，模型提交本轮新增来源时，程序仍要求重复完整历史来源；
- v7r3 已把来源合并和明确停止交给程序维护。v7r4 的两条官方 `deepseek-v4-pro` 真人轨迹已封存：共 `12` 次用户提交、`13` 次调用，首次产生可见正文 `11/12`、空内容 `0`、自动恢复 `1`、程序保护 `2`；产品负责人裁决整体 `No-Go`，同时确认 V4 Pro 继续使用；
- v8 A1 完成 `10` 次提交后以 `1/4 early_stopped` 收口，产品负责人判断 `通过 / direct_use / target triggered`；`10/10` 次首次成功，`7/7` 条可见提问均为 `same_focus_low_burden`，技术失败、恢复、保护和重复消息均为 `0`；
- v8r1 已将简短礼貌回应与明确停止组合收入零调用暂停，真实 U10 回放通过。最终 `12` 项 Thinking high 候选完成 `160` 项相关测试、构建、Preview 部署与创建时 `0/12` 空白批次回读；初始化模型调用 `0`。产品负责人随后完成 A1 一条轨迹，确认事件内容中的沟通负担被程序误判为停止当前访谈，形成单例阻断。`2026-08-10` 专用评测库只读回读为 `running`、活动任务 A2、已完成轨迹 `1`、Provider 调用 `2` 且均为 `valid`；
- v8r2 工程底座继续保留历史身份。GI-088 阶段 C2 已完成全新 Judge 校准：Plus 普通与思考均完整 No-Go，Max 思考 15/20 后网络技术阻断，当前无可推荐 Judge。后续 Judge 路线需要新授权；独立准入、人工提交与质量裁决继续关闭；
- Flash / Pro 已完成 3 组、6 次同请求对照：Flash `2/3` 可见有效、`1/3` 空正文；Pro `3/3` 返回可解析可见 JSON。火山 Ark Flash 同三例获得 `3/3` 可见正文、平均等待约 10.9 秒；这些结果作为 v7r2 与 v7r4 的模型平台归因证据保留；
- 板块 7 正式接入继续等待板块 6；
- 板块 8 继续等待；
- 日志成果专项已完成 9 条真人轨迹的今日日记 Prompt v3 评价；其中 6 条完成“记录卡 v3 → 今日日记 v3”完整回归，记录卡 v3 的证据范围限定为 6 条；
- 当前新前端已完成第二轮视觉验收、验收基线恢复、隔离功能 Preview 真实闭环复验和发布前运行依赖安全验证；字体与色阶增强候选及旧 UI Preview 只作为历史工程证据；
- Production 当前使用 `event_centered + baseline`；GI-088 与 `generative` 策略继续关闭。

Daily Light 当前网页端方向为“访谈记录 → 当天事件卡片 → 今日日记”。生成式访谈双轨资产已冻结；阶段 C2 完整确认 Plus 双 No-Go，Max 形成技术阻断，正式准入继续保持关闭。联调契约见[隔离 Preview 联调契约](./plans/2026-08-12-daily-light-journal-preview-contract.md)，评测证据见[GI-088 阶段 C2 入口](../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md)。

跨会话的端到端联调统一由前端设计／联调会话总控，推进顺序、三方 Ready 条件、接口状态映射、问题归属和完整闭环验收见[Daily Light 端到端联调总交接](./plans/2026-08-12-daily-light-end-to-end-integration-handoff.md)。

## 2. 新会话阅读顺序

1. [项目协作与事实规则](../AGENTS.md)
2. [AI 评测总规范 v1.0](./ai-evaluation-standard.md)（涉及评测集、模型比较、Judge、准入、Preview、Bad Case 或线上质量时必读）
3. [访谈产品优化总 Map](./interview-product-optimization-map.md)
4. [生成式访谈重构总 Map](./generative-interview-refactor-map.md)
5. [生成式访谈 AI 产品工作方法 v1.0](./technical/interview-event-centered/00-generative-interview-ai-product-working-method.md)
6. [板块 6 当前专项｜生成式访谈质量评测 v1](./technical/interview-event-centered/04j-generative-quality-evaluation-v1.md)
7. [板块 5 冻结输入](./technical/interview-event-centered/05-board5-stability-user-control-and-interaction-scope.md)
8. [GI-074 评测与交接](./technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md)
9. [GI-088 阶段 B2 双轨资产、无正文回执与独立任务交接](../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md)
10. [评测资产总入口](../artifacts/README.md)

评测类新会话的最短路径为：`AGENTS.md → AI 评测总规范 → 相关 Map → 当前专项的总规范适配卡 → 正式资产入口`。

## 3. 按任务找文件

### 产品状态与决策

- 全产品访谈链路：[访谈产品优化总 Map](./interview-product-optimization-map.md)
- 网页端访谈、事件卡片与今日日记交接：[Daily Light：访谈、事件卡片与今日日记网页端前端设计交接](./plans/2026-08-11-daily-light-journal-page-frontend-handoff.md)
- 端到端联调总控：[Daily Light 端到端联调总交接](./plans/2026-08-12-daily-light-end-to-end-integration-handoff.md)
- 事件中心阶段与批次：[事件中心重构讨论地图](./interview-event-centered-refactor-discussion-map.md)
- 生成式板块 1～8：[生成式访谈重构总 Map](./generative-interview-refactor-map.md)
- 事件中心产品事实：[事件中心产品规格](./interview-event-centered-product-spec.md)
- 板块 5～8 工作方式：[生成式访谈 AI 产品工作方法 v1.0](./technical/interview-event-centered/00-generative-interview-ai-product-working-method.md)
- 方法形成过程与经验：[板块 5 与 AI 产品工作方法实操复盘](./technical/interview-event-centered/00a-generative-interview-ai-product-working-method-retrospective.md)
- 交互式理解入口：[实操复盘可视化](./technical/interview-event-centered/00a-generative-interview-ai-product-working-method-retrospective.html)

### 当前评测与真人裁决

- 项目级评测治理：[AI 评测总规范 v1.0](./ai-evaluation-standard.md)
- 新专项起草入口：[AI 评测专项模板 v1.0](./templates/ai-evaluation-specialty-template.md)
- 访谈意图专项：[访谈意图评测与上线事实源](./interview-intent-evaluation-source-of-truth.md)
- 生成式访谈专项：[板块 6｜生成式访谈质量评测 v1](./technical/interview-event-centered/04j-generative-quality-evaluation-v1.md)
- GI-088 当前双轨资产：[阶段 B2 资产、无正文回执与独立任务交接](../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/README.md)
- 日志成果九条真人轨迹：[今日日记 Prompt v3 与六条完整链路阶段性总结](../artifacts/journal-generation-evaluation/nine-human-trajectory-summary.md)
- 日志生成评测资产：[离线评测与隔离评审入口](../artifacts/journal-generation-evaluation/README.md)
- 板块 6 人工校准：[首批 8 张卡入口](../artifacts/generative-interview-board6/2026-08-06/README.md)
- GI-088 v8r2 工程底座与空白 run 证据：[v8r2 评测底座加固资产](../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)
- GI-088 v8r2 已完成实施合同：[意图控制与评测底座全量修复](./ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)
- GI-088 v8r1 事故与部署时快照：[v8r1 最终 12 项独立验收](../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md)
- GI-088 当前问题台账：[BC-01～12 与 v3～v8r2 补充问题](../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-current-issue-ledger.json)
- GI-088 历史批次复盘：[v1 8/12 提前结束、独立初评与 Bad Case](../artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v1/README.md)
- GI-087 候选基线与历史筛选：[Board 7B working-task v1](../artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1/README.md)
- GI-086 能力校准历史：[Board 7B Thinking capability v1](../artifacts/generative-interview-board7/2026-08-07-board7b-thinking-capability-v1/README.md)
- GI-085 回归结果与根因：[Board 7B semantic-frame v1](../artifacts/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1/README.md)
- GI-081 六题 A/B：[真实输出资产入口](../artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/README.md)
- 评测资产治理：[artifacts 总入口](../artifacts/README.md)

### 工程实现与运行

- 系统结构：[architecture.md](./architecture.md)
- API 与调用方式：[integration-guide.md](./integration-guide.md)
- 本地运行与排障：[operator-runbook.md](./operator-runbook.md)
- 当前交接：[handoff.md](./handoff.md)
- Daily Light 高保真 Preview 联调契约：[2026-08-12 Preview 合同](./plans/2026-08-12-daily-light-journal-preview-contract.md)
- 访谈意图评测：[interview-intent-evaluation-source-of-truth.md](./interview-intent-evaluation-source-of-truth.md)
- 工作区收口结果：[2026-08-06-workspace-consolidation-result.md](./maintenance/2026-08-06-workspace-consolidation-result.md)
- 本轮 304 路径处置台账：[2026-08-12-workspace-disposition-ledger.md](./maintenance/2026-08-12-workspace-disposition-ledger.md)

### 历史证据

- 历史 Board 7：[Board 7 资产索引](../artifacts/generative-interview-board7/README.md)
- 历史 Board 8：[Board 8 资产索引](../artifacts/generative-interview-board8/README.md)
- 历史 Batch B：[Batch B 证据清单](../artifacts/event-centered-batch-b-manifest.md)
- `GI-066` 真人 No-Go 与历史候选：[04u 专项](./technical/interview-event-centered/04u-board8-gi066-thought-only-question-strategy.md)

## 4. 稳定搜索词

在仓库根目录使用：

```bash
rg -n "GI-088|GI-087|板块 6|board7b-working-task-v1|board6-calibration|legacy \+ baseline" AGENTS.md README.md docs artifacts
```

历史候选使用：

```bash
rg -n "GI-066|No-Go|historical|历史证据" docs/technical/interview-event-centered artifacts
```

## 5. 事实使用规则

总 Map 的当前状态优先于历史报告；当前专项承载开放问题和校准过程；冻结专项承载关闭输入；`artifacts/` 保存运行和人工裁决证据。自动技术通过、旧候选和历史 Preview 结论不能替代当前产品裁决或 Production 授权。
