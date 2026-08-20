# GI-088 v8r2 Preview 部署与 `0/12` 回读

## 为什么该批次可以交给产品负责人

Preview 的产品行为来自通过全绿静态门的不可变行为 commit；Vercel 远程 Linux 构建同时生成两套 Prisma Client，运行时存储初始化已经验收。线上回读的版本、指纹和运行配置与本地证据一致。新批次只执行零模型初始化，当前保持 `0/12`，因此真人体验证据可以从干净起点开始累计。

## 部署身份

- Commit：`5281bc53f2b04be9c31adb6d7f4710ac818883a8`
- Behavior Build ID：`cfGovtoHY1ZF9Mk6RTvZa`
- Deployment source fix commit：`0a993afad1248e67a2863456d2c35b774bb2130f`
- 主工作区同内容 commit：`483c613723693d576bd16da4fa4cf4b5795fe2e2`
- Deployment ID：`dpl_YRUQitffCQH264xiksHpLMviQZLy`
- URL：`https://xingfuxitong-iqddtq6e2-zouzhijies-projects.vercel.app`
- Target：`preview`
- State：`READY`

## 运行时打包事故与修复验收

- 受影响 deployment：`dpl_2NscP95yaRMqzHbd2X9F5X9hzBQ9`
- 受影响 URL：`https://xingfuxitong-l9c7fwtjm-zouzhijies-projects.vercel.app`
- 现象：虚构账号 `POST login` 返回 `503 AUTH_STORAGE_NOT_READY`，故障发生在 Prisma Client 初始化阶段，数据库查询尚未开始。
- 根因：本机 `--prebuilt` 产物只携带 `darwin-arm64` Prisma engine，无法在 Vercel Linux 运行时初始化。
- 修复：`vercel.json` 在应用 build 前同时执行主库与评测库的 `prisma generate`，两套 Client 均由 Vercel Linux 远程构建。
- 验收：新 deployment 使用虚构账号 `POST login` 返回 `401 INVALID_CREDENTIALS`，表明认证存储已进入正常查询路径；deployment error logs 为 `0`。
- 版本连续性：行为 commit、Execution fingerprint 和 run 身份保持不变。

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
| Execution | `96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c` |
| Behavior manifest | `e38e5798e635c8100d804de4953ae2cd3d726a38926ae8a4ea1661537dc6f222` |
| Candidate layer | `a83f235db2711c2adca02af8fac54d83d2d6559c04ac5b4d57f2b52ed5edb179` |
| Dataset layer | `775442a568152748455bb51de2d232d41d6964be7cb17ace8f1d9df5b98044ac` |
| Runner layer | `1943497a658d882aeb6682a49c2d9c90a11f6b3a1a8736f9f16c7ef8327539bb` |
| Experience layer | `b98dc88431ea5feb1a614593f2c3b996f144d6a493c156b707e26bb55ea4a744` |

## SSO 与路由配置

- 匿名页面 GET：`302`
- Cache-Control：`no-store`
- Robots：`noindex`
- `POST /start-task` maxDuration：`120s`
- `POST /turn` maxDuration：`120s`
- `POST /retry` maxDuration：`120s`

## 全新零模型批次

- Run ID：`b816d468-e3c3-4459-a822-04f95b1e78cd`
- Run ordinal：`2`
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

运行时修复后再次只读回读，run 继续保持 `ordinal=2 / revision=0 / running / 0/12 / gate=pending / tasks=12 / active=null / calls=0`，Execution fingerprint 继续为 `96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c`。

## 发布边界

- Production changed：`false`
- Production mode：`legacy + baseline`
- Production migration／部署／数据写入：`0`
- 模型探针：`0`
- 真人内容提交：`0`
- 隐藏推理持久化：`0`
- 容量超过约 200 轮的优化：`excluded`

预发布指标缺陷对应的旧 run 已行政退役；受打包事故影响的 deployment 也已退出当前入口。本页分别保留事故历史与最终当前证据。
