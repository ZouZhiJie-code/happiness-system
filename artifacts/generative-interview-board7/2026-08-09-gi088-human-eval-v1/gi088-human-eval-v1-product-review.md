# GI-088 v1｜产品负责人真人体验评价

版本：`2026-08-09.gi088-human-eval-v1-product-review-v1`

评测方案：`2026-08-09.gi088-human-eval-v1`

执行指纹：`4b65801390264df957189efbc968c9b2584e212154e98671370b8167e7ff70b2`

证据来源：专用评测库只读快照 `gi088-human-eval-v1-readonly-db-snapshot.json`，SHA256 `130efc938dc2a7fa3d68a7703390cf226b8d9c3d87451417dad677b2f235f0d5`

证据身份：`产品负责人逐轨迹评价、Thinking 配置比较与本轮提前结束决定`。Codex 九维初评、阻断检查和根因判断另行保存，不能覆盖本文。

## 1. 本轮产品负责人决定

- 计划任务：`12` 项、`24` 条轨迹；
- 实际完成：A1～A8 共 `8` 项、`16` 条轨迹；
- 未执行：A2-R、A3-R、A4-R、A6-R 四项复测；
- 提前结束原因一：前 8 项已经让产品负责人看到较好的质量效果，当前无需继续复测；
- 提前结束原因二：运行中技术失败过多，持续打断访谈并显著损害体验；
- 当前决定：结束本批真人评测，进入整批复盘与下一候选迭代；
- 发布边界：本决定不授权新的模型调用、下一批 Preview 或 Production 变化。

系统事实单独记录：前 8 项的逐轨迹评价和配置比较均已写入专用评测库；现有运行器只支持 `12/12` 后整批 sealed，因此数据库仍为 `running`、`sealedAt = null`。本轮以只读快照和哈希承担产品层提前封存证据。

## 2. 整体评价汇总

| 配置 | 可直接使用 | 轻微问题 | 质量失败 | 单例阻断 |
|---|---:|---:|---:|---:|
| Thinking 关闭 | 1 | 0 | 5 | 2 |
| Thinking high | 4 | 1 | 3 | 0 |

| 配置比较 | 数量 |
|---|---:|
| Thinking high 更好 | 6 |
| Thinking 关闭更好 | 0 |
| 相当 | 2 |

两次“相当”均来自技术失败导致有效对话太短、证据不足。产品负责人对 high 有效输出的主要正向体验为：Prompt 指令遵循更好，回应更自然，提问切入更符合产品策略，认识和总结更有深度。主要负向体验为：空内容、超时、规则拦截与频繁手动重试持续打断对话。

## 3. 逐任务原始评价

### A1｜自然入场与共同聚焦

- Thinking 关闭：`feeling=same`；`quality=quality_failure`。
  - 理由：一次提了两个问题，导致规则校验失败。
- Thinking high：`feeling=same`；`quality=quality_failure`。
  - 理由：多次出现 `EMPTY_CONTENT` 等技术失败；产品负责人追问技术失败原因。
- 配置比较：`high_better`。
  - 理由：high 能够进行更多轮对话，Prompt 指令遵循体感更好，没有出现一次问两个问题。

### A2｜保留相关整体、选择当前入口

- Thinking 关闭：`feeling=same`；`quality=quality_failure`。
  - 理由：一次提了两个问题，导致规则校验失败。
- Thinking high：`feeling=better`；`quality=quality_failure`。
  - 理由：最终一轮未通过结构、来源或单轮一问规则检查，页面显示 `semantic.nextInquiry` 字段不合规。
- 配置比较：`high_better`。
  - 理由：high 的指令遵循更好；提问更像自然的人类表达；追问角度和切入点更符合产品设计。

### A3｜动态深入并形成认识

- Thinking 关闭：`feeling=worse`；`quality=quality_failure`。
  - 理由：重复追问且问题没有抓住重点；用户已经讲出幸福时刻和“一天新的开始”，仍继续追问同一意义。
- Thinking high：`feeling=better`；`quality=direct_use`。
  - 理由：回应整理恰到好处，提问切入好，符合产品提问策略；相较关闭组效果明显更好。
- 配置比较：`high_better`。
  - 理由：提问切入更符合产品设计；两段式回复中的理解回应更自然、生动。

### A4｜纠正后重新规划

- Thinking 关闭：`feeling=worse`；`quality=quality_failure`。
  - 理由：没有成功输出提问。
- Thinking high：`feeling=better`；`quality=quality_failure`。
  - 理由：提问本身很好，频繁技术失败使体验很差。
- 配置比较：`high_better`。
  - 理由：关闭组连问题都未成功产出。

### A5｜决策支持

- Thinking 关闭：`feeling=better`；`quality=quality_failure`。
  - 理由：最终没有成功输出提问。
- Thinking high：`feeling=better`；`quality=direct_use`。
  - 理由：产品负责人非常满意。
- 配置比较：`high_better`。
  - 理由：high 在提问深度、用户回应和最终总结上都明显更好。

### A6｜说不清、拒答与停止

- Thinking 关闭：`feeling=same`；`quality=direct_use`。
  - 理由：问题能帮助用户把宽泛事情具体化并收敛。
- Thinking high：`feeling=better`；`quality=direct_use`。
  - 理由：提问角度可以；技术失败过多，稳定性体验很差。
- 配置比较：`equivalent`。
  - 理由：通常 high 的提问效果更好；本项 high 技术失败太早，有效问题过少，无法充分比较。

### A7｜独立话题与边界

- Thinking 关闭：`feeling=better`；`quality=single_case_blocker`。
  - 理由：模型把两件事联系在一起；产品负责人同时指出自己的原始表达也带有一定融合，因此该案例质量不理想。
- Thinking high：`feeling=better`；`quality=minor_issue`。
  - 理由：同样出现话题融合疑问，且技术失败过多。
- 配置比较：`equivalent`。
  - 理由：两条轨迹都过早失败，有效问题太少，无法比较。

### A8｜形成认识后的继续或结束

- Thinking 关闭：`feeling=same`；`quality=single_case_blocker`。
  - 理由：技术／规则失败，一个问题都没有成功展示。
- Thinking high：`feeling=better`；`quality=direct_use`。
  - 理由：能把细腻情感挖出来，选点准确，最终总结很好。开放问题是：用户选择继续后，模型只追问一轮便再次形成认识，需要和 Codex 复核这是否符合深聊阶段问停标准。
- 配置比较：`high_better`。
  - 理由：high 的提问、总结和回应都更有深度。

## 4. Thinking 配置的产品负责人结论

已观察到的结论：

1. high 的有效回答在自然表达、追问切入、认识深度和总结质量上形成了清晰正向信号；
2. high 的技术稳定性严重影响真实访谈体验，技术失败已经足以成为本批提前结束原因；
3. 关闭组频繁出现单轮多问或其他规则拦截，导致多条轨迹在较早阶段结束；
4. 当前 8 项足以支持进入问题汇总和下一候选迭代；四项复测由产品负责人主动取消。

证据边界：本轮不证明 Thinking 的通用能力或稳定失败率；四项新话题复测未运行，跨题材重复稳定性保持未测；板块 6、板块 7 正式接入、板块 8 和 Production 状态均保持原边界。
