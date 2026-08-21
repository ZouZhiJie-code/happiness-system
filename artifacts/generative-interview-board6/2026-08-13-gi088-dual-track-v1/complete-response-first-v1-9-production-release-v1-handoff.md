# GI-088 v1.9 Production 发布工具交接

- 文档职责：当前执行交接
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 当前结论

v1.9 发布状态机已完成本地实现和工程验证。产品负责人依据四轮 Preview 原文全部裁决 `pass`，当前按固定顺序执行候选部署、候选可见回应与后台 Trace 验证；候选语义裁决通过后进入正式切流和线上回归。

最终启动卡计划指纹为 `1edd95dfa7be436f241bdbd576b2b6f316e7d9bee494f28f4028b18c9515fd4f`，当前状态为 `product_owner_preview_pass_ready_for_candidate_deploy`。

## 已确认事实

- 发布工具专项 `11/11`、v1.9 相关测试 `101/101`、全量 `460` 个测试文件／`3694` 条测试通过；`2` 个文件／`10` 条测试按既定条件跳过。
- TypeScript、Lint、两套 Prisma 和 Production build 通过；Lint 为 `0` error／`45` 条既有 warning，build 保留 `16` 条既有动态文件系统 warning。
- 产品裁决缺失时，真实候选部署命令在读取部署凭据和网络写操作前返回 `GI088_V19_RELEASE_PRODUCT_REVIEW_REQUIRED`。
- 当前正式域名为 `https://dailylight.chat`，继续指向部署 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`；策略继续为 `event_centered + baseline`。
- Production 数据库备份 SHA-256 为 `02f4c070714ecee041421540696330aa0aedc83ebeb07ddaa769c64b37c49260`，恢复清单已验证。

## 当前门禁

1. 四轮 Preview 产品裁决必须为 `pass`，并绑定实际输入、输出和证据哈希。
2. 候选部署使用 `--skip-domain`，先保持正式域名不变。
3. 候选冒烟必须同时通过可见回应、后台事实 Trace、临时账号精确清理和产品语义裁决。
4. 正式切流后的最小线上回归失败时，工具恢复 `baseline` 并回退到冻结部署。

## 证据

- [执行计划](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-9-production-release-runner.md)
- [公开回执](./complete-response-first-v1-9-production-release-v1-receipt.json)
- [阶段账](./complete-response-first-v1-9-production-release-stage-ledger-v1.json)
- 私有状态、产品裁决和冒烟正文保存在 Git 排除目录，目录权限 `0700`、文件权限 `0600`。

## 下一停止点

候选部署和后台 Trace 验证完成后，交付候选冒烟的实际用户输入和 AI 输出；正式域名切换以候选产品裁决和后台 Trace 同时通过为前提。
