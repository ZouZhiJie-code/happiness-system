# GI-088 v8r3 静态与真实数据库验证

## 验证对象

- 最终实现 commit：`4e4afb2a338e376bf6783c037470dca580cdd8a3`
- 行为文件：`112`
- Behavior manifest SHA-256：`3fd1749af70e6e5e47a87cc1c78103788cb1fe690dd0708ab95815171526cf81`
- Execution fingerprint：`093fa6ace9f5b8edad088ccb76a2fbffd62492ae3df92d4ad59c7dce99d719d0`

## 本地全仓门

- 全仓 Vitest：`320` 个文件通过、`2` 个文件按条件跳过；`3033` 项通过、`10` 项跳过；`0` 失败。
- TypeScript：通过。
- 全量 lint：`0 error / 45` 条基线 warning；本轮 GI-088 变更目标：`0 warning`。
- Production build：通过，63 个静态页面生成完成。
- Preview build：通过，63 个静态页面生成完成。
- 主 Prisma：validate 与 generate 通过。
- 评测 Prisma：validate 与 generate 通过。
- Skill：`quick_validate` 通过，运行时快照与仓库文件逐字一致。
- 行为清单：`--require-tracked` 通过。
- `git diff --check`：通过。

## 关键零模型验证

- 同一回答目标的多个问号只进入观察和人工复核，不触发技术恢复。
- 非提问动作出现问号时同样形成观察，结构、来源、共同任务和状态越界继续由程序硬门处理。
- 离线 Runner 与 Foundation 统一为候选解析、确定性状态补全、严格结构校验、语义校验和状态原子提交。
- 超时、结构、语义和状态越界分别使用对应纠正说明；每个检查点最多一次，全批预算最多两次。
- 每次恢复的触发类型和纠正版本进入请求哈希，模型身份继续覆盖 Provider、Host、Endpoint、Model 与 Payload 合同。
- v0.6 历史导出逐字节重放；v0.7 剔除身份、请求标识、凭据、请求正文和隐藏推理。

## 真实隔离数据库

### 应用数据库与【帮我记】

- 全新临时 schema 应用 `39` 项 migration。
- capture 产品流集成 `1/1` 通过，用时 `117.202s`。
- 记录模式持久化、同日跨模式隔离、原话先保存、确定性零问题承接、Provider `0`、日志生成编辑保存重开均通过。
- 显式清理后 schema 残留 `0`。

### GI-088 评测数据库

- 全新临时 schema 应用 `4` 项 migration。
- 事务集成 `3/3` 通过，用时 `48.270s / 12.615s / 14.161s`。
- 并发创建、操作幂等、调用账本、恢复血缘、导出快照和事务一致性通过。
- 显式清理后 schema 残留 `0`。

## 发布门结论

工程门通过。第二轮正式候选收到 `96/96 ACCOUNTOVERDUEERROR`，可靠性和延迟证据无法成立，因此本版本保持 `No-Go`，未执行 Preview 部署、`0/6` 初始化、Judge 或真人内容提交。
