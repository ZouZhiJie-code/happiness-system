# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v2`
- 候选观察起点：`2026-08-03T00:00:00.000Z`
- 观察截止时间：`2026-08-04T00:00:00.000Z`
- 入选：`8/8` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 用户可见回应等待：中位数 `3.00s`，P90 `8.52s`，速度档位 `pass`。
- 真实生成式回合：`20` 次；确定性控制动作：`12` 次。
- 运行降级：累计 `8` 次，最大连续 `3` 次；最近 `20` 个真实生成式回合降级率 `40.0%`。
- 降级错误码分布：`{"ask_requires_single_question":1,"INVALID_SCHEMA":6,"thinking_summary_must_acknowledge_correction":1}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `7`，标题修复 `1`，全文安全回退 `1`。
- 回退信号：首批降级门 `是`；最近 20 回合门 `是`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 19 |
| `event_centered_entry_opened` | 18 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 32 |
| `event_centered_checkpoint_reached` | 20 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 8 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 尝试 / 控制 / 降级 | 回应 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|
| 1 | `b1eed7e6-c824-4060-bb67-d2681ecfe9b7` | baseline | feeling / checkpoint_two | 2 / 1 / 2 | 6.01s / 11.64s | 是 | 是 | 待填写 |
| 2 | `c5dd5fad-6294-448c-b2ed-9b76af72bb65` | mixed | feeling / checkpoint_two | 3 / 2 / 1 | 3.00s / 11.39s | 是 | 是 | 待填写 |
| 3 | `bfa023a9-925e-4bee-b9f8-9711cfd47d0f` | baseline | thought / checkpoint_two | 2 / 1 / 2 | 5.42s / 8.59s | 是 | 是 | 待填写 |
| 4 | `7c3a0197-30eb-491d-be85-88d3788fd8e9` | generative | thought / checkpoint_two | 3 / 2 / 0 | 2.55s / 4.35s | 是 | 是 | 待填写 |
| 5 | `c30d0993-109e-46c5-ad7f-b720bdbc6871` | mixed | relationship / checkpoint_two | 2 / 1 / 1 | 3.33s / 8.46s | 是 | 是 | 待填写 |
| 6 | `b43a074a-074e-454f-89dd-53e73a32d604` | generative | relationship / checkpoint_two | 3 / 2 / 0 | 3.02s / 5.43s | 是 | 是 | 待填写 |
| 7 | `5e07086f-94c5-41d9-94e5-2b6a7399fa66` | mixed | action / checkpoint_two | 2 / 1 / 1 | 2.97s / 6.61s | 是 | 是 | 待填写 |
| 8 | `4b4d72c8-ad35-4fcb-9212-fdec4cffaeb1` | mixed | action / checkpoint_two | 3 / 2 / 1 | 2.89s / 5.86s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `b1eed7e6-c824-4060-bb67-d2681ecfe9b7`

- 首条有效内容：`2026-08-03T04:12:50.065Z`
- 会话 / 事件 / 日志：`b1eed7e6-c824-4060-bb67-d2681ecfe9b7` / `7b28e295-fdf2-4dbb-8b95-646a58459fa4` / `ea8c2ca8-9d9b-4fe0-8faf-203e31152bae`
- Trace：`4a0cd392-6a62-4108-9170-3993776d7ff7`、`b239c6ea-030e-4585-b4af-a34aeb41c2ef`、`37fe77cf-ae21-4fc2-ae5e-d9ee9b06b867`、`aca7af23-d7eb-4fb4-92b6-6a879ad12ad3`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/ask_requires_single_question；visible/ask_requires_single_question；interview_turn/INVALID_SCHEMA；semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `c5dd5fad-6294-448c-b2ed-9b76af72bb65`

- 首条有效内容：`2026-08-03T04:13:11.554Z`
- 会话 / 事件 / 日志：`c5dd5fad-6294-448c-b2ed-9b76af72bb65` / `fdc934aa-393b-4d92-a20b-e5b76677357c` / `02b90a71-5df8-4035-9e2b-c4418a941eb3`
- Trace：`a9e4dda0-5508-4bbd-9f21-6599d4d85852`、`fd8c0cc1-c2be-478a-9c81-e29c04d6262e`、`5160951d-1fd1-491a-ab32-1606dfd552c9`、`9d4e51b7-75c9-4375-93ac-05acdd10fa2d`、`528c5521-ff7d-4e1e-825a-7a9b87ff3da6`、`e6fee9b7-fc9e-46a3-ad00-3eab1bd86652`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALID_SCHEMA；semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `bfa023a9-925e-4bee-b9f8-9711cfd47d0f`

- 首条有效内容：`2026-08-03T04:53:46.553Z`
- 会话 / 事件 / 日志：`bfa023a9-925e-4bee-b9f8-9711cfd47d0f` / `7c858671-7cee-417b-bbac-6e0a2c117c57` / `27dfad78-2ae9-441f-9145-af73396f68b8`
- Trace：`0c43ce79-1a14-474a-971e-c426c9650db4`、`5e9954c2-d689-4407-a9c1-0f6ce85f417a`、`e2c264b0-940f-4244-b959-97f3bf961b05`、`15e24fd2-04cd-41d7-9fc3-91bb4ae68741`、`82c554b3-9bef-48a7-872c-6dace3028558`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALID_SCHEMA；visible/INVALID_SCHEMA；interview_turn/thinking_summary_must_acknowledge_correction；visible/thinking_summary_must_acknowledge_correction
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `7c3a0197-30eb-491d-be85-88d3788fd8e9`

- 首条有效内容：`2026-08-03T04:54:05.099Z`
- 会话 / 事件 / 日志：`7c3a0197-30eb-491d-be85-88d3788fd8e9` / `68912fdd-51ab-4273-a217-5ccc1983b46e` / `aea239bb-82ef-4f2d-9937-c6b75942b0ca`
- Trace：`2c0cfa92-f53c-4c32-9a2a-4ccdd2b66419`、`5233b258-028b-43f3-b2f2-a6e3ec149b08`、`203b8568-6bb5-4da0-9493-f1596ca7e666`、`64ae5ed1-562e-4d9e-bcc3-0a6eca5adaf9`、`7cdf14c1-8c17-4d8b-a631-fa92a9784585`、`41a7fc43-e2fa-4b2a-aac6-13040898bb84`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `c30d0993-109e-46c5-ad7f-b720bdbc6871`

- 首条有效内容：`2026-08-03T04:54:18.204Z`
- 会话 / 事件 / 日志：`c30d0993-109e-46c5-ad7f-b720bdbc6871` / `325e7031-7adc-4364-bdae-276528314003` / `9c5f5c9f-9fee-4f5d-a15e-ba12e7897ac5`
- Trace：`c6fddee1-891f-447e-922d-f3df63f9d0f8`、`5381f5ce-94d7-4260-9515-1c7abc2cd11e`、`3deee128-5cf4-4e47-be2e-89452ff37fa7`、`d466e0bf-5630-4c91-b3a9-4f75e0e87ccb`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALID_SCHEMA；visible/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `b43a074a-074e-454f-89dd-53e73a32d604`

- 首条有效内容：`2026-08-03T04:54:32.598Z`
- 会话 / 事件 / 日志：`b43a074a-074e-454f-89dd-53e73a32d604` / `86067773-d234-4fab-af1e-b6b9affbd460` / `a46b7446-f592-4fc2-aaa8-4a679093bbbd`
- Trace：`48bdd6e8-163f-4146-a66f-648c9603ddbe`、`8999a2ab-d41c-4487-a966-94221bb1c89e`、`b207b1e1-cf78-4777-b94e-4ec8adb53b07`、`b5410d97-8e70-43f7-9c19-681753a6a7ad`、`5309c15f-6b8b-477b-8b81-955d2e0c4926`、`c5a74b94-7be4-430b-8a06-29f190a8e4f7`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `5e07086f-94c5-41d9-94e5-2b6a7399fa66`

- 首条有效内容：`2026-08-03T04:54:52.086Z`
- 会话 / 事件 / 日志：`5e07086f-94c5-41d9-94e5-2b6a7399fa66` / `d1b53b72-ed52-43d2-a8d2-4a08b50deead` / `dac18cc7-1bb0-4b19-8ba6-caf898f12e69`
- Trace：`3f5dfc6a-250b-4c51-a87e-3545397acc62`、`e741a964-0369-4a93-abdd-25132ef93cf9`、`be4eaf6f-193a-4db7-a7a5-dfb0116b6512`、`9bc3da35-530c-49ca-8570-85f7fa84978d`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALID_SCHEMA；semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `4b4d72c8-ad35-4fcb-9212-fdec4cffaeb1`

- 首条有效内容：`2026-08-03T04:57:04.695Z`
- 会话 / 事件 / 日志：`4b4d72c8-ad35-4fcb-9212-fdec4cffaeb1` / `da5f2d6c-cb7b-4795-932d-4d955447dabd` / `a0c68025-0c72-4968-a524-f9d92f419a37`
- Trace：`f1cc8920-e10d-4179-8e55-ff896b1163a0`、`51a8d236-706e-42ae-bb90-3b0987401de2`、`c1d8c0d9-5003-4cbb-888b-60ba32c56273`、`2fe1f727-d174-4945-8b6d-c06acc59cc05`、`3255cfaa-443f-4087-999f-b4fbb849e2a4`、`1c2597f8-2f5e-44e6-bfff-8688c698c343`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALID_SCHEMA；semantic/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
