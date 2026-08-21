# GI-088｜完整回应优先 v1.9 Production 发布工具

- 文档职责：当前专项
- 文档状态：待验证
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 1. 为什么做这一步

v1.9 隔离 Preview 四轮连续链已经形成产品验收材料，Codex 初评 `4/4 pass`。当前发布准备已经具备 Production 快照、数据库备份和回退目标，但发布动作仍依赖人工串联多条命令。人工串联容易漏掉产品裁决、后台任务回读、临时验收数据清理或回退顺序。

本专项把已确认的发布路径固化为一个可审计工具。工具先验证产品负责人对四轮原文的裁决和证据绑定，再允许创建不接管正式域名的 Production 候选部署。候选必须通过一条真实可见回应、后台事实任务和数据库 Trace 回读，才允许切换正式域名。

## 2. 当前事实与产品边界

| 类别 | 当前结论 |
|---|---|
| 已确认事实 | v1.9 隔离 Preview 四轮 Codex `4/4 pass`；中位 `10633.5ms`、最大 `11505ms`；产品裁决 pending |
| 已确认事实 | 当前 Production 为 `event_centered + baseline`，部署 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` |
| 已确认事实 | Production 数据库备份及 `pg_restore --list` 已通过，回退目标已冻结 |
| 产品判断 | 四轮产品裁决通过后，可以进入 Production 候选部署；正式域名切换前必须验证可见回应和后台任务 |
| Codex 评估 | 发布风险集中在遗漏门禁和后台状态不可见；使用单一状态机可以把验收、切流、清理和回退顺序固定下来 |
| 待验证假设 | 新候选部署能在 Production 数据库上完成一条可见回应和一次后台事实写入，并保持 v1.9 的语义质量 |

## 3. 工具范围

发布工具提供六个阶段：

1. `inspect`：只读核对分支、提交、Preview 证据、产品裁决、Production 快照、数据库备份和回退目标。
2. `deploy-candidate`：把 Production 策略设为 `complete_response_v1_9`，使用 `--skip-domain` 创建候选部署，并等待 Ready。
3. `smoke`：直连候选部署创建一个精确标识的临时验收账号，完成一条可见回应，随后从 Production 数据库回读后台事实 Trace。
4. `promote`：要求产品四轮裁决通过、候选冒烟通过、后台 Trace 通过、候选冒烟语义裁决通过，再切换正式域名。
5. `online-regression`：在正式域名完成最小真实回归，核对别名、可见回应和后台任务。
6. `rollback`：恢复 `baseline`，回退到冻结部署，并重新回读策略和正式域名。

工具对每个会改变外部状态的阶段使用独占锁和调用前写账。公开证据只保存状态、哈希、耗时和数量；用户输入、AI 输出、数据库连接和临时账号信息保存在 Git 排除的私有目录，权限为 `0600`。临时验收账号按精确用户 ID 清理并回读确认。

## 4. 硬门与停止点

- 产品负责人裁决文件必须为 `pass`，并绑定四轮 Preview 的输入、输出和证据哈希；缺失或漂移时在读取部署凭据和执行网络写操作前停止。
- `deploy-candidate` 只创建不接管正式域名的 Production 目标部署。
- `smoke` 必须同时满足：HTTP 与会话有效、AI 可见回应完整、后台 Trace `completed`、来源有效、一次成功调用、重试为零、结果已应用。
- 候选冒烟语义裁决必须为 `pass`，并绑定本次输入与实际 AI 输出哈希。
- 任一门失败时保持正式域名指向原部署；已修改策略时自动执行恢复 `baseline`。
- `promote` 后线上回归失败时执行 `baseline` 恢复和冻结部署回退。
- 当前停止点：发布工具实现与本地验证可以连续执行；产品负责人四轮裁决通过前，Production 环境、部署、域名和数据库保持现状。

## 5. 验证

- 单元测试覆盖产品裁决缺失、证据漂移、阶段越级、候选部署失败、后台 Trace 未完成、私有正文脱敏、精确账号清理、域名切换和回退命令。
- 测试使用临时目录和伪造执行器，禁止访问 Vercel、数据库和 Production。
- 完成定向测试、类型检查、Lint、Production build、两套 Prisma、`docs:check` 与 `git diff --check`。
- 工具和证据完成后形成独立提交并推送当前分支；产品裁决通过后可直接执行真实发布。

## 6. 当前实施结果

- 发布工具、独占锁、私有状态账、公开脱敏回执和九个命令入口已经实现。
- 发布工具专项测试 `11/11`、v1.9 相关测试 `101/101`、全量 `460` 个测试文件／`3694` 条测试通过；另有 `2` 个文件／`10` 条测试按既定条件跳过。
- TypeScript、Lint、两套 Prisma、Production build、`docs:check` 与差异格式检查通过。Lint 为 `0` error／`45` 条既有 warning，build 保留 `16` 条既有动态文件系统 warning。
- 缺少产品裁决时，真实 `deploy-candidate` 命令在读取部署凭据和执行网络写操作前以 `GI088_V19_RELEASE_PRODUCT_REVIEW_REQUIRED` 停止。
- 当前 Production 继续使用 `event_centered + baseline`，正式域名仍指向部署 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。
- 当前停止点为产品负责人四轮 Preview 原文裁决。裁决通过后，依次执行候选部署、候选可见回应与后台 Trace 验证、候选语义裁决、正式切流和线上回归。
