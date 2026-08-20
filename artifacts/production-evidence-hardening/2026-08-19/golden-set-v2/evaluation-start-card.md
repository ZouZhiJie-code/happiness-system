# Golden Set v2 AI 评测启动卡

- 文档职责：评测启动卡
- 文档状态：已确认·实施中
- 最后核验：`2026-08-19`
- 权威入口：[`Production 日志 Golden Set v2`](./README.md)
- 运行身份：`2026-08-19.production-journal-golden-set-v2-review-v1`

## 1. 本轮产品决策

建立一套来源清楚、授权可撤回、判尺稳定且可长期复用的 Production 日志真实复盘集，识别当前 `event_centered + baseline` 输出中的 Bad Case 家族和改进优先级。产品负责人逐例裁决后决定哪些案例获得 Golden 身份。

本轮只复盘现有输出。结果支持日志质量诊断、判尺校准和后续回归设计，不授权模型、Prompt、产品行为或 Production 发布变更。

## 2. 被测对象与运行身份

| 项目 | 冻结值 |
|---|---|
| 当前产品链 | `event_centered + baseline` |
| 评测单位 | `访谈完整轨迹 → 当前事件卡 → 当前今日日记与修订` |
| 运行身份 | `2026-08-19.production-journal-golden-set-v2-review-v1` |
| 合同版本 | `golden-set-v2-contract@2.0` |
| 模型／Prompt／Skill | 复盘既有输出，本轮无新增生成候选 |
| 程序指纹 | 以公开 [`manifest.json`](./manifest.json) 的合同 SHA-256 为准 |
| Production 读取实现 | 随机 case 映射、样本授权、完整链路复核、同意行锁与审计合同已本地实现；真实访问 `not_run` |

## 3. 数据集身份与覆盖

| 项目 | 冻结值 |
|---|---|
| 数据集身份 | `production-journal-golden-set-v2-candidate-pool-v1` |
| 计划数量 | `30` 条真实完整链路 |
| 当前数量 | `0` |
| 来源 | 当前同意有效且具有样本级完整轨迹评审授权的内部账号 |
| 模式覆盖 | 【帮我记】`capture ≥ 5`；【陪我聊】`chat ≥ 5` |
| 特殊行为覆盖 | 编辑、需更新、恢复或人工修改保护合计 `≥ 5` |
| 其余样本 | 保持 Production 内部自然使用分布 |
| 内容指纹 | 真实样本形成后逐例计算，当前 `not_run` |
| 隐私等级 | `restricted_real / human_only` |
| 公开范围 | 随机 case ID、非内容哈希、数量、评分、阻断编码和脱敏问题摘要 |

真实样本不足时继续内部自然使用。覆盖不足形成 `partial / insufficient_evidence`，合成案例只承担程序边界回归。

## 4. 判尺与阻断

六个维度使用 `2 / 1 / 0 / N/A`：事实忠实、重要内容覆盖、来源与日期边界、结构和可读性、用户原声保留、更新与人工修改保护。`N/A` 必须提供逐维理由。

确定性结论：

- 任一单例阻断或任一维度 `0`：`fail`；
- 无失败且任一维度 `1`：`minor`；
- 全部适用维度为 `2`：`pass`。

单例阻断：事实编造、跨用户污染、跨日期污染、隐私泄露、覆盖用户人工修改。任一阻断立即进入 Bad Case，暂停对应产品质量通过判断。

## 5. 职责

| 角色 | 职责 |
|---|---|
| 客观规则 | 校验随机身份、完整链路引用、哈希、授权、撤回、评分完整性、阻断和产品检查点 |
| AI Judge | 本轮关闭 |
| Codex | 逐例完成结构化初评、Bad Case 分类和根因假设；不替代产品裁决 |
| 产品负责人 | 完成原文最终裁决；第 10 条确认判尺和分类，第 30 条决定候选池封存与 Golden 晋升 |

## 6. 隐私、访问和撤回

每条案例同时满足：内部账号、当前 AI 质量同意有效、撤回为空、样本级 `full_trajectory_review` 授权有效、外部模型处理关闭。四次强制重查节点为 shortlist、正文读取、人工评审、检查点／最终封存。

撤回、删除、重新同意形成的新 consent epoch、授权过期、政策版本变化或身份不一致会触发 fail-closed：正文停止读取、案例退出活跃集合、私有内容进入隔离处置、公开只保留非内容撤回回执，并补充替代样本。

正文读取的并发边界：服务端先根据私有授权映射定位真实 root，再在读取正文前对 consent 所在 User 行执行参数化 `FOR SHARE` 锁。撤回更新先完成时，本次读取停止；读取先持有共享锁时，撤回等待审计事务结束；Serializable 冲突统一关闭并返回安全错误。锁内仍执行开始和审计前两次 consent epoch 复核。

`GOLDEN_SET_V2_AUTHORIZED_SOURCES_JSON` 与 `GOLDEN_SET_V2_CONTENT_ACCESS_ENABLED=true` 必须同时显式存在。映射只保存在服务端，最多 `30` 条；API 使用随机 `jgv2_…`，真实 root、用户 ID 和数据库异常不进入响应。所有 shortlist／详情响应使用 `private, no-store`。

Production 用户业务记录保持只读。后续每次正文访问必须创建 `AdminAuditLog`；该审计记录是唯一允许的治理写入。

## 7. 预算与停止点

| 项目 | 冻结值 |
|---|---|
| 新增模型调用 | `0` |
| AI Judge 调用 | `0` |
| 自动重试 | `0` |
| 质量重试 | `0` |
| Production 正文读取 | 当前基础批次 `0` |
| 当前授权范围 | 本地合同、公开零正文资产、Git 排除、私有目录保护和默认关闭的受控读取实现；Production 真实访问保持 `not_run` |

停止点：

1. 同意、授权或身份校验失败时停止该例；
2. 任一单例阻断时停止对应产品质量通过判断并入账；
3. 前 10 条完成后停在产品负责人检查点；
4. 累计 30 条完成后停在产品负责人最终裁决；
5. 计划外普通用户取样、外部模型处理、数据库迁移或批量 Production 导出需单独扩展范围。

## 8. 资产位置与启动门结论

- 公开回执：本目录；
- 私有正文、身份映射、授权、逐例评审与撤回账：本目录 `.private/`；
- 公开合同：`src/features/journal-evaluation/golden-set-v2-contract.ts`；
- 私有目录守卫：`scripts/journal-generation-eval/golden-set-v2-private-workspace.ts`。

启动门结论：`基础合同与安全读取门已具备；真实内容访问 not_run`。下一步先完成配置 readback 和最小样本授权核验，再进入受控管理员当前主链读取与审计批次。
