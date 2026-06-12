# 顶栏小组件统一 · 改前/改后预览

> **打开方式**：用浏览器打开 [`header-widget-unity-preview.html`](./header-widget-unity-preview.html)  
> macOS 终端：`open docs/plans/header-widget-unity-preview.html`

## 预览里有什么

单个 HTML，底部控制面板可切换：

| 控制项 | 作用 |
|--------|------|
| **改前 / 改后** | 对比当前代码 vs 计划落地后的顶栏 frost + 小组件 |
| **访谈 / 日历 / 分析 / 设置** | 切换顶栏中区真实布局 |
| **子状态** | 访谈子态、日历视图、分析 preset |

页面中部有两张对照卡，单独展示「胶囊 / 按钮」组件条，方便不看整页顶栏也能比颜色与高度。

## 改后方案要点（与计划一致）

- **顶栏背景**：glass 预览预设 A — 上沿 alpha 0.78、下沿 0.72、blur 12px、saturate 140%
- **顶栏内所有胶囊切换**：统一半透明暖底 + 选中暖棕渐变（访谈五维 / 月周日 / 本周本月 同色同高）
- **按钮原语**：Chip（今天）/ Action（完整日志）/ Primary（生成日志）/ Ghost（清除对话）
- **摘要 pill**：统一 `--header-surface-strong` 背景

## 建议体验路径

1. 默认「改后」，依次点：访谈 → 日历 → 分析，看选中胶囊是否同色
2. 切「改前」，重复 1，感受访谈浅色选中 vs 日历渐变选中的差异
3. 向下滚动页面，看改后顶栏叠在木纹背景上是否更清晰
4. 对照中部组件条 + 底部 token 读数，确认数值是否符合预期

## 关联文档

- 实施计划：Cursor plan「Header Widget Unity」
- 顶栏透明度调参：[`header-glass-preview.html`](./header-glass-preview.html) 预设 A
- 布局统一（已落地）：[`header-unity-preview.html`](./header-unity-preview.html)
