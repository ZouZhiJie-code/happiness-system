# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-04T05:06:51.949Z`
- 观察截止时间：`2026-08-04T05:08:00.000Z`
- 入选：`1/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `5.38s`，P90 `6.94s`，速度档位 `pass`。
- 可继续操作：中位数 `5.41s`，P90 `6.98s`，速度档位 `pass`。
- 模型耗时：中位数 `5.35s`，P90 `6.91s`；非模型耗时：中位数 `0.07s`，P90 `0.08s`。
- 真实生成式回合：`3` 次；确定性控制动作：`1` 次。
- 实际 provider 调用：`7` 次；deterministic / disabled 诊断：`3` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`1` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`1` 次；局部确定性修复：`0` 次。
- 运行降级：累计 `1` 次，最大连续 `1` 次；最近 `3` 个真实生成式回合降级率 `33.3%`。
- 降级错误码分布：`{"INVALID_SCHEMA":1}`。
- 事件日志：生成 `1` 个会话，保存 `1` 个会话，24 小时内保存 `1` 个会话；AI 接受 `1`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 1 |
| `event_centered_response_completed` | 5 |
| `event_centered_checkpoint_reached` | 3 |
| `event_journal_generation_started` | 1 |
| `event_journal_generated` | 1 |
| `event_journal_saved` | 1 |
| `event_centered_turn_fallback` | 1 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `5cbc2970-8797-43c5-ac24-31c2d651ff55` | mixed | feeling / deep_companionship | 3 / 7 / 1 / 1 | 5.38s / 6.94s | 5.41s / 6.98s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `5cbc2970-8797-43c5-ac24-31c2d651ff55`

- 首条有效内容：`2026-08-04T05:06:51.997Z`
- 会话 / 事件 / 日志：`5cbc2970-8797-43c5-ac24-31c2d651ff55` / `7f8b331b-575f-4256-81d8-1b2bbcb9d40f` / `894dacdf-9571-44c9-b811-c107af1afa5f`
- Trace：`2c23a687-ecd0-4d2e-93f2-7caf257c3073`、`6444ca13-107c-436d-b293-8438b29f4906`、`e85dd185-d73c-46dc-ab7b-f06cb2e410b3`、`b88e8508-a746-43b6-9b4c-16e6e1f3a6ef`、`1817c71e-8dd0-48f7-bd33-36ead18de971`、`f32e0154-1566-4083-bd79-85e0cb54d28d`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/INVALID_SCHEMA；semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
