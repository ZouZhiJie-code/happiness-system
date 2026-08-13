# 内容理解评测集

这组评测用于判断系统能否形成忠于用户原意、可持续修正的可信理解结果。

- 原内容理解案例：`120`
- 第二版可执行案例：`40`
- 配合意图识别案例：`120`
- 模块二专项案例合计：`280`
- 维度：`joy / fulfillment / reflection / improvement / gratitude`
- 每个维度：`24` 条
- 事实源：[cases.ts](./cases.ts)
- 第二版事实源：[v2-cases.ts](./v2-cases.ts)
- 自动检查：`npm run eval:interview-content-understanding`
- 连续三次稳定性报告：`npm run eval:interview-content-understanding:stability`

原有案例标注原问题、历史事实、用户原话、回答状态、接受/待确认/撤回/排除材料、事件关系、更新动作、候选维度和连续性场景。新增案例会直接运行有序操作要求、多目标回答、修正与含糊冲突、多事件归属、恢复复用和下游材料排除逻辑。连续三次检查结果保存在 `reports/`。
