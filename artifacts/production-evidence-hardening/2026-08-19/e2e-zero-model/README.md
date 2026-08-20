# 阶段 2｜零模型端到端回归公开回执

- 证据类型：公开脱敏工程回执
- 验证状态：本地完整三连跑通过
- 对应提交：`be98237`
- 当前发布线状态：远程工程门通过，Preview 核心主链部分通过，Production blocked
- Preview／Production：本回执不承担发布证明

## 为什么保留这份回执

这份回执固定零模型端到端回归的本地验收结果，方便后续 Preview、Production 和主链重构沿用同一发布门。它只记录测试数量、耗时、临时环境标识、模型调用审计和数据回收状态。

公开材料不包含数据库地址、账号、口令、用户输入、对话内容、事件卡内容或日记正文。临时 Schema 名是单次运行自动生成的非敏感隔离标识，运行结束后均已删除。

## 当前发布线复核

原始三连跑继续由提交 `be98237` 与下方机器回执承担。阶段 2 发布线 rebase 到 `origin/main@305f209` 后，等价实现提交为 `5d0e795`，本地验证头为 `f12bf27`；24 个文件边界中 Prisma 变更为 `0`。

rebase 后新增一轮安全复核：guard `9/9`、浏览器 `11/11`；`AIRequestLog=0`，12 条 Trace 的四类模型调用违规为 `0`，临时 Schema 已删除且最终残留为 `0`。该单轮用于证明发布线重放后未发生工程漂移，不改写下方原始三连跑身份。该本地检查点结束时，PR、远程 CI、Preview 和 Production 均为 pending；当前状态见下方 PR 与 Preview 结果。

## PR 与 Preview 结果

PR #41 在 head `e7e1541` 上的 push／pull request 两套 CI 均成功。远程常规门为 `361` 个测试文件通过、`16` 个跳过，`3216` 条用例通过、`82` 条跳过、`0` 失败；构建 `77/77`，Lint `0 errors / 43 warnings`。两套零模型 E2E Job 均为 `11/11`，其中 PR Job 记录 `AIRequestLog=0`、12 条 Trace、四类调用违规 `0`，临时 Schema 已删除。

Preview `dpl_GAU2uR8BpbTsP4FQhhnqaGBmv4Sr` 为 Ready。人工 smoke 已通过匿名保护、普通用户后台保护、上海日期归属、【帮我记】完整回应、完成记录、单卡保存和今日日记 draft 生成。首次人工编辑使用了 17 字验收标题，超过 UI 的 16 字合同，产品正确返回 `400 INVALID_JOURNAL_DAILY_AUTOSAVE_REQUEST`；纠正后的首次重新登录在请求到达应用前遇到 Vercel CLI TLS 阻断，因此编辑／保存、来源变化需更新和更新后人工修改保护保持 `not_run`。

当前发布结论为 `远程工程门通过 / Preview 核心主链部分通过 / Production blocked`。Stage 2 Production 等待两项完成：阶段 1 管理员成功读取；Preview 日记编辑、保存、需更新和人工修改保护续跑。机器可读边界见 [`preview-gate-receipt.json`](./preview-gate-receipt.json)。

## 本地三连跑结果

| 轮次 | 浏览器场景 | 结果 | 耗时 | 生成轨迹 | 模型请求记录 | 调用违规 | 临时 Schema |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | 11 | `11/11 passed` | `5.6s` | 12 | 0 | 0 | `daily_light_e2e_mt0xpgeg_45ef174f8a`，已删除 |
| 2 | 11 | `11/11 passed` | `5.7s` | 12 | 0 | 0 | `daily_light_e2e_mt0xqkhy_410fec5134`，已删除 |
| 3 | 11 | `11/11 passed` | `5.8s` | 12 | 0 | 0 | `daily_light_e2e_mt0xr8ke_a2598cdff9`，已删除 |

每轮覆盖 1440×900 的 10 项主链场景，以及 1024×768 的 1 项尺寸冒烟。每轮均使用 4 个并行 Worker；数据库并发场景保持串行。

## 零模型与隔离结论

- 三轮 `AIRequestLog` 均为 `0`。
- 三轮各有 12 条 `AIGenerationTrace`，`outputOrigin=llm`、Provider 调用次数大于 0、`actualModelCallExecuted=true`、非 `disabled` Provider 尝试四类违规均为 `0`。
- 三个临时 Schema 均产生删除回执；最终残留 Schema 数为 `0`。
- 异常停止演练通过退出后回收检查：零模型审计回执、Schema 删除回执和最终残留 `0` 均成立。
- CI 的 Playwright 自动重试次数固定为 `0`，随机失败将直接暴露。

## 分析合同 v2 对账

受控事件中心完整链路的六步漏斗逐步一致：

1. 打开当天 `1`；
2. 首次提交内容 `1`；
3. 获得完整回应 `1`；
4. 保存事件卡 `1`；
5. 生成今日日记 `1`；
6. 保存今日日记 `1`。

接口合同版本为 `2`，旧链路兼容区继续存在。本次对账使用一次性临时 Schema，测试数据已经随 Schema 删除。

## 机器可读证据

完整结构化结果见 [`receipt.json`](./receipt.json)。
