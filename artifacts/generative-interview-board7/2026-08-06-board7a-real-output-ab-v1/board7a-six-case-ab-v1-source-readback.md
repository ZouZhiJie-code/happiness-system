# 板块 7A｜三条历史输入只读核验

核验时间：`2026-08-06T14:29:15Z`

核验结果：`通过`

## 1. 数据边界

- 数据库：`happiness_board8_preview_20260804_gi066_fix_candidate_5_65_v3`
- 数据库类型：本机隔离 Preview
- Production 数据：`0`
- 数据写入：`0`
- 保存范围：仅保存 H1～H3 所需的用户可见轮次、消息 ID、根会话 ID 与 Trace 血缘
- 人工替换：关闭；原文无法核验时整包暂停

## 2. 根会话与案例

| 案例 | 根会话 | 当前输入截止消息 | 失败证据 Trace |
|---|---|---|---|
| H1 | `8b8df99c-4e56-4501-a7aa-584c5c66632f` | `1228fecf-1a8a-47ec-9b4f-d6d01e300981` | 下一轮 `429c5428-ae46-4581-b25d-1e2e7b67837e` |
| H2 | `b03b9868-3cce-4a0a-a419-020f074a79d2` | `a0404de2-7191-48da-9b5e-3a2847ac7dfe` | 下一轮 `778bff39-1e98-42d7-ab57-c7b92895cd9e` |
| H3 | `b03b9868-3cce-4a0a-a419-020f074a79d2` | `564fe641-c98b-49b3-9bf4-29ad5ea40a83` | 下一轮 `d8ab4769-a331-4a03-b480-f48bd1b953a9` |

H1 使用事件 A 中用户明确纠正“两种感受并存”的决策点。H2 使用事件 B 中用户否定“场合”方向并明确指出“过去经历”新重点的决策点。H3 使用事件 B 中用户已经给出续费信息、当时反应、查看消息和过去经历线索的较早决策点。

## 3. 只读核验方式

本轮通过本机 PostgreSQL 只读查询核对：

1. 当前数据库名为指定隔离 Preview 库；
2. 两个根会话均存在；
3. 数据集中的历史消息 ID、顺序、角色与用户原话均能在 `InterviewMessage` 回读；
4. 用户可见 AI 内容从原消息 JSON 的 `naturalUnderstanding` 与 `naturalResponse` 投影；
5. 关键 Trace 与 04w、总 Map 保存的历史 No-Go 血缘一致。

完整候选输入见版本化数据集：`evals/event-centered-generative/board7a-real-output/board7a-six-case-v1.json`。
