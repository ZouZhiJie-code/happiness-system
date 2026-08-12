# GI-088 v8r3 Preview 回读

## 已验证

- commit：`b14056fb43b4fe56bf7119b0a4dbca707a0a9644`
- branch：`codex/gi088-v8r3-skill-ark-flash`
- deployment：`dpl_FUuaiYJy9H3ZbD3ZGbxAQB11Kiee`
- target：`preview`
- branch URL：`https://xingfuxitong-git-codex-gi088-v8r3-sk-5c3376-zouzhijies-projects.vercel.app`
- 远程构建：主 Prisma 与评测 Prisma 均在 Vercel Linux 构建阶段生成
- 物理数据库身份门：Preview、Neon pooled/direct host、数据库名、`gi088_app_preview` 与 `gi088_evaluation_v0` 均匹配
- app migration：`20260811120000_add_interview_record_mode` 已应用
- evaluation migration：4/4 已应用，0 pending
- anonymous session readback：`200 authenticated=false`
- invalid-format-valid login readback：`401 INVALID_CREDENTIALS`
- model calls：0
- 真人内容：0
- Production：未变更

## 当前阻塞

Preview 的 GI-088 API 与初始化脚本均安全返回 `GI088_OFFLINE_EVIDENCE_MISSING`。私有隐藏准入包未随当前隔离工作树提供，候选离线结果和三项离线证据指纹尚未生成；因此 0/6 尚未创建，真人内容入口保持关闭。

## 继续条件

恢复私有隐藏准入包后，使用 `npm run eval:gi088:v8r3:offline -- --mode candidate --execute` 完成 Ark Flash 候选运行，记录 96 初始调用与最多 2 次自动恢复；将候选离线运行指纹、证据指纹和恢复次数写入该分支 Preview 环境，重跑初始化并回读 0/6。Judge 20+20 仍保持后置，不阻塞这一轮 Preview。
