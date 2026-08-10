# GI-088 v8r2 历史兼容与导出验证

## 结论

历史 run 按存储 state 与对应 evaluationVersion 的不可变元数据解释。当前 v8r2 指纹只限制写入与模型调用，历史 session 和只读 export 保持可用。兼容迁移前后的 v8r1 业务 state SHA-256 完全一致。

最终验证 commit：`5281bc53f2b04be9c31adb6d7f4710ac818883a8`。

## v8r1 真实历史 run 只读回读

- Run ID：`5123d795-5c19-408d-9b98-7767eaa7892c`
- 版本：`2026-08-10.gi088-human-eval-v8r1-final12`
- collection status：`running`
- active task：`A2`
- completed trajectory：`1`
- legacy calls：`2`
- legacy call status：`valid=2`
- revision：`5`
- sealed：`false`
- 兼容迁移回填 gate：`legacy_unknown`
- v8r2 Call Ledger rows：`0`
- 业务 state SHA-256（迁移前）：`5cecacceb73e37557e142ade0ceff582772d6895acaf2e5a9d8e634f9fcbae91`
- 业务 state SHA-256（迁移后）：`5cecacceb73e37557e142ade0ceff582772d6895acaf2e5a9d8e634f9fcbae91`

## 13 版本兼容矩阵

| 版本 | 模式 | 存储任务数 | Session | Export | 写入 |
| --- | --- | ---: | --- | --- | --- |
| v1 | paired | 12 | pass | pass | read-only |
| v2 | high_only | 12 | pass | pass | read-only |
| v3 | high_only | 12 | pass | pass | read-only |
| v4 | high_only | 12 | pass | pass | read-only |
| v5 | high_only | 12 | pass | pass | read-only |
| v6 | high_only | 4 | pass | pass | read-only |
| v7 | high_only | 2 | pass | pass | read-only |
| v7r1 | high_only | 2 | pass | pass | read-only |
| v7r2 | high_only | 2 | pass | pass | read-only |
| v7r3 | high_only | 2 | pass | pass | read-only |
| v7r4 | high_only | 2 | pass | pass | read-only |
| v8 | high_only | 4 | pass | pass | read-only |
| v8r1 | high_only | 12 | pass | pass | read-only |

每个版本均断言 evaluation ID、version、serviceVersion、model、candidate／execution／dataset fingerprint、存储任务顺序、mode、activeBranches、历史只读和零 Provider 调用。

## Session 与 export 隐私边界

| 字段 | Public session | Readonly export v0.6 |
| --- | --- | --- |
| 对话与公开调用事实 | 保留 | 保留 |
| 人工评价 | 保留 | 保留 |
| `rawFinalOutput` | 固定为 `null` | 保留可见原始输出 |
| 隐藏推理正文 | 清除 | 清除 |
| Provider 安全诊断 | 脱敏后保留 | 脱敏后保留 |
| 密钥、Authorization、完整请求正文 | 清除 | 清除 |

历史 running run 的 gate 直接读取存储 `gateStatus/gateReasons`，保持历史门的原始含义。

## 验证命令

```bash
npx vitest run tests/unit/gi088-foundation-service.test.ts
```

历史矩阵回归与当前 Foundation Service 合计 `28/28 passed`。该命令使用 Memory Store 与 fake Provider；历史矩阵中的 Provider factory 和 Provider `complete` 均为 `0` 次。
