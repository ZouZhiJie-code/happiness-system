# 板块 7A｜六题真实输出 A/B 候选包确认

状态：`候选包完成；等待产品负责人单独授权；模型调用 0`

包指纹：`32703f687342868a359f3b682b216f0a8965b0608096781f535f4303adc68248`

## 1. 本包解决什么

首批 8 张人工校准卡已经帮助产品负责人和 Codex 对齐一部分判尺。C3 的分歧同时证明，人工写出的参考回应无法直接承担真实模型效果证据。本包将三条历史真人决策点和三条目标案例交给两种隔离候选生成真实输出，再由产品负责人盲评。

本包只开放板块 7A 离线诊断。板块 6 继续进行中，板块 7 正式实现与板块 8 Preview 继续等待后续门槛。

## 2. 六题范围

| 案例 | 来源 | 模式 | 核心行为 |
|---|---|---|---|
| H1 | 隔离 Preview 真人历史 | 【陪我聊】 | 接受两种感受并存，退出旧二选一 |
| H2 | 隔离 Preview 真人历史 | 【陪我聊】 | 执行纠正并回到“过去经历”新重点 |
| H3 | 隔离 Preview 真人历史 | 【陪我聊】 | 使用用户主动留下的过去经历线索 |
| T1 | GI-068 / R1 | 【帮我记】 | 丰富材料后的轻承接与零追问 |
| T2 | GI-068 | 【帮我记】 | 用户向 AI 提问时仍保持记录任务 |
| T3 | GI-070、GI-076 / C5 | 【陪我聊】 | 第二次说不清且不想继续时诚实暂停 |

数据集：[board7a-six-case-v1.json](../../../evals/event-centered-generative/board7a-real-output/board7a-six-case-v1.json)

历史来源核验：[只读核验记录](./board7a-six-case-ab-v1-source-readback.md)

## 3. 两种候选

- 候选 A：每题一次结构化调用，同时返回语义与用户可见回应，共 `6` 次。
- 候选 B：每题先形成结构化语义，再根据冻结语义和引用原话生成可见回应，共 `12` 次。
- 两组共同使用 `deepseek-v4-flash`、温度 `0.2`、Thinking 关闭、`json_object`、同一产品规则和同一输入。
- 质量重试为 `0`；全批最多 `3` 次技术失败重试；生成请求上限 `21`。

完整 Prompt：[六题 A/B Prompt v1](./board7a-six-case-ab-v1-prompts.md)

内部结构与运行合同：`evals/event-centered-generative/board7a-real-output/board7a-real-output-ab.ts`

## 4. 盲评与揭晓

运行器按固定种子生成平衡映射，六题中候选 A、B 各有三次出现在左侧。盲评文件只显示“回应甲／回应乙”，不展示架构、结构化语义或 Codex 判断。

- 运行前模板：[盲评模板](./board7a-six-case-ab-v1-blind-review.md)
- 揭晓映射：[reveal.json](./board7a-six-case-ab-v1-reveal.json)，完成产品负责人盲评后再读取
- 运行后文件：`board7a-six-case-ab-v1-blind-review-run.md`

每题需要填写相对判断、两段回应的绝对判断和理由。产品负责人完成后再揭晓架构，并检查每种候选是否达到：单例阻断 `0`、至少 `4/6` 可用、普通质量失败最多 `2/6`。

## 5. 运行保护与停止点

当前预算账本状态为 `pending_approval`，已使用请求为 `0`。运行器默认只做候选包检查；真实调用同时需要：

1. 产品负责人基于当前包指纹提交独立批准文件；
2. 命令显式带 `--execute --approval <批准文件>`；
3. 当前环境通过非 Production 和 DeepSeek 官方配置检查；
4. 预算账本仍为未使用状态。

候选包自检命令：

```bash
npx vite-node -c vitest.config.ts scripts/run-board7a-real-output-ab.ts
```

该命令只检查数据、指纹、配对与预算，输出中的模型调用保持 `0`。

产品负责人授权后，复制[批准模板](./board7a-six-case-ab-v1-approval-template.json)形成独立批准文件，填写 `decision=approved`、确认时间和确认文字，再执行：

```bash
npx vite-node -c vitest.config.ts scripts/run-board7a-real-output-ab.ts --execute --approval <批准文件路径>
```

本轮到此暂停。Production、线上 Prompt、公开 API、页面、数据库、运行配置与开关继续保持原样。
