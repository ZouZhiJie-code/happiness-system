# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-04T03:54:57.218Z`
- 观察截止时间：`2026-08-04T04:00:09.000Z`
- 入选：`8/8` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `0.05s`，P90 `25.39s`，速度档位 `repair`。
- 可继续操作：中位数 `0.09s`，P90 `25.42s`，速度档位 `repair`。
- 模型耗时：中位数 `14.83s`，P90 `27.77s`；非模型耗时：中位数 `0.07s`，P90 `0.08s`。
- 真实生成式回合：`17` 次；确定性控制动作：`9` 次。
- 实际 provider 调用：`46` 次；deterministic / disabled 诊断：`24` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`8` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`4` 次；局部确定性修复：`0` 次。
- 运行降级：累计 `10` 次，最大连续 `5` 次；最近 `17` 个真实生成式回合降级率 `58.8%`。
- 降级错误码分布：`{"SERVICE_UNAVAILABLE_ERROR":4,"INVALID_SCHEMA":1,"visible_turn_uses_unquoted_user_first_person":1,"TIMEOUT":2}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `8`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `是`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 34 |
| `event_centered_checkpoint_reached` | 20 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 10 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `b7a37a4a-8701-4175-b8b5-53a4c6acc9ab` | baseline | feeling / checkpoint_two | 1 / 4 / 1 / 1 | 0.05s / 12.11s | 0.09s / 12.15s | 是 | 是 | 待填写 |
| 2 | `c5c6e534-9616-4a72-90ed-a61f812b5ea8` | baseline | feeling / deep_companionship | 3 / 10 / 1 / 3 | 7.99s / 23.49s | 8.02s / 23.53s | 是 | 是 | 待填写 |
| 3 | `f12b2558-be4f-4ac5-b1a9-fada81361c22` | baseline | thought / checkpoint_two | 1 / 2 / 1 / 1 | 0.02s / 13.91s | 0.05s / 13.95s | 是 | 是 | 待填写 |
| 4 | `e0388421-1e16-4477-8148-7de7c05af940` | mixed | thought / checkpoint_two | 3 / 7 / 1 / 1 | 7.50s / 11.01s | 7.55s / 11.03s | 是 | 是 | 待填写 |
| 5 | `ab907d55-2137-410b-beef-eee76ad7da08` | mixed | relationship / checkpoint_two | 2 / 4 / 1 / 1 | 0.02s / 8.48s | 0.03s / 8.53s | 是 | 是 | 待填写 |
| 6 | `36caba37-15c0-4b51-a017-86a96fbb6c27` | mixed | relationship / deep_companionship | 3 / 10 / 1 / 2 | 25.39s / 33.23s | 25.42s / 33.26s | 是 | 是 | 待填写 |
| 7 | `17082968-bee3-420f-91bb-4390fe746d12` | generative | action / checkpoint_two | 1 / 2 / 2 / 0 | 0.02s / 15.14s | 0.03s / 15.14s | 是 | 是 | 待填写 |
| 8 | `75fb4f60-6332-4432-ae94-700d4393d367` | mixed | action / checkpoint_two | 3 / 7 / 1 / 1 | 15.13s / 27.80s | 15.17s / 27.83s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `b7a37a4a-8701-4175-b8b5-53a4c6acc9ab`

- 首条有效内容：`2026-08-04T03:54:57.284Z`
- 会话 / 事件 / 日志：`b7a37a4a-8701-4175-b8b5-53a4c6acc9ab` / `3f49936a-9259-4519-896b-f7716bb49974` / `3f0e92cf-a155-4585-8a2e-d2f2b40e6fd5`
- Trace：`f916f4a1-e719-489c-a9aa-9493d0f10137`、`3ea2c4e8-a814-44ea-a847-f4383e5defb5`、`0fc5d45f-535e-40d0-a87f-2fca6d5c4218`、`e6edcab3-dc80-48c8-bfc8-2fc74c928d2b`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/SERVICE_UNAVAILABLE_ERROR；visible/SERVICE_UNAVAILABLE_ERROR
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `c5c6e534-9616-4a72-90ed-a61f812b5ea8`

- 首条有效内容：`2026-08-04T03:55:13.637Z`
- 会话 / 事件 / 日志：`c5c6e534-9616-4a72-90ed-a61f812b5ea8` / `fe877b2e-e193-40d4-8eec-cc79ebafe7ee` / `8b69b8ee-fabe-434b-9ef5-38789f9ea2a1`
- Trace：`978becf7-febb-4f70-8c0f-e3e193c9833a`、`00b7e655-886e-43c2-9bb8-ada1ed6d479d`、`7a453d12-dd58-4b27-9d45-d453e4b5e9c2`、`61cd25a1-8b71-4e1d-b93d-5316326bcb3d`、`90894979-acb5-4580-8c34-9db858a82f5a`、`36c8d622-08cc-4cba-ace5-98d96885de97`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/SERVICE_UNAVAILABLE_ERROR；visible/SERVICE_UNAVAILABLE_ERROR；interview_turn/SERVICE_UNAVAILABLE_ERROR；visible/SERVICE_UNAVAILABLE_ERROR；interview_turn/INVALID_SCHEMA；visible/INVALID_SCHEMA
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `f12b2558-be4f-4ac5-b1a9-fada81361c22`

- 首条有效内容：`2026-08-04T03:56:04.237Z`
- 会话 / 事件 / 日志：`f12b2558-be4f-4ac5-b1a9-fada81361c22` / `471bc70e-6d28-4e9a-a023-1af3209197ed` / `c4c9f032-1638-458c-a77b-4444ba759279`
- Trace：`0f6526d0-755b-443c-bff8-a513bed5821a`、`54784e9b-3abc-4fc0-8f38-6581d4943089`、`34a0c2a1-fd24-4acd-a52a-d2aef127691c`、`1c2c5ef0-f23f-43dd-b231-6f1af6e9fb41`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/SERVICE_UNAVAILABLE_ERROR；semantic/SERVICE_UNAVAILABLE_ERROR
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `e0388421-1e16-4477-8148-7de7c05af940`

- 首条有效内容：`2026-08-04T03:56:21.179Z`
- 会话 / 事件 / 日志：`e0388421-1e16-4477-8148-7de7c05af940` / `6e3265ab-4b1a-4df6-be59-fd85461c1962` / `caea1c45-b522-4be9-adca-83ea41dc4123`
- Trace：`a40ead99-93ed-4523-9852-2f4a66faf7fb`、`8fcd6be9-481b-434a-bd07-8d720a296e41`、`5ce66e1f-bd54-463e-9224-bc9ec1c27b23`、`d3e1ee90-8069-4b4d-804d-5280c379b050`、`0cacec27-b6fa-4f61-8d42-a65f253d9e38`、`5c90cf6f-b23e-435e-8e3a-58c3dc179eff`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/visible_turn_uses_unquoted_user_first_person；visible/visible_turn_uses_unquoted_user_first_person
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `ab907d55-2137-410b-beef-eee76ad7da08`

- 首条有效内容：`2026-08-04T03:56:51.100Z`
- 会话 / 事件 / 日志：`ab907d55-2137-410b-beef-eee76ad7da08` / `5712b580-61a1-4e81-b62e-9a1dffe29f0d` / `d461c059-c6c6-4997-9cd4-df23f40c9075`
- Trace：`0938d35c-d688-4e07-9830-51ecc7404192`、`2e4919cf-9113-4dd0-8ae4-6a6067b8e2a0`、`0d025403-6a12-43fb-ac57-225c15173876`、`ec02b4ba-e6a8-4986-a0db-e3bda33f9221`、`d164c6b8-b16e-4f35-8ae1-39023854844c`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/SERVICE_UNAVAILABLE_ERROR；semantic/SERVICE_UNAVAILABLE_ERROR
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `36caba37-15c0-4b51-a017-86a96fbb6c27`

- 首条有效内容：`2026-08-04T03:57:11.254Z`
- 会话 / 事件 / 日志：`36caba37-15c0-4b51-a017-86a96fbb6c27` / `273dbd78-85b9-41f3-bff7-b90308d3b23d` / `771fa4ca-4f2e-491b-808d-7e24de86d8c9`
- Trace：`71e73a7a-4314-4f44-8ba6-f1ee1690893a`、`35556cd4-99ee-410e-8452-c96878219421`、`b470704b-d0fc-4277-81c3-0e369f1b9259`、`116c841e-dc16-4549-830c-02cb2e0642a9`、`1ee87d05-9232-4103-97a6-f44d8f0a11aa`、`16c427f4-69c6-48ba-9dea-48b342bc1ae3`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/TIMEOUT；visible/TIMEOUT；interview_turn/TIMEOUT；visible/TIMEOUT
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `17082968-bee3-420f-91bb-4390fe746d12`

- 首条有效内容：`2026-08-04T03:58:38.338Z`
- 会话 / 事件 / 日志：`17082968-bee3-420f-91bb-4390fe746d12` / `134e0502-b00d-476b-9fd8-913abc540e49` / `3921b5f3-8ce9-4728-9709-38d0375c1f1b`
- Trace：`8088ca68-d460-4eaa-9cca-6ca1f7ae2db0`、`11cb0f74-5e60-4240-8a6b-6707eff8a966`、`f17b6335-4174-49af-931d-f67608a0e1a1`、`6fdaeeaf-165b-451a-9f15-b3df54ffefac`、`8da3cc5f-43f8-4807-922a-2c53043c1c2d`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `75fb4f60-6332-4432-ae94-700d4393d367`

- 首条有效内容：`2026-08-04T03:58:58.112Z`
- 会话 / 事件 / 日志：`75fb4f60-6332-4432-ae94-700d4393d367` / `91df678b-4972-45b1-ad37-cfd7ef2a3a1c` / `3fe6e056-8de5-4765-97e2-89fd55f453bc`
- Trace：`c4752486-8445-4ee0-996c-2b96e659b575`、`ad69147c-cbed-4081-ae29-4d11a3509a6b`、`fc4589db-8430-494d-99a0-114ec5d0835d`、`6fea4738-f038-43dc-b664-3d36dbc852f7`、`78f64051-d434-4abe-8dab-126d804bb862`、`1b3d435c-9226-48e7-8048-0cd550d5706d`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/TIMEOUT；visible/TIMEOUT
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
