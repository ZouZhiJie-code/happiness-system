# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-04T04:57:22.780Z`
- 观察截止时间：`2026-08-04T04:58:00.000Z`
- 入选：`1/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `6.08s`，P90 `8.04s`，速度档位 `pass`。
- 可继续操作：中位数 `6.11s`，P90 `8.06s`，速度档位 `pass`。
- 模型耗时：中位数 `6.42s`，P90 `8.01s`；非模型耗时：中位数 `0.06s`，P90 `0.08s`。
- 真实生成式回合：`3` 次；确定性控制动作：`1` 次。
- 实际 provider 调用：`7` 次；deterministic / disabled 诊断：`4` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`1` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`0` 次；局部确定性修复：`0` 次。
- 运行降级：累计 `2` 次，最大连续 `2` 次；最近 `3` 个真实生成式回合降级率 `66.7%`。
- 降级错误码分布：`{"thinking_summary_repeats_user_expression":1,"INVALID_SCHEMA":1}`。
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
| `event_centered_turn_fallback` | 2 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `0c83a0f2-d3b1-4a21-b3cc-7d8219b1d2d6` | mixed | feeling / deep_companionship | 3 / 7 / 1 / 2 | 6.08s / 8.04s | 6.11s / 8.06s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `0c83a0f2-d3b1-4a21-b3cc-7d8219b1d2d6`

- 首条有效内容：`2026-08-04T04:57:22.834Z`
- 会话 / 事件 / 日志：`0c83a0f2-d3b1-4a21-b3cc-7d8219b1d2d6` / `49c9feca-1322-47d9-b0dd-69cfc4c7d8fd` / `bc0df389-623e-41af-8e74-e7afc7b796df`
- Trace：`50154b4c-36f8-415a-9553-82d9361ab0c0`、`30698c20-9855-42b8-854c-882c1abbff95`、`fb9bb16c-95f4-44a8-8397-aef1128e944b`、`e03eef46-0d01-4ed0-afc9-5815a3b0b6b1`、`8ea91a94-963c-454e-85a8-74c8773f7653`、`fad3990e-3b45-433c-a7d4-419f5eaa9e70`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/thinking_summary_repeats_user_expression；visible/thinking_summary_repeats_user_expression；interview_turn/INVALID_SCHEMA；semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
