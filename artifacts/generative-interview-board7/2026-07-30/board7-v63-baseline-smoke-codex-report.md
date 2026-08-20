# 生成式访谈评测运行报告

- 数据资产预检：通过
- 硬边界（静态检查夹具）：24/24
- 技术完整：12/12
- 产品人工通过：0/12
- 人工待裁决：12
- 完成门：阻断：等待人工逐条裁决

## 版本与覆盖

- 边界：24 条 / 12 组
- 单轮：32 条（工作集 24，准入集 8）
- 轨迹：8 段（工作集 4，准入集 4）

## 单轮输出

- 候选：one_call｜策略 5.45.0｜角度卡 2.11.0｜示例 quality-patterns.2026-07-30.v24

- SMK-F-PARTIAL-ASK-R1：技术完整；人工待裁决；ask
- SMK-T-ASK-R1：技术完整；人工待裁决；ask
- SMK-R-PARTIAL-ASK-R1：技术完整；人工待裁决；ask
- SMK-A-PARTIAL-ASK-R1：技术完整；人工待裁决；ask
- SMK-F-CLOSED-R1：技术完整；人工待裁决；complete
- SMK-T-USER-R1：技术完整；人工待裁决；complete
- SMK-R-CLOSED-R1：技术完整；人工待裁决；complete
- SMK-A-CLOSED-R1：技术完整；人工待裁决；pause
- SMK-F-AI-R1：技术完整；人工待裁决；ask
- SMK-T-AI-R1：技术完整；人工待裁决；pause
- SMK-R-AI-R1：技术完整；人工待裁决；ask
- SMK-A-AI-R1：技术完整；人工待裁决；ask

## 三类严格分流冒烟门

- 技术完整：12/12
- ask：0/4
- 用户成果：1/4
- AI 综合：0/4
- 来源误判：1
- 严重事实 / 边界 / 强推断 / 来源错误：2
- Codex 门：fail
- 用户门：blocked_pending_review
