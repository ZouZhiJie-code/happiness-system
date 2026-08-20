# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-04T05:00:00.000Z`
- 观察截止时间：`2026-08-04T05:16:12.753Z`
- 入选：`1/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `3.79s`，P90 `8.35s`，速度档位 `pass`。
- 可继续操作：中位数 `3.83s`，P90 `8.38s`，速度档位 `pass`。
- 模型耗时：中位数 `4.22s`，P90 `8.32s`；非模型耗时：中位数 `0.07s`，P90 `0.08s`。
- 真实生成式回合：`5` 次；确定性控制动作：`1` 次。
- 实际 provider 调用：`9` 次；deterministic / disabled 诊断：`2` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`1` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`0` 次；局部确定性修复：`2` 次。
- 运行降级：累计 `1` 次，最大连续 `1` 次；最近 `5` 个真实生成式回合降级率 `20.0%`。
- 降级错误码分布：`{"SEMANTIC_FRAME_EVIDENCE_REF_UNTRACEABLE":1}`。
- 事件日志：生成 `1` 个会话，保存 `1` 个会话，24 小时内保存 `1` 个会话；AI 接受 `1`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 1 |
| `event_centered_response_completed` | 7 |
| `event_centered_checkpoint_reached` | 3 |
| `event_journal_generation_started` | 1 |
| `event_journal_generated` | 1 |
| `event_journal_saved` | 1 |
| `event_centered_turn_fallback` | 1 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `cb5f32cb-9e97-416b-a46c-6dcf5788144b` | mixed | feeling / checkpoint_two | 5 / 9 / 1 / 1 | 3.79s / 8.35s | 3.83s / 8.38s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `cb5f32cb-9e97-416b-a46c-6dcf5788144b`

- 首条有效内容：`2026-08-04T05:15:09.746Z`
- 会话 / 事件 / 日志：`cb5f32cb-9e97-416b-a46c-6dcf5788144b` / `3bbbb27d-9f4f-4574-9301-a49f688a4d42` / `8cf4a37f-6364-4dc5-8ca2-5db017cb1fb8`
- Trace：`1534e0c4-c435-4a88-a21e-43860b231fb4`、`74095b79-4862-45ae-b1de-e1413620d761`、`039b1859-3b95-4861-9aae-0ece0da0f9d0`、`10b9a0c7-96d5-44b1-a724-e8c22c580798`、`c9983052-934e-4f74-b677-1394f6da46b6`、`d507523f-6e4b-4ce6-88f1-b31178d092f9`、`cbee3bc5-a179-4241-aa85-1e6c6f8c9c69`、`40ef19e7-3720-4947-9c0f-a93a1d0e8600`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/SEMANTIC_FRAME_EVIDENCE_REF_UNTRACEABLE；semantic/SEMANTIC_FRAME_EVIDENCE_REF_UNTRACEABLE
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
