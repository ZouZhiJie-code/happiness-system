# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-03T15:05:05.596Z`
- 观察截止时间：`2026-08-03T16:00:00.000Z`
- 入选：`8/8` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `0.04s`，P90 `9.79s`，速度档位 `pass`。
- 可继续操作：中位数 `0.08s`，P90 `9.85s`，速度档位 `pass`。
- 模型耗时：中位数 `4.71s`，P90 `24.01s`；非模型耗时：中位数 `0.08s`，P90 `0.10s`。
- 真实生成式回合：`12` 次；确定性控制动作：`14` 次。
- 实际 provider 调用：`29` 次；deterministic / disabled 诊断：`24` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`8` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`1` 次；局部确定性修复：`1` 次。
- 运行降级：累计 `8` 次，最大连续 `3` 次；最近 `12` 个真实生成式回合降级率 `66.7%`。
- 降级错误码分布：`{"user_articulated_origin_adds_unstated_relation":3,"CORRECTION_SCOPE_OMITTED":1,"TIMEOUT":3}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `8`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `是`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 34 |
| `event_centered_checkpoint_reached` | 19 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 8 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `023711d9-1ade-4f27-b2f3-f25990f13249` | mixed | action / checkpoint_two | 3 / 8 / 2 / 2 | 0.03s / 5.69s | 0.07s / 5.73s | 是 | 是 | 待填写 |
| 2 | `8e127221-52fe-407d-98c1-78e69a860ce8` | baseline | thought / checkpoint_two | 1 / 1 / 1 / 1 | 0.03s / 3.76s | 0.07s / 3.81s | 是 | 是 | 待填写 |
| 3 | `52ad8580-34d7-430f-b51b-b4dc366a1166` | baseline | action / checkpoint_two | 1 / 2 / 2 / 1 | 0.03s / 24.05s | 0.06s / 24.08s | 是 | 是 | 待填写 |
| 4 | `c345156c-f578-4315-ad46-079a68955636` | generative | relationship / checkpoint_two | 1 / 2 / 1 / 0 | 0.05s / 4.10s | 0.10s / 4.16s | 是 | 是 | 待填写 |
| 5 | `5b45b4c8-b59d-419f-9f2e-b0ae7ec85729` | baseline | feeling / checkpoint_two | 1 / 3 / 1 / 1 | 0.05s / 5.99s | 0.10s / 6.03s | 是 | 是 | 待填写 |
| 6 | `9f4b51eb-de2c-44f1-b735-50a7a379561f` | baseline | feeling / checkpoint_two | 1 / 2 / 3 / 1 | 0.03s / 24.03s | 0.05s / 24.06s | 是 | 是 | 待填写 |
| 7 | `60ec6aec-0405-4d9d-9a48-ba91352ca91a` | mixed | thought / deep_companionship | 2 / 6 / 2 / 1 | 0.04s / 23.57s | 0.08s / 23.61s | 是 | 是 | 待填写 |
| 8 | `639c966c-25e9-4bc2-badf-87be835c0333` | mixed | relationship / checkpoint_two | 2 / 5 / 2 / 1 | 0.04s / 4.58s | 0.08s / 4.62s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `023711d9-1ade-4f27-b2f3-f25990f13249`

- 首条有效内容：`2026-08-03T15:05:05.659Z`
- 会话 / 事件 / 日志：`023711d9-1ade-4f27-b2f3-f25990f13249` / `109c0913-533d-42b8-a810-be2ddeaf3868` / `62f19141-8ab8-4fce-a767-5eaee82476db`
- Trace：`728e956e-2893-4261-b83d-0bc35d4b3db1`、`35bc3d63-96d4-450f-92f2-b69a2b8d3f2c`、`30e865c8-86eb-4831-beff-1c6d93cf86a8`、`3863c35d-6e34-442a-b9e1-1fd63e97b0c4`、`d18ee400-336b-48bf-8963-0be8ba0a2fb1`、`f74ed435-890d-47be-a52d-77d11a9d8f89`、`921b2ea7-aaf5-486c-850c-24be539bd12d`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation；interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `8e127221-52fe-407d-98c1-78e69a860ce8`

- 首条有效内容：`2026-08-03T15:05:05.659Z`
- 会话 / 事件 / 日志：`8e127221-52fe-407d-98c1-78e69a860ce8` / `913f5b8c-f47e-446f-96b8-82e08f657909` / `a0708146-86c1-4955-b3f5-ae12287d5158`
- Trace：`ebe0e608-7972-4c3c-ad5a-620a793d7c05`、`5353baf9-36d7-4aeb-b36f-863f00ddd350`、`198ff513-3569-42e2-8696-f06855a257fd`、`8f73f24f-a5fd-4b43-b934-e6944c3cf380`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/CORRECTION_SCOPE_OMITTED；semantic/CORRECTION_SCOPE_OMITTED
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `52ad8580-34d7-430f-b51b-b4dc366a1166`

- 首条有效内容：`2026-08-03T15:05:53.798Z`
- 会话 / 事件 / 日志：`52ad8580-34d7-430f-b51b-b4dc366a1166` / `81851eed-7d52-423d-8a0c-10e006883dc2` / `7bc1b0a2-9ad7-4171-a19a-d1d551f91147`
- Trace：`3d6e6b63-cb02-4303-9c87-b6ffff142789`、`55f2c55f-dfec-4670-a09b-7a93187f59be`、`8ad8ed8f-3d71-4439-b226-e6fda293cebe`、`9d0db4e7-92c7-41a6-ace3-afbbb0229c10`、`22e5f64d-8084-4849-9055-ec48ee2fa721`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/TIMEOUT；semantic/TIMEOUT
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `c345156c-f578-4315-ad46-079a68955636`

- 首条有效内容：`2026-08-03T15:05:53.800Z`
- 会话 / 事件 / 日志：`c345156c-f578-4315-ad46-079a68955636` / `012b6283-209e-4f8a-9ce9-22e6b55329a3` / `fe1873ef-7b86-4347-bea1-6e0af3b5fd3c`
- Trace：`0a32b065-82b3-4800-8b24-9b562f74ff28`、`30fee7c3-7793-4e9b-8637-cff4498aba90`、`2d2dc7ee-7c62-4f4f-bdcd-bd5e4794c63d`、`58e68885-84f2-46d4-881f-b0f0273e229a`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `5b45b4c8-b59d-419f-9f2e-b0ae7ec85729`

- 首条有效内容：`2026-08-03T15:05:53.807Z`
- 会话 / 事件 / 日志：`5b45b4c8-b59d-419f-9f2e-b0ae7ec85729` / `7cbf2aad-4490-4800-b3d6-c8ae42db35a3` / `c640cba3-2df0-4c3e-b3b8-c4522a5d5095`
- Trace：`04f88107-64d4-4127-b40a-8d97cc43503f`、`01f72c35-b7b6-407d-a37d-9f0faf163b7d`、`c1e8a124-60ae-4550-9682-215b0d5033b1`、`e6d80638-4d81-4096-874d-91fc5dcc7820`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `9f4b51eb-de2c-44f1-b735-50a7a379561f`

- 首条有效内容：`2026-08-03T15:05:53.817Z`
- 会话 / 事件 / 日志：`9f4b51eb-de2c-44f1-b735-50a7a379561f` / `026bf13a-fb71-4857-9c0d-72539c83cea7` / `a2a96aaa-d152-4fe5-b497-bbc5e85ec4b7`
- Trace：`7bf7ce6e-8e23-4836-b493-e9dd3fe1d847`、`7df5b748-a151-4476-8d3a-ecb549ea1116`、`a11b2ee7-c65d-49af-ae62-982ba7567ff2`、`6396988b-9423-4f9a-a03e-7006189c3839`、`7707ca8d-5063-4b42-888a-8f0ba9b282d1`、`d7d063f9-a8b7-4cc2-9940-05c8d6508fb6`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/TIMEOUT；semantic/TIMEOUT
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `60ec6aec-0405-4d9d-9a48-ba91352ca91a`

- 首条有效内容：`2026-08-03T15:05:53.822Z`
- 会话 / 事件 / 日志：`60ec6aec-0405-4d9d-9a48-ba91352ca91a` / `1a888d04-8432-44c5-bccf-9384ec857858` / `76ff8a55-96d6-49e7-b50d-9c123938473c`
- Trace：`781955a3-bf51-4be7-b0ff-e781608ff0da`、`acf736c6-0dc7-4935-8d95-237120fe3be9`、`359d7776-a529-4ed5-bc0a-60f330d7f7f8`、`28c55da8-be9d-48e4-b064-c2edd77bcca6`、`86177494-3d26-4ea7-9f5d-f0558724c67c`、`2213767f-022f-40db-807f-378df45f78dc`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/TIMEOUT；visible/TIMEOUT
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `639c966c-25e9-4bc2-badf-87be835c0333`

- 首条有效内容：`2026-08-03T15:05:53.826Z`
- 会话 / 事件 / 日志：`639c966c-25e9-4bc2-badf-87be835c0333` / `dc9be119-3abf-4347-9ad9-0c82074c7b44` / `33d32855-bf65-480f-b011-9b0343e90b90`
- Trace：`2b90cb09-b02d-4040-bd5f-d46db1bf66b8`、`4625ce26-3677-443e-9d16-837910c9e103`、`fa20c9a3-5ad0-42ba-aa89-53c9f206442a`、`44ff2710-3b47-41bf-bdda-aa6a63c5953a`、`18e4766b-d486-4224-8532-015ee8e18706`、`d1864833-f827-485b-bfca-69aaf1a83a0d`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
