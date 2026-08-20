# 阶段 2｜零模型端到端回归公开回执

- 证据类型：公开脱敏工程回执
- 验证状态：本地完整三连跑通过
- 对应提交：`be98237`
- 当前发布线状态：已合入 main，Preview 通过至“需更新”，两测试文件本地修复门通过、远程待验证，Production blocked
- Preview／Production：本回执不承担发布证明

## 为什么保留这份回执

这份回执固定零模型端到端回归的本地验收结果，方便后续 Preview、Production 和主链重构沿用同一发布门。它只记录测试数量、耗时、临时环境标识、模型调用审计和数据回收状态。

公开材料不包含数据库地址、账号、口令、用户输入、对话内容、事件卡内容或日记正文。临时 Schema 名是单次运行自动生成的非敏感隔离标识，运行结束后均已删除。

## 当前发布线复核

原始三连跑继续由提交 `be98237` 与下方机器回执承担。阶段 2 发布线 rebase 到 `origin/main@305f209` 后，等价实现提交为 `5d0e795`，本地验证头为 `f12bf27`；24 个文件边界中 Prisma 变更为 `0`。

rebase 后新增一轮安全复核：guard `9/9`、浏览器 `11/11`；`AIRequestLog=0`，12 条 Trace 的四类模型调用违规为 `0`，临时 Schema 已删除且最终残留为 `0`。该单轮用于证明发布线重放后未发生工程漂移，不改写下方原始三连跑身份。该本地检查点结束时，PR、远程 CI、Preview 和 Production 均为 pending；当前状态见下方 PR 与 Preview 结果。

## PR、Preview 与 main 合并结果

PR #41 在 head `e7e1541` 上的 push／pull request 两套 CI 均成功。远程常规门为 `361` 个测试文件通过、`16` 个跳过，`3216` 条用例通过、`82` 条跳过、`0` 失败；构建 `77/77`，Lint `0 errors / 43 warnings`。两套零模型 E2E Job 均为 `11/11`，其中 PR Job 记录 `AIRequestLog=0`、12 条 Trace、四类调用违规 `0`，临时 Schema 已删除。

最终 head `553d488` 的 push run `32337508459` 与 pull request run `32337511943` 继续通过，两套零模型 E2E 均为 `11/11`。PR #41 随后合入 main merge `77de8d1`；该合并只形成 Preview，正式域名继续指向阶段 1 Production `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。

Preview `dpl_GAU2uR8BpbTsP4FQhhnqaGBmv4Sr` 为 Ready。人工 smoke 已通过匿名保护、普通用户后台保护、上海日期归属、【帮我记】完整回应、完成记录、单卡保存和今日日记 draft 生成。首次人工编辑使用了 17 字验收标题，超过 UI 的 16 字合同，产品正确返回 `400 INVALID_JOURNAL_DAILY_AUTOSAVE_REQUEST`；纠正后的首次重新登录在请求到达应用前遇到 Vercel CLI TLS 阻断，因此编辑／保存、来源变化需更新和更新后人工修改保护保持 `not_run`。

最终 Preview `dpl_5okCGtSkeA7h6uCQUAWv9ur5UtHG` 完成一次最小续跑：16 字以内标题的人工编辑、日记保存和事件卡变化后的“需更新”均通过；调用日记更新前再次遇到 Vercel CLI TLS 阻断，应用未收到该更新请求。因此日记更新与更新后人工片段保护保持 `not_run`，首次输入错误和两次传输失败继续分别记账。

main push run `32337995170` 的零模型 E2E 为 `11/11`，常规测试出现一个 GI-088 工作台异步单例失败：`360` 个测试文件通过、`16` 个跳过、`1` 个失败，`3215` 条用例通过、`82` 条跳过、`1` 个失败；构建与 Lint 随前序失败跳过。Stage 5 同一提交的 push run `32338658277` 全绿，PR run `32338697673` attempt 1 又在同一测试文件等待结构化错误 `GI088_TURN_OUT_OF_DATE`，单例 `30.174s` 后失败；failed-only attempt 2 已主动取消。两组远程事实共同确认 GI-088 工作台存在异步测试波动，Stage 5 产品候选继续使用自身证据判断。

首次本地修复后的全量运行在 `361/377` 文件进度处出现第二类单次时序失败：跨日期会话界面标题已经切换为所选记录，地址栏更新 effect 尚未完成。该精确用例的旧版随后完成 `50/50 P4`，仍按实际失败证据修复为同时等待地址栏 `sessionId` 与 `entryDate`；修复后再次完成 `50/50 P4`。GI payload 用例继续覆盖用户真实首次选择“包含提问”的路径，fake digest 只承担测试替身；该用例完成 `50/50 P4`，完整 GI 文件完成 `20/20 P4`，两个工作区混合压力为 `270/270 P4`。

当前热修复提交 `0e5907b` 只改两个测试文件，产品源码变更 `0`。当前代码连续三轮全量均为 `361` 个文件通过、`16` 个跳过，`3216` 条用例通过、`82` 条跳过、`0` 失败；相关四文件 `40/40`。类型检查、目标与全量 Lint、构建 `77/77`、Prisma、文档与差异检查均通过。零模型浏览器回归为 `11/11`，`AIRequestLog=0`、12 条 Trace 的模型调用违规为 `0`，临时 Schema 已删除且残留为 `0`。本地工程门已通过，远程结果待验证。

当前发布结论为 `已合入 main / Preview 通过至需更新 / 本地修复门通过、远程待验证 / Production blocked`。Stage 2 Production 等待阶段 1 管理员成功读取、Preview 日记更新与人工修改保护、以及 `PEH-023` 远程验证完成。机器可读边界见 [`preview-gate-receipt.json`](./preview-gate-receipt.json)。

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

`receipt.json` 继续承担原始本地三连跑身份；本次 PR、Preview、main 合并和 CI 修复边界只进入 [`preview-gate-receipt.json`](./preview-gate-receipt.json)，阶段 1 Production 回执保持原身份。
