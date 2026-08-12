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
- Preview：远程构建已 READY，数据库迁移已完成；`0/6` 初始化等待私有离线候选证据回填
- 真人内容：仅由产品负责人在 Preview 回读通过后提交

## 当前 Preview 回读

- 冻结提交：`b14056fb43b4fe56bf7119b0a4dbca707a0a9644`
- READY deployment：`dpl_FUuaiYJy9H3ZbD3ZGbxAQB11Kiee`
- Preview 地址：`https://xingfuxitong-git-codex-gi088-v8r3-sk-5c3376-zouzhijies-projects.vercel.app`
- deployment target：`preview`
- Git ref / SHA：`codex/gi088-v8r3-skill-ark-flash` / `b14056fb43b4fe56bf7119b0a4dbca707a0a9644`
- 构建：Vercel 远程生成主 Prisma Client、评测 Prisma Client 后执行 Next build
- 应用 schema：迁移 `20260811120000_add_interview_record_mode` 已应用
- 评测 schema：4 个迁移均已应用，无待执行迁移
- 未登录 `/api/auth/session`：`200`，`authenticated=false`
- 不存在用户名的合法格式登录：`401 INVALID_CREDENTIALS`，未产生会话

## 暂停原因

Preview `/api/preview/gi088/runs`、`/session` 和本地初始化脚本均返回 `GI088_OFFLINE_EVIDENCE_MISSING`。当前隔离工作树没有绑定的私有隐藏准入包，因此无法诚实生成候选 80/80 的离线 `candidateOfflineRunFingerprint`、`candidateEvidenceFingerprint` 和自动恢复计数；保持 API 拒绝模型调用，避免用占位哈希伪装评测证据。

恢复动作固定为：把既有私有隐藏准入包恢复到离线评测目录并保持 `0600` 权限，运行候选 Ark Flash 离线评测（初始 96 次、全批自动恢复上限 2），将输出收据的三个字段写入该分支 Preview 环境，再执行 `eval:gi088:initialize-current`。初始化回读必须得到 `running / gate=pending / 0/6 / 4 条计分轨迹 + 2 条兼容冒烟 / 0 calls`，随后才开放真人内容。

公开证据只保存数量、类别和哈希；原始卡片、理由、隐藏题面、请求正文、凭据和隐藏推理不进入仓库。
