# Stage 4 第三批日记候选证据

- 文档职责：历史证据
- 文档状态：待验证
- 最后核验：`2026-08-21`
- 权威入口：[`docs/README.md`](../../../../docs/README.md)

## 当前结论

- source-main 基线：`a89d5bcc7d1d2b63741f80973a4933367193313a`；PR #48 代码合并为 `dedf0942f6e53cf1d2a1968e6084fdedeee1fdc8`，PR #49 治理收口 main 为 `8f7ae405bab81400911f4222b95d0a8c93d4e120`。
- 原 `8` 笔日记候选重放 head：`ecb674deea3498638499dd70286e2703c3355334`。
- 并发内容保护提交：`a6cb4a9`。
- 本地独立终审：`P0=0 / P1=0 / P2=1`。
- 当前状态：`source_main_complete / Preview_smoke_blocked / Production_lineage_integration_blocked`。

## 已验证范围

- 记录、日记和当天读取按响应时最新视图做字段级合并，稳定保留人工日记、事件卡和“需更新”状态。
- 事件卡与日记提交等待期锁定输入，提交快照与用户可见状态保持一致。
- 退出／删号恢复态清理、存储异常后的匿名导航、焦点恢复、同月刷新状态和第二批访谈恢复合同继续通过。
- 全量：`376` 个文件通过、`17` 个跳过；`3332` 条通过、`95` 条跳过、失败 `0`。
- 类型、Lint、Production build `77/77`、主／评测 Prisma、文档与差异检查通过。
- 修复后零模型 E2E 连续三轮均 `11/11`；每轮 `AIRequestLog=0`、Trace `12`、模型执行字段为 `0`，临时 Schema 均删除，最终残留 `0`。
- PR #48 证据 head `519cc37` 的 push run `32442390634` 与 pull request run `32442422147` 均 attempt 1 全绿；两套均为 `3332 passed / 95 skipped`、build `77/77`、Lint `0 errors / 33 warnings`，零模型 E2E 均 `11/11`、`AIRequestLog=0`、Trace `12`，临时 Schema 已删除。
- Preview `dpl_BAux5cqn6ATTqB7DsHZDSu3u6Wxt` Ready 且与 PR #48、分支和 head 完全一致。匿名保护单次返回 HTTP `302` 至 Vercel SSO；固定账号登录在应用请求前因验收脚本工作目录解析失败而停止，产品主链 smoke 记为 `blocked_before_application_request`、重试 `0`、业务写入 `0`、模型端点请求 `0`。
- final docs head `9d075f7` 的 push run `32443259149` 与 pull request run `32443261597` 均 attempt 1 全绿；PR #48 随后合入 main `dedf094`。唯一 main run `32443785474` attempt 1 全绿，零模型 E2E `11/11`、`AIRequestLog=0`、Trace `12`，临时 Schema 已删除。

## 保留边界

- 唯一 P2 是未来开放事件卡删除时的来源合并边界；当前产品没有删除或取消保存入口，详见问题台账 `PEH-041`。
- source-main 工程门已通过；Preview 产品 smoke 受验收工具配置阻断，Production 保留独立状态。
- 当前 Production 运行独立 GI-088 v1.9 deployment `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`；阶段 1 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5` 保留为回退目标。第三批未进入 Production，后续发布先完成 main 与 GI-088 Production 血缘整合，详见 `PEH-043`。
- 公开证据不包含用户正文、账号、会话标识、连接信息或凭证。

机器可读回执见 [`receipt.json`](./receipt.json)。
