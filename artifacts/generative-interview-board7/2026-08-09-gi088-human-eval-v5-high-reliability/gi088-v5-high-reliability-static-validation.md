# GI-088 v5｜Thinking high 可靠性候选静态验证

验证日期：`2026-08-09`

状态：`本地候选、私有 Preview 与 0/12 High-only 空白批次回读通过`

## 1. 指纹检查

`npm run eval:gi088:inspect` 已通过：

- 评测版本：`2026-08-09.gi088-human-eval-v5-high-reliability`；
- Effective candidate：`40335e6aa4166d63132f75b66c8c298cdc405a34e73b3cfd13b0e8aa556aab93`；
- 数据集指纹：`cc6d81be13babc91c57a588c31407ba7afad1238cf9465eab96de20cf825075e`；
- 执行指纹：`6dd8ed0723c78bb2f4481c25a988f2a6765a868be13e1387187dcf37bf6cfefd`；
- `branchOrder=[high]`、`taskCount=12`、`modelGenerationCalls=0`。

## 2. 自动验证

- Board 7B 工作协议、阶段转场、GI-088 Service、Workbench、OpenAI Provider：`5` 个文件，`101/101` 通过；
- `npm run typecheck` 通过；
- v5 相关服务、API、客户端、页面和测试 ESLint 通过；
- Prisma schema、Next.js production build、`git diff --check` 和 manifest JSON 解析通过；构建只包含仓库其他模块已有 warning。

## 3. 已覆盖的不变量

1. High-only 批次从 U1 直接开始 Thinking high，不创建可操作的 off 轨迹，不要求成对比较。
2. Provider 接收 `15s / 45s / 60s` 三段等待参数；路由最长 `75s`。
3. HTTP 200 后持续收到正文分片时允许生成继续到 60 秒；正文停滞 45 秒才触发 body timeout。
4. 只有 deadline 来源的 headers/body TIMEOUT 可获得一次同 high 恢复；hard total 不自动重复 60 秒。
5. 单问资产限制一个可见问句和一个问号；既有程序保护继续生效。
6. 唯一 `ASK_QUESTION_COUNT_INVALID:2` 可自动纠正一次；双问题之外的结构错误不误触发。
7. 空内容、阶段转场、双问题和超时恢复共享两次 Provider 调用上限，不产生第三次调用。
8. 首次失败永久保留；恢复成功只提交一条回答和一次语义状态；失败后保留原话和完整 Trace。
9. 并发、刷新和重复恢复申请通过服务端 revision 原子消费，最多产生一次恢复调用。
10. 页面提供 `aria-busy`、持续行内状态和温和 Toast；Toast 不抢焦点，也不承担唯一信息来源。
11. 隐藏推理正文继续不读取、不保存、不展示。
12. v1～v4 历史批次和 Production `legacy + baseline` 保持隔离。

## 4. 下一步

私有 Preview `redacted-deployment-id` 已 Ready，固定入口为 `https://xingfuxitong-gi088-v5-high-reliability.vercel.app/preview/gi088-evaluation`。专用评测库已创建批次 `redacted-operational-id`，回读结果为 `high_only`、活动分支 `high`、`0/12`、revision `0`、模型调用 `0`、执行指纹完全一致。Production 页面和 session API 继续返回 `404`。

浏览器已停留在新域名的 Daily Light 登录页。产品负责人完成一次登录后可直接开始 A1；Codex 在交接前不发起模型调用。
