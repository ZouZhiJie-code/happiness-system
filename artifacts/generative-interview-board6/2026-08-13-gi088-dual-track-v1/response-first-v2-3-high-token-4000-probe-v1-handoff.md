# GI-088 回应优先 v2.3｜High `4000` Token 单题探针

- 身份：`2026-08-17.gi088-response-first-v2-3-high-token-4000-probe-v1`
- 计划指纹：`bf1876287e5973268db7465ba63a8a536c68eaf33b4bb3994054e3498cee3e89`
- 唯一变化：High `maxTokens 2000→4000`
- 调用：`1/1`；重试、恢复、回退均为 `0`
- 完整性：HTTP 200、模型正确、`finishReason=stop`；completion `2072`、reasoning `1898`，完整 JSON `596` 字符
- 耗时：High `37.066s`，冻结 Low＋High `40.407s`，45 秒目标和 60 秒硬门均达到
- Token 结论：`4000` 在本题解决了 `2000` 上限截断；实际完成点为 `2072` completion Token，不承担其他案例必然成功的结论
- 合同结果：`NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL`；模型在当前 `workingTask=null` 时提交 `understandingChange=add`，合同有效 `0/1`
- 用户可见追加：`correctableUnderstanding=null`、问题 `0`；按现有交付规则，本轮只能 Low-only 完成
- 内容：完整 High 原文等待 Codex 初评和产品负责人裁决；合同失败与语义评价分开记账
- 费用：按 `2026-08-13` 冻结价估算 `¥0.0127198`，Provider 实际账单金额待回执
- 停止：探针额度用尽；原 v2.3 剩余 `8` 次、页面接入、提交、推送、部署和 Preview 均为 `not_run`
- Production：继续使用 `event_centered + baseline`
- 私有边界：完整用户上下文、冻结 Low 和 High 原文保存在 Git 排除目录
