# Daily Light 上线前字体与色阶增强证据

日期：`2026-08-13`

状态：`产品负责人真人验收未通过；候选已否决并退出目标版本；仅保留历史证据`

## 1. 结果

- 页面标题、工作台正文、归档、状态和操作文字整体放大；对话气泡与输入框统一为 `17px / 28px`。
- 主按钮、主要记录方式与发送按钮使用 `#BD8C6B` 浅暖棕表面和深色文字，保留清楚主次并降低沉重感。
- `1440×900` 与 `1024×768` 覆盖首页、记录选择、记录对话、日记、周记、月记和趋势页，共 `14` 张截图。
- 七个关键页面以 `512×384` CSS 视口模拟 200% 缩放，横向溢出均为 `0px`。
- 「认识自己」分段导航通过键盘 `End` 跳到【记忆】并保留焦点。

## 2. 截图

每个页面均提供 `1440×900` 与 `1024×768`：

- `home-*`
- `interview-start-*`
- `interview-chat-*`
- `day-*`
- `week-*`
- `month-*`
- `insights-trends-*`

## 3. 功能 Preview

- deployment：`dpl_kJMqxU6DtdcawXbzGgy8CTnJ2gDU`
- 地址：<https://xingfuxitong-cnxn510m1-zouzhijies-projects.vercel.app>
- 状态：`READY`
- 数据环境：既有 Daily Light 隔离测试数据库
- 访谈模式：`event_centered + baseline`
- 访问边界：Vercel Deployment Protection；项目成员登录后可访问

远程路由冒烟覆盖首页、登录、注册、协议、隐私、认证状态、记录、日记和认识自己，均返回 `200`。

真实隔离闭环使用新验收账号完成：

1. 登录并创建【帮我记】记录；
2. 原话可靠保存，服务返回“好，这段已经记下了。”；
3. 完成记录，形成已保存记录卡；
4. 当日日记读取到 `1` 条真实来源；
5. 生成今日日记，状态进入草稿；
6. 保存今日日记，`contentRevision=1`、`savedRevision=1`；
7. 周记与月记均读取到 `1` 份真实素材；
8. 趋势回读为 `1` 个记录日、`1` 条完成记录、`1` 篇日记。

## 4. 自动验证

- 全量测试：`370` 个文件、`3248` 项通过；`10` 项按既定环境条件跳过。
- 类型检查：通过。
- Prisma 主库结构校验：通过。
- 目标范围 ESLint：`0` error、`0` warning。
- 本地 Next.js Turbopack production build：通过。
- Vercel Linux 源码构建：通过。
- 差异格式检查：通过。

Impeccable 确定性扫描识别到 `globals.css` 既有历史色值与圆角债务；本轮新增色阶已写入 `DESIGN.md`，本轮业务组件未新增扫描级漂移。历史债务继续留在全站设计治理范围，当前隔离功能 Preview 验收不扩展处理。

## 5. 发布边界

Production deployment 仍为 `dpl_ATtwPhXLvmHURAutRzKyimNSWyir`，域名 `https://dailylight.chat` 保持 `legacy + baseline`。本证据只支持隔离功能 Preview 验收；Production 切换继续等待产品负责人单独授权。

产品负责人在视觉复验后判断该候选破坏了第二轮基线的视觉平衡，要求恢复上一个版本。该 deployment、截图和参数只用于记录被否决候选，不再作为功能联调、Production 发布或后续设计实现的事实源。

本候选发现的运行依赖安全问题已在恢复后的第二轮基线中收口：Next.js 升级至 `16.3.0`，Production 运行依赖审计为 `0`，全量回归、本地构建与 Vercel Linux 构建通过。该修复随基线功能 Preview 继续验证，不改变本字体与色阶候选的否决结论，也不构成 Production 发布授权。
