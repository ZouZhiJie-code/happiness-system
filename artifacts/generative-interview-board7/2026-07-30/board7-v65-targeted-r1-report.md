# 生成式访谈评测运行报告

- 数据资产预检：通过
- 硬边界（静态检查夹具）：24/24
- 技术完整：2/2
- 人工可裁决：2
- 产品人工通过：0/2
- 人工待裁决：2
- 完成门：阻断：等待人工逐条裁决

## 版本与覆盖

- 边界：24 条 / 12 组
- 单轮：32 条（工作集 24，准入集 8）
- 轨迹：8 段（工作集 4，准入集 4）

## 单轮输出

- 候选：one_call｜策略 5.46.0｜角度卡 2.12.0｜示例 quality-patterns.2026-07-30.v25

- SMK-R-PARTIAL-ASK-R1：技术完整；人工待裁决；ask
- SMK-F-AI-R1：技术完整；人工待裁决；ask

## 三类严格分流冒烟门

- 运行范围：定向 2 条
- 技术完整：2/2
- ask：可裁决 0/0，Codex 已裁决 0/0，通过 0/0
- 用户成果：可裁决 1/1，Codex 已裁决 0/1，通过 0/1
- AI 综合：可裁决 1/1，Codex 已裁决 0/1，通过 0/1
- Codex 总裁决：可裁决 2/12；已裁决 0/2；待裁决 2；通过 0/12
- 用户总裁决：可裁决 2/12；已裁决 0/2；待裁决 2；通过 0/12
- 来源误判：0
- 严重事实 / 边界 / 强推断 / 来源错误：0
- Codex 门：blocked_pending_review
- 用户门：blocked_pending_review
- 命令状态：blocked_pending_human_review
- v64 预算账本：/Users/zouzhijie/Desktop/Happiness-system-codex/artifacts/generative-interview-board7/2026-07-30/board7-v64-run-budget-ledger.json
- 本次技术尝试 / 重试：4 / 2
