# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-04T04:47:16.441Z`
- 观察截止时间：`2026-08-04T04:50:00.000Z`
- 入选：`8/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `0.03s`，P90 `6.59s`，速度档位 `pass`。
- 可继续操作：中位数 `0.06s`，P90 `6.61s`，速度档位 `pass`。
- 模型耗时：中位数 `4.62s`，P90 `7.36s`；非模型耗时：中位数 `0.07s`，P90 `0.07s`。
- 真实生成式回合：`16` 次；确定性控制动作：`9` 次。
- 实际 provider 调用：`39` 次；deterministic / disabled 诊断：`17` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`8` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`0` 次；局部确定性修复：`0` 次。
- 运行降级：累计 `6` 次，最大连续 `2` 次；最近 `16` 个真实生成式回合降级率 `37.5%`。
- 降级错误码分布：`{"user_articulated_origin_adds_unstated_relation":1,"thinking_summary_repeats_user_expression":2,"visible_turn_uses_unquoted_user_first_person":3}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `8`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `是`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 33 |
| `event_centered_checkpoint_reached` | 20 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 6 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `f00bca44-6d93-47fd-8d39-d39c02a73295` | baseline | feeling / checkpoint_two | 1 / 3 / 1 / 1 | 0.03s / 7.48s | 0.06s / 7.50s | 是 | 是 | 待填写 |
| 2 | `875f36c8-c01a-48e9-a9f3-7b1b0e229236` | mixed | feeling / checkpoint_two | 3 / 7 / 1 / 1 | 3.49s / 7.43s | 3.53s / 7.43s | 是 | 是 | 待填写 |
| 3 | `4f400ee0-5a40-46c3-aec9-91834d26cdd1` | baseline | thought / checkpoint_two | 1 / 3 / 1 / 1 | 0.02s / 6.59s | 0.03s / 6.61s | 是 | 是 | 待填写 |
| 4 | `07d0f790-35c5-4c69-806f-ae93e8fd31ee` | mixed | thought / checkpoint_two | 3 / 7 / 1 / 1 | 3.97s / 7.13s | 4.01s / 7.16s | 是 | 是 | 待填写 |
| 5 | `87aaa00b-ad04-456d-9691-d1e9966f0e76` | generative | relationship / checkpoint_two | 1 / 2 / 1 / 0 | 0.02s / 3.71s | 0.04s / 3.71s | 是 | 是 | 待填写 |
| 6 | `b0c71dd8-a130-452f-8e35-8411d91a62c5` | mixed | relationship / deep_companionship | 3 / 9 / 1 / 2 | 5.29s / 6.55s | 5.33s / 6.58s | 是 | 是 | 待填写 |
| 7 | `add88887-4c8c-47e2-819d-6f4cd053c760` | generative | action / checkpoint_two | 1 / 2 / 2 / 0 | 0.01s / 3.83s | 0.03s / 3.83s | 是 | 是 | 待填写 |
| 8 | `8e87cd4d-017d-415a-8c9f-26e04b174ff9` | generative | action / checkpoint_two | 3 / 6 / 1 / 0 | 3.71s / 4.01s | 3.71s / 4.06s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `f00bca44-6d93-47fd-8d39-d39c02a73295`

- 首条有效内容：`2026-08-04T04:47:16.491Z`
- 会话 / 事件 / 日志：`f00bca44-6d93-47fd-8d39-d39c02a73295` / `44389fdd-f522-460e-b22d-84178d9e551b` / `2eba43b7-4ee2-4c0d-8d4a-eec7a13f9cf7`
- Trace：`ba213899-9c72-432c-9f9f-c52f33ddf5d9`、`fa37cde3-833e-451b-a602-d2af31c7e626`、`6ccf9670-a44c-44e6-849d-a1803c032917`、`deccd904-039f-4adf-a9ef-f7f650035a22`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `875f36c8-c01a-48e9-a9f3-7b1b0e229236`

- 首条有效内容：`2026-08-04T04:47:26.599Z`
- 会话 / 事件 / 日志：`875f36c8-c01a-48e9-a9f3-7b1b0e229236` / `756f5968-d2a4-4c5c-9916-632cba4c4db1` / `974676ea-307a-4bc5-ae2b-69d94fe39e01`
- Trace：`0591203a-5bce-41ab-996a-3f82f42a49ed`、`3ad28a13-96a8-4443-b9a7-674a50ef2ee7`、`67267b1c-e204-455c-b3dd-a2936a56ed24`、`2de4eff6-f5e6-48d8-9a06-70852824fc40`、`a59a0745-3a2d-4ca1-9fde-0783842d7fe2`、`d4475f2f-28a3-4c07-a2a3-d50188852387`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/thinking_summary_repeats_user_expression；visible/thinking_summary_repeats_user_expression
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `4f400ee0-5a40-46c3-aec9-91834d26cdd1`

- 首条有效内容：`2026-08-04T04:47:46.511Z`
- 会话 / 事件 / 日志：`4f400ee0-5a40-46c3-aec9-91834d26cdd1` / `7c74fd94-2ab8-4703-a6d0-2f01df3642c7` / `211ca200-8561-4d38-8016-7849e3b4f894`
- Trace：`197ab6ea-da2f-468c-9052-cbed33a034bf`、`61b3f38b-9764-4c4e-a6ae-c760ffb5a8ae`、`e4250ccf-723b-46e6-a3a6-aac7c0a965ff`、`a93c17aa-009f-4fca-b931-af54ea5328de`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/visible_turn_uses_unquoted_user_first_person；visible/visible_turn_uses_unquoted_user_first_person
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `07d0f790-35c5-4c69-806f-ae93e8fd31ee`

- 首条有效内容：`2026-08-04T04:47:55.335Z`
- 会话 / 事件 / 日志：`07d0f790-35c5-4c69-806f-ae93e8fd31ee` / `6bdc2d4d-22b1-46db-baca-7a86c3b38c3e` / `728cab84-55c5-44ae-8d8e-5c09be71f250`
- Trace：`355d4c08-0a72-481f-9893-03a4ff014d26`、`6ec93c46-ca64-4744-b413-b71727879087`、`38e67b90-50fb-4d23-9855-56f99f204e57`、`1242018e-2cce-42f9-9206-b7397df5a987`、`e10e5a52-494e-4b17-a7b0-7dd5cdbc88f7`、`c9cd7dda-bfd1-4796-9676-ef00c257930c`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/visible_turn_uses_unquoted_user_first_person；visible/visible_turn_uses_unquoted_user_first_person
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `87aaa00b-ad04-456d-9691-d1e9966f0e76`

- 首条有效内容：`2026-08-04T04:48:15.135Z`
- 会话 / 事件 / 日志：`87aaa00b-ad04-456d-9691-d1e9966f0e76` / `07a78e46-8866-412c-8443-2290d82db324` / `ec085528-2058-48c7-8e31-33d8923e0885`
- Trace：`f0dfc841-0b12-48a9-8841-ed063d0b8806`、`46e51cb0-4119-467c-a0d2-dfaf71829445`、`5bb4361a-1bd2-4a7b-a8b2-d282c076c93e`、`d5c83292-bee8-48a4-9e13-5d03aaa5cbc4`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `b0c71dd8-a130-452f-8e35-8411d91a62c5`

- 首条有效内容：`2026-08-04T04:48:21.473Z`
- 会话 / 事件 / 日志：`b0c71dd8-a130-452f-8e35-8411d91a62c5` / `39fa149c-1089-43dc-bc42-9f63e4e21945` / `b8f32d9a-0ac3-4a31-b3aa-8001f56dd6b5`
- Trace：`edae47d1-31fa-489a-aeb2-50a1d0800547`、`54241613-a8a4-4960-b432-e353a1c0369e`、`b01c6c98-8821-4bc3-a12a-a633b312cff0`、`e5bfaf95-f607-4450-9e52-4efdf41bd15f`、`998bd93e-14bf-4d02-8d4f-c1a114b9c5c2`、`25bd82ec-d126-4727-94d0-690773ab1b7f`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：interview_turn/visible_turn_uses_unquoted_user_first_person；visible/visible_turn_uses_unquoted_user_first_person；interview_turn/thinking_summary_repeats_user_expression；visible/thinking_summary_repeats_user_expression
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `add88887-4c8c-47e2-819d-6f4cd053c760`

- 首条有效内容：`2026-08-04T04:48:42.349Z`
- 会话 / 事件 / 日志：`add88887-4c8c-47e2-819d-6f4cd053c760` / `06de0ff9-6b02-4695-bee4-bc7d4c0b67a0` / `fd21f89b-d190-4f2c-a547-221335dc0dc0`
- Trace：`0863f88a-f6d6-42b4-964d-20e2b1ec4515`、`170308c9-ef2b-467f-a3c1-514ddaa81b76`、`9ecbafd2-d8d8-4560-86e8-8f94b1119cf1`、`f5713ebb-9c54-41e0-8124-1dc626266f4f`、`fd0c21e3-b343-4596-8fe0-749c8b0cef7a`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `8e87cd4d-017d-415a-8c9f-26e04b174ff9`

- 首条有效内容：`2026-08-04T04:48:49.359Z`
- 会话 / 事件 / 日志：`8e87cd4d-017d-415a-8c9f-26e04b174ff9` / `fb656342-98ff-4386-a6f9-8ec5f6f93145` / `11654656-e318-4e9d-83b8-1d2391dd0bf1`
- Trace：`bc6123f5-0838-438a-a27a-508d5a636532`、`5c798f7b-411e-4195-98d3-a93eceacdb00`、`b3aa52ad-85e9-40b9-b8cd-5e419842eb03`、`bb339359-1264-416c-8ec1-da2ebee894a2`、`eb0bfc77-1db1-43af-b541-056709c707f0`、`2d2dc512-ac4b-4d99-952f-d07fe359ac75`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
