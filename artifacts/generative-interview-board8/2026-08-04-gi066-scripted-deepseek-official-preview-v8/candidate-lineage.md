# GI-066 冻结候选血缘

- 冻结日期：`2026-08-04`
- Strategy：`5.64.0`
- Angle Card：`2.17.0`
- Few-shot：`quality-patterns.2026-08-04.v34`
- Semantic Prompt：`2026-08-04.event-centered-thought-map-v84-gi066`
- Visible Prompt：`2026-08-04.event-centered-thought-map-v84-gi066-visible`
- Semantic Artifact：`event-centered-semantic-plan.v16`
- Dialogue Snapshot：`v4`
- Provider：`openai`
- Base URL Host：`api.deepseek.com`
- Model：`deepseek-v4-flash`
- Preview 数据库：本机独立 PostgreSQL；`happiness_board8_preview_20260804_gi066_candidate_5_64_v8`
- Production：`legacy + baseline`，本候选尚未获得生产授权。

## 自动证据

- 官方最小预检：通过；运行期间曾发生三次短时 `TIMEOUT`，随后官方 `/models` 与最小聊天调用均恢复为 HTTP 200。
- `10×3` 稳定性门：动作 `30/30`、方向 `30/30`、总通过 `30/30`。
- 单角度 `8+2`：主链 `8/8`、日志闭环 `8/8`、第一检查点冒烟通过、旧五维冒烟通过。
- 只读审计：运行降级 `0`；完整文本中位数 / P90 `3.386s / 5.635s`；可操作中位数 / P90 `3.429s / 5.667s`；日志 AI 接受 `8/8`、标题修复 `1`、全文 fallback `0`。
- 工程验证：TypeScript、`2521/2521` 全量测试、生产构建、Prisma validate / migrate status、Lint 和 `git diff --check` 通过。

## 当前裁决

自动技术层达到人工实聊准入门。下一步由产品负责人完成 `2` 条真实事件与 `2` 条风控事件，至少 `3` 条通过、最多 `1` 条条件通过、失败为 `0`。人工 Go 后仍需独立 Production 授权。

本机人工工作台：`http://127.0.0.1:3010/preview/board8-gi066-review`。
