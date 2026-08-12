# GI-088 v8r3 Preview 回读

## 已验证

- 行为冻结 commit：`c289c94`
- 部署源 commit：`4328ed0ee70c854d5217297a62aef39f209472b7`
- branch：`codex/gi088-v8r3-skill-ark-flash`
- deployment：`dpl_6t4WWXewBbr81ripbr7M76Hu5WXR`
- target：`preview`
- status：`READY`
- URL：`https://xingfuxitong-dz9pzmbkc-zouzhijies-projects.vercel.app/preview/gi088-evaluation`
- Preview URL：`https://xingfuxitong-dz9pzmbkc-zouzhijies-projects.vercel.app/preview/gi088-evaluation`
- 远程构建：主 Prisma 与评测 Prisma 均在 Vercel Linux 构建阶段生成
- 物理数据库身份门：Preview、Neon pooled/direct host、数据库名、`gi088_app_preview` 与 `gi088_evaluation_v0` 均匹配
- app migration：`20260811120000_add_interview_record_mode` 已应用
- evaluation migration：4/4 已应用，0 pending
- anonymous session readback：`200 authenticated=false`
- invalid-format-valid login readback：`401 INVALID_CREDENTIALS`
- unauthenticated runs/session readback：`401 AUTHENTICATION_REQUIRED`
- model calls：0
- 真人内容：0
- Production：未变更

## 新 0/6 回读

- run：`c873ad9a-ab5a-4629-960d-03266bc17b54`
- ordinal / revision：`2 / 0`
- status / gate：`running / pending`
- tasks：`4` 条计分轨迹＋`2` 条兼容冒烟，完成 `0/6`
- active task：`null`
- Provider calls：`0`
- model identity：Ark `deepseek-v4-flash-ga-260731`、Thinking high、`json_object`
- timeout：header/body/hard `60s`，automatic chain `90s`
- execution：`8ed702c77f68d8ac416bd6058c816d40d70595791530489f424b63e3fccc1c2f`
- candidate offline evidence：`ddbc40089c6f9ebcfe4fa1b22158e46f512a1eabcc16da3f9fc5b578b8f54cfc` / `30238488cc9ed8d31d9397a32ed245bda2182422d785c02202caf7b9453c2553` / automatic recovery `2`

## 当前质量边界

候选离线运行已完成：`96` 个初始检查点、`2` 次自动恢复、`98` 次总调用；首次有效 `76/96=79.17%`，最终失败 `18`，可见延迟样本 `78`（p50 `7.630s`、p90 `25.514s`、最大 `67.011s`）。首次有效率低于 `85%` 可靠性硬门，当前 Preview 保持候选 / No-Go 证据边界；Judge 20+20 后置且未运行。
