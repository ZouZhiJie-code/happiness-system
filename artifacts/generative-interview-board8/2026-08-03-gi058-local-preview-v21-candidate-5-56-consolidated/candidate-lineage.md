# GI-058｜DeepSeek 官方 API 候选血缘

记录日期：`2026-08-03`

当前状态：`独立 Preview 技术发布门通过；等待产品负责人填写人工裁决并单独授权 Production`

Production：`legacy + baseline，保持未切换`

## 候选合同

| 项目 | 值 |
| --- | --- |
| Preview 数据库 | `happiness_board8_preview_20260803_gi058_local`（本机独立库） |
| 数据库迁移 | `38` 条，up to date |
| 事件入口 | `optional` |
| 对话策略 | `generative` |
| 聊天 Provider | `openai` 兼容适配器，连接 DeepSeek 官方 API |
| API 地址 | `https://api.deepseek.com` |
| 模型 | `deepseek-v4-flash` |
| Strategy | `5.56.0` |
| Semantic artifact | `event-centered-semantic-plan.v8` |
| Semantic Prompt | `2026-08-03.event-centered-generative-v76-gi058-origin-correction` |
| Visible Prompt | `2026-08-03.event-centered-generative-v76-gi058-origin-correction-visible` |
| 角度卡 / Few-shot | `2.14.0` / `quality-patterns.2026-08-03.v31` |
| Board8 报告 | `board8.candidate-aware.v4` |

本候选相对 `5.55.0` 的改动聚焦两点：将“用户说出两条事实、系统完成安全连接”的归属稳定为有来源的 AI 综合；将明确纠正的当前原话补入语义骨架，确保可见回应承认并使用新理解。来源、隐私、纠正和停止硬门保持有效。

## 计分根会话

以下只保留运行标识和状态，不保留用户原话、AI 全文、日志正文或 Trace 上下文。

| 轨迹 | 根会话 ID | 结果 | 关键验证 |
| --- | --- | --- | --- |
| 感受 1｜引导复盘 | `59fae19e-1514-4ff2-a33c-4742fb27449f` | 通过 | 真实事件、日志闭环 |
| 感受 2｜深聊 | `69d2b2e6-1e61-4191-8d5d-05d75d5ca6a6` | 通过 | 说不清后关闭角度、日志闭环 |
| 想法 1｜引导复盘 | `a3a21c08-e6db-4c2e-9266-9b90c9615212` | 通过 | 用户纠正优先、日志闭环 |
| 想法 2｜深聊 | `7161fb12-bcc1-47f6-bd65-dbf1bb462224` | 通过 | 判断依据、深聊暂停、日志闭环 |
| 关系 1｜引导复盘 | `b1f0fca2-7a52-46c3-8aa8-1a7e38893a7f` | 通过 | 关系期待与事实边界、日志闭环 |
| 关系 2｜深聊 | `8d9e9bcb-a270-4e29-9aea-00d53619025d` | 通过 | 两项边界并存、停止关闭、日志闭环 |
| 行动 1｜引导复盘 | `47d29d1c-b039-468c-92bc-12afbcdd2c93` | 通过 | 双事件聚焦、刷新续接、日志闭环 |
| 行动 2｜深聊 | `37ba3922-cde3-4b44-924b-811a7c94d09d` | 通过 | 行动作用与取舍、深聊暂停、日志闭环 |

候选窗口为 `2026-08-03T15:31:08.958Z` 至 `2026-08-03T15:35:37.260Z`。审计使用明确的根会话清单，避免将修复前、控制动作或未完成执行混入当前候选。

## 证据索引

- [Provider 前置检查](./provider-preflight.md)
- [8+2 汇总执行证据](./preview-execution-evidence.md)
- [8+2 汇总执行 JSON](./preview-execution-evidence.json)
- [Board8 JSON 只读审计](./board8-preview-candidate-audit.json)
- [Board8 Markdown 只读审计](./board8-preview-candidate-audit.md)

## 候选有效性与边界

- 本次 8 条轨迹均为串行运行。行动 2 的首个进程在形成证据前结束，最终采用独立的串行复跑会话；未完成执行未纳入候选根会话清单或审计分母。
- 候选代码、模型、Prompt、策略、角度卡或语义产物变化后，本 Preview 结果失效，需按 GI-054 重跑。
- 本机独立 Preview 证明候选功能、回退和双延迟指标；Production 授权仍由产品负责人单独决定。Production 配置、数据库、部署版本和开关保持原状。
