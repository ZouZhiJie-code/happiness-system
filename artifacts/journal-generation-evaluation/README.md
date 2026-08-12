# 日志生成离线评测与隔离评审

## 目的

这套资产用于验证“访谈轨迹 → 日志正文”的忠实性、组织能力与失败保护。机器可确定的硬边界放在静态评测器中，自然度、结构质量和用户原声交给真人轨迹评审。

当前范围保持三条边界：

1. 只做离线评测与本地管理员评审；
2. 产品负责人已完成 9 条真人轨迹的今日日记 Prompt v3 评价：首批 3 条使用较早确认的记录卡，扩展 6 条完成“记录卡 v3 → 今日日记 v3”完整回归；9/9 均为“可直接使用”、四项评分全部 5 分。记录卡 Prompt v3 和统一完整链路的证据范围均限定为 6 条；
3. 私有完整对话、候选正文和评审身份映射全部留在 `.private/`，该目录默认被 Git 忽略。

正式 `dev28＋hidden12`、新前端六案例 Preview 和 Production 切换继续等待后续阶段；当前阶段总结见[九条真人轨迹阶段性总结](./nine-human-trajectory-summary.md)。

## 资产结构

- `private-source-index.json`：9 份已知私有文件的脱敏事实索引。5 个主导出文件承载 9 条已完成真人轨迹；2 个 sealed copy 只承担去重校验；2 个 v8r1 baseline 属于派生快照，排除本批真人回放；
- `case-schema.json`：种子案例和候选快照的正式数据结构；
- `seed-cases.json`：10 个合成规则案例，覆盖单事件、多事件、跨会话、修正、删除和更新失败；只承担自动规则回归；
- `seed-static-report.json`：10 个种子案例的可复现静态基线报告；
- `flash-daily-prompt-v2-round-report.md`：3 条真人轨迹的 Flash 二轮调用、执行指纹、成本、页面验收和停止边界摘要；
- `flash-daily-context-v3-round-report.md`：结构语境 Prompt v3 的 3 条真人轨迹调用、血缘、成本、页面验收和当前评审状态；
- `gi088-human-extension-record-card-stage-a-report.md`：剩余 6 条真人轨迹的 Stage A 记录卡运行汇总、零调用评审准入续包指纹、机械结构处理边界与当前人工确认状态；
- `gi088-record-card-rewrite-stage1-report.md`：新版记录卡六条整改案例的真实调用、零调用展示投影、客观来源问题、写作诊断、成本耗时和真人评审停止点；
- `gi088-record-card-rewrite-v2-stage1-report.md`：写作材料单元候选的六条真实调用、客观合同结果、写作诊断、执行指纹与当前评审停止点；
- `record-card-v3-daily-regression-report.md`：六条已确认记录卡生成今日日记的真实回归、父子血缘、程序检查、执行指纹和真人评价结论；
- `nine-human-trajectory-summary.md`：九条今日日记 Prompt v3 真人证据、六条统一完整链路边界与后续顺序；
- `metrics-template.json`：P0、P1、Judge 校准、独立准入和真人裁决完整门槛；
- `formal/evaluation-plan.json`：正式 40 案例总结构与当前“仅骨架、未执行”边界；
- `formal/dev28-manifest.json`：10 种子、9 真人、9 派生的开发集清单；
- `formal/hidden12-manifest.json`：3 个全新真人和 9 个冻结后独立合成空槽位，不含隐藏案例内容；
- `formal/derived-recipes.json`：9 个派生配方、父案例绑定、P0 不变量与私有物化路径；
- `formal/judge-calibration-20-manifest.json`：20 个 Judge 校准空包及人工标注后冻结结构；
- `formal/gate-protocol.md`：本地隔离、开发冻结、Judge 校准、独立准入和发布裁决门槛；
- `admission-report-template.md`：候选准入报告模板；
- `private-candidate-packets.example.json`：本地 A/B 候选包占位格式；
- `.private/`：导入清单、本地候选和评审结果，持续保持 Git 忽略。

## 正式评测资产骨架

```bash
node_modules/.bin/vite-node --script scripts/journal-generation-eval/formal-asset-validator.ts
```

结构校验固定检查：

1. `dev28 = 10 个种子 + 9 个真人 + 9 个派生`；
2. 9 个派生案例与 9 个配方、9 个真人父案例一一对应；
3. `hidden12 = 3 个全新真人空槽位 + 9 个冻结后独立合成空槽位`；
4. hidden 正式清单不含对话、场景、记录卡、日记输入或候选正文；
5. Judge 校准包保持 20 个空槽位，gold label 等待人工双标和裁决；
6. 所有私有物化结果只写入 `.private/formal/`。

## 本地隔离硬检查

本机项目 `.env` 当前指向远程 Neon，正式评测命令必须显式覆盖标准 `DATABASE_URL` 与 `DIRECT_URL`。安全检查不读取数据库、不创建 schema，也不写任何数据。

先按 `formal/local-isolation-env.example` 在同一条启动命令中显式设置环境；其中 `VERCEL_ENV` 与 `NEXT_PUBLIC_VERCEL_ENV` 需要显式覆盖为空，避免本地 Vite 载入 `.env.local` 中的 Preview 标记。随后运行：

```bash
node_modules/.bin/vite-node --script scripts/journal-generation-eval/check-local-isolation.ts
```

检查器会硬拒绝：

- `DATABASE_URL` 或 `DIRECT_URL` 缺失；
- 任一数据库地址不是 `localhost / 127.0.0.1`；
- database 不是 `happiness_system_codex`；
- schema 不是 `journal_daily_eval`；
- Web origin 不是本地 HTTP；
- 存在 `VERCEL_ENV`、Preview 或 Production 上下文；
- 运行数据目录离开 `.private/formal/`；
- 私密探针未被 Git 忽略，或 `.private` 下存在被跟踪文件。

检查通过只代表环境变量和文件边界安全。建 schema、导入私有数据、启动应用与执行评测继续是后续独立动作。

## 本地导入

```bash
node_modules/.bin/vite-node --script scripts/journal-generation-eval/import-private-exports.ts
```

导入器会：

1. 在用户下载目录与 `artifacts/local-runtime` 中匹配已知文件名；
2. 重新计算 SHA-256 并拒绝内容不一致的文件；
3. 按 SHA-256 去重轨迹副本；
4. 只把文件位置、技术元数据和轨迹定位信息写入 `.private/imported-manifest.json`；
5. 保持对话正文在原私有文件内。

可用参数：

```bash
node_modules/.bin/vite-node --script scripts/journal-generation-eval/import-private-exports.ts \
  --source-dir /path/to/private/exports \
  --output /path/to/ignored/imported-manifest.json \
  --dry-run
```

## 静态评测

```bash
node_modules/.bin/vite-node --script scripts/journal-generation-eval/evaluate.ts \
  --input artifacts/journal-generation-evaluation/seed-cases.json \
  --output artifacts/journal-generation-evaluation/.private/seed-static-report.json
```

评测器执行确定性检查：记录卡规则、来源映射、必要事实覆盖、不确定性保留、事件合并与分开、顺序、禁止内容命中，以及生成失败时旧稿保留。10 个合成种子只承担规则回归，不进入真人评审。

## 隔离评审

本地开发环境中的管理员可打开 `/admin/journal-evaluation`。当前入口优先展示六条记录卡 v3 → 今日日记 Prompt v3 回归评价：

- 页面展示完整真人对话、原始记录卡、已确认记录卡和 Prompt v3 今日日记；
- 总体裁决、四项评分、问题标签和备注逐字段保存到本地隔离服务；
- 首次裁决锁定后揭示程序检查和来源关系，备注支持追加；
- 六例均已锁定为“可直接使用”，四项评分均为 5 分，问题标签为 0；
- 10 个合成种子持续承担静态规则检查；真人评审证据由私有真人轨迹独立形成。

记录卡 v3 已确认的六张卡作为本轮今日日记唯一输入；旧扩展记录卡包不参与本轮输入。记录卡 v3 的历史评价可从 `/admin/journal-evaluation/record-rewrite-v3` 回看。

## 正式准入阶段

种子链路通过后，正式数据集扩展为 40 个日级案例：28 个开发与回归案例、12 个冻结前不可见的独立准入案例。GI-088 回放只承担开发与诊断，同一故事只计一个来源案例。

12 个独立案例连续运行 3 次，全部 P0 通过后才进入发布裁决。Judge 需要在人工标注集上达到 P0 召回率 100%、精确率至少 90%；低于门槛时继续作为诊断工具。真人盲评要求“可直接使用＋轻微修改”至少 80%，具体阈值以 `metrics-template.json` 为准。

## 已知能力边界

静态规则能发现可枚举的事实遗漏、旧事实复活、删除内容复活、来源断链和失败覆盖。语义等价改写、篇章自然度、情绪力度与真正的“更像用户”仍需真人评审。任何准入结论都要同时保留评测集版本、候选指纹、静态报告与匿名评审覆盖率。
