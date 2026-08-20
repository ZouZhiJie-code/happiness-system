# 板块 8｜Production 首批有效会话只读审计

- 报告版本：`board8.production-first10.v1`
- Production 开启时间：`2026-08-02T14:03:00.000Z`
- 观察截止时间：`2026-08-02T14:06:53.000Z`
- 入选：`1/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 用户可见回应等待：中位数 `6.16s`，P90 `6.16s`，速度档位 `pass`。
- 生成式降级：累计 `1` 次，最大连续 `1` 次；最近 `1` 个可评回合降级率 `100.0%`。
- 事件日志：生成 `1` 个会话，保存 `1` 个会话，24 小时内保存 `1` 个会话。保存率当前只建立基线。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 1 |
| `event_centered_entry_opened` | 1 |
| `event_centered_first_content_submitted` | 1 |
| `event_centered_response_completed` | 1 |
| `event_centered_checkpoint_reached` | 1 |
| `event_journal_generation_started` | 1 |
| `event_journal_generated` | 1 |
| `event_journal_saved` | 1 |
| `event_centered_turn_fallback` | 1 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 角度 / 阶段 | 降级 | 回应 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---:|---|---|---|---|
| 1 | `b5d062f3-19d8-46ea-b726-172a94635da7` | 待识别 / checkpoint_one | 1 | 6.16s / 6.16s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `b5d062f3-19d8-46ea-b726-172a94635da7`

- 首条有效内容：`2026-08-02T14:03:25.701Z`
- 会话 / 事件 / 日志：`b5d062f3-19d8-46ea-b726-172a94635da7` / `0621d372-f2d7-4185-a6b8-39018f0ae182` / `b4ce743b-ae45-4069-9e51-76fb1630f985`
- Trace：`f589406d-7e88-412e-bb21-47d4b38109ce`、`32049434-7328-4f95-a8ab-8ae37e8e34ba`
- 检查点：first
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
