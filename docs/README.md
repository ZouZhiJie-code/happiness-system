# Daily Light 文档导航

最后更新：`2026-08-06`

用途：让新的 AI、开发者或产品协作者在五分钟内找到当前事实、开放问题、实现说明和评测证据。

## 1. 当前状态

- `GI-068～080` 保持关闭；
- 生成式访谈工作方法 `v1.0` 已冻结；
- 板块 6 继续进行中；
- `GI-081` 六题真实输出已经完成，当前等待产品负责人完成盲评与架构裁决；
- 板块 7 正式实现继续等待板块 6；
- 板块 8 继续等待；
- Production 保持 `legacy + baseline`。

## 2. 新会话阅读顺序

1. [项目协作与事实规则](../AGENTS.md)
2. [访谈产品优化总 Map](./interview-product-optimization-map.md)
3. [生成式访谈重构总 Map](./generative-interview-refactor-map.md)
4. [生成式访谈 AI 产品工作方法 v1.0](./technical/interview-event-centered/00-generative-interview-ai-product-working-method.md)
5. [板块 6 当前专项｜生成式访谈质量评测 v1](./technical/interview-event-centered/04j-generative-quality-evaluation-v1.md)
6. [板块 5 冻结输入](./technical/interview-event-centered/05-board5-stability-user-control-and-interaction-scope.md)
7. [GI-074 评测与交接](./technical/interview-event-centered/04x-07-evaluation-preview-and-handoff.md)
8. [评测资产总入口](../artifacts/README.md)

## 3. 按任务找文件

### 产品状态与决策

- 全产品访谈链路：[访谈产品优化总 Map](./interview-product-optimization-map.md)
- 事件中心阶段与批次：[事件中心重构讨论地图](./interview-event-centered-refactor-discussion-map.md)
- 生成式板块 1～8：[生成式访谈重构总 Map](./generative-interview-refactor-map.md)
- 事件中心产品事实：[事件中心产品规格](./interview-event-centered-product-spec.md)

### 当前评测与真人裁决

- 板块 6 人工校准：[首批 8 张卡入口](../artifacts/generative-interview-board6/2026-08-06/README.md)
- GI-081 六题 A/B：[真实输出资产入口](../artifacts/generative-interview-board7/2026-08-06-board7a-real-output-ab-v1/README.md)
- 评测资产治理：[artifacts 总入口](../artifacts/README.md)

### 工程实现与运行

- 系统结构：[architecture.md](./architecture.md)
- API 与调用方式：[integration-guide.md](./integration-guide.md)
- 本地运行与排障：[operator-runbook.md](./operator-runbook.md)
- 当前交接：[handoff.md](./handoff.md)
- 访谈意图评测：[interview-intent-evaluation-source-of-truth.md](./interview-intent-evaluation-source-of-truth.md)
- 工作区收口结果：[2026-08-06-workspace-consolidation-result.md](./maintenance/2026-08-06-workspace-consolidation-result.md)

### 历史证据

- 历史 Board 7：[Board 7 资产索引](../artifacts/generative-interview-board7/README.md)
- 历史 Board 8：[Board 8 资产索引](../artifacts/generative-interview-board8/README.md)
- 历史 Batch B：[Batch B 证据清单](../artifacts/event-centered-batch-b-manifest.md)
- `GI-066` 真人 No-Go 与历史候选：[04u 专项](./technical/interview-event-centered/04u-board8-gi066-thought-only-question-strategy.md)

## 4. 稳定搜索词

在仓库根目录使用：

```bash
rg -n "GI-081|板块 6|board6-calibration|board7a-real-output-ab|legacy \+ baseline" AGENTS.md README.md docs artifacts
```

历史候选使用：

```bash
rg -n "GI-066|No-Go|historical|历史证据" docs/technical/interview-event-centered artifacts
```

## 5. 事实使用规则

总 Map 的当前状态优先于历史报告；当前专项承载开放问题和校准过程；冻结专项承载关闭输入；`artifacts/` 保存运行和人工裁决证据。自动技术通过、旧候选和历史 Preview 结论不能替代当前产品裁决或 Production 授权。
