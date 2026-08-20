# 板块 7｜v72 首个运行账本基础设施作废审计

- 账本：`board7-provider-v72-semantic-frame-first-pass-budget-v1`
- 状态：`aborted`
- 发生位置：读取运行时配置后、Provider 预检前
- 只读预检请求：`0`
- 生成请求：`0`
- 六例结果：`0/6`，均未进入模型
- 原因：评测脚本只读取到旧 Endpoint 配置，并把 Endpoint ID 当作冻结模型名称比较；项目完整环境层级中已经配置 `DEEPSEEK_MODEL=deepseek-v4-flash`。
- 处理：保留原账本和空检查点；新入口先加载与应用一致的完整环境层级，再执行冻结模型校验。
- 运行轮次：本次不计入六例真实首轮，因为模型、模型列表接口和生成接口均未收到请求。
- 替代账本：`board7-provider-v72-semantic-frame-first-pass-budget-v2`
- 授权连续性：沿用产品负责人已确认的同一六例、同一候选、同一模型和一次首轮真实验证授权；替代账本明确引用本作废记录。
