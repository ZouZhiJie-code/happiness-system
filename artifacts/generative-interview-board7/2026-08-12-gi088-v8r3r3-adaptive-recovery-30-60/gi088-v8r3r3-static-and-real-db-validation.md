# GI-088 v8r3r3｜静态门与真实隔离库验证

最后更新：`2026-08-12`

## 冻结提交

- 分支：`codex/gi088-v8r3r3-adaptive-recovery-30-60`
- 实现提交：`ee665383b12e98c8863fc119f37714efaad5c5ff`
- 冻结后工作树：干净
- 行为清单：`114` 个运行文件，`--require-tracked` 通过

## 工程门

| 门 | 结果 |
|---|---|
| GI-088 重点测试 | `131/131` 通过 |
| 离线执行器专项 | `26/26` 通过 |
| Foundation service | `43/43` 通过 |
| Foundation store | `13/13` 通过 |
| 工作台 | `22/22` 通过 |
| 全量测试 | `330` 文件通过、`2` 条件跳过；`3078` 测试通过、`11` 跳过 |
| TypeScript | 通过 |
| 全量 lint | `0 errors`；仓库既有 `49 warnings` |
| GI-088 目标 lint | `0 warnings` |
| 主 Prisma validate / generate | 通过 |
| 评测 Prisma validate / generate | 通过 |
| Production 配置构建 | 通过；仅验证构建产物，未部署 Production |
| 差异格式 | 通过 |

## 真实隔离评测库

- 环境：Preview 身份的非池化评测库连接；正式评测 schema 未写入测试数据；
- 临时 schema：`gi088_foundation_v8r2_test_v8r3r3_8196fafe69`；
- 迁移：`4/4` 应用成功；
- 用例：`4/4` 通过，总耗时 `110.92s`；
- 新增事务覆盖：并行恢复只确认一个赢家、迟到结果原子失效、重复确认幂等、单份用户／AI 消息语义；
- 并发过程中实际出现一次 PostgreSQL `40001`，Store 事务重试后用例通过，证明冲突路径可恢复；
- 结束后精确删除临时 schema，`pg_namespace` 残留 `0`。

## 安全与发布边界

- 真实模型调用仅发生在随后冻结的 96-checkpoint 离线评测；数据库事务测试模型调用 `0`；
- 评测报告与盲评正文留在 Git 排除的 `0600` 私有目录；
- 未运行 Judge、模型探针或真人内容代提交；
- v8r3r3 因正式可靠性门失败，未部署 Preview、未迁移正式 schema、未初始化新 run；
- Production 保持 `legacy + baseline`。
