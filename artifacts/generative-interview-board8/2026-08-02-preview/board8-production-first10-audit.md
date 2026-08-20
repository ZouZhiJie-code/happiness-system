# 板块 8｜Production 首批有效会话只读审计

- 报告版本：`board8.production-first10.v1`
- Production 开启时间：`2026-08-01T16:00:00.000Z`
- 观察截止时间：`2026-08-03T16:00:00.000Z`
- 入选：`10/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 用户可见回应等待：中位数 `6.02s`，P90 `9.17s`，速度档位 `pass`。
- 生成式降级：累计 `16` 次，最大连续 `7` 次；最近 `20` 个可评回合降级率 `80.0%`。
- 事件日志：生成 `5` 个会话，保存 `5` 个会话，24 小时内保存 `5` 个会话。保存率当前只建立基线。
- 回退信号：首批降级门 `是`；最近 20 回合门 `是`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 12 |
| `event_centered_entry_opened` | 10 |
| `event_centered_first_content_submitted` | 30 |
| `event_centered_response_completed` | 56 |
| `event_centered_checkpoint_reached` | 34 |
| `event_journal_generation_started` | 13 |
| `event_journal_generated` | 13 |
| `event_journal_saved` | 13 |
| `event_centered_turn_fallback` | 34 |
| `event_centered_session_abandoned` | 9 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 降级 | 回应 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|
| 1 | `c687d542-f4e3-47d5-bbaf-e91dbb3d74f5` | baseline | 待识别 / event_recording | 1 | 5.78s / 5.78s | 否 | 待发生 | 待填写 |
| 2 | `8c48bc9a-fe5f-406a-9e53-99f405d01fea` | baseline | 待识别 / event_recording | 1 | 6.02s / 6.02s | 否 | 待发生 | 待填写 |
| 3 | `d2259cc9-ce41-4036-bf63-fb1585714dec` | baseline | feeling / checkpoint_two | 3 | 0.05s / 5.61s | 是 | 是 | 待填写 |
| 4 | `e05b742b-63a0-49cc-b9b0-49de02d316ce` | mixed | feeling / checkpoint_two | 2 | 4.53s / 4.86s | 否 | 待发生 | 待填写 |
| 5 | `b5d062f3-19d8-46ea-b726-172a94635da7` | baseline | 待识别 / checkpoint_one | 1 | 6.16s / 6.16s | 是 | 是 | 待填写 |
| 6 | `1ddb3b28-a045-4b33-bb45-bec1b0cdce36` | baseline | 待识别 / checkpoint_one | 1 | 6.47s / 6.47s | 否 | 待发生 | 待填写 |
| 7 | `071105a4-35a0-495d-bd2d-2f9c0ceab0fe` | mixed | feeling / checkpoint_two | 1 | 6.14s / 6.96s | 是 | 是 | 待填写 |
| 8 | `918874c3-8c9b-40ad-9706-24b094613cc9` | mixed | 待识别 / checkpoint_two | 2 | 7.17s / 9.17s | 是 | 是 | 待填写 |
| 9 | `eefc4ad1-7331-4574-8478-fc8dc7057a3a` | mixed | 待识别 / checkpoint_two | 2 | 8.58s / 18.58s | 是 | 是 | 待填写 |
| 10 | `cb367069-8335-44fe-ad5c-dcd283f21414` | baseline | 待识别 / checkpoint_two | 2 | 0.07s / 7.36s | 否 | 待发生 | 待填写 |

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
- Trace：`e01705e2-60a6-46b2-939b-d0bcd347d376`、`531ce356-9099-4374-9a4e-1cea45f2da52`、`aa5ba505-5661-408e-97a5-a65c782893bb`
- 检查点：first、second
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `b5d062f3-19d8-46ea-b726-172a94635da7`

- 首条有效内容：`2026-08-02T14:03:25.701Z`
- 会话 / 事件 / 日志：`b5d062f3-19d8-46ea-b726-172a94635da7` / `0621d372-f2d7-4185-a6b8-39018f0ae182` / `b4ce743b-ae45-4069-9e51-76fb1630f985`
- Trace：`f589406d-7e88-412e-bb21-47d4b38109ce`、`32049434-7328-4f95-a8ab-8ae37e8e34ba`
- 检查点：first
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `1ddb3b28-a045-4b33-bb45-bec1b0cdce36`

- 首条有效内容：`2026-08-02T14:18:12.524Z`
- 会话 / 事件 / 日志：`1ddb3b28-a045-4b33-bb45-bec1b0cdce36` / `e680588e-7e36-4195-83fc-e4df55d822a3` / `待生成`
- Trace：`d61a77fe-bc06-4060-9b2f-48ebf9b0115d`
- 检查点：first
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `071105a4-35a0-495d-bd2d-2f9c0ceab0fe`

- 首条有效内容：`2026-08-02T14:24:54.510Z`
- 会话 / 事件 / 日志：`071105a4-35a0-495d-bd2d-2f9c0ceab0fe` / `f4e9fdfd-c884-4c92-8488-3d45f5790a80` / `576f355d-afbc-4aa4-ae65-70c9728b1294`
- Trace：`deb7ca99-6e18-4b69-a532-bc2256adaa2b`、`5f8cf250-4b4e-439c-bf52-90393c2674df`、`f8305025-8ad5-4979-8b54-ea8243612802`
- 检查点：first、second
- 失败阶段与错误码：semantic/ASSEMBLY_FAILED
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `918874c3-8c9b-40ad-9706-24b094613cc9`

- 首条有效内容：`2026-08-02T14:57:51.221Z`
- 会话 / 事件 / 日志：`918874c3-8c9b-40ad-9706-24b094613cc9` / `367b6fa9-d071-4581-975f-38b8f62ec0f6` / `2568ddad-99bf-46b0-a4d0-bdcba7edf66a`
- Trace：`0b4d2f21-2ff9-4014-8f75-21b898637879`、`d038b3ae-2acf-495a-886f-d9e60b7fa9b0`、`774851a8-48a4-4fa8-a32e-4cd755fe0b47`、`837510f8-00c1-4bbc-a50f-4cb0883f6b02`
- 检查点：first、second
- 失败阶段与错误码：semantic/INVALID_SCHEMA；semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 9. `eefc4ad1-7331-4574-8478-fc8dc7057a3a`

- 首条有效内容：`2026-08-02T15:25:45.230Z`
- 会话 / 事件 / 日志：`eefc4ad1-7331-4574-8478-fc8dc7057a3a` / `fc5050f0-199f-429b-ae70-9510a2727b9f` / `6c24dc9d-6d41-4737-b1b4-d667b19d0662`
- Trace：`410c9867-2271-424b-a087-dbe3f406dc9a`、`a75a0820-b34b-497e-8e23-d8e7560c173b`、`ca445eed-f8c9-4128-98ea-676314f319f5`、`a58bec51-71a9-4c60-a673-61d578166eef`
- 检查点：first、second
- 失败阶段与错误码：semantic/INVALID_SCHEMA；semantic/REQUEST_FAILED
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 10. `cb367069-8335-44fe-ad5c-dcd283f21414`

- 首条有效内容：`2026-08-02T16:18:28.489Z`
- 会话 / 事件 / 日志：`cb367069-8335-44fe-ad5c-dcd283f21414` / `f23826eb-e66d-4c77-a6d9-0b7348b8a09a` / `待生成`
- Trace：`a53188e4-f255-4263-80a8-01b34ea333db`、`1260c68f-7174-47c1-a91d-86f716a0143a`
- 检查点：first、second
- 失败阶段与错误码：semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
