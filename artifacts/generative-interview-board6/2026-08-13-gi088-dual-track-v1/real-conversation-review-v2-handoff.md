# GI-088 真实对话证据审题包 v2｜交接

> 历史状态更新：本包要求产品负责人重新裁决已经评价过的历史材料，当前流程已停止。现役入口为[GI-088 历史真实金标库 v1](./historical-real-gold-v1-handoff.md)；本文件与原回执继续保留错误纠正过程和历史身份。

- 状态：`已被历史真实金标库 v1 替代；不再等待逐份裁决`
- 版本：`2026-08-16.gi088-real-conversation-review-v2`
- 产品范围：`【陪我聊】`
- 模型、Judge、数据库、Preview、Production 变更：`0`

## 当前事实

原 70 项资产继续保留目录身份。本轮追溯找到 12 份带真实历史 AI 输出的【陪我聊】对话，覆盖其中 8 项原资产；另有 54 项缺少完整真实运行证据，8 项属于【帮我记】或跨模式范围。

“可以直接评”的 12 份材料全部具备：必要上下文、用户原话、AI 当时真实回答、候选与运行身份、历史人工结论与理由、内容指纹。模型生成后被程序拦截的回答明确标记为“用户未看到”，内容质量与交付事实分开呈现。

## 本机入口

点击打开：[`index.html`](./.private/real-conversation-review-v2/index.html)

应用安全策略阻止 Codex 自动把当前 `file://` 标签页切换到另一个本机文件。页面已经生成，产品负责人从上方链接进入即可。

## 如何评

只对“可以直接评”的 12 份材料提交裁决。逐份检查场景代表性、上下文、回答完整性、考点、历史标签、阻断级别和证据层，最后选择保留、修改金标、补上下文、转开发探索、退出替换或等待产品规则决定。

页面自动保存在本机浏览器；可以导出草稿，12/12 完成后同时导出正式 JSON 和 Markdown。导入其他版本的草稿会因评审包指纹不一致而被拦截。

## 证据入口

- [公开无内容回执](./real-conversation-review-v2-receipt.json)
- 私有评审包：`.private/real-conversation-review-v2/review-packet.json`
- 私有初始裁决账：`.private/real-conversation-review-v2/review-decisions.json`
- 私有初始汇总：`.private/real-conversation-review-v2/review-summary.json`

当前评审包指纹：`a0e98f16df9e63bc13d1dbe335ea223eea0b9a2a2b780cf59a09f9b72b13ea25`。

## 结论边界与停止点

本包只支持判断真实历史对话及旧金标是否适合进入当前评测资产。当前候选质量、Judge 资格、独立准入、真人 Preview 和发布资格保持待验证。

停止点已经达到：等待产品负责人导出 12 份裁决结果。下一轮再形成保留、修改、退出和产品规则待决清单。
