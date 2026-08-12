# GI-088 v8r3 Golden 8 Preview release

本目录承接已封存的 Golden 8 替换裁决，并作为 v8r3 Preview 发布证据的当前入口。

## 当前已冻结的产品证据

- 前 32 条历史裁决：`accepted_previous_round`，只读沿用。
- 本轮替换裁决：8 条，其中 7 条进入采用集合，1 条进入开发回归与 Bad Case。
- 质量失败的公开类别：`reasks_answered_content`。原始理由和对话材料继续保存在本机私有裁决目录。
- Golden 8 裁决模型调用、数据库写入和外部上传：均为 `0`。
- Judge 20+20 Golden 校准：后置门，当前 Preview 不依赖其结果。

## 发布边界

- 候选版本：`2026-08-11.gi088-human-eval-v8r3-skill-ark-flash`
- 候选模型：Ark `deepseek-v4-flash-ga-260731`，Thinking high，`json_object`
- Production：继续保持 `legacy + baseline`
- Preview：等待本目录对应的最终静态门、远程部署和全新 `0/6` 回读
- 真人内容：仅由产品负责人在 Preview 回读通过后提交

公开证据只保存数量、类别和哈希；原始卡片、理由、隐藏题面、请求正文、凭据和隐藏推理不进入仓库。
