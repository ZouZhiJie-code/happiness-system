# GI-088 v1.9 Production 发布工具 v1.5 候选冒烟交接

- 文档职责：当前任务记录
- 文档状态：已完成
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 最终结果

候选 `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p` 的真实冒烟已通过技术门：可见回答 `12524ms`，后台事实一次调用成功、重试 0，临时用户已删除。候选仍未接管正式域名，Production 继续由原 baseline 部署服务。

Codex 依据私有原文初评 `pass`，产品负责人裁决 `pass`。候选已经接管正式域名；线上回归可见回答 `12190ms`，后台事实一次成功、零重试，临时数据已清理，未触发回退。

正式域名回读为部署 `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`、Ready；Production 环境为 `event_centered + complete_response_v1_9 + deepseek-v4-pro`。原 baseline 部署继续保留为回退目标。

## 公开边界

公开证据只保存哈希、耗时、状态和数量。完整用户输入与 AI 输出保存在权限为 `0600` 的私有评审材料，并通过受控对话交付产品负责人。
