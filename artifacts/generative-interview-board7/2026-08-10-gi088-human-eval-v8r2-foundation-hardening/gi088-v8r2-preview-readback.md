# GI-088 v8r2 Preview 部署与 `0/12` 回读

## 为什么该批次可以交给产品负责人

Preview 的产品行为来自通过全绿静态门的不可变行为 commit；Vercel 远程 Linux 构建同时生成两套 Prisma Client，运行时存储初始化已经验收。线上回读的版本、指纹和运行配置与本地证据一致。新批次只执行零模型初始化，当前保持 `0/12`，因此真人体验证据可以从干净起点开始累计。

## 部署身份

- Commit：`e01c9ed5fa0334d8d717dbed2643791f1045e04d`
- Deployment ID：`dpl_GG4qs4PFLXzCmHRZvopTmsajroUc`
- URL：`https://xingfuxitong-ov2vk47wq-zouzhijies-projects.vercel.app`
- Target：`preview`
- State：`READY`

## 运行时打包事故与修复验收

- 受影响 deployment：`dpl_2NscP95yaRMqzHbd2X9F5X9hzBQ9`
- 受影响 URL：`https://xingfuxitong-l9c7fwtjm-zouzhijies-projects.vercel.app`
- 现象：虚构账号 `POST login` 返回 `503 AUTH_STORAGE_NOT_READY`，故障发生在 Prisma Client 初始化阶段，数据库查询尚未开始。
- 根因：本机 `--prebuilt` 产物只携带 `darwin-arm64` Prisma engine，无法在 Vercel Linux 运行时初始化。
- 修复：`vercel.json` 在应用 build 前同时执行主库与评测库的 `prisma generate`，两套 Client 均由 Vercel Linux 远程构建。
- 验收：新 deployment 使用虚构账号 `POST login` 返回 `401 INVALID_CREDENTIALS`，表明认证存储已进入正常查询路径；deployment error logs 为 `0`。
- 版本连续性：后续事务分区修复改变 Runner／Experience 与 Execution fingerprint，因此该运行时打包修复部署进入历史证据。

## 事务锁默认分区事故与修复验收

- 受影响 deployment：`dpl_YRUQitffCQH264xiksHpLMviQZLy`
- 受影响 run：`b816d468-e3c3-4459-a822-04f95b1e78cd`
- 现象：产品负责人点击【开始 Thinking high 评测】后返回 `GI088_INTERNAL_ERROR`。
- 根因：run 行锁使用未限定分区的原生 SQL；运行连接将其解析到 PostgreSQL 默认分区，因而找不到位于 `gi088_evaluation_v0` 的评测表。
- 调用边界：错误发生在 Provider dispatch 前，受影响 run 保持 `0/12 / calls=0 / active=null`。
- 修复：事务锁验证评测分区标识并使用分区限定表名；真实集成测试主动保持默认分区与评测分区不同。
- 验收：真实 PostgreSQL `3/3`、线上认证 session 回读、零模型新 run 回读均通过；新 deployment error logs 为 `0`。

## 真人批次模型调用授权

- 受影响 deployment：`dpl_5wqmDbg7ZMyf8zmaRgvXSh5N1Aa3`
- 现象：产品负责人点击【开始 Thinking high 评测】后返回 `GI088_MODEL_CALL_AUTHORIZATION_REQUIRED`。
- 根因：当前 Execution fingerprint 已完成精确授权，分支仍继承 Preview 的安全默认值 `GI088_MODEL_CALL_SCOPE=disabled`。
- 修复：仅对 `codex/gi088-v8r2-schema-lock-fix` Preview 分支设置 `GI088_MODEL_CALL_SCOPE=batch`，保持精确 Execution fingerprint 不变，并重新远程构建部署。
- 验收：分支有效环境回读同时满足 `scope=batch`、当前 Execution fingerprint 与评测开关；校验过程的模型请求、真人内容提交和 Call Ledger 创建均为 `0`。

## 线上版本与指纹

| 回读项 | 线上值 |
| --- | --- |
| Evaluation | `2026-08-10.gi088-human-eval-v8r2-foundation-hardening` |
| Service | `2026-08-10.gi088-evaluation-foundation-service-v8r2` |
| Model | `deepseek-v4-pro` |
| Thinking | `enabled / high` |
| Response format | `json_object` |
| Max tokens | `provider_default` |
| Effective candidate | `0d5f91c0142df15035cd665a4a782f5207c4df48ef242e072452653c77b2efd6` |
| Dataset | `191f648089ef6749024425ead17903995b307f1936cc6fc2ccef1aaaac7625cf` |
| Execution | `55c0c9b0ef31f46bf638c3a90fd6323c1ef7ad83a14d367d4e2e2fe3cc34b34e` |
| Behavior manifest | `68321bf7329020761cd804bbdaffdb3f7fcc76c8cf5141510474112f9962cf44` |
| Candidate layer | `a83f235db2711c2adca02af8fac54d83d2d6559c04ac5b4d57f2b52ed5edb179` |
| Dataset layer | `775442a568152748455bb51de2d232d41d6964be7cb17ace8f1d9df5b98044ac` |
| Runner layer | `f14f6fd04d33521e7fddcca0e97b4c2a71d425693140558d2a7771a41f51bea5` |
| Experience layer | `17c42be27cf31f38606bb076594dbd3578a8f7c699daf53c375e762053686636` |

## SSO 与路由配置

- 匿名页面 GET：`302`
- Cache-Control：`no-store`
- Robots：`noindex`
- `POST /start-task` maxDuration：`120s`
- `POST /turn` maxDuration：`120s`
- `POST /retry` maxDuration：`120s`

## 全新零模型批次

- Run ID：`ce893fe6-e9e2-4445-9153-deca3b1571ce`
- Run ordinal：`3`
- Revision：`0`
- Collection status：`running`
- Completed：`0/12`
- Gate：`pending`
- Mode：`high_only`
- Active branches：`high`
- Active task：`null`
- Provider calls：`0`
- Target coverage：`reviewed=0 / total=12`
- `unreviewedTrajectoryCount`：`0`
- 无有效分母的比率：`null`，页面显示 `N/A`

初始化脚本验证了 Preview 数据库身份与预期身份；Provider 实例化、模型授权和 Call Ledger 创建均为 `0`。

线上认证 session 再次只读回读，run 保持 `ordinal=3 / revision=0 / running / 0/12 / gate=pending / tasks=12 / active=null / calls=0`，Execution fingerprint 为 `55c0c9b0ef31f46bf638c3a90fd6323c1ef7ad83a14d367d4e2e2fe3cc34b34e`。临时只读验收 session 已立即删除，残留为 `0`。

## 发布边界

- Production changed：`false`
- Production mode：`legacy + baseline`
- Production migration／部署／数据写入：`0`
- 模型探针：`0`
- 真人内容提交：`0`
- 隐藏推理持久化：`0`
- 容量超过约 200 轮的优化：`excluded`

预发布指标缺陷、运行时打包事故和事务分区事故对应的旧 run／deployment 均已退出当前入口。本页分别保留事故历史与最终当前证据。
