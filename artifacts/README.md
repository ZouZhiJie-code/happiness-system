# 评测资产公开索引

最后更新：`2026-08-10`

当前状态：`GI-088 v7 两条真人连续轨迹已封存；v7r1 Prefix 兼容 No-Go；v7r2 Ark Flash 本地实现与自动验证通过，等待 Preview 回读和 0/2 空白批次`

## 1. 为什么采用公开精简包

公开仓库服务产品设计理解、实现复核和脱敏结论追溯。真人原始内容与运行过程文件需要更严格的访问边界，因此本目录只保存当前入口、版本清单、最终裁决、静态验证、脱敏聚合结果和必要的合成回归资产。

产品状态以 [`docs/generative-interview-refactor-map.md`](../docs/generative-interview-refactor-map.md) 为准；本目录只承担证据职责。

## 2. 当前事实链路

1. [GI-088 v7r2 Thinking high Ark Flash](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r2-ark-flash/README.md)：当前候选、冻结行为、自动验证与 Preview 停止点。
2. [GI-088 v7r1 Prefix 续写 No-Go](./generative-interview-board7/2026-08-10-gi088-human-eval-v7r1-visible-continuation/README.md)：Prefix 与 JSON Output 不兼容，以及模型平台对照结论。
3. [GI-088 v7 连续性底座封存](./generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/README.md)：两条真人连续轨迹的脱敏结论与可靠性阻断。
4. [Board 7 资产索引](./generative-interview-board7/README.md)：GI-084～GI-088 的公开安全资产导航。

Production 当前保持 `legacy + baseline`。当前候选只服务受控 Preview，正式发布继续等待独立授权。

## 3. 公开证据范围

允许进入 Git 的内容：

- README、manifest、最终裁决与阶段复盘；
- 静态验证、运行器验证与脱敏聚合指标；
- 不含真人内容的 Prompt、Skill、输出合同和合成回归输入；
- 只包含哈希、数量、状态码和安全诊断的技术证据。

持续保留在 `artifacts/local-runtime/` 或原本机目录的内容：

- 完整真人轨迹、用户原话和原始模型输出；
- 隐藏思考正文、Trace、checkpoint、完整 runs 与数据库快照；
- Cookie、数据库连接、API Key、Token 和其他凭据；
- 可以关联真人 Call、Turn、会话或个人经历的原始标识。

## 4. 收纳规则

1. 当前事实、历史证据和本地过程文件分层保存。
2. 历史自动通过只承担当时版本的技术证据，无法替代当前产品裁决。
3. 新资产必须注明候选版本、来源血缘、适用范围、验证状态和 Production 边界。
4. 完整真人内容缺少独立公开授权时持续留在本机受控目录。
5. API Key、完整数据库连接和 Cookie 禁止写入正式资产。
6. 公开副本会把可关联运行记录的 UUID 替换为 `redacted-operational-id`；包含 Trace 定位符或真人逐字输入的 manifest、运行计划、脚本和测试持续留在本机。
