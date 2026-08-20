# GI-088 v0.5｜评测运行器验证记录

当前身份：`历史验证记录；正式批次最终停在 A2 high 的 1600 Token 连续耗尽，现行入口为 v1`

验证日期：`2026-08-09`

Base GI-087 候选指纹：`e45f431f21819b668422c5da64678ad22fb6ef3f3eee285aa9e9c8fb533321aa`

Effective candidate 指纹：`58074d31e96d18c2fd196a344c6f471a98024897f6578b97ed8288913308b884`

执行指纹：`3bea0a9e01205a8a2cf6723b35cffc4272cf44da5cee077d0c0609fee45d4113`

结论：`v0.5 两臂技术冒烟均为 valid；formal batch 累计 9 次调用后停在 A2 high，当前入口已切换到 v1`

## 1. 为什么产生 v0.5

v0.3 high 冒烟返回空最终内容。v0.4 加入安全 Provider 诊断后再次运行 high，结果为完整 JSON，结束原因为 `stop`，推理 Token 为 `797`，可以排除输出预算耗尽和 Provider 空响应。

v0.4 的唯一结构错误是：模型把“未出现明显负担信号”写成非空 `burdenSignal`，同时给出空 `evidenceRefs`。GI-087 原合同示例展示了对象，却未明确无信号时的可空编码。v0.5 因此新增版本化合同澄清：当前记录缺少有效负担证据时输出 JSON `null`；存在有效信号时至少引用一条用户消息。严格 Schema、Prompt、Skill、任务结构和两臂输入继续保持一致。

## 2. 已通过检查

- GI-088 服务、Provider 与工作台定向测试：`37/37`；
- TypeScript：通过；
- GI-088 定向 ESLint：通过；
- 独立 Prisma schema 校验与 additive migration：通过；
- 本机构建与 Vercel Preview 构建：通过；
- GI-088 API 构建追踪包含独立 Prisma 运行文件，普通登录接口保持隔离：通过；
- Base、Effective candidate、数据集与执行指纹：可重复生成；
- Schema 失败元数据只保留白名单路径与错误码，不保存值；
- 隐藏推理正文与凭据扫描：通过；
- 当前 v0.5 技术冒烟 DeepSeek 生成调用：`2`；累计历史技术冒烟调用：`5`；正式 `12` 项真人评测调用：`1`。

仓库正式构建仍显示若干原有模块警告，GI-088 定向检查保持通过。

## 3. 正式批次部署与访问边界

- 历史 formal batch Preview deployment：`dpl_EhDcw5vVpHbLzAPFQp9wXJ2aNCiW`；
- 服务版本：`2026-08-09.gi088-preview-service-v0.5`；
- Preview URL：`https://xingfuxitong-34pbcz5so-zouzhijies-projects.vercel.app/preview/gi088-evaluation`；
- 当前模型调用作用域：`batch`；
- 登录后工作台读回：A1 进行中，关闭组首轮为 `protected_failure / ASK_QUESTION_COUNT_INVALID:2`，显示 v0.5 执行指纹；
- Preview 外层保护：未登录访问返回授权跳转；
- 应用保护：管理员与专用评测名单取交集；
- Production 页面、session API、smoke API：均返回 `404`。

初始 formal deployment `dpl_GSZg7VouMyjEctSExsKrqXbHgdVM` 完成 A1 关闭组首轮一次正式调用。模型生成了两个用户可见问题，程序按“单轮一问”规则正确保留原始输出并阻止状态合并；同时暴露评价入口被较矮桌面视口裁切的页面故障。当前 deployment 只调整页面高度适配、评价区滚动和失败原因文案，Prompt、Skill、输出结构、模型参数、候选指纹、执行指纹、评测数据与服务端流程均保持不变。登录读回确认操作入口在 `771px` 高视口内完整可见，评价表单可滚动，所有评价选项保持未选择；本次恢复过程新增模型调用 `0`。

## 4. 存储与历史结果

- Preview 使用专属物理数据库；应用和评测数据分别使用 `gi088_app_preview`、`gi088_evaluation_v0` schema；
- v0.3 保留 off `valid`、high `technical_failure / EMPTY_CONTENT` 两条记录；
- v0.4 保留 high `protected_failure / OUTPUT_SCHEMA_INVALID` 一条记录；
- v0.5 off 保留 `valid`：请求 UUID `b1389fce-5488-45ac-b300-f6ce3c52f132`，deployment `dpl_5CZN1qAUPBrtssXtFZ1HkpmmKVJg`，`finishReason=stop`，总 Token `2553`，无 reasoning 正文或长度，Provider 耗时 `369ms`；
- v0.5 high 保留 `valid`：请求 UUID `bb756d3c-af07-4072-9bb5-8e88209a2167`，deployment `dpl_CWoVyTmxKZUgUFUMhrGbtAGDnz5f`，`finishReason=stop`，总 Token `3377`，reasoning 长度 `2971` 字符、推理 Token `722`，Provider 耗时 `411ms`；
- 累计五条 smoke、五次技术冒烟 DeepSeek 调用；其中 v0.5 两次；A1 关闭组正式调用 `1` 次；
- v0.4 空正式批次 `a12756bb-024a-4135-b727-ac13db13a1db` 经核验为 `running / revision 0 / activeTaskId null / messages 0 / turns 0`，按固定 ID 和旧指纹定向删除 `1` 条；
- 删除后既有三条 smoke 保持完整；v0.5 两臂新增两条 `valid` 记录；当前 formal batch 保留 A1 关闭组首轮程序保护结果；
- 保留期清理覆盖当前评测版本全部批次和 GI-088 专属 smoke 表全部历史指纹。

## 5. 当前停止点

该批次后续累计 `9` 次正式调用，最终停在 A2 high。同一轮初次调用与两次手动重试均为 `finishReason=length`，`completionTokens=1600`、`reasoningTokens=1600`，可见内容为空。v0 原始记录继续保存，现行入口见 [GI-088 v1](../2026-08-09-gi088-human-eval-v1/README.md)。

当时的后续步骤已经由 v1 覆盖。产品负责人从 [GI-088 v1 当前入口](../2026-08-09-gi088-human-eval-v1/README.md) 重新完成 `12` 项、`24` 条轨迹；v0 只承担历史根因和恢复证据。

任何候选资产、运行参数或运行器代码变化都会产生新执行指纹，旧授权随之失效。Production 继续保持 `legacy + baseline`。
