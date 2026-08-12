# GI-088 v8r3 Golden 8 Preview release

状态：`历史 Golden 32＋8 与旧 Preview 证据；当前入口已切换到 v8r3r2`

本目录承接已封存的 Golden 8 替换裁决，并保存当时的 v8r3 Preview 发布证据。当前板块 7 结论见 [v8r3r2 双恢复与正式封存](../2026-08-12-gi088-v8r3r2-empty-content-recovery-2/README.md)。

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
- Preview：候选 deployment 已完成远程构建并回读为 `READY`；数据库迁移已完成；全新 `0/6` 已初始化并保持零模型调用
- 真人内容：仅由产品负责人在 Preview 回读通过后提交

## 历史 Preview 回读

- 行为冻结提交：`c289c94`（完整 SHA 以分支回读为准）
- 部署源提交：`4328ed0ee70c854d5217297a62aef39f209472b7`（仅包含证据回读文档变更）
- Preview deployment：`dpl_6t4WWXewBbr81ripbr7M76Hu5WXR`
- Preview 地址：[打开 GI-088 v8r3 Preview](https://xingfuxitong-dz9pzmbkc-zouzhijies-projects.vercel.app/preview/gi088-evaluation)
- deployment target：`preview`
- Git ref / SHA：`codex/gi088-v8r3-skill-ark-flash` / `4328ed0ee70c854d5217297a62aef39f209472b7`
- 构建：Vercel 远程生成主 Prisma Client、评测 Prisma Client 后执行 Next build
- 应用 schema：迁移 `20260811120000_add_interview_record_mode` 已应用
- 评测 schema：4 个迁移均已应用，无待执行迁移
- 未登录 `/api/auth/session`：`200`，`authenticated=false`
- 不存在用户名的合法格式登录：`401 INVALID_CREDENTIALS`，未产生会话；保护的 runs/session 接口在未登录时返回 `401 AUTHENTICATION_REQUIRED`
- 新批次：`c873ad9a-ab5a-4629-960d-03266bc17b54`，`ordinal=2 / revision=0 / running / 0/6 / gate=pending / high_only / high / calls=0`
- 任务结构：4 条【陪我聊】计分轨迹＋2 条【帮我记】兼容冒烟
- 离线候选证据：96 初始检查点、2 次自动恢复、98 次总调用；`firstValid=76/96=79.17%`，最终失败 `18`，可见延迟样本 `78`，p50 `7.630s`、p90 `25.514s`、最大 `67.011s`
- 当前五层指纹：behavior manifest `2fd873bebdfc7484bc1c51075870702a6b7f8dadd800ea8e3e7ffbe3e9bb9e74`；candidate `77e679af80a90805f589a6effde475b7c097c62729342c79ac6f987a9df776d4`；dataset `a279ef0542c9733fcf4b096db1b0bda92d23e2c41a12a254d8ae6c1f69811efb`；runner `1db8b7227bbff76d9a03bd7080bd98d5ade4bb8b84220c92815a86bcfe328842`；experience `458cb9bffba324d507806b4bdb437a2dca384bd3dc6c918d46ec8582e19733f1`；execution `8ed702c77f68d8ac416bd6058c816d40d70595791530489f424b63e3fccc1c2f`

## 当时的质量边界

当前候选已完成 Ark Flash 离线运行并完成 0/6 零模型初始化。首次有效率低于可靠性硬门 `85%`，因此质量与可靠性仍保持 `No-Go`，Preview 仅作为产品负责人后续回读和问题定位候选，不构成 Production 发布授权。

下一步由产品负责人决定是否在该候选 Preview 继续进行真人内容；Codex 不代提交真人内容。Judge 20+20 仍是后置门，当前未运行。

公开证据只保存数量、类别和哈希；原始卡片、理由、隐藏题面、请求正文、凭据和隐藏推理不进入仓库。
