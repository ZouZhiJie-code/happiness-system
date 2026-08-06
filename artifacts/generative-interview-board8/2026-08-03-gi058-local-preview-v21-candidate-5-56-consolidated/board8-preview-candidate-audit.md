# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-03T15:31:08.958Z`
- 观察截止时间：`2026-08-03T16:00:00.000Z`
- 入选：`8/8` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `0.04s`，P90 `6.64s`，速度档位 `pass`。
- 可继续操作：中位数 `0.09s`，P90 `6.71s`，速度档位 `pass`。
- 模型耗时：中位数 `5.05s`，P90 `8.61s`；非模型耗时：中位数 `0.10s`，P90 `0.11s`。
- 真实生成式回合：`11` 次；确定性控制动作：`14` 次。
- 实际 provider 调用：`25` 次；deterministic / disabled 诊断：`12` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`8` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`1` 次；局部确定性修复：`1` 次。
- 运行降级：累计 `2` 次，最大连续 `1` 次；最近 `11` 个真实生成式回合降级率 `18.2%`。
- 降级错误码分布：`{"user_articulated_origin_adds_unstated_relation":1,"thinking_summary_direction_mismatch":1}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `8`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 33 |
| `event_centered_checkpoint_reached` | 19 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 2 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `59fae19e-1514-4ff2-a33c-4742fb27449f` | baseline | feeling / checkpoint_two | 1 / 3 / 1 / 1 | 0.04s / 8.60s | 0.09s / 8.64s | 是 | 是 | 待填写 |
| 2 | `69d2b2e6-1e61-4191-8d5d-05d75d5ca6a6` | generative | feeling / checkpoint_two | 1 / 2 / 3 / 0 | 0.03s / 4.56s | 0.09s / 4.60s | 是 | 是 | 待填写 |
| 3 | `a3a21c08-e6db-4c2e-9266-9b90c9615212` | baseline | thought / checkpoint_two | 1 / 3 / 1 / 1 | 0.04s / 9.21s | 0.09s / 9.25s | 是 | 是 | 待填写 |
| 4 | `7161fb12-bcc1-47f6-bd65-dbf1bb462224` | generative | thought / checkpoint_two | 2 / 4 / 2 / 0 | 0.03s / 5.25s | 0.07s / 5.32s | 是 | 是 | 待填写 |
| 5 | `b1f0fca2-7a52-46c3-8aa8-1a7e38893a7f` | generative | relationship / checkpoint_two | 1 / 2 / 1 / 0 | 0.04s / 6.64s | 0.09s / 6.71s | 是 | 是 | 待填写 |
| 6 | `8d9e9bcb-a270-4e29-9aea-00d53619025d` | generative | relationship / checkpoint_two | 2 / 4 / 2 / 0 | 0.04s / 5.04s | 0.09s / 5.10s | 是 | 是 | 待填写 |
| 7 | `47d29d1c-b039-468c-92bc-12afbcdd2c93` | generative | action / checkpoint_two | 1 / 2 / 2 / 0 | 0.02s / 5.08s | 0.06s / 5.15s | 是 | 是 | 待填写 |
| 8 | `37ba3922-cde3-4b44-924b-811a7c94d09d` | generative | action / checkpoint_two | 2 / 5 / 2 / 0 | 0.04s / 8.64s | 0.09s / 8.72s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `59fae19e-1514-4ff2-a33c-4742fb27449f`

- 首条有效内容：`2026-08-03T15:31:09.030Z`
- 会话 / 事件 / 日志：`59fae19e-1514-4ff2-a33c-4742fb27449f` / `c9356fc0-67c4-4732-8f80-f81a202d2ee2` / `33a19f40-a142-4858-a35f-bab89fbcf6e5`
- Trace：`ecb48607-b862-4418-9f52-6536037f37fe`、`282e903e-14f5-4900-ab6b-4ee901f93432`、`bdacd8b9-3ae8-491e-88c2-62a5c7ed339e`、`368554ee-dd49-4a21-98c7-fc8bb52c5cfd`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `69d2b2e6-1e61-4191-8d5d-05d75d5ca6a6`

- 首条有效内容：`2026-08-03T15:31:53.880Z`
- 会话 / 事件 / 日志：`69d2b2e6-1e61-4191-8d5d-05d75d5ca6a6` / `387d0b0b-d6fa-4f3b-94b3-a7b1ebed6b3d` / `bfd645d9-3820-4ec8-8d19-f5ea152238bf`
- Trace：`5458772c-43ba-43b8-9fca-a317eeccbd84`、`315656d3-9eb4-40e6-b721-be4c76548787`、`f8b02bbc-c0e2-4e9a-b1e9-231ac6488a93`、`5581205f-529a-4fd0-a8b0-0758fef48444`、`6a287e97-668e-4d66-a281-04b29e1c80e3`、`ede5046b-9b70-453f-8493-c516c590348c`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `a3a21c08-e6db-4c2e-9266-9b90c9615212`

- 首条有效内容：`2026-08-03T15:32:23.537Z`
- 会话 / 事件 / 日志：`a3a21c08-e6db-4c2e-9266-9b90c9615212` / `91545554-f38d-433c-80c0-013de3743d02` / `b0e51f40-cd5f-482c-8f45-c00c8ef08ad4`
- Trace：`d1697919-948b-4820-b5b6-9fd22519c446`、`3f1bc428-6db4-483c-bc66-577f0844a5f3`、`12e09a70-8c46-4c99-9359-dbefccd0f66e`、`39de17a7-907c-4237-aa11-ce7ebf432f15`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/thinking_summary_direction_mismatch；visible/thinking_summary_direction_mismatch
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `7161fb12-bcc1-47f6-bd65-dbf1bb462224`

- 首条有效内容：`2026-08-03T15:32:58.023Z`
- 会话 / 事件 / 日志：`7161fb12-bcc1-47f6-bd65-dbf1bb462224` / `c4c8f89d-b40e-44d8-af78-18ee70ae5664` / `16461c07-2465-4f26-bfb8-7e468b0fc644`
- Trace：`cc437047-8bbd-47d8-bae4-47c99cd5eeab`、`f1ca885d-b65d-4db9-9497-570c35cc6cd9`、`54e2ca48-4105-4c5a-bc91-ef1eb3c2a177`、`5485238d-24d1-454f-b033-86121b6f743e`、`4e8c7a2d-1028-44a7-b402-2be83a9ae942`、`0c70f3af-b2e4-41e0-bf8d-52a418959069`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `b1f0fca2-7a52-46c3-8aa8-1a7e38893a7f`

- 首条有效内容：`2026-08-03T15:33:24.766Z`
- 会话 / 事件 / 日志：`b1f0fca2-7a52-46c3-8aa8-1a7e38893a7f` / `506e0c5e-080b-42ff-a4dd-463ca876c5cc` / `285ac460-844e-44a2-89cb-07d3011663cb`
- Trace：`72306bb1-7a10-4e91-9a80-a8a5b0e51445`、`640da63d-07d4-4efc-ba34-e98963dd0eb5`、`e482d9ef-de45-4944-aa4d-7fda42d47c90`、`35487924-9043-4a4b-8684-f1651f5ac4d3`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `8d9e9bcb-a270-4e29-9aea-00d53619025d`

- 首条有效内容：`2026-08-03T15:33:44.505Z`
- 会话 / 事件 / 日志：`8d9e9bcb-a270-4e29-9aea-00d53619025d` / `3ed1b5f2-bf2b-4a95-8bd9-dd7ca813c443` / `d187898b-22d5-4d3e-b642-c74cb462178c`
- Trace：`77358504-edc2-468a-9bb3-c93cba4a3936`、`a246a392-909a-47ef-9f75-8ff9a3e169e8`、`1a799bd5-d9b7-4b4a-a653-20ab416623df`、`5224499d-cc90-4de1-99a1-c54152d5dcb7`、`56d57b37-45a2-4bcb-a6f7-6d80cc0b3264`、`f12a5f70-52bc-4d66-b71b-238c29d1e3cb`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `47d29d1c-b039-468c-92bc-12afbcdd2c93`

- 首条有效内容：`2026-08-03T15:34:11.162Z`
- 会话 / 事件 / 日志：`47d29d1c-b039-468c-92bc-12afbcdd2c93` / `ade401be-935c-41ec-a0dd-e385221e9bdd` / `f3c6c727-8221-489b-a5b2-7edb59792ebd`
- Trace：`f51b86e7-d60f-4d15-877f-075a01755342`、`75f27bd3-e778-479e-b3b9-a293f8d7b0af`、`b62823b0-7db2-4f3e-b72a-18a34c28fb25`、`364ed3ff-7651-43dc-a1af-387d320b6f09`、`1dd40f89-05a0-479c-9af2-9c1e3fee308c`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `37ba3922-cde3-4b44-924b-811a7c94d09d`

- 首条有效内容：`2026-08-03T15:35:21.347Z`
- 会话 / 事件 / 日志：`37ba3922-cde3-4b44-924b-811a7c94d09d` / `bb272b0e-acdc-4d1a-a47f-99440eead9cf` / `8c1bcc02-053e-471e-b4ad-4d03a5f60a4a`
- Trace：`6046b43a-0e73-4bbf-a73b-2626dbdd8d41`、`28564827-d2ee-4c44-bd83-2edf8153ec4b`、`364c3c11-1379-48f3-9807-b3d8e31e8d42`、`6a01b356-5e34-4aaf-bd39-a2528ab91419`、`afe55395-23c7-4219-bea4-a5a5efe766f8`、`b2b1f404-5794-455e-bc18-1cb55e207f35`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
