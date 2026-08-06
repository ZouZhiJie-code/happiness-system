# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-03T12:47:14.583Z`
- 观察截止时间：`2026-08-03T13:27:02.522Z`
- 入选：`1/8` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `19.66s`，P90 `33.12s`，速度档位 `repair`。
- 可继续操作：中位数 `46.27s`，P90 `58.05s`，速度档位 `repair`。
- 模型耗时：中位数 `6.96s`，P90 `6.96s`；非模型耗时：中位数 `51.09s`，P90 `51.09s`。
- 真实生成式回合：`1` 次；确定性控制动作：`1` 次。
- 实际 provider 调用：`3` 次；deterministic / disabled 诊断：`3` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`1` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`0` 次；局部确定性修复：`0` 次。
- 运行降级：累计 `1` 次，最大连续 `1` 次；最近 `1` 个真实生成式回合降级率 `100.0%`。
- 降级错误码分布：`{"user_articulated_origin_adds_unstated_relation":1}`。
- 事件日志：生成 `1` 个会话，保存 `1` 个会话，24 小时内保存 `1` 个会话；AI 接受 `1`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 1 |
| `event_centered_response_completed` | 3 |
| `event_centered_checkpoint_reached` | 2 |
| `event_journal_generation_started` | 1 |
| `event_journal_generated` | 1 |
| `event_journal_saved` | 1 |
| `event_centered_turn_fallback` | 1 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `2273ca5c-0599-41f6-9eef-e10ca1801229` | baseline | feeling / checkpoint_two | 1 / 3 / 1 / 1 | 19.66s / 33.12s | 46.27s / 58.05s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `2273ca5c-0599-41f6-9eef-e10ca1801229`

- 首条有效内容：`2026-08-03T12:47:40.116Z`
- 会话 / 事件 / 日志：`2273ca5c-0599-41f6-9eef-e10ca1801229` / `a5afd80b-e80a-4040-b361-899e1fc650d0` / `c95385cf-3f56-4989-ac71-027ec9c196f8`
- Trace：`c936eae1-e391-47bf-896e-5548562681e2`、`0692b71e-5084-4119-be17-10132194c01e`、`c6bba449-aa10-4528-850d-b6a5efe63298`、`7437b5bc-deec-484a-beec-3d53202f3093`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
