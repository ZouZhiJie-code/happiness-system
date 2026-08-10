# GI-088｜真人交互开发评测集 v0 与透明 Thinking 对照

状态：`历史评测批次；1600 Token 应用上限导致 A2 high 连续三次 EMPTY_CONTENT，当前入口已切换到 v1`

评测方案版本：`2026-08-08.gi088-human-eval-v0`

Production：`legacy + baseline`

## 1. 为什么采用真人交互批次

GI-087 的六题混入旧候选与人工 AI 回合，新的候选实际承接了已经形成的语境。GI-088 因此要求从用户第一段自然表达开始，并让同一候选生成后续全部 AI 回合。

首批任务同时需要观察真实追问分叉和 Thinking 配置差异。产品负责人通过网页自然交流，评测数据库承担跨回合连续性；整批完成后再共同查看全部结果、归因并选择下一版的一个主要影响因素。

## 2. 本批评测范围

本批属于开发评测集，用于候选诊断。它不能单独证明通用模型能力，也不承担板块 6 退出、板块 7 正式接入、板块 8 Preview 或 Production 发布资格。

| 任务 | 需要主动触发的能力 | 话题要求 |
|---|---|---|
| A1 | 自然入场与共同聚焦 | 一件当前愿意聊的真实事情 |
| A2 | 保留相关整体、选择当前入口 | 两个互相影响的真实内容 |
| A3 | 动态深入并形成认识 | 一件值得多聊几轮的真实困扰 |
| A4 | 纠正后重新规划 | 对 AI 的焦点、事实或理解作真实纠正 |
| A5 | 决策支持 | 一个有目标、限制或取舍的真实选择 |
| A6 | 说不清、拒答与停止 | 自然表达说不清、不想答或停止 |
| A7 | 独立话题与边界 | 两件互不相关或需要暂缓一侧的事情 |
| A8 | 形成认识后的继续或结束 | 已有一条认识后自然选择继续或结束 |
| A2-R | A2 复测 | 使用新的真实话题 |
| A3-R | A3 复测 | 使用新的真实话题 |
| A4-R | A4 复测 | 使用新的真实话题 |
| A6-R | A6 复测 | 使用新的真实话题 |

合计：`12` 项任务、`24` 条对话轨迹。

任务说明只向产品负责人展示，不进入模型上下文，也不规定产品负责人必须说什么。

## 3. 每项任务怎样运行

1. 系统把固定开场 `A0＝“此刻你想聊点什么？”` 写入上下文，模型调用为 `0`。
2. 产品负责人输入一次真实 `U1`。系统冻结本项共同起点 `A0＋U1`。
3. 先完成 Thinking 关闭轨迹；产品负责人依据实际回应自然继续，内容回合不设上限。
4. 打开 Thinking 开关，从相同 `A0＋U1` 新建独立 high 轨迹。两条轨迹分别保存后续消息、状态和 Trace。
5. 每条轨迹结束后填写聊后感受、质量判断和理由；两条都完成后填写配置偏好与理由。
6. `12` 项全部完成后封存批次，生成只读导出。

每次用户发送对应一次模型请求。刷新恢复当前状态；重复提交使用稳定请求身份；质量问题保留原输出；技术失败等待产品负责人手动重试并保留原失败。

## 4. 候选配置

两组共同使用：

- 模型：`deepseek-v4-flash`；
- 基础 Prompt、Interview Skill、输入与任务结构：GI-087 原样哈希绑定；
- 输出合同：在 GI-087 原合同上追加 `burdenSignal` 可空编码澄清，两臂共享同一 Effective candidate；
- 任务结构：`workingTask＋nextInquiry`；
- 输出：JSON；
- `maxTokens=1600`；
- 同一上下文、程序保护、网页流程与评测口径；
- 质量重试：`0`。

唯一配置差异：

| 配置 | Thinking | 温度 | reasoning effort |
|---|---|---|---|
| `off` | 关闭 | `0.2` | `N/A` |
| `high` | 开启 | `N/A` | `high` |

完整隐藏推理不读取、不保存、不展示。页面全程显示配置身份、语义结构、用户原话证据、耗时、Token 和技术状态。

## 5. 裁决与报告

产品负责人逐条填写：

- 聊后感受：`better / same / worse`；
- 质量判断：可直接使用／轻微问题／质量失败／单例阻断；
- 关键理由；
- 同题配置比较：关闭更好／开启更好／相当。

整批封存后，Codex 独立完成九维评分：任务与模式、焦点与上下文、来源忠实、下一步价值、认识与结果、负担与节奏、用户控制与安全、用户可见表达、状态与日志收束。技术完整率单独报告，产品负责人拥有最终路线裁决权。

## 6. 评测运行器与数据边界

- 运行器部署在私有 Preview；
- 产品负责人登录与访问保护；
- Preview 专用评测数据库；
- DeepSeek 凭据只在服务端使用；
- Thinking 分支、状态和 Trace 相互隔离；
- 支持批次封存和只读导出；
- Production 页面、公共 API、生产数据库、线上 Prompt、配置和运行开关保持现状。

原始对话保存至板块 6 关闭后 `30` 天，再按明确范围清理并保留审计记录。经产品负责人确认的脱敏正式资产长期保存。

## 7. 当前停止点

评测运行器、独立存储、假 Provider 全流程、自动检查、Preview 部署、应用登录、工作台读回和 v0.5 两臂技术冒烟已经完成。v0.5 当前执行指纹为 `3bea0a9e01205a8a2cf6723b35cffc4272cf44da5cee077d0c0609fee45d4113`；Base GI-087 候选指纹为 `e45f431f…3321aa`，Effective candidate 指纹为 `58074d31…08b884`。当前 formal batch 部署模型调用作用域为 `batch`。

v0.2 指纹 `53731dc2…f01f20b1` 的关闭组授权在模型请求前遇到 Preview 访问名单和独立评测数据库运行文件问题，授权未消费，模型调用为 `0`。运行文件打包修复提升了服务版本并产生新指纹，旧授权随之失效。

v0.3 已完成两次技术冒烟：Thinking 关闭组得到 `valid`，耗时 `579ms`、总 Token `2422`；high 组完成一次调用后得到 `technical_failure / EMPTY_CONTENT`。两条结果及对应授权均已封存，high 未执行自动重试。

v0.4 增加安全诊断后完成 high 一次调用：`finishReason=stop`、推理 Token `797`，最终内容为完整 JSON。唯一失败是 `burdenSignal` 把“未出现负担信号”编码为对象并给出空证据。该结果排除了输出预算耗尽、空 content 和 Provider 兼容问题。v0.4 空正式批次 `redacted-operational-id` 经核验为 `0` 消息、`0` 回合、revision `0`，按固定 ID 与旧指纹精确删除；累计三条技术冒烟记录继续保留。

v0.5 保留严格 Schema，并以版本化合同澄清修复上述根因。定向测试 `37/37`、类型检查、定向 ESLint、Prisma 校验、本地与 Preview 构建均通过；Production 页面与两类 API 均为 `404`。off 冒烟在 deployment `redacted-deployment-id` 上得到 `valid`：请求 UUID `redacted-operational-id`，总 Token `2553`，无 reasoning 正文，Provider 耗时 `369ms`。high 冒烟在 deployment `redacted-deployment-id` 上得到 `valid`：请求 UUID `redacted-operational-id`，总 Token `3377`，reasoning 长度 `2971` 字符、推理 Token `722`，Provider 耗时 `411ms`。两臂 `finishReason` 均为 `stop`。

v0 formal batch 最终停在 A2 high。该批次累计 `9` 次正式调用：`3` 次 valid、`3` 次程序保护、`3` 次技术失败；已填写 `3` 条分支评价和 `1` 项配置比较。A2 high 同一轮初次调用与两次手动重试均以 `finishReason=length` 结束，`completionTokens=1600`、`reasoningTokens=1600`，最终可见回答为空。该证据确认应用层 `maxTokens=1600` 会在真实多轮 high 轨迹中挤占全部可见输出空间。批次原始结果完整保留，当前入口切换到 [`GI-088 真人交互开发评测集 v1`](../2026-08-09-gi088-human-eval-v1/README.md)。

后续任何 Prompt、Skill、数据集、运行参数或评测运行器代码变化都需要提升服务版本、重新生成执行指纹并取得新授权；当前部署身份与服务版本见 manifest。

当前清单与指纹状态见 [`gi088-human-eval-v0-manifest.json`](./gi088-human-eval-v0-manifest.json)，合同澄清见 [`gi088-output-contract-clarification-v0.1.md`](./gi088-output-contract-clarification-v0.1.md)，验证记录见 [`gi088-runner-validation.md`](./gi088-runner-validation.md)，逐次授权文本见 [`gi088-smoke-authorization-template.md`](./gi088-smoke-authorization-template.md)。

## 8. 历史方案怎样承接

- GI-087 六题继续保存 `6/6` 次调用、上下文资格审计和历史裁决；
- 原“最小纯净评测包”计划由本评测方案覆盖，覆盖原因是需要保留真实追问分叉和重复样本；
- GI-087 的基础 Prompt、Interview Skill、任务结构和上下文准入仍为当前候选输入；
- GI-085／086 No-Go、GI-081 临时 Prompt 基线和 GI-083／084 开发血缘继续承担历史证据；
- GI-068～080 和方法 v1.0 保持冻结；板块 6 继续进行中，板块 7 正式接入与板块 8 继续等待。
