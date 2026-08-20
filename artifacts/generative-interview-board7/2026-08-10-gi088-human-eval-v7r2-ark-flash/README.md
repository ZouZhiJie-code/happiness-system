# GI-088｜v7r2 Thinking high Ark Flash

状态：`2/2 已封存；两项目标均触发；可靠性门未通过；已由 v7r3／v7r4 承接`

评测版本：`2026-08-10.gi088-human-eval-v7r2-ark-flash`

服务版本：`2026-08-10.gi088-ark-flash-service-v7r2`

运行策略：`2026-08-10.gi088-ark-flash-runtime-v1`

合同版本：`2026-08-10.gi088-semantic-delta-contract-v2.1`

Effective candidate：`63acaede24844272886ea798c435d7f59ab14deb989b734d842b60ab48ee7242`

数据集指纹：`ea2d42c59850222bed72b59213263bed21d9660fb6d21937af533d5800e88a6c`

执行指纹：`deb5f242d0fb5edea5f2a2d874ee7c029bfbefde62223fef8125dfb4ae175275`

Production：`legacy + baseline`

Preview：`https://xingfuxitong-8p5uc4ng7-zouzhijies-projects.vercel.app/preview/gi088-evaluation`

Preview deployment：`dpl_HDemGjQPpMhTFhj5fw8Yq8iehpwX`

批次：`c10c8c25-b3f9-4bfb-a02a-c5c0a44c303c`（`sealed 2/2`）

## 1. 为什么进入 v7r2

v7 两条真人连续轨迹已经完成，连续性工作台、认识修正、无限轨迹和自然长聊得到真实体验验证。当前阻断集中在 DeepSeek 官方 Flash 的可见正文可靠性：Thinking high 正常完成思考后仍可能返回空正文，普通恢复也可能连续失败。

官方 Flash / Pro 与火山 Ark Flash 的同请求对照显示：Ark Flash 三条历史空正文请求均返回可见正文，平均等待约 10.9 秒；官方 Pro 同样返回 `3/3` 可见正文，平均等待约 30 秒。v7r2 因此把唯一主要因素收敛为“模型平台运行路径切到火山 Ark Flash”，继续沿用 v7 连续性合同和两项真人任务。

## 2. 冻结行为

1. 只运行 `deepseek-v4-flash-ga-260731 + Thinking high + json_object`。
2. 接入使用 Ark REST Chat Completions 与项目现有 TypeScript OpenAI-compatible Provider。
3. 非流式响应头等待、正文空闲和总时长均为 60 秒，避免 15 秒响应头截止误伤健康生成。
4. v7 的 `understandingChange / burdenSignalChange`、单一回答焦点、阶段转场、无限轨迹和原子状态提交保持不变。
5. v7r1 Prefix 策略停止用于新轮次；历史 v7r1 Call、恢复血缘、Trace 和导出继续只读兼容。
6. 首次 `EMPTY_CONTENT` 使用普通同配置 high 自动恢复一次；第二次失败开放一次人工生成，随后停止。
7. 同一用户原话最多三次调用；EMPTY_CONTENT、TIMEOUT 和阶段转场共享自动恢复额度，无法串联出额外调用。
8. 隐藏思考正文继续不读取、不保存、不展示；Trace 只保存安全诊断。

## 3. 真人验收

本批只使用 Thinking high，共两项、两条轨迹：

1. A1：形成认识后明确纠正一处，再继续至少一轮，验证有效 `revise`；
2. A2：自然长聊，检查阶段 3、页面连续性和真实恢复。

两条轨迹合计至少 10 次用户提交。轨迹不设总轮次上限；每次用户提交理论最坏为 3 次调用。真人批次开始时为 `0/2`，页面提交真实内容才会触发模型调用。

## 4. 证据边界

- 平台探针只形成三案例方向性证据；真人连续轨迹承担可靠性和体验裁决。
- Ark 结构化输出接口已在真实调用中接受 `json_object`；输出合同仍由项目严格校验。
- Preview 只使用独立评测库和评测页面；Production 全程保持 `legacy + baseline`。
- API Key、隐藏思考、Prompt、用户原话和原始模型输出均不进入本目录正式证据。

## 5. Preview 起点回读

- Preview 页面经部署保护通道回读为 HTTP `200`；
- 新批次为 `running 0/2`，仅启用 Thinking high；
- 初始化过程模型调用为 `0`；
- 页面提交真实内容后才会调用 Ark Flash。

## 6. 真人结果与裁决

- 两项任务均完成并封存，共 `15` 次用户提交、`20` 次 Provider 调用；A1、A2 的任务目标均标记为已触发。
- 首次直接成功 `10/15`；自动恢复后成功 `3` 轮；A1 U8、A2 U7 最终触发程序保护。
- 两个最终保护都包含 `CONTINUE_WORKING_TASK_MUST_RETAIN_EVIDENCE_LINEAGE`：模型只提交本轮新来源，旧程序要求模型重复全部历史来源。A1 U8 同时暴露“新内容＋停止”仍由模型决定暂停动作的问题。
- 产品负责人对 A1、A2 均评为 `minor_issue`；可靠性门要求首次直接成功至少 `90%`、整批自动恢复最多一次、最终程序保护为 `0`，因此本批可靠性结论为 `No-Go`。
- 完整封存结果继续保存在产品负责人下载的私有 JSON 中；正式证据只记录批次版本、指纹、聚合数字、Trace 定位和结论。

后续由 v7r3 将确定性状态交给程序维护并完成零模型回放；v7r4 继承该底座，仅把运行模型切换为官方 DeepSeek V4 Pro。v8 继续等待 v7r4 真人可靠性门。
