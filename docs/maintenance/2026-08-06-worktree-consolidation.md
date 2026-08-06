# 2026-08-06 工作区分组收口清单

状态：`第二轮整理快照；用于后续分组审查与提交`

## 1. 为什么需要分组收口

当前工作区同时保存已经发布的五维能力、事件中心历史实现、生成式访谈产品文档、Board 6/7/8 评测资产和多轮本地运行结果。直接形成一个大提交会混合产品事实、工程实现和历史证据，也会削弱回退与审查能力。

本清单只规定收口顺序，不改变产品状态、运行配置或发布范围。

## 2. 起始快照

- 当前分支：`codex/interview-review`
- 当前提交：`9c270e2`
- 已跟踪修改：`109` 个文件
- 未跟踪文件：`1394` 个文件
- `codex/batch-c-outcomes-prototype` 在当前提交之后包含 `3` 个独立提交：`5d86297`、`0b35c13`、`3a1c547`
- Production：`legacy + baseline`

第二轮整理结果：

- 根目录历史 checkpoint 从 `36` 份收敛为 `4` 份仍被文档引用的证据；
- `32` 份无引用 checkpoint 和 `1` 份恢复日志移入已忽略的本地临时区；
- 新增 Board 6、GI-081 Board 7A 和 Batch B 三个资产入口；
- 未跟踪文件从 `1394` 个降至 `1366` 个，新增入口与清单已经计入结果。

## 3. 建议收口顺序

### A. 当前产品事实与 GI-081 评测闭环

范围：

- `docs/generative-interview-refactor-map.md`
- 板块 4～7 当前与冻结专项文档
- `artifacts/generative-interview-board6/2026-08-06/`
- `artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/`
- `evals/event-centered-generative/board7a-real-output/`
- `scripts/run-board7a-real-output-ab.ts`
- `tests/unit/board7a-real-output-ab.test.ts`

审查重点：产品盲评与 Codex 初评独立保存；运行前冻结快照保持原样；六题数据、Prompt、预算、运行结果和揭晓映射血缘完整。

### B. 已发布的访谈可靠性、意图识别与回复版本

范围：

- `InterviewUserTurn` 可靠提交与恢复；
- 意图识别 `enforce`；
- 按意图重新生成与活动分支；
- 对应 migration、API、页面、埋点、测试和运行文档。

审查重点：对照已发布生产事实，确认 migration、回退档位、接口错误和前端恢复体验均有验证证据。

### C. 事件中心基础实现与 Batch C 成果

优先复核 `codex/batch-c-outcomes-prototype` 的三个既有提交，减少在当前混合工作区重复整理同一批文件。当前文件与该分支存在后续演进时，按功能差异追加独立提交。

审查重点：数据模型、迁移、事件级可靠提交、事实修订、认识与成果、事件日志和恢复合同保持同一血缘。

### D. 历史 Board 7/8 与 Batch B 证据

范围：

- `artifacts/generative-interview-board7/2026-07-28` 至 `2026-08-02`；
- `artifacts/generative-interview-board8/`；
- 根目录 `event-centered-batch-b-*` 历史结果。

审查重点：只保留候选血缘、最终报告、代表性失败、真人裁决和必要原始输出；当前状态统一标为历史证据。

### E. 独立设计与知识资产

范围：

- `docs/diagrams/`
- `docs/vibe-coding-series/`
- `docs/prototypes/`
- `DESIGN.md` 与 UI 规范。

这些内容与生成式评测运行分开审查，避免设计文档、文章和运行证据进入同一个提交。

## 4. 提交前共同检查

每组独立完成：

1. 文件清单与引用检查；
2. 敏感信息和用户原话授权检查；
3. 相关测试、类型检查或文档检查；
4. 当前事实、历史证据和开放问题标签检查；
5. Production `legacy + baseline` 与运行开关检查；
6. 独立暂存、差异复核和提交说明。

## 5. 当前停止点

第二轮只建立分组、入口与本地过程文件收纳。Git 暂存、提交、分支切换和历史产物删除统一留给后续逐组审查，避免干扰产品负责人正在进行的 GI-081 盲评。
