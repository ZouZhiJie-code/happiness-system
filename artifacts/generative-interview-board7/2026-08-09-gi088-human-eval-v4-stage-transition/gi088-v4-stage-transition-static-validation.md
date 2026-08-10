# GI-088 v4｜阶段 2→3 自然转场静态验证

验证日期：`2026-08-09`

状态：`历史静态验证通过；A1 已运行并以 1/12 提前结束，只读保留`

## 1. 指纹只读检查

`npm run eval:gi088:inspect` 通过：

- 评测版本：`2026-08-09.gi088-human-eval-v4-stage-transition`；
- Effective candidate：`cc3984818587c410decc828b446094a41b11f41bc2833c04fd6189c37a9d21c9`；
- 数据集指纹：`064f042b0fdf592b2f3ebfac413f1c7001f99828bf0347505c9ef12d00d493c0`；
- 执行指纹：`0206fd34f57f2a8e6c4c5401a172bcfda526e702bf6081e197324054a47b1d0a`；
- `taskCount=12`；
- off/high 的 `automaticStageTransitionRetries=1`；
- `modelGenerationCalls=0`。

## 2. 自动验证

以下检查通过：

- `npm test -- --run tests/unit/board7b-working-task-v1.test.ts tests/unit/gi088-stage-transition.test.ts tests/unit/gi088-evaluation-service.test.ts tests/unit/gi088-evaluation-workbench.test.tsx tests/unit/openai.provider.test.ts`：`5` 个文件，`95/95`；
- `npm run typecheck`；
- v4 相关服务、客户端、API、测试文件 ESLint；
- `npm run prisma:gi088:validate`；
- `npm run build`，构建通过；输出只包含仓库其他模块已有 warning；
- `git diff --check`；
- manifest JSON 解析。

## 3. 已覆盖的不变量

1. 阶段 2 的新回答机会用完后，模型输入明确提供当前阶段不可继续创建 `new` 机会和允许的后续动作。
2. 已有认识或本轮形成认识，并且下一问引用最新用户回答时，可以进入 `deepen_integrate`。
3. 条件不足时，`synthesize / acknowledge / pause` 保持零问题。
4. 阶段 3 连续多轮提问不受数字上限影响，继续价值与回答负担仍由模型判断。
5. 只有唯一问题 `NEW_ANSWER_OPPORTUNITY_UNAVAILABLE` 可以获得一次阶段转场自动纠正资格；双问题及其他结构问题不会误触发。
6. off/high 都沿用原分支配置；恢复只增加冻结的内部转场指令。
7. 首次违规保留且不提交 assistant 或语义状态；恢复成功只提交一条 assistant 与一次状态。
8. 阶段转场恢复与空内容恢复共享每个用户提交最多两次 Provider 调用；第二次空内容、超时或程序保护都进入 `exhausted`。
9. 恢复额度在 Provider 调用前通过 revision 原子消费；并发标签页最多产生一次恢复调用。
10. 每次恢复使用独立请求指纹，并记录父调用、触发原因、次数和实际配置。
11. 页面恢复期间设置 `aria-busy`，常驻行内状态和 `role=status / aria-live=polite` Toast 同步提供信息；Toast 不移动焦点，也不承担唯一信息来源。
12. v1 共享协议和 v3 只读批次保持独立；隐藏推理正文继续隔离。

## 4. 当前执行边界

- v4 实际只完成 A1 的 off/high 两条轨迹；A2 未开始；
- 最坏模型调用预算为 `40`，实际消费 `10`；
- 新 Preview deployment：`redacted-deployment-id`，状态为 `Ready`；
- 私有入口：`https://xingfuxitong-ncy2wcta8-example-team.vercel.app/preview/gi088-evaluation`；
- 新评测批次：v4 独立批次已于 `2026-08-09T16:30:13.282Z` 以 `1/12 early_stopped` 进入只读终态；
- 登录回读：页面显示 `BATCH EARLY STOPPED`、A1 已完成、A2～A6-R 共 11 项未执行；
- 浏览器标签文字修正版 deployment `redacted-deployment-id` 已 Ready，并绑定固定别名 `https://xingfuxitong-gi088-v4-stage-transition.vercel.app`；当前已登录评测继续使用首次 deployment；
- 模型调用：`10`；
- Production 变化：`0`，继续保持 `legacy + baseline`。

下一步由 v5 High-only 可靠性候选承接 30 秒误截断和双问题；v4 只承担阶段转场单例证据与回归血缘。
