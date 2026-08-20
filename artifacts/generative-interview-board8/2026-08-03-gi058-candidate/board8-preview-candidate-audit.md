# 板块 8｜Preview 候选只读审计

- 报告版本：`board8.candidate-aware.v4`
- 候选观察起点：`2026-08-03T10:40:00.000Z`
- 观察截止时间：`2026-08-03T11:10:00.000Z`
- 入选：`8/8` 个根会话；按首条有效事件内容时间排序并去重

## 自动汇总

- 完整文本可见：中位数 `0.03s`，P90 `0.41s`，速度档位 `pass`。
- 可继续操作：中位数 `0.07s`，P90 `0.45s`，速度档位 `pass`。
- 模型耗时：中位数 `0.07s`，P90 `0.41s`；非模型耗时：中位数 `0.07s`，P90 `0.09s`。
- 真实生成式回合：`15` 次；确定性控制动作：`8` 次。
- 实际 provider 调用：`30` 次；deterministic / disabled 诊断：`44` 次，后者不进入模型尝试分母。
- 事件记录入口识别：`14` 次；该阶段不计入正式复盘生成式降级分母。
- 生成式定向修复后通过：`0` 次；局部确定性修复：`0` 次。
- 运行降级：累计 `15` 次，最大连续 `15` 次；最近 `15` 个真实生成式回合降级率 `100.0%`。
- 降级错误码分布：`{"INVALIDENDPOINTORMODEL.NOTFOUND":8}`。
- 事件日志：生成 `8` 个会话，保存 `8` 个会话，24 小时内保存 `8` 个会话；AI 接受 `0`，标题修复 `0`，全文安全回退 `8`。
- 回退信号：首批降级门 `是`；最近 20 回合门 `否`；日志连续失败门 `否`。

## 漏斗

| 事件 | 次数 |
|---|---:|
| `event_centered_entry_exposed` | 1 |
| `event_centered_entry_opened` | 1 |
| `event_centered_first_content_submitted` | 8 |
| `event_centered_response_completed` | 37 |
| `event_centered_checkpoint_reached` | 17 |
| `event_journal_generation_started` | 8 |
| `event_journal_generated` | 8 |
| `event_journal_saved` | 8 |
| `event_centered_turn_fallback` | 15 |
| `event_centered_session_abandoned` | 0 |

## 首批会话

| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `1f08e16c-ec4d-4ada-814a-1a1b76ace2b7` | baseline | feeling / checkpoint_two | 1 / 2 / 1 / 1 | 0.04s / 0.42s | 0.10s / 0.47s | 是 | 是 | 待填写 |
| 2 | `fe9f9d6c-4d70-45c2-86b0-cbb01f679e0e` | baseline | thought / checkpoint_two | 3 / 6 / 1 / 3 | 0.09s / 0.41s | 0.13s / 0.45s | 是 | 是 | 待填写 |
| 3 | `0da6b851-635c-42e5-b2b5-a5132e2c1d2e` | baseline | feeling / checkpoint_two | 1 / 2 / 1 / 1 | 0.03s / 0.60s | 0.06s / 0.65s | 是 | 是 | 待填写 |
| 4 | `cc926ae5-9069-4483-8ac8-028a4306cd09` | baseline | thought / checkpoint_two | 2 / 4 / 1 / 2 | 0.03s / 0.39s | 0.07s / 0.43s | 是 | 是 | 待填写 |
| 5 | `2464f5c5-a229-415c-ac12-2168590d6d53` | baseline | relationship / checkpoint_two | 2 / 4 / 1 / 2 | 0.03s / 0.45s | 0.05s / 0.50s | 是 | 是 | 待填写 |
| 6 | `4798a97b-5beb-46b7-a71c-29ad5a2483d2` | baseline | relationship / checkpoint_two | 2 / 4 / 1 / 2 | 0.03s / 0.10s | 0.05s / 0.14s | 是 | 是 | 待填写 |
| 7 | `06c9429f-af70-4544-9162-d2e1bb9c8318` | baseline | action / checkpoint_two | 2 / 4 / 1 / 2 | 0.03s / 0.38s | 0.05s / 0.43s | 是 | 是 | 待填写 |
| 8 | `cfec791a-e928-4961-b1a4-961641674c1d` | baseline | action / checkpoint_two | 2 / 4 / 1 / 2 | 0.03s / 0.11s | 0.06s / 0.14s | 是 | 是 | 待填写 |

## 逐会话人工裁决

### 1. `1f08e16c-ec4d-4ada-814a-1a1b76ace2b7`

- 首条有效内容：`2026-08-03T10:42:04.322Z`
- 会话 / 事件 / 日志：`1f08e16c-ec4d-4ada-814a-1a1b76ace2b7` / `c4ecb268-1115-4517-a5bc-97bb1af1089f` / `5c903097-a9bc-4cf2-b8ac-50bcdbc22f1a`
- Trace：`639218fb-16d2-4d27-ba0d-f2512e3af3a9`、`cd999a3f-30bd-4438-a2a2-a7264300e51d`、`3cd1be54-90aa-4b8d-8bff-ac0ea5ef517f`、`d23ef8cf-f25e-4d00-b453-568ad62f0b83`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 2. `fe9f9d6c-4d70-45c2-86b0-cbb01f679e0e`

- 首条有效内容：`2026-08-03T10:43:39.298Z`
- 会话 / 事件 / 日志：`fe9f9d6c-4d70-45c2-86b0-cbb01f679e0e` / `b79c164f-0de9-4aac-9888-5cb8bef7297d` / `c2bd69b2-ea79-4c94-b29b-c8ea68875950`
- Trace：`fd38652d-cfa3-4de0-a44a-13d343043e13`、`cf7343f8-e56d-4728-b0cd-c472d7d88317`、`ac0729e3-3c25-4f0c-8671-711165850b70`、`4676b9d4-7c42-4fd2-948d-85fff297dd3d`、`ce70fc87-d435-4471-8bee-b2d57261b1d1`、`5eeccda8-9dbc-4ffb-a73f-ed17dd2fdbe2`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND；interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND；interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 3. `0da6b851-635c-42e5-b2b5-a5132e2c1d2e`

- 首条有效内容：`2026-08-03T10:45:42.861Z`
- 会话 / 事件 / 日志：`0da6b851-635c-42e5-b2b5-a5132e2c1d2e` / `ed190db8-e505-4314-899c-31943bc6d6e3` / `290f611a-4512-43ff-a49d-6ee74f995ea2`
- Trace：`a0652e2f-c3f6-4587-86d9-92525ce170de`、`36e1b079-3ded-4991-8431-57aaa4a2c0a0`、`5b95f01d-eb14-4fef-ae48-4ecb7afd0773`、`58c56834-bbc0-4a07-b711-fb603998dbc6`、`7a599c31-1b71-4278-b60e-6049157df96d`、`512005f7-dc0c-4343-90f3-6d663066d3d0`、`1d3cd1a3-2087-4446-af89-01935d3274b4`、`b2ca920e-49b1-4050-882b-fb3bf9515242`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 4. `cc926ae5-9069-4483-8ac8-028a4306cd09`

- 首条有效内容：`2026-08-03T10:48:47.875Z`
- 会话 / 事件 / 日志：`cc926ae5-9069-4483-8ac8-028a4306cd09` / `ce967b6e-5463-4c38-9fc8-cedf7bd09391` / `15fdf5b3-254a-4fb0-94e7-c74b8023baf3`
- Trace：`2dfae730-2328-495d-8d82-ced74bf26c0a`、`92673bb1-7222-42be-9144-d401bb8c8625`、`3b487455-1805-406d-baac-0fe3a0429eac`、`eea1443c-45bb-45c3-9d0e-c4d4dc94ccad`、`81c6a3cb-0af1-4626-a955-aa441e98bf94`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND；interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 5. `2464f5c5-a229-415c-ac12-2168590d6d53`

- 首条有效内容：`2026-08-03T10:50:32.988Z`
- 会话 / 事件 / 日志：`2464f5c5-a229-415c-ac12-2168590d6d53` / `74ffc10e-5922-432b-8cc4-3c50a71713be` / `0df4397d-93bd-425d-aa80-25a6c9ab0b4f`
- Trace：`7746fb5c-bf08-424c-aa84-d8d8f1fdf9ae`、`51912429-8d33-468b-9fc8-258900f49bd2`、`66b18cff-9ce1-4f3b-8249-7da0f061181a`、`742fcf4c-f371-417b-9698-18bf3d334960`、`8ffc1376-69f5-4172-8a30-d3ba77208820`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND；interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 6. `4798a97b-5beb-46b7-a71c-29ad5a2483d2`

- 首条有效内容：`2026-08-03T10:51:12.024Z`
- 会话 / 事件 / 日志：`4798a97b-5beb-46b7-a71c-29ad5a2483d2` / `67bbdc91-a5a9-4fec-ac8c-a2ef5d8a3aa7` / `0afb67a3-df73-4431-9c0d-243a08c0708c`
- Trace：`fc476d70-1480-4ab0-9f2a-fb857e85264c`、`4fa755ac-947e-48b6-8180-7884f3747f32`、`ff2e836d-5ae3-45d6-8b8c-b5c38478b051`、`8b5618af-7613-4af3-ba1d-466a472c46cb`、`e91d154f-012e-4dce-bd8f-a6f6cffc38ef`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND；interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 7. `06c9429f-af70-4544-9162-d2e1bb9c8318`

- 首条有效内容：`2026-08-03T10:51:50.975Z`
- 会话 / 事件 / 日志：`06c9429f-af70-4544-9162-d2e1bb9c8318` / `2a403715-0c4a-4c17-b990-aa86cb67a862` / `d3f66258-949a-436e-a0b5-a14976fc8910`
- Trace：`7f817803-3e93-4598-b558-b2d2c15554c1`、`7be66f77-16e0-47c0-915c-4e76f43ec954`、`14ff54dd-5b11-4f5b-9edd-4710d99981be`、`e7952704-3d98-4b4f-8390-62f0e3c7e519`、`e9a80868-4386-47ca-89e6-5ce5f4db28f3`、`3a547eab-4b4b-4c17-b17b-ee851f8f1578`、`0288860f-8573-427a-b33c-e237bb9acc3b`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND；interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

### 8. `cfec791a-e928-4961-b1a4-961641674c1d`

- 首条有效内容：`2026-08-03T10:53:45.385Z`
- 会话 / 事件 / 日志：`cfec791a-e928-4961-b1a4-961641674c1d` / `a0222d53-f623-434f-a03c-7ed4aedb9bb0` / `00bb0ff5-5db1-4ce9-9389-76093c6809ac`
- Trace：`b7bc39ea-9cd1-42de-ac6c-441af43065fe`、`48573b58-430f-4dd2-a9f5-79c7ee181ed4`、`3458ae95-2d8b-466a-99de-4ddeb8e3c720`、`1c3d8139-1806-49cf-b4c2-df7726409b23`、`db6307d2-2f27-47c0-87c3-dc33565dcda7`
- 检查点：first、second
- 失败阶段与错误码：interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND；interview_turn/INVALIDENDPOINTORMODEL.NOTFOUND；semantic/INVALIDENDPOINTORMODEL.NOTFOUND
- 人工结论：____________（通过 / 条件通过 / 失败）
- 脱敏问题摘要：____________
- 评审人 / 时间：____________

## 隐私边界

报告固定排除：用户原话、AI 全文、事件日志标题与正文、Trace contextSnapshot、Trace finalOutput、模型请求与响应正文。人工问题摘要只填写脱敏信息。
