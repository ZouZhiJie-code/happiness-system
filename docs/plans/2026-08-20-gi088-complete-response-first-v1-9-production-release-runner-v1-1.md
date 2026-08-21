# GI-088｜完整回应优先 v1.9 Production 发布工具 v1.1

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 1. 进入原因

产品负责人已经依据四轮完整用户输入与实际 AI 输出裁决 v1.9 Preview `4/4 pass`。发布工具 v1 随后创建了一个 Ready 的 Production 候选部署，但在读取 Vercel CLI 返回值时把成功部署误判为“缺少部署身份”。

当前安装的 Vercel CLI `50.41.0` 在自动执行环境中返回：顶层包含执行状态，真实部署信息位于 `deployment` 子对象。v1 工具只读取顶层 `id/url`，因此没有识别已经创建的候选。

## 2. 已确认事实

| 类别 | 当前结论 |
|---|---|
| 产品判断 | v1.9 Preview 四轮产品裁决 `4/4 pass`，裁决与四轮输入／输出哈希绑定 |
| 技术事实 | v1 候选部署 `dpl_8tTNtvoemDhstcPqaLu1g3q3gvWU` 已 Ready，未接管正式域名 |
| 技术事实 | 正式域名继续指向 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`；Production 策略已恢复 `baseline` |
| 根因 | Vercel 非交互 JSON 使用 `deployment.id/url`；发布工具读取顶层 `id/url` |
| 产品风险 | v1 工具无法继续写入候选身份和执行后续冒烟；正式用户链路保持稳定 |

## 3. 唯一修复

- 发布工具先读取 `result.deployment`，缺少该对象时兼容读取原顶层结构。
- 新运行身份：`2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-1-cli-json-shape`。
- 新私有状态目录和公开回执独立保存；v1 失败证据保持冻结。
- 产品负责人当前 `4/4 pass` 继续绑定同一四轮输入／输出哈希，在新身份中重新落盘。
- 创建全新候选部署；v1 已创建的候选只承担历史审计，不进入冒烟或正式切流。

模型、可见回应、后台任务、候选版本、Production 数据库、备份、回退目标、候选冒烟输入、产品门和正式切流门全部保持原值。

## 4. 验证与停止点

- 自动测试必须覆盖 Vercel 非交互嵌套 JSON 与旧顶层 JSON 两种格式。
- 运行前重验 Preview、产品裁决、Production baseline、数据库备份、工作区和远端分支。
- 新候选使用 `--skip-domain`；正式域名继续指向原部署。
- 候选可见回应、后台 Trace、临时用户精确清理和候选语义裁决全部通过后，才进入正式切流。
- 任一外部状态漂移或候选失败时恢复 `baseline`，正式域名保持原部署。
- 当前停止点：完成单因素修复、本地验证、提交推送和新启动卡；随后直接创建新候选并运行真实冒烟。
