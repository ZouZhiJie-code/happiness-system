# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-04T05:00:00.000Z`
- 观察截止时间：`2026-08-04T05:26:49.285Z`
- 入选：`8/10` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `3.85s`，P90 `4.97s`，速度档位 `pass`。
- 可继续操作：中位数 `3.89s`，P90 `5.00s`，速度档位 `pass`。
- 模型耗时：中位数 `4.57s`，P90 `7.82s`；非模型耗时：中位数 `0.06s`，P90 `0.07s`。
- 真实生成式回合：`18` 次；确定性控制动作：`9` 次。
- 实际 provider 调用：`40` 次；deterministic / disabled 诊断：`12` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`8` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`1` 次；局部确定性修复：`6` 次。
- 运行降级：累计 `2` 次，最大连续 `1` 次；最近 `18` 个真实生成式回合降级率 `11.1%`。
- 降级错误码分布：`{"user_articulated_origin_adds_unstated_relation":1,"visible_turn_uses_unquoted_user_first_person":1}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `8`，标题修复 `0`，全文安全回退 `0`。
- 回退信号：首批降级门 `否`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 0 |
| `event_centered_entry_opened` | 0 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 35 |
| `event_centered_checkpoint_reached` | 19 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 2 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `0005f87a-2ab8-41c0-badd-ae92f4d87cf4` | baseline | feeling / checkpoint_two | 1 / 3 / 1 / 1 | 0.03s / 7.85s | 0.07s / 7.87s | 是 | 是 | 待填写 |
| 2 | `262994fb-c3d1-414a-a032-f851af4cd73f` | generative | feeling / checkpoint_two | 4 / 10 / 1 / 0 | 4.07s / 11.08s | 4.07s / 11.11s | 是 | 是 | 待填写 |
| 3 | `87dc1d36-6ad1-415d-b0b6-8de4483ac746` | baseline | thought / checkpoint_two | 1 / 3 / 1 / 1 | 0.01s / 7.68s | 0.03s / 7.71s | 是 | 是 | 待填写 |
| 4 | `77704353-d9c3-4860-9bce-60de8c406b0d` | generative | thought / checkpoint_two | 3 / 6 / 1 / 0 | 4.01s / 4.24s | 4.05s / 4.26s | 是 | 是 | 待填写 |
| 5 | `e87d8510-3c43-46ff-b42a-4349633d086e` | generative | relationship / checkpoint_two | 1 / 2 / 1 / 0 | 0.01s / 4.18s | 0.03s / 4.18s | 是 | 是 | 待填写 |
| 6 | `31a614e6-f49b-4afb-8c63-1a1ef5f6b961` | generative | relationship / checkpoint_two | 4 / 8 / 1 / 0 | 3.85s / 4.97s | 3.89s / 5.00s | 是 | 是 | 待填写 |
| 7 | `99aa8524-1c20-4354-8313-71c441ed461a` | generative | action / checkpoint_two | 1 / 2 / 2 / 0 | 0.01s / 4.74s | 0.03s / 4.74s | 是 | 是 | 待填写 |
| 8 | `538bffe8-63d6-481b-b4e2-b012c2d86cb2` | generative | action / checkpoint_two | 3 / 6 / 1 / 0 | 4.23s / 4.93s | 4.26s / 4.98s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `0005f87a-2ab8-41c0-badd-ae92f4d87cf4`

- 首条有效内容：`2026-08-04T05:24:34.693Z`
- 会话 / 事件 / 日志：`0005f87a-2ab8-41c0-badd-ae92f4d87cf4` / `b37b7934-922d-444d-9383-2a8e0ccb632c` / `f30bde9b-5fc5-49f2-863e-2a8726aa00d4`
- Trace：`a55e39d4-692c-4706-8fa5-405adb42713d`、`8be844f3-fa50-43f9-8ec9-b6a690d87a62`、`e4298f64-3390-451b-b283-b01ec04e7566`、`cb5ec679-8663-433d-8646-bc1ea8ecbd18`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/user_articulated_origin_adds_unstated_relation；visible/user_articulated_origin_adds_unstated_relation
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `262994fb-c3d1-414a-a032-f851af4cd73f`

- 首条有效内容：`2026-08-04T05:24:44.932Z`
- 会话 / 事件 / 日志：`262994fb-c3d1-414a-a032-f851af4cd73f` / `45acf5c1-d936-442c-aec9-f97cb34c2620` / `82eb0b16-0f0a-48e9-9d43-fbff27f65448`
- Trace：`f530769f-2f00-4e5b-804f-785953555399`、`dea8e9f4-acd7-4a9e-bf85-0cc13839aaec`、`39ca4fde-b35b-4e4d-8ee0-dbc37ccc5026`、`5fb7f0eb-1972-435e-b852-452bed54f987`、`3ee4de6c-d688-4d6e-8e5b-528ce17da195`、`858ab3ce-ac1e-4934-9e47-78a2f816006f`、`42b386c6-25a1-41d8-8459-8ca9a7716ae2`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `87dc1d36-6ad1-415d-b0b6-8de4483ac746`

- 首条有效内容：`2026-08-04T05:25:12.929Z`
- 会话 / 事件 / 日志：`87dc1d36-6ad1-415d-b0b6-8de4483ac746` / `6c48ea37-0ff0-476e-905c-7676506d3199` / `de26b332-565b-4ba9-acb8-4ef6f7b8c228`
- Trace：`44351885-ade4-4029-9fa2-df4d7d7f1bcf`、`46a51b04-b3b1-47e4-9f9a-d5d49e5a2116`、`0a8c4782-0273-493c-8519-1e90b052c930`、`cc9ca719-75c3-48f6-9a80-198adc2d6dee`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/visible_turn_uses_unquoted_user_first_person；visible/visible_turn_uses_unquoted_user_first_person
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `77704353-d9c3-4860-9bce-60de8c406b0d`

- 首条有效内容：`2026-08-04T05:25:23.775Z`
- 会话 / 事件 / 日志：`77704353-d9c3-4860-9bce-60de8c406b0d` / `6b069a48-a719-49bf-b9d3-30f5e51839e5` / `2e6840a6-1b66-4ec3-9b22-6f8f7d436a1c`
- Trace：`37676ace-cafd-45a5-98ce-d2d0105e577e`、`bdbc48ab-7725-4696-bd23-5a9ac5d29d31`、`cb9e8168-d64e-4bb0-b223-d0413436b7ac`、`bcdb26cb-59fd-4977-b64c-0bb169b071e1`、`041f4d68-4213-41c5-9908-b3c5dbc7ecb8`、`1be63ba8-02fb-45bb-8294-07de9133a652`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `e87d8510-3c43-46ff-b42a-4349633d086e`

- 首条有效内容：`2026-08-04T05:25:40.214Z`
- 会话 / 事件 / 日志：`e87d8510-3c43-46ff-b42a-4349633d086e` / `44fab805-1e01-4356-9b92-ace810f8a6c2` / `a6f1c466-f81a-4955-b323-bb3b99c5bffb`
- Trace：`3281a350-2067-4891-91e5-e4a587c43689`、`f8511aa8-5d68-4726-ba98-2a96c2a29f3f`、`48691b77-570b-42ba-9b1f-9306e5b2f0cd`、`2da9a95f-315e-49bd-8647-d4a62e5edce1`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `31a614e6-f49b-4afb-8c63-1a1ef5f6b961`

- 首条有效内容：`2026-08-04T05:25:47.054Z`
- 会话 / 事件 / 日志：`31a614e6-f49b-4afb-8c63-1a1ef5f6b961` / `b935eefd-d2d4-4a33-9df9-7fc520c5cacd` / `4265c67e-a8d1-4a67-be46-c40ba1cf3344`
- Trace：`994d389d-4ced-403f-9202-57e36c645ce4`、`2784942a-b4b2-4694-8f87-0c228733ea3f`、`c4e6d8a3-901e-4a23-81d0-c23a39bde647`、`c7c73c7f-5b76-4114-a765-b015b340b83f`、`e4e1bd7f-c05a-487a-8fc7-5cf9f82a91f5`、`853bdf0c-e73d-41eb-a1da-e86ffb7a3519`、`61b1d764-cfce-49e9-b144-7e408dc0766b`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `99aa8524-1c20-4354-8313-71c441ed461a`

- 首条有效内容：`2026-08-04T05:26:07.715Z`
- 会话 / 事件 / 日志：`99aa8524-1c20-4354-8313-71c441ed461a` / `1d51d7bc-22f6-4f03-8f21-446ee395af9f` / `c41484bc-735e-42de-81d5-26a671d5a8f8`
- Trace：`6c15e193-41d1-452b-b8e2-4ac355cef991`、`c4238742-9ed9-489c-8b28-644ed82072a2`、`e6592bfe-6eed-48fa-bcdf-1e25318f94f0`、`592efacb-c3ea-4f42-9819-6fe1b972814e`、`cb3738e6-2996-473c-830f-a6cf34230756`
- 检查点：first、second
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `538bffe8-63d6-481b-b4e2-b012c2d86cb2`

- 首条有效内容：`2026-08-04T05:26:15.948Z`
- 会话 / 事件 / 日志：`538bffe8-63d6-481b-b4e2-b012c2d86cb2` / `a8a49012-7b07-4a93-93ee-7fdbcf4b57b5` / `79968f9a-6962-4074-bc2e-e084ddcb3df9`
- Trace：`e57a84a2-2eaa-4cbe-94f5-6d2a792a8e02`、`cc1b9e0b-dad4-4bd9-9be8-3b20224cbc42`、`1c218632-9975-4d47-9444-951972508eea`、`64fc508f-cced-4c64-bfc8-f48e2d918320`、`0286c154-be1b-4f53-9cf7-c6a62209f8d3`、`c1d3224e-c15f-4d3a-8d41-c1a64dd4fc39`
- 检查点：first、second、deep_pause
- 失败阶段与错误码：无已记录失败
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
