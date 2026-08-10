# GI-084 v0.1｜冻结规则分流与提问策略修正

当前候选只修正 GI-084。GI-083 真实失败网页和 GI-084 v0 均保持原样，继续承担历史对照。

## 当前资产

- `board7b-base-prompt-v0.1.md`：精简的【陪我聊】稳定产品合同。
- `conduct-daily-light-thinking-interview/SKILL.md`：共同聚焦、形成认识、动态深入和决策支持方法。
- `board7b-semantic-result-v0.md`：原样沿用的 v0 结构合同。
- `board7b-gi068-080-rule-coverage-v0.1.md`：不进入模型的冻结规则分流表。
- 八次隐藏回归的逐字输入与执行计划保留在本机受控目录；公开包只保留裁决和聚合结果。
- `board7b-prompt-skill-v0.1-manifest.json`：候选指纹、状态和边界。

## 8 次回归结果

产品负责人已授权并完成 `8/8` 次调用，自动重试 `0`。结果为 `No-Go`：结构完整通过 `3/8`，秋招关键决策点未达到 `4/4`，真实网页轨迹继续关闭。详细结果见 `board7b-prompt-skill-v0.1-regression-result.md`。

只读检查命令：

```bash
npx vite-node -c vitest.config.ts scripts/run-board7b-prompt-skill-v0-1-workbench.ts --check
```

本机网页运行器继续保留，当前不启动真实轨迹。下一版需要新指纹和新授权。

Production 继续保持 `legacy + baseline`；公共 API、数据库、线上页面、线上 Prompt、配置和运行开关均保持当前状态。
