# GI-088 v8r3r2 板块 8 Preview 回读

状态：`通过；Preview READY，running 0/6，calls 0，等待产品负责人真人 4＋2`

最后回读：`2026-08-12`

## 部署身份

- 冻结行为提交：`1e029152ee826be963e67cee2fbf9b3844cf7c33`
- 分支：`codex/gi088-v8r3r2-empty-content-recovery-2`
- Deployment：`dpl_9QNR6fEgyEdCCm2FQiy8nCAWCAk1`
- Preview URL：`https://xingfuxitong-7770e4vp2-zouzhijies-projects.vercel.app/preview/gi088-evaluation`
- Vercel 状态：`READY`
- Target：`preview`
- 构建：Vercel Linux 远程构建；主 Prisma 与评测 Prisma Client 均在远端生成

Deployment 的 Git ref 与 Git SHA 均和上述冻结身份一致。发布命令未使用本地预构建产物，也未包含 Production 参数。

## 数据库与迁移

- 四条数据库连接通过 Preview 身份门；应用与评测使用同一专属 Preview 物理库。
- 应用 schema：`gi088_app_preview`
- 评测 schema：`gi088_evaluation_v0`
- 应用迁移：`39/39`，status 为 up to date。
- 评测迁移：`4/4`，status 为 up to date。

迁移前完成环境、Host、物理库和双 schema 核验。Production 数据库与 Production schema 均未进入本轮操作范围。

## 零模型初始化与认证回读

- Run ID：`e96aa8eb-76bd-4dcd-8e2d-c40ca70a4b6f`
- Run ordinal：`1`
- 状态：`running`
- Gate：`pending`
- 进度：`0/6`
- 活动任务：`null`
- 任务构成：`4` 条 `scored_trajectory`＋`2` 条 `compatibility_smoke`
- Provider calls：`0`
- 调用账本：空

零模型初始化器在 Provider 创建或授权回调被触发时会立即失败；本次初始化成功，因此 `calls 0` 同时由初始化硬门和认证 Public Session 回读共同证明。认证回读的 `/api/auth/session`、runs、Public Session 和工作台页面均返回成功；Vercel Deployment Protection 继续作为第一层访问保护。

## 运行配置与行为身份

- 模型：Ark `deepseek-v4-flash-ga-260731`
- Thinking：`enabled`
- Reasoning：`high`
- 输出：`json_object`
- 超时：Header／正文空闲／单次硬截止／共享恢复链为 `60/60/60/90s`
- EMPTY_CONTENT：最多自动恢复 `2` 次；单轮最多 `3` 次 Provider 调用
- Skill：`2026-08-11.gi088-interview-skill-v8r3`
- Skill SHA：`a1b13e4f451a40850bd1122f5b873cce3eb9496c62ef6d42c4b8b28d0ab20494`
- 行为清单 SHA：`afd3f90b3c345e42310468665fed0c98f01ed036f5d421aa4d91e0ba305bad30`
- Candidate：`9643a02914923281f86fcd72c2224a313ffdca0ab67abdb5bc36ad192abb98e3`
- Dataset：`258a4b47ec4eb36393bcf37191fe5088ce699fc0abec5a6d7ccbc8e4b8f5a027`
- Runner：`17148c384524f2b141f7a8091a21185c51ae6c297d1e9a659eb302b972e03d92`
- Experience：`f755b278f721fbc08860c23743af7be8b99c0131b7f98f103d25a33166bb2505`
- Execution：`c0d5245addd37063d265fb3839fe49c518096cf387f76170ef6b5d5a8b874c96`
- 隐藏推理持久化：`forbidden`

## 停止点

板块 7 已正式封存，板块 8 的可用私有 Preview 已停在全新 `0/6` 起点。真人内容由产品负责人提交；Judge 20＋20 保持后置，Production 继续保持 `legacy + baseline`。本轮模型探针、真人内容代提交和 Production 变更均为 `0`。
