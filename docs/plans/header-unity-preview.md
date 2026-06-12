# 顶部导航统一性改进 · 交互预览说明

> **打开方式**：用浏览器打开 [`header-unity-preview.html`](./header-unity-preview.html)  
> macOS 终端：`open docs/plans/header-unity-preview.html`

## 预览里有什么

单个 HTML，底部控制面板可切换：

| 控制项 | 作用 |
|--------|------|
| **改进前 / 改进后** | 对比当前线上 vs P0–P3 合并方案 |
| **主导航** | 访谈 / 日历 / 分析 / 设置 / 画像 |
| **子状态** | 访谈 4 态、日历月/周/日、分析 preset |

## P0–P3 在预览中的对应关系

- **P0**：改进后所有页面统一五列 `brand｜中区｜nav`；设置/画像中区显示轻标题；主导航选中不再放大字号
- **P1**：wayfinding 用下划线（主导航 + 分析 section）；view 切换用 segmented（五维、月/周/日、分析 preset）
- **P2**：访谈进度 / 生成日志 / 回到访谈占固定槽位，隐藏时不挤动后续按钮
- **P3**：日历 / 分析 / 访谈共用四槽模板 `[时间导航｜标题摘要｜视图切换｜快捷动作]`

## 建议体验路径

1. 选 **改进后**，依次点：访谈 → 日历 → 分析 → 设置 → 画像，观察右侧主导航是否基本不动  
2. 访谈页切换子状态：默认 → 有进度 → 可生成日志 → 完整日志模式，观察改进后按钮是否不再横向跳动  
3. 切 **改进前**，重复 1–2，感受 grid 塌陷与 reflow  
4. 分析页切「自定义」，看 custom 日期输入宽度变化

## 待写入文件

- 文件路径：[`header-unity-preview.html`](./header-unity-preview.html)
- 风格参考：[`header-glass-preview.html`](./header-glass-preview.html)
- 状态：**已落地到代码**（2026-06-12）
