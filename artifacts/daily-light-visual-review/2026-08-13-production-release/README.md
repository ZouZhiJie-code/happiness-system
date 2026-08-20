# Daily Light 第二轮验收基线 Production 发布证据

日期：`2026-08-13`

状态：`Production 已发布并通过正式域名、数据库、匿名保护与登录态只读主链验收`

## 发布结果

- 正式域名：`https://dailylight.chat`
- Production deployment：`dpl_3ChuumbtWFLLhWogNrCVrFwCu1M2`
- 运行模式：`event_centered + baseline`
- 上一正式 deployment：`dpl_ATtwPhXLvmHURAutRzKyimNSWyir`
- 回退入口：`legacy + baseline`

## 数据库

正式库应用以下五条保留式迁移：

1. `20260810180000_add_journal_daily_generation_system`
2. `20260811100000_add_journal_period_reports`
3. `20260812140000_add_event_centered_session_sidebar`
4. `20260812150000_allow_two_event_centered_roots`
5. `20260812151000_allow_message_sourced_event_cards`

迁移完成后复核 `45` 条迁移，数据库状态为最新。正式库已有的两条历史迁移文件从原始提交恢复到工作区，迁移血缘保持一致。

## 发布中发现的问题

首次 deployment `dpl_2UYkgmx7sTuDwSyYjbybo1B6vDmY` 构建完成后，匿名访问私有接口返回通用错误。确认原因为 Next.js `16.3.0` 生产优化下认证函数的空值保护被错误消除。

处理结果：补充明确返回类型和认证 Cookie 前置保护，完成本地 Production 构建与无缓存 Vercel 重建。最终 deployment 的匿名私有接口稳定返回 `401 AUTHENTICATION_REQUIRED`。

## 线上复验

- `/`、`/interview`、`/calendar`、`/insights`：`HTTP 200`
- 匿名 `/api/auth/session`：`HTTP 200`，`authenticated=false`
- 匿名会话、日记、趋势接口：`HTTP 401`
- 登录态会话列表、今日日记、日归档、周记、趋势、画像：`HTTP 200`
- 登录态 `/interview`：显示【新建记录】，旧五维入口未出现
- 临时只读验收会话在检查后删除；未创建记录、未调用模型、未修改用户内容

## 自动验证

- 认证与核心接口专项：`14/14`
- 类型检查：通过
- 本地 Next.js Production 构建：通过
- Vercel 无缓存构建：通过，deployment `READY`
- Prisma migration status：最新
- ESLint：`0 error`，保留 `44` 条历史 warning
- Production 运行依赖审计：`0 vulnerabilities`
- 差异格式检查：通过
- 全量测试出现一次 GI-088 评测工作台轮询计时抖动；独立复跑 `15/15` 通过。该评测页面与 Production 用户主链隔离。

## 停止点

Production 发布完成后进入观察期。生成式访谈策略、GI-088、语义标题生成、模型质量专项和旧链路清理继续使用独立授权门。
