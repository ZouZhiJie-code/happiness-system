# GI-088 v8r3r2 工程与数据门

状态：`通过；冻结行为提交 1e029152 已完成 Preview READY 与 0/6 零调用回读`

本文件只记录冻结提交上的可复现验证结果。模型调用、Judge、真人内容提交和 Production 部署均保持关闭。

## 人工与交互门

- EMPTY 恢复裁决：`10/10` 已封存，准入通过。
- 本机裁决接口、草稿恢复、不可变收据和响应式工作台专项：`11/11` 通过。
- 浏览器：`1440×900` 对话区 `667px`；`1512×827` 为 `594px`；`1024×768` 为 `535px`；`390×844` 与 200% 等效视口无横向滚动，主动作可达。

## 零模型与工程门

- EMPTY 裁决、Golden 8、恢复幂等、单焦点、问题价值、v0.6／v0.7 导出、隐私清洗和零模型初始化等受影响回归：`218 passed / 6 historical skipped`。
- 工作台异步与导出回归：连续 `3` 轮均为 `22/22`。
- 全量测试：`326` 个测试文件通过、`2` 个文件按显式集成门跳过；`3057 passed / 10 skipped`。
- TypeScript：通过。
- 全量 ESLint：`0 errors`，保留仓库既有 `45 warnings`；GI-088 与本机裁决工具目标范围为 `0 warnings`。
- Production 配置构建：通过，静态页面 `70/70` 生成完成。
- 主 Prisma 与评测 Prisma：validate／generate 全部通过。
- 主行为清单：`--require-tracked` 通过，运行文件 `113` 个。
- `git diff --check`：通过。

## 真实 Preview 隔离数据库

为使历史 `pgvector` 迁移在完全隔离的环境中从零安装，本轮在同一 Preview 集群创建一个随机临时数据库；应用链使用该数据库内的 `gi088_app_preview`，评测链使用独立随机 schema。测试完成后删除整个临时数据库，隔离强度高于共享物理库内的单 schema 测试。

- 应用迁移：`39/39` 通过。
- 【帮我记】capture 产品链：`1/1` 通过，覆盖同日两种模式隔离、连续记录、零 Provider 回应、日志编辑、保存和重开。
- 评测迁移：`4/4` 通过。
- GI-088 Foundation：`3/3` 通过，覆盖并发 run、调用领取、恢复血缘、幂等证据与不可变导出。
- 清理：随机临时数据库残留 `0`，其中应用与评测 schema 残留 `0`；正式 Preview schema 未被测试写入。

## 运行行为身份复核

- Candidate：`9643a02914923281f86fcd72c2224a313ffdca0ab67abdb5bc36ad192abb98e3`
- Dataset：`258a4b47ec4eb36393bcf37191fe5088ce699fc0abec5a6d7ccbc8e4b8f5a027`
- Runner：`17148c384524f2b141f7a8091a21185c51ae6c297d1e9a659eb302b972e03d92`
- Experience：`f755b278f721fbc08860c23743af7be8b99c0131b7f98f103d25a33166bb2505`
- Execution：`c0d5245addd37063d265fb3839fe49c518096cf387f76170ef6b5d5a8b874c96`

本机裁决台、公开证据和文档位于运行行为清单外，上述五层指纹与人工评审前完全一致。

冻结行为提交为 `1e029152ee826be963e67cee2fbf9b3844cf7c33`。最终部署和零调用批次身份见[板块 8 Preview 回读](./gi088-v8r3r2-preview-readback.md)。
