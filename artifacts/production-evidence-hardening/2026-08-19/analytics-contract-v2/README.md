# Daily Light 管理分析合同 v2 Preview／数据库／CI 证据

- 文档职责：证据索引
- 文档状态：已完成
- 最后核验：`2026-08-20`
- 权威入口：[`DL-PROD-20260819`](../../../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)
- 公开数据边界：零用户正文、零用户身份、零凭证

## 1. 结论

阶段 1 已完成发布前的三层验证：远程 CI 全绿、Preview 行为验收通过、受控日期范围的独立只读数据库统计完成。当前结论为 `Preview Ready / Production 待发布`；正式产品继续运行 `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`，本证据不改变 Production 状态。

本轮保留两条清晰边界：

- 漏斗六步已经完成 Preview API 与独立 SQL 逐项对账，六项差异均为 `0`。
- 留存与质量区保存本轮独立 SQL 统计；后续 Preview API 再读受到 deployment protection／TLS 路径阻断，因此不声明本轮重新完成了留存与质量的 API 逐字段回读。既有 Preview API smoke 及页面验收结论继续有效。

机器可读回执见 [`receipt.json`](./receipt.json)。

## 2. 版本与发布身份

| 项目 | 身份 |
|---|---|
| 数据合同实现 | `7bbe285d10403130f7b596f1109f1313fab006a6` |
| 发布验证头 | `51925b61406f9feddad31008be46bb6b35f4a10d` |
| Pull Request | [#40](https://github.com/ZouZhiJie-code/happiness-system/pull/40) |
| Preview deployment | `dpl_DExPivo5Qqfk97kH9jVahU8yWQ8A` |
| Production 状态 | 待发布 |
| 发布后回退目标 | `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2` |

## 3. 远程 CI

GitHub Actions run [`32331657275`](https://github.com/ZouZhiJie-code/happiness-system/actions/runs/32331657275) 在发布验证头上完成并返回 `success`：

- 类型检查、全量测试、构建和 Lint 全部通过；
- 测试文件 `359 passed / 16 skipped / 0 failed`；
- 测试用例 `3205 passed / 82 skipped / 0 failed`；
- Lint 为 `0 errors / 44 warnings`，这些 warning 保留在阶段 1 的历史源码范围，后续主链重构批次单独收口。

## 4. Preview 行为验收

Preview 已覆盖以下用户与页面状态：

- 管理员：后台页面和分析接口可访问，默认展示事件中心六步主链，旧五维进入独立历史区；
- 匿名用户：管理接口返回 `401 AUTHENTICATION_REQUIRED`，后台正文不展示；
- 普通用户：管理接口返回 `403 ADMIN_FORBIDDEN`；
- 空状态：未来日期范围返回六步全零，旧链兼容区仍存在；
- 错误状态：反向日期范围返回 `400 INVALID_ADMIN_ANALYTICS_RANGE`；
- 质量区：fallback、异常退出、恢复、首段可见耗时、完整交互耗时和日记需更新口径均可展示。

受控对账范围为 `2026-07-22..2026-08-20`，记录归属时区为 `Asia/Shanghai`。

## 5. 六步漏斗对账

| 顺序 | 当前产品步骤 | Preview API | 独立 SQL | 差异 |
|---:|---|---:|---:|---:|
| 1 | 打开当天 `openedDay` | 6 | 6 | 0 |
| 2 | 首次提交内容 `firstContentSubmitted` | 5 | 5 | 0 |
| 3 | 获得完整回应 `completeResponseReceived` | 5 | 5 | 0 |
| 4 | 保存事件卡 `eventCardSaved` | 1 | 1 | 0 |
| 5 | 生成今日日记 `dailyJournalGenerated` | 1 | 1 | 0 |
| 6 | 保存今日日记 `dailyJournalSaved` | 1 | 1 | 0 |

## 6. 留存与质量只读统计

独立 SQL 统计结果：

- 留存 cohort 用户 `2`；D1／D7／D30 eligible 分别为 `2 / 2 / 0`；再次形成有效记录的比率分别为 `0.5 / 0.5 / 0`；D7／D30 重复保存比率均为 `0`。
- 完整回应 `26`，fallback `0`；开始会话 `17`，异常退出 `0`；恢复开始／完成／失败为 `0 / 0 / 0`。
- 首段可见耗时 P50／P95 为 `1085ms / 2512ms`；完整交互耗时 P50／P95 为 `2119ms / 3653ms`。
- 已存在日记 `3` 条，其中来源签名落后 `1` 条，`staleRate=1/3`。

这些数值承担本轮独立数据库统计证据。留存与质量接口的合同形状、管理员权限、页面展示和错误处理已经在既有 Preview smoke 中通过；本轮后续 API 再读阻断不扩大为新的逐字段一致性结论。

## 7. 数据保护与停止点

- 数据库事务确认 `transaction_read_only=on`；
- 用户正文读取 `0`，用户业务写入 `0`；
- 临时秘密文件残留 `0`；
- Production 发布、正式域名回验和线上观察继续保持待执行；
- 若 Production 发布后出现漏斗、权限或页面加载回归，回退到 `dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`。
