# GI-088｜v3 Thinking high 可见答案自动恢复候选

状态：`A1 已完成；1/12 提前结束并只读封存`

评测方案版本：`2026-08-09.gi088-human-eval-v3-empty-recovery`

服务版本：`2026-08-09.gi088-empty-content-recovery-service-v3`

执行指纹：`3b79fe68ecdb541b867b8c78ff85bf3f6fba222333523e36e47f4f4fa170d23b`

Production：`legacy + baseline`

## 1. 为什么进入恢复候选

v1 真人评测和两轮 v2 探针共同确认了一种稳定的失败形态：DeepSeek 返回 HTTP 200 并正常结束，隐藏推理已经产生，可见 `content` 长度仍为 0。项目能够确认失败发生在上游生成／响应阶段，无法继续定位 DeepSeek 内部停止原因。

response format 配对探针已经否决“移除 `response_format=json_object`”；Thinking 模式配对探针没有稳定复现空内容。产品负责人随后确认停止独立根因复现，把本轮唯一主要因素冻结为“Thinking high 的可见答案自动恢复”。

公开同类案例只承担实现参考：有项目同样观察到推理内容存在而可见正文为空，并建议在检测到空正文后追加最终答案指令进行一次恢复。[OpenClaw #84591](https://github.com/openclaw/openclaw/issues/84591) [Hermes Agent #21811](https://github.com/NousResearch/hermes-agent/issues/21811)

## 2. 结论分账

- 产品负责人判断：保留 Thinking high、`response_format=json_object`、原模型和输出合同；首次 `EMPTY_CONTENT` 后自动恢复最多 1 次；不切换 Thinking disabled，不做 high→off 降级。
- Codex 初评：该方案直接处理用户看不到回答的结果，同时保留首个技术失败、恢复调用和最终质量三套独立账目；自动验证已覆盖成功、失败、规则保护和并发申请。
- 已确认根因边界：上游响应可能在已有 reasoning、HTTP 200、`finish_reason=stop` 时返回零长度可见 content；Provider 正确识别为 `EMPTY_CONTENT`。
- 待验证假设：增加一次“直接输出最终可见 JSON”的内部指令，能够在真人对话里以可接受等待成本恢复多数偶发空内容。

## 3. 冻结行为

1. 首次调用继续使用原 Thinking high、reasoning high、`json_object`、模型、用户原话、完整上下文、语义状态和输出合同。
2. 首次 `EMPTY_CONTENT` 永久写入 Trace，不提交 assistant 或语义状态。
3. 服务端开放一次恢复资格；客户端取得资格后发起恢复。恢复调用继续使用相同 high 配置，并增加内部指令：`刚才只完成了思考，请直接输出最终可见 JSON，不要继续解释思考过程。`
4. 服务端在调用模型前原子消费恢复额度。刷新、响应丢失或多个标签页并发时，只会有一个恢复调用进入 Provider。
5. 恢复成功只提交一条 assistant 和一次语义状态，轮次标记 `complete_after_auto_recovery`；该输出继续按 high 质量评分，首次技术失败单独统计。
6. 恢复仍失败时标记 `exhausted`，保留用户原话和两次完整 Trace，停止自动调用。
7. 每个用户提交最坏调用上限为 2；无第三次调用、无自动 Thinking disabled、无 high→off。
8. 两次请求指纹不同；恢复调用通过 `parentCallId / retryTrigger / retryOrdinal / effectiveConfig` 关联原始调用。
9. 页面持续显示等待或失败状态并设置 `aria-busy`；恢复开始和成功使用温和 Toast，Toast 不抢焦点，也不承担唯一信息来源。
10. 隐藏推理正文继续不读取、不保存、不展示；Trace 只显示允许的类型、长度、Token 和调用血缘。

## 4. 指纹与血缘

- v1 历史评测：`2026-08-09.gi088-human-eval-v1`；执行指纹 `4b65801390264df957189efbc968c9b2584e212154e98671370b8167e7ff70b2`；8/12 只读快照。
- v2 诊断底座：`2026-08-09.gi088-human-eval-v2-diagnostic`；执行指纹 `96a555c6ecef0efd8ff2946bbf7ec9c7ee6b717157520a1e6944bb888b29f943`。
- Effective candidate：`58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`，继续保持不变。
- v3 数据集指纹：`6f3f3cf8c28d1dc72ad2a330a5a22014961dda5ba29b6be189fcb2329cf734ca`。
- v3 执行指纹：`3b79fe68ecdb541b867b8c78ff85bf3f6fba222333523e36e47f4f4fa170d23b`。

Prompt、Interview Skill 和输出合同均未改变。执行指纹变化来自评测／服务版本、空内容恢复政策、内部恢复指令、调用上限、血缘和客户端恢复行为。

## 5. 已完成验证

- GI-088 Service、Workbench 与 OpenAI Provider：`3` 个测试文件，`69/69` 通过。
- 覆盖首次空内容、恢复成功、恢复再次空内容、恢复结构保护、并发标签页、重复恢复请求、永久 Trace、Toast 去重、`aria-busy` 和刷新只读恢复。
- TypeScript、相关文件 ESLint、Prisma schema、Next.js production build 与 `git diff --check` 通过。
- `npm run eval:gi088:inspect` 通过，输出 `modelGenerationCalls=0`。

详细记录见 [manifest](./gi088-human-eval-v3-empty-recovery-manifest.json) 与 [静态验证](./gi088-v3-empty-recovery-static-validation.md)。

## 6. 真人结果与当前停止点

产品负责人原授权 A1、A2、A3 共 `3` 项定向真人复测，整批模型调用总账上限为 `40`。完成 A1 两条轨迹后，产品负责人确认 Thinking 关闭与 Thinking high 均出现同类阻断，单组证据已经足以停止。本批已在 A2 开始前按 `sufficient_evidence` 提前结束，终态为 `1/12`；其余 `11` 项标记为未执行。

私有 Preview deployment 为 `redacted-deployment-id`，入口为 `https://xingfuxitong-fpxzwohws-example-team.vercel.app/preview/gi088-evaluation`。页面零调用验收为 `200`，未登录 session API 为 `401`；Production 页面与 session API 均为 `404`。打开页面并完成应用登录后，系统按 v3 评测版本为当前评测账号创建独立空白批次。

本组共消费 `8/40` 次模型调用：off `4` 次、high `4` 次；`EMPTY_CONTENT=0`，自动恢复 `0`，手动重试 `0`。两边前三轮均有效，第 4 轮都命中 `MODEL_OUTPUT_PROTECTED / NEW_ANSWER_OPPORTUNITY_UNAVAILABLE`。产品负责人仍判断 high 的提问、总结和回应整体更好，两条轨迹均为 `better / minor_issue / target triggered`。

已确认根因属于回答机会边界：两边在 `explore_clarify` 已使用两次新回答机会，第 4 轮仍选择继续提问，程序按冻结合同拦截。该阻断与 Thinking 开关无关。v3 空内容自动恢复在本组未触发，因此真人效果保持未判定；输出合同进入下一问题候选，新的开发、模型调用或 Preview 批次继续等待产品负责人确认。

脱敏复盘见 [A1 定向真人评测复盘](./gi088-v3-targeted-human-eval-summary.md)。Production 变化 `0`，继续保持 `legacy + baseline`。
