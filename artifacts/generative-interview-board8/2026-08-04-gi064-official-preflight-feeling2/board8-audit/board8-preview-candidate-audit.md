# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-04T05:00:00.000Z`
- 观察截止时间：`2026-08-04T05:20:59.978Z`
- 入选：`1/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `4.53s`，P90 `8.52s`，速度档位 `pass`。
- 可继续操作：中位数 `4.58s`，P90 `8.55s`，速度档位 `pass`。
- 模型耗时：中位数 `4.93s`，P90 `8.48s`；非模型耗时：中位数 `0.07s`，P90 `0.08s`。
- 真实生成式回合：`4` 次；确定性控制动作：`1` 次。
- 实际 provider 调用：`9` 次；deterministic / disabled 诊断：`1` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`1` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`1` 次；局部确定性修复：`1` 次。
- 运行降级：累计 `0` 次，最大连续 `0` 次；最近 `4` 个真实生成式回合降级率 `0.0%`。
- 降级错误码分布：`暂无`。
- 事件日志：生成 `1` 个会话，保存 `1` 个会话，24 小时内保存 `1` 个会话；AI 接受 `1`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 1 |
| `event_centered_response_completed` | 6 |
| `event_centered_checkpoint_reached` | 3 |
| `event_journal_generation_started` | 1 |
| `event_journal_generated` | 1 |
| `event_journal_saved` | 1 |
| `event_centered_turn_fallback` | 0 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `05f98f1f-85b0-4ac0-80a9-f86307754f27` | generative | feeling / checkpoint_two | 4 / 9 / 1 / 0 | 4.53s / 8.52s | 4.58s / 8.55s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `05f98f1f-85b0-4ac0-80a9-f86307754f27`

- 首条有效内容：`2026-08-04T05:20:20.196Z`
- 会话 / 事件 / 日志：`05f98f1f-85b0-4ac0-80a9-f86307754f27` / `6285478a-18d7-42dc-8a46-aa137ee5b639` / `ffb7296b-aee3-42ce-9c58-ef35fd25f0c2`
- Trace：`f57f03b3-7ca7-49d4-87ae-0ddad805e112`、`8d555c34-cfdf-4083-ab82-e3e42bee0a6f`、`b658aa4a-3783-4bfb-b9e9-d8d3d643d79b`、`376af37f-79b1-4524-ac80-0e5eb1c37672`、`f283c400-e7d5-48de-9981-2244cae01788`、`51145b49-61e4-4c1f-80c5-78c97c85fab8`、`7f1fe835-1ee2-447e-8eca-ba3a39576ad9`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
