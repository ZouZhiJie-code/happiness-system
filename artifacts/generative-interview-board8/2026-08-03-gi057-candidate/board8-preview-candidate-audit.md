# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v3`
- 候选观察起点：`2026-08-03T07:32:44.000Z`
- 观察截止时间：`2026-08-03T09:16:26.721Z`
- 入选：`8/8` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 用户可见回应等待：中位数 `50.88s`，P90 `78.00s`，速度档位 `repair`。
- 真实生成式回合：`12` 次；确定性控制动作：`10` 次。
- 事件记录入口识别：`16` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`0` 次；局部确定性修复：`0` 次。
- 运行降级：累计 `3` 次，最大连续 `2` 次；最近 `12` 个真实生成式回合降级率 `25.0%`。
- 降级错误码分布：`{"SEMANTIC_PLAN_CONTENT_HASH_MISMATCH":1,"user_articulated_origin_adds_unstated_relation":2}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `8`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `是`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 1 |
| `event_centered_entry_opened` | 1 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 38 |
| `event_centered_checkpoint_reached` | 17 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 3 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 尝试 / 控制 / 降级 | 回应 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|
| 1 | `f14a9a33-452a-412f-8e2f-ced12f34db7b` | baseline | feeling / checkpoint_two | 1 / 1 / 1 | 52.73s / 53.76s | 是 | 是 | 待填写 |
| 2 | `1eb9b8f8-22b1-4ac1-9815-f7dbd9057f44` | mixed | feeling / checkpoint_two | 3 / 2 / 1 | 51.52s / 79.28s | 是 | 是 | 待填写 |
| 3 | `2e0314bb-9b66-4358-9f55-b6fc52b29eca` | generative | thought / checkpoint_two | 1 / 1 / 0 | 48.95s / 72.59s | 是 | 是 | 待填写 |
| 4 | `13e9b71e-8372-4902-b887-e08789647676` | generative | thought / checkpoint_two | 2 / 1 / 0 | 48.60s / 70.30s | 是 | 是 | 待填写 |
| 5 | `b4c46d40-0d8a-4281-ac25-4f2574ef1d28` | generative | relationship / checkpoint_two | 1 / 1 / 0 | 49.29s / 76.94s | 是 | 是 | 待填写 |
| 6 | `d914fad1-21af-4403-8c50-699c7a5b0d7a` | generative | relationship / checkpoint_two | 1 / 1 / 0 | 56.53s / 78.00s | 是 | 是 | 待填写 |
| 7 | `c51ff446-af86-4d6a-b2ee-acf644d6706f` | generative | action / checkpoint_two | 1 / 2 / 0 | 47.80s / 79.07s | 是 | 是 | 待填写 |
| 8 | `f129cc3e-a652-467e-b096-a2b69b024090` | mixed | action / checkpoint_two | 2 / 1 / 1 | 58.16s / 76.11s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `f14a9a33-452a-412f-8e2f-ced12f34db7b`

- 首条有效内容：`2026-08-03T07:48:54.323Z`
- 会话 / 事件 / 日志：`f14a9a33-452a-412f-8e2f-ced12f34db7b` / `50a13f66-1ad7-4e33-86a1-dca9a3ca3d59` / `96a01556-0051-4e2a-812e-44f514691366`
- Trace：`50ec0c2d-f1c9-431f-9af1-6ad4b683e9c9`、`5f3ab3be-b21d-41d4-98a3-e3ae2736e1ad`、`79fb6c48-2733-43fb-947a-f3461523ba37`、`dec3ac52-5930-4af9-afc1-b65dddc33f4c`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/SEMANTIC_PLAN_CONTENT_HASH_MISMATCH；visible/SEMANTIC_PLAN_CONTENT_HASH_MISMATCH
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `1eb9b8f8-22b1-4ac1-9815-f7dbd9057f44`

- 首条有效内容：`2026-08-03T08:01:20.099Z`
- 会话 / 事件 / 日志：`1eb9b8f8-22b1-4ac1-9815-f7dbd9057f44` / `194c8a76-704b-4111-b90b-a05cfbeff4ac` / `95516e82-c12f-48f2-b241-a3977fb5700a`
- Trace：`d442795d-d598-4bf0-ae52-164cebaa840e`、`b0794546-3f57-46ca-a80e-08405291d2a0`、`d919d102-8ff3-4859-bb18-f7c9b1705a8e`、`9048afe9-fd9d-433c-9106-2a24dd289e79`、`982873e6-5e4b-47b0-8839-e610410164f9`、`85b566aa-2c8b-468a-9900-9a518f1a8cb2`、`0bfc60f4-c7b0-416d-bc60-8648e9546105`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `2e0314bb-9b66-4358-9f55-b6fc52b29eca`

- 首条有效内容：`2026-08-03T08:16:06.360Z`
- 会话 / 事件 / 日志：`2e0314bb-9b66-4358-9f55-b6fc52b29eca` / `908a3ddc-da15-4bb1-bf9f-cbda4e9238a8` / `a9cf5c8a-f24f-4a55-a039-b1c5446b7ab8`
- Trace：`00daba81-b186-4f4e-aa6f-0c7466b4fdf9`、`7c54e999-5606-4b18-acd9-2b0be8a855f1`、`2dacdd0a-1004-45f0-bd40-90b5e2b0f018`、`5eabf297-4d2d-4905-b29c-63549278b6db`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `13e9b71e-8372-4902-b887-e08789647676`

- 首条有效内容：`2026-08-03T08:23:02.412Z`
- 会话 / 事件 / 日志：`13e9b71e-8372-4902-b887-e08789647676` / `e33ff813-ec9c-441e-8a71-59946167d681` / `2260930f-7dc5-4b9d-a105-173a237b2be3`
- Trace：`fe1dd31e-4cea-4a97-bfb7-92e9726c7831`、`bf0e67d0-6e6f-419f-8fd1-01def6bf7078`、`a6a0fab7-4340-4458-923c-7a364eb435e5`、`aa3a8aea-0fca-4723-977c-9c0b0e915ec6`、`8bc89752-7363-41f1-83ec-3a41aa55bfd0`、`a76cce5c-5088-4239-8eea-7d40e42aea68`、`e8a50bd2-df79-4046-a6bb-cd334a3a1609`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `b4c46d40-0d8a-4281-ac25-4f2574ef1d28`

- 首条有效内容：`2026-08-03T08:35:46.318Z`
- 会话 / 事件 / 日志：`b4c46d40-0d8a-4281-ac25-4f2574ef1d28` / `75992a51-2a75-4625-8194-d9636bf0d521` / `f4cdffb7-f40e-4fe9-9210-afdb44a5a005`
- Trace：`0978f1ab-bbf1-40aa-ab11-a2fd9b7a95f2`、`5e8f398c-0785-4923-b875-648a09ac576d`、`3190971c-57d3-41d2-8992-d8c4c951379b`、`abc4ddc3-5827-4f61-a434-a5c89e56d17a`、`aad3ba58-100d-4409-bf3f-23e34011f48d`、`8d4bcc26-f14a-4cee-bfbf-c8b4210869aa`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `d914fad1-21af-4403-8c50-699c7a5b0d7a`

- 首条有效内容：`2026-08-03T08:45:02.677Z`
- 会话 / 事件 / 日志：`d914fad1-21af-4403-8c50-699c7a5b0d7a` / `5ee57d3f-5595-48c6-b564-215ca6f0e59f` / `deec7ca0-72c6-4576-98be-8b25f8345309`
- Trace：`43f62d00-1b7d-4f30-9b60-d455ee3d1f1e`、`254859c7-c4fd-4e4a-be44-0c9ac6705936`、`b19a47d3-282a-46d9-aa8a-830e4148dc37`、`bcf1847c-001e-4178-9c6a-6aaf41b2bed3`、`2ca7d022-8e0c-468e-8f9f-8293d1fd7bc4`、`83439879-a257-433c-81c5-26993dc3eb51`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `c51ff446-af86-4d6a-b2ee-acf644d6706f`

- 首条有效内容：`2026-08-03T08:58:20.937Z`
- 会话 / 事件 / 日志：`c51ff446-af86-4d6a-b2ee-acf644d6706f` / `e3e5c8a8-30b2-4830-8789-eee4c8597840` / `0f5975bd-5450-4c6a-95e6-af89226d2df4`
- Trace：`7c07fdb3-2650-4265-a83f-e3cf9f21766d`、`180d486a-eaf1-4e69-8db0-1d3f23224cec`、`09bc5d94-2499-4fb9-b30f-483316619160`、`8b41d05a-851d-46b4-af78-5730aeb3dfd8`、`27ae0bbd-498c-480e-bf9a-2ee8f38f8a54`、`94944b63-ff88-4593-bb01-82d6c8d9c464`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `f129cc3e-a652-467e-b096-a2b69b024090`

- 首条有效内容：`2026-08-03T09:07:22.931Z`
- 会话 / 事件 / 日志：`f129cc3e-a652-467e-b096-a2b69b024090` / `1d36b0e7-d294-4903-9d2b-cf155e59badf` / `e144ed29-10a0-443b-aa02-c6fd7a20cb04`
- Trace：`8a8265f9-df95-4f36-8b18-eea49625fac0`、`4d8a8150-f3f4-477f-bb75-a8ffc6c5c646`、`f96a5f91-923f-4613-b333-eeb0d1be0d5b`、`1d352455-6456-48d8-9375-f0f05bf0b451`、`9eaa7a7b-5507-43b7-92eb-1dfed280e529`、`969ac6d8-da6b-4fd3-914c-5ea583ae98b1`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
