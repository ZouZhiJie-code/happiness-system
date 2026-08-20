# GI-088｜v8 统一问前决策与确定性状态修复

状态：`1/4 early_stopped；产品负责人确认通过；v8r1 最终 12 项承接剩余覆盖`

评测版本：`2026-08-10.gi088-human-eval-v8-question-decision-pro`

服务版本：`2026-08-10.gi088-question-decision-service-v8`

合同版本：`2026-08-10.gi088-semantic-delta-contract-v2.3`

状态策略：`2026-08-10.gi088-deterministic-state-maintenance-v2`

问前决策：`2026-08-10.gi088-question-decision-skill-v1`

恢复策略：`2026-08-10.gi088-shared-recovery-deadline-v2`

Effective candidate：`7d449eed837897caa1f8b61c48410118177dad695d4cd2319823d4a359d12230`

数据集指纹：`8b1713b43b76d33ec07fe43ee50eafba7a4236eea5ee765bc87f1c82a3517cff`

执行指纹：`39857f0d7f7e38a36c8d05622bb71d06ab5ba8513baaf8fefa404d3247d3791a`

Production：`legacy + baseline`

## 1. 为什么进入 v8

v7r4 已完成 `2/2` 真人轨迹并封存。官方 DeepSeek V4 Pro 首次产生可见正文 `11/12`，`EMPTY_CONTENT=0`，产品负责人决定继续使用。整批因两次程序保护和连续停止提问记为 `No-Go`。

v8 在保留 V4 Pro、Thinking high、JSON 输出和 v7r4 结构基础上，处理四个已经确认的问题：可确定来源补全、组合停止、本轮问前价值判断和自动恢复总等待。

## 2. 当前行为

1. 模型遗漏或提交空的 `workingTask.evidenceRefs` / `nextInquiry.evidenceRefs` 时，程序在严格校验前根据历史任务与最新用户消息补全；非空未知、跨任务或虚构来源继续拦截。
2. 程序补全会写入 `program_source_completion` 复核标记，原始模型输出保持原样，Trace 和导出展示补全摘要。
3. 组合纯停止由程序零模型调用完成；新内容加停止最多调用一次吸收内容，最终强制暂停。
4. Interview Skill 每轮先处理继续、停止与纠正，再判断已有答案、具体未解部分、认识增量和低负担入口。
5. 用户在零问题回应后继续提供实质内容时，默认寻找一个有价值的下一问；内容充分或继续价值有限时自然收住。
6. 首次调用最长 `60s`；首次与一次自动恢复从首次开始共享 `90s`。人工再次生成采用独立 `60s`，并停止后续自动恢复。
7. 每段用户原话最多三次 Provider 调用；整条轨迹继续不设轮次上限。

## 3. 零模型回放

v7r4 两个真实失败点均已通过私有零模型回放：

- A1 缺失的下一问来源由程序补入最新用户消息，严格合同与阶段校验通过；
- A2 组合停止识别为纯停止，程序提交暂停并清空下一问；
- 回放模型调用：`0`；公开证据不包含用户原话或模型原始输出。

## 4. 真人验收任务

1. A1：零问题回应后明确要求继续，最后明确停止。
2. A2：用户已经给出明显答案，检查 AI 是否避免重复追问。
3. A3：阶段 3 使用具体入口持续深化。
4. A4：围绕现实选择持续提供决策支持。

四项只运行 Thinking high，合计至少 `12` 次用户提交。计划内最坏调用数为 `36`；满足通过门时最多 `13` 次。所有可见提问继续完成人工单一回答焦点复核。

## 5. 通过门

- `4/4` 命中目标；至少 `3/4 direct_use`，最多一项 `minor_issue`；
- 首次可见回答率至少 `90%`；整批自动恢复最多一次，连续两轮恢复判阻断；
- 程序保护、最终技术失败、重复消息和人工第三次生成均为 `0`；
- 自动恢复总等待不超过 `90s`；
- 通过后进入最终 `12` 项、`12` 条 Thinking high 独立批次。

## 6. 边界

Preview 空白批次初始化不会调用模型。真人模型调用只在产品负责人于评测页面提交真实内容时发生。Production 全程保持 `legacy + baseline`，隐藏推理正文继续隔离。

## 7. Preview 交付

- Deployment：`dpl_BBdWoWMXN3BQummXmCw2cCioxx9N`
- 页面：`https://xingfuxitong-8easi3ups-zouzhijies-projects.vercel.app/preview/gi088-evaluation`
- 页面回读：HTTP `200`，包含 `GI-088`、`v8` 与“统一问前决策”
- 批次：`cdc6f41b-f441-4587-9d2f-4b5fe9c1dc60`
- 批次终态：`1/4 early_stopped`
- 初始化模型调用：`0`

## 8. 真人结果与收口

- 批次：`cdc6f41b-f441-4587-9d2f-4b5fe9c1dc60`；终态时间 `2026-08-10T11:30:59.852Z`。
- 产品负责人完成 A1 共 `10` 次用户提交后，以“证据充分，快速进入更大样本”为由提前结束；A2～A4 标记 `not_run`。
- 产品负责人判断：`direct_use / target triggered / 通过`。
- `10/10` 次 Provider 调用均在首次返回有效结果；技术失败、自动恢复、人工重试、程序保护和重复消息均为 `0`。
- `7` 条可见提问全部人工分类为 `same_focus_low_burden`；零问题后继续提供实质内容时，AI 已恢复有价值提问并进入阶段 3 深化。
- Codex 初评：核心行为通过；末轮礼貌停聊被识别为混合停止，多产生一次 `17.514s` 调用，列为 v8r1 确定性小修。
- 完整结果只保存在 `artifacts/local-runtime/gi088-v8-sealed/v8-sealed-export.json`，SHA256 为 `a031676df904967d0ad0cd760947766fc619fedec86e42167a7f6df7b3ac59e8`。
- 脱敏复盘见 [`gi088-v8-human-eval-closure-summary.md`](./gi088-v8-human-eval-closure-summary.md)。
