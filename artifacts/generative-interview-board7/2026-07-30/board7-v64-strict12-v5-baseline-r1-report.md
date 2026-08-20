# 生成式访谈评测运行报告

- 数据资产预检：通过
- 硬边界（静态检查夹具）：24/24
- 技术完整：0/12
- 产品人工通过：0/12
- 人工待裁决：12
- 完成门：失败

## 版本与覆盖

- 边界：24 条 / 12 组
- 单轮：32 条（工作集 24，准入集 8）
- 轨迹：8 段（工作集 4，准入集 4）

## 单轮输出

- 候选：one_call｜策略 5.46.0｜角度卡 2.12.0｜示例 quality-patterns.2026-07-30.v25

- SMK-F-PARTIAL-ASK-R1：技术失败；人工待裁决；无结果
- SMK-T-ASK-R1：技术失败；人工待裁决；无结果
- SMK-R-CLEAN-ASK-R1：技术失败；人工待裁决；无结果
- SMK-A-PARTIAL-ASK-R1：技术失败；人工待裁决；无结果
- SMK-F-CLOSED-R1：技术失败；人工待裁决；无结果
- SMK-T-USER-R1：技术失败；人工待裁决；无结果
- SMK-R-PARTIAL-ASK-R1：技术失败；人工待裁决；无结果
- SMK-A-CLOSED-R1：技术失败；人工待裁决；无结果
- SMK-F-AI-R1：技术失败；人工待裁决；无结果
- SMK-T-AI-R1：技术失败；人工待裁决；无结果
- SMK-R-AI-R1：技术失败；人工待裁决；无结果
- SMK-A-AI-R1：技术失败；人工待裁决；无结果

## 三类严格分流冒烟门

- 运行范围：完整 12 条
- 技术完整：0/12
- ask：Codex 已裁决 0/4，通过 0/4
- 用户成果：Codex 已裁决 0/4，通过 0/4
- AI 综合：Codex 已裁决 0/4，通过 0/4
- Codex 总裁决：0/12；通过 0/12
- 用户总裁决：0/12；通过 0/12
- 来源误判：0
- 严重事实 / 边界 / 强推断 / 来源错误：0
- Codex 门：blocked_pending_review
- 用户门：blocked_pending_review
- 命令状态：failed_objective_gate
- v64 预算账本：/Users/zouzhijie/Desktop/Happiness-system-codex/artifacts/generative-interview-board7/2026-07-30/board7-v64-run-budget-ledger.json
- 本次技术尝试 / 重试：24 / 12
