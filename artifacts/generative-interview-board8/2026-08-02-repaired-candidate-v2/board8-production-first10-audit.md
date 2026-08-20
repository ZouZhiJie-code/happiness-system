# 板块 8｜Production 首批有效会话只读审计

- 报告版本：`board8.production-first10.v1`
- Production 开启时间：`2026-08-02T14:24:00.000Z`
- 观察截止时间：`2026-08-02T14:32:00.000Z`
- 入选：`1/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 用户可见回应等待：中位数 `6.14s`，P90 `6.96s`，速度档位 `pass`。
- 生成式降级：累计 `1` 次，最大连续 `1` 次；最近 `2` 个可评回合降级率 `50.0%`。
- 事件日志：生成 `1` 个会话，保存 `1` 个会话，24 小时内保存 `1` 个会话。保存率当前只建立基线。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 1 |
| `event_centered_entry_opened` | 1 |
| `event_centered_first_content_submitted` | 1 |
| `event_centered_response_completed` | 2 |
| `event_centered_checkpoint_reached` | 2 |
| `event_journal_generation_started` | 1 |
| `event_journal_generated` | 1 |
| `event_journal_saved` | 1 |
| `event_centered_turn_fallback` | 1 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 降级 | 回应 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|
| 1 | `071105a4-35a0-495d-bd2d-2f9c0ceab0fe` | mixed | feeling / checkpoint_two | 1 | 6.14s / 6.96s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `071105a4-35a0-495d-bd2d-2f9c0ceab0fe`

- 首条有效内容：`2026-08-02T14:24:54.510Z`
- 会话 / 事件 / 日志：`071105a4-35a0-495d-bd2d-2f9c0ceab0fe` / `f4e9fdfd-c884-4c92-8488-3d45f5790a80` / `576f355d-afbc-4aa4-ae65-70c9728b1294`
- Trace：`deb7ca99-6e18-4b69-a532-bc2256adaa2b`、`5f8cf250-4b4e-439c-bf52-90393c2674df`、`f8305025-8ad5-4979-8b54-ea8243612802`
- 检查点：first、second
- 失败阶段与错误码：semantic/ASSEMBLY_FAILED
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
