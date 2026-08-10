# GI-088 v3｜Thinking high 可见答案自动恢复静态验证

验证日期：`2026-08-09`

状态：`静态验证与私有 Preview 零调用验收通过；等待产品负责人开始 A1～A3`

## 1. 指纹只读检查

`npm run eval:gi088:inspect` 通过：

- 评测版本：`2026-08-09.gi088-human-eval-v3-empty-recovery`；
- Effective candidate：`58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`；
- 数据集指纹：`6f3f3cf8c28d1dc72ad2a330a5a22014961dda5ba29b6be189fcb2329cf734ca`；
- 执行指纹：`3b79fe68ecdb541b867b8c78ff85bf3f6fba222333523e36e47f4f4fa170d23b`；
- `taskCount=12`；
- `high.automaticEmptyContentRetries=1`；
- `modelGenerationCalls=0`。

## 2. 自动验证

以下检查通过：

- `npm test -- --run tests/unit/gi088-evaluation-service.test.ts tests/unit/gi088-evaluation-workbench.test.tsx tests/unit/openai.provider.test.ts`：`3` 个文件，`69/69`；
- `npm run typecheck`；
- v3 相关服务、客户端、API、测试文件 ESLint；
- `npm run prisma:gi088:validate`；
- `npm run build`，构建通过；输出仅包含仓库其他模块已有 warning；
- `git diff --check`；
- manifest JSON 解析。

## 3. 已覆盖的不变量

1. 首次 high `EMPTY_CONTENT` 只写失败记录，不提交 assistant 或语义状态。
2. 只有 high 的第一次空内容可以获得一次自动恢复资格；其他错误、off 分支和第二次调用不会开启该资格。
3. 恢复调用继续使用 Thinking enabled、reasoning high、`json_object`、同一用户原话、对话上下文和 `semanticStateBefore`。
4. 恢复调用只增加冻结的内部最终答案指令，并生成独立请求指纹。
5. 恢复额度在 Provider 调用前通过批次 revision 原子消费；并发申请最多产生一次恢复调用。
6. 恢复成功只提交一条 assistant 与一次状态，轮次为 `complete_after_auto_recovery`。
7. 恢复发生技术失败或程序保护后都进入 `exhausted`；重复自动申请和人工重试不会产生第三次调用。
8. 页面在生成和恢复期间设置 `aria-busy`；Toast 使用 `role=status` 和 `aria-live=polite`，不移动焦点；永久行内状态与 Trace 同时保留。
9. 历史刷新只读取已恢复结果，不重复调用或重复显示成功 Toast。
10. Trace 按调用展示配置、请求指纹、错误、父调用和恢复序号；隐藏推理正文继续保持隔离。

## 4. 私有 Preview 零调用验收

- deployment：`redacted-deployment-id`；
- 评测入口：`https://xingfuxitong-fpxzwohws-example-team.vercel.app/preview/gi088-evaluation`；
- Preview 页面：`200`；
- 未登录 Preview session API：`401`；
- Production 页面与 session API：`404 / 404`；
- 模型调用：`0/40`；
- 新评测批次：等待产品负责人首次登录后由 session 读取创建；
- Production 变化：`0`。

## 5. 当前执行范围

产品负责人已授权 A1、A2、A3 共 `3` 项和 `40` 次模型调用总账上限。A3 完成后提前结束并导出 `3/12` 部分结果。每个用户提交最多一次 high 空内容自动恢复，最坏 Provider 调用上限为 `2`；无第三次调用、无 Thinking disabled、无 off 降级。
