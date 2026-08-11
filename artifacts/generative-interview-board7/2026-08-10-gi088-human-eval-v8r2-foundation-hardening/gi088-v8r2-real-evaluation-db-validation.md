# GI-088 v8r2 真实评测库验证

## 为什么需要真实事务验证

Memory Store 可以证明业务合同，真实 PostgreSQL 事务才能验证唯一约束、条件更新、恢复血缘、不可变导出和清理顺序。最终版本在独立 Preview 测试 schema 上完成 3 项真实事务用例，全部通过，清理后残留为 `0`。

## Migration 回读

| 顺序 | Migration | 状态 |
| --- | --- | --- |
| 1 | `20260808000000_init` | applied |
| 2 | `20260808010000_add_technical_smoke_and_retention_audit` | applied |
| 3 | `20260808020000_add_provider_diagnostics` | applied |
| 4 | `20260810180000_add_v8r2_foundation_hardening` | applied |

结果：`4/4 applied`。

## 3 项真实事务用例

| 用例 | 验证内容 | 结果 | 耗时 |
| --- | --- | --- | --- |
| 1 | 并发 run、调用领取、恢复血缘、幂等证据与不可变导出 | pass | 48.170s |
| 2 | 零 dispatch 的 reserved 回收调用可作为连续恢复父调用 | pass | 12.659s |
| 3 | 用户主动人工恢复可承接 `interrupted_unknown_dispatch` 调用 | pass | 14.273s |

汇总：`3/3 passed`；`0 failed`；清理后 residue `0`。

## 覆盖范围

- 并发创建 run 与 run ordinal 唯一性。
- 操作幂等、同操作号 payload 冲突与原结果回放。
- Turn、Operation 与 Call Ledger 的同事务预约。
- `reserved → dispatched` 唯一领取。
- Provider 结果落账、finalizer 重入与 CAS 冲突恢复。
- 自动／人工恢复父调用、触发原因和实际配置血缘。
- 程序介入、人工评价修订与 gate 重算。
- 不可变 export snapshot 的首次冻结和重复下载。
- 事务失败回滚、清理顺序和跨表残留检查。

## 数据库隔离

- 环境限定：`VERCEL_ENV=preview`。
- 测试 schema 使用强制的隔离命名规则和显式身份确认。
- 测试 URL 与共享评测库 URL 分离。
- 测试连接主动移除 `search_path` 覆盖，使 `current_schema()` 保持默认分区；事务锁仍显式访问隔离评测分区。
- 正式证据排除 Host、database、schema 与连接凭据。
- Production 数据写入：`0`。

## 验证命令

Migration 状态由私有评测 Prisma schema 的只读 status 回读获得。3 项真实事务用例使用同一集成测试命令：

```bash
GI088_FOUNDATION_PRISMA_INTEGRATION=I_UNDERSTAND \
  npx vitest run tests/integration/gi088-foundation-prisma-store.test.ts
```

隔离数据库身份变量由执行环境注入，仓库证据只保留脱敏结论。
