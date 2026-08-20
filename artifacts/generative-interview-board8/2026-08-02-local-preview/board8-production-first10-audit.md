# 板块 8｜Production 首批有效会话只读审计

- 报告版本：`board8.production-first10.v1`
- Production 开启时间：`2026-08-01T16:00:00.000Z`
- 观察截止时间：`2026-08-03T15:59:59.000Z`
- 入选：`4/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 用户可见回应等待：中位数 `5.61s`，P90 `6.02s`，速度档位 `pass`。
- 生成式降级：累计 `6` 次，最大连续 `6` 次；最近 `6` 个可评回合降级率 `100.0%`。
- 事件日志：生成 `1` 个会话，保存 `1` 个会话，24 小时内保存 `1` 个会话。保存率当前只建立基线。
- 回退信号：首批降级门 `是`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 4 |
| `event_centered_entry_opened` | 3 |
| `event_centered_first_content_submitted` | 4 |
| `event_centered_response_completed` | 1 |
| `event_centered_checkpoint_reached` | 5 |
| `event_journal_generation_started` | 1 |
| `event_journal_generated` | 1 |
| `event_journal_saved` | 1 |
| `event_centered_turn_fallback` | 5 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 角度 / 阶段 | 降级 | 回应 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---:|---|---|---|---|
| 1 | `c687d542-f4e3-47d5-bbaf-e91dbb3d74f5` | 待识别 / event_recording | 1 | 5.78s / 5.78s | 否 | 待发生 | 待填写 |
| 2 | `8c48bc9a-fe5f-406a-9e53-99f405d01fea` | 待识别 / event_recording | 1 | 6.02s / 6.02s | 否 | 待发生 | 待填写 |
| 3 | `d2259cc9-ce41-4036-bf63-fb1585714dec` | feeling / checkpoint_two | 3 | 0.05s / 5.61s | 是 | 是 | 待填写 |
| 4 | `e05b742b-63a0-49cc-b9b0-49de02d316ce` | 待识别 / checkpoint_one | 1 | 4.86s / 4.86s | 否 | 待发生 | 待填写 |

## 逐会话人工裁决

### 1. `c687d542-f4e3-47d5-bbaf-e91dbb3d74f5`

- 首条有效内容：`2026-08-02T13:27:32.580Z`
- 会话 / 事件 / 日志：`c687d542-f4e3-47d5-bbaf-e91dbb3d74f5` / `d12edc33-9c46-4297-9253-f199972e89b3` / `待生成`
- Trace：`b61f0e80-4508-4097-a6a3-6b9848d54c8a`
- 检查点：first
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `8c48bc9a-fe5f-406a-9e53-99f405d01fea`

- 首条有效内容：`2026-08-02T13:30:34.231Z`
- 会话 / 事件 / 日志：`8c48bc9a-fe5f-406a-9e53-99f405d01fea` / `3deb8fab-3cd2-44f0-96bc-22d0808fdef1` / `待生成`
- Trace：`43ee4b4e-42c6-4489-8c85-de653ca9bd78`
- 检查点：first
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `d2259cc9-ce41-4036-bf63-fb1585714dec`

- 首条有效内容：`2026-08-02T13:32:33.876Z`
- 会话 / 事件 / 日志：`d2259cc9-ce41-4036-bf63-fb1585714dec` / `ec6324fc-a2a3-4b10-a0bc-fd2647420754` / `ea87d481-fcda-49bd-9cc1-774e9669574f`
- Trace：`74381021-ac55-4fc0-80e2-f3d9dc342bcf`、`e6cc0ede-fc4a-4fd3-9bcc-0b2c90bdf5fe`、`ac228b93-2aba-4473-a553-2cf2c9cdccea`、`e7007709-bf11-4f2e-992d-e3d6b5a49a6f`
- 检查点：first、second
- 失败阶段与错误码：semantic/INVALID_SCHEMA；visible/SEMANTIC_PLAN_CONTENT_HASH_MISMATCH
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `e05b742b-63a0-49cc-b9b0-49de02d316ce`

- 首条有效内容：`2026-08-02T13:56:35.448Z`
- 会话 / 事件 / 日志：`e05b742b-63a0-49cc-b9b0-49de02d316ce` / `247172d0-21f0-4202-b23a-02b85e93339f` / `待生成`
- Trace：`e01705e2-60a6-46b2-939b-d0bcd347d376`
- 检查点：first
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
