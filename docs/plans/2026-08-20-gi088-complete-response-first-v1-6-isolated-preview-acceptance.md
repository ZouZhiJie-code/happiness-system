# GI-088｜完整回应优先 v1.6 隔离 Preview 验收

- 文档职责：当前专项
- 文档状态：待确认
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 1. 为什么进入 Preview

完整回应优先已经在参与调优的八题和未参与调优的新八题中完成离线验证。新八题可见回应与后台事实均技术有效，Codex 初评零 fail；两处可见 minor 需要在真实对话体验中判断是否影响使用。当前最有价值的证据是产品负责人直接体验页面中的完整回应、连续回合、停止、纠正和后台晚到，而不是继续增加离线 Prompt 版本。

本阶段只发布隔离 Preview。Production 继续使用 `event_centered + baseline`。

## 2. 当前候选

| 项目 | 冻结值 |
|---|---|
| 可见策略 | `INTERVIEW_EVENT_CENTERED_STRATEGY=complete_response_v1_6` |
| 可见负责人 | 第一次调用一次性生成一条完整气泡；Thinking disabled、`1280` Token、45 秒硬门 |
| 后台负责人 | 第二次调用只整理用户事实与纠正；Thinking disabled、`1600` Token、20 秒硬门；不能修改可见气泡 |
| 模型 | 两次调用均为 `deepseek-v4-pro`，与离线候选一致 |
| 来源 | 实质字符连续、逐字、唯一匹配时允许空白／标点对齐；最终引用从真实用户原文截取 |
| 恢复 | 可见回应和后台任务原子提交；调用前记账；模型结果先保存再顺序写入；失败保留原话与可见回应 |
| 数据 | Preview 独立验收数据库；不读取或写入 Production 数据 |

## 3. Preview 验收范围

最多 `15` 次用户可见模型调用，后台调用按每个实际用户回合最多一次独立记账。产品负责人在真实页面完成：

1. 普通表达：自然承接并进入一个有价值的新层；
2. 明确要求继续／深挖：兑现推进请求，避免重复已答内容；
3. 关系表达：自然语义转化可以保留，新增具体体验或行为需有依据；
4. 纠正：只沿纠正后的事实推进，旧理解退出；
5. 停止／少问：立即收住，零额外问题；
6. 连续回合与后台晚到：下一轮可继续输入，可见气泡不被后台改写；
7. 刷新、重复提交和失败恢复：同一 `clientTurnId` 不重复消费模型，结果和事实顺序稳定。

## 4. 执行顺序与验证门

1. 把正式链路的可见 Provider 固定到离线使用的 `deepseek-v4-pro`，历史 Flash 候选保持原身份；
2. 把 v1.7 来源标点对齐接入后台正式解析与写入链路；
3. 跑专项、全量、Lint、类型、两套 Prisma、Production build、文档和差异检查；
4. 分组提交并推送当前分支；
5. 只给当前分支配置 `event_centered + complete_response_v1_6` 和 Pro 模型，远程源码构建隔离 Preview；
6. 核对 Preview runtime、数据库隔离、登录、单气泡回应、后台任务和恢复；
7. 把真实用户输入和实际 AI 输出逐回合交付产品负责人裁决。

严重来源错误、忽略明确停止、可见气泡被后台改写、重复消费、Production 配置变化或持续技术失败立即停止 Preview。普通自然度与提问质量由产品负责人按原文裁决。

## 5. 实际结果

- 提交 `3c564ffdef87ccd46bf7932bd210c23d77c30f12` 已推送，隔离部署 `dpl_D2fEAPidG2tpWGHQBV56ncryxe12` 为 Ready；Preview 地址为 <https://xingfuxitong-idch4sa4l-zouzhijies-projects.vercel.app>。
- 当前分支的三个 Preview 变量已绑定 `event_centered + complete_response_v1_6 + deepseek-v4-pro`，Production 配置保持 baseline。
- 页面、账户、登录、会话、开始记录和非法日期校验通过；非法日期稳定返回 `400 / INVALID_START_REQUEST`。
- 受控真实回合的可见模型耗时 `2854ms`，完整回应 `4026ms` 就绪，completion `44/1280`；Codex 初评 `pass`，产品负责人裁决 pending。
- 后台 `3341ms` 完成 2 条事实和 2 条逐字来源，零可见写权限，气泡未变化。
- 同一 `clientTurnId` 重放复用原 Turn、气泡、Trace 与消息序号；数据库 `attemptCount=1`，新增模型调用 `0`。
- 真人可见预算消费 `2/15`，剩余 `13`；后台调用 `2`；重试、恢复调用和回退均为 `0`。

公开结果见[Preview 验收交接](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-6-isolated-preview-v1-handoff.md)与[阶段账](../../artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/complete-response-first-v1-6-isolated-preview-stage-ledger-v1.json)。

## 6. 当前停止点

当前为 `Preview Ready / awaiting_product_acceptance`。等待产品负责人真实体验裁决。通过后可按同一提交直接进入 Production 发布准备；Production 切换仍需保存当前 deployment、环境快照、数据库备份和一键 baseline 回退证据。
