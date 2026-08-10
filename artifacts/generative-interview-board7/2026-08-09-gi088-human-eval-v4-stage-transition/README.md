# GI-088｜v4 阶段 2→3 自然转场候选

状态：`A1 已完成并以 1/12 提前结束；批次已进入只读终态`

评测方案版本：`2026-08-09.gi088-human-eval-v4-stage-transition`

服务版本：`2026-08-09.gi088-stage-transition-service-v4`

Effective candidate：`cc3984818587c410decc828b446094a41b11f41bc2833c04fd6189c37a9d21c9`

数据集指纹：`064f042b0fdf592b2f3ebfac413f1c7001f99828bf0347505c9ef12d00d493c0`

执行指纹：`0206fd34f57f2a8e6c4c5401a172bcfda526e702bf6081e197324054a47b1d0a`

Production：`legacy + baseline`

## 1. 为什么进入 v4

v3 A1 的 Thinking 关闭与 Thinking high 两条真人轨迹都在第 4 次用户回答后触发 `NEW_ANSWER_OPPORTUNITY_UNAVAILABLE`。程序记录显示，模型已经收到阶段 2 新回答机会为 `false`，仍然输出阶段 2、`answerOpportunity=new` 和一个新问题，因此最终回应被程序拦截。

阶段 1、2 各最多两个回答机会属于已冻结边界；阶段 3 按认识增量、回答负担和继续价值动态问停，没有数字上限。产品负责人确认 v4 只处理阶段转场：阶段 2 机会用完后，条件满足时自然进入阶段 3；条件不足时总结、承接或暂停。模型仍越界时，off/high 都可自动纠正最多 1 次。

## 2. 结论分账

- 产品负责人判断：保留阶段 1、2 的次数边界与阶段 3 动态问停；阶段 2 用完后根据认识和最新表达自然转场；唯一阶段越界允许一次同配置自动纠正。
- Codex 初评：模型输入、候选说明、程序验证和恢复血缘已形成闭环；定向自动测试覆盖两种 Thinking 配置、阶段 3 多轮、条件不足收束、第二次失败和并发申请。
- 已确认根因：模型已经收到阶段 2 无剩余机会，仍留在阶段 2 创建新的回答机会，程序按冻结合同拦截。
- 待验证假设：新转场指令可以让至少 `3/4` 真人轨迹在首次调用直接完成正确转场；最多 `1/4` 需要自动纠正。

## 3. v4 候选行为

1. 模型先吸收最新回答，再决定阶段与动作。
2. 已有认识或本轮形成认识，且用户最新表达打开同一焦点下具体未解部分时，进入 `deepen_integrate`；继续提问时最多一问，并引用最新用户消息。
3. 已形成认识、用户未打开更深部分时，使用 `synthesize` 自然总结并保持零问题。
4. 认识仍不足且继续价值有限时，使用 `acknowledge` 或 `pause`，保持零问题。
5. 阶段 3 继续动态问停，程序不增加数字上限。
6. 程序只验证“认识存在”和“转场提问具有最新用户来源”；更深部分是否有语义价值继续由模型结合完整语境判断。

## 4. 自动纠正与分账

- 仅当程序问题精确等于 `NEW_ANSWER_OPPORTUNITY_UNAVAILABLE` 时开放自动纠正；双问题、字段错误和其他结构问题保持独立记录。
- `/retry` 使用 `automatic_stage_transition`；off/high 均沿用原 Thinking、模型、JSON mode、用户原话、完整上下文和 `semanticStateBefore`。
- 恢复调用增加内部指令：`当前阶段的新回答机会已经用尽。若已形成认识且用户打开了更深的未解部分，请进入深化阶段；否则总结或暂停。不要继续在原阶段创建新回答机会。`
- 首次违规永久保留，恢复调用通过 `parentCallId / retryTrigger / retryOrdinal / effectiveConfig` 建立血缘，并使用独立请求指纹。
- 恢复成功只提交一条 assistant 和一次语义状态，轮次标记 `complete_after_auto_recovery`。
- 第二次失败进入 `exhausted`；空内容恢复与阶段转场恢复共享每个用户提交最多两次 Provider 调用的总上限，不会串联第三次调用。
- 恢复资格通过批次 revision 在 Provider 调用前原子消费；刷新、多标签页和重复请求最多进入一次 Provider。

## 5. 页面体验

- 生成和恢复期间保留用户原话，行内显示持续状态并设置 `aria-busy`。
- 阶段转场恢复开始时温和播报：`刚才的回应没有顺利完成阶段转换，正在自动整理，请再等一会儿～`
- Toast 使用 `role=status`、`aria-live=polite`，不抢焦点；同一状态同时保留在行内区域和 Trace。
- 第二次失败后显示持久说明，保留两次调用血缘并停止自动调用。
- 隐藏推理正文继续不读取、不保存、不展示。

## 6. 已完成验证

- Board 7B 历史协议、v4 转场合同、GI-088 Service、Workbench 与 OpenAI Provider：`5` 个测试文件，`95/95` 通过。
- 覆盖阶段 2 用完后进入阶段 3、条件不足零问题收束、阶段 3 连续多轮、off/high 自动纠正、第二次失败、空内容停止、并发幂等、一次回答/一次状态提交及其他结构问题不误触发。
- TypeScript、相关文件 ESLint、Prisma schema、Next.js production build 与 `git diff --check` 通过。
- `npm run eval:gi088:inspect` 输出 `modelGenerationCalls=0`。

公开详细记录见 [静态验证](./gi088-v4-stage-transition-static-validation.md)；含批次定位符的 manifest 留在本地受控资产中。

## 7. 下一停止点

### 实际真人结果

- 产品负责人完成 A1 的 off/high 两条轨迹后确认：阶段 2→3 转场已在 high 轨迹中生效；继续扩大 off/high 对照的价值有限，后续只保留 Thinking high。
- A1 共 `10` 次调用：off `2` 次，high `8` 次。high 的四次直接有效生成耗时为 `9.620s～21.366s`；后两次首次调用均在 `30.002s～30.003s` 触发本地 `hard_total`，人工续试分别得到一次有效回应和一次双问题保护。
- off 与 high 各出现一次 `ASK_QUESTION_COUNT_INVALID:2`。这说明双问题与 Thinking 开关无稳定对应关系。
- 已确认超时近端根因：两次失败均已在约 `0.43s` 收到 HTTP 200 响应头，正文持续生成到本地 30 秒总截止后被主动中止；连接建立正常，30 秒阈值缺少 high 延迟校准依据。
- 产品负责人判断：当前证据足以停止 v4。Codex 初评：阶段转场候选已获得单例真人支持；双问题和等待阈值进入下一候选，转场质量仍需作为回归项保留。
- 批次 `redacted-operational-id` 已于 `2026-08-09T16:30:13.282Z` 以 `mixed` 原因完成 `early_stopped`；A1 已完成，其余 11 项明确标记为未执行，revision 为 `24`。

### 历史计划

真人复测只使用 v4 前两项：

1. A1：形成认识后打开同一焦点下的具体未解部分，验证自然进入阶段 3 并继续至少一轮；
2. A2：形成认识后不再打开更深部分，验证自然总结、承接或暂停。

两项均执行 off/high，共 `4` 条轨迹；最坏模型调用预算为 `40`。产品负责人已针对执行指纹 `0206fd34…b1d0a` 授权私有 Preview、新评测批次与这 40 次最坏调用预算。

- Preview deployment：`redacted-deployment-id`；
- 访问地址：`https://xingfuxitong-ncy2wcta8-example-team.vercel.app/preview/gi088-evaluation`；
- Vercel 状态：`Ready`，target 为 `preview`；
- 页面已通过 Deployment Protection 并到达 Daily Light 登录页；未登录 session API 为 `401`；
- Production session API 保持 `404`；
- 产品负责人已在新部署完成登录；工作台已按 v4 创建独立 `0/12` 空白批次，状态为 `BATCH IN PROGRESS`，A1 为待开始；
- 页面完整执行指纹回读为 `0206fd34f57f2a8e6c4c5401a172bcfda526e702bf6081e197324054a47b1d0a`；
- 实际模型调用为 `10/40`，没有继续执行 A2；
- 首次 deployment 的浏览器标签沿用旧 `v2 Diagnostic` 文字，页面正文、任务和指纹均为 v4。标签修正版 deployment `redacted-deployment-id` 已 Ready，并绑定固定别名 `https://xingfuxitong-gi088-v4-stage-transition.vercel.app`；该别名等待首次登录，当前真人评测继续使用上方已登录地址；
- v3 的 `1/12` 与 v4 的 `1/12` 结果均保持只读，Production 继续保持 `legacy + baseline`。
