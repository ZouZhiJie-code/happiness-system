# 顶栏小组件样式统一 · 设计说明

日期：2026-06-12

## 目标

顶栏背景调到 [`header-glass-preview.html`](./header-glass-preview.html) 预设 A（更实、blur 12px），访谈 / 日历 / 分析顶栏内小组件共用一套 token 与原语。

交互预览：[`header-widget-unity-preview.html`](./header-widget-unity-preview.html)

## CSS Token（`:root`）

| Token | 值 | 用途 |
|-------|-----|------|
| `--header-frost-top` | `0.78` | 顶栏渐变上沿 alpha |
| `--header-frost-bottom` | `0.72` | 顶栏渐变下沿 alpha |
| `--header-frost-blur` | `12px` | backdrop blur |
| `--header-frost-saturate` | `140%` | backdrop saturate |
| `--header-frost-border-alpha` | `0.18` | 底边框 |
| `--header-frost-shadow-alpha` | `0.12` | 外阴影 |
| `--header-surface` | `rgba(255,249,239,0.56)` | 次要按钮 / segmented 轨道 |
| `--header-surface-strong` | `rgba(255,249,239,0.72)` | 摘要 pill |
| `--header-surface-border` | `rgba(150,105,61,0.14)` | 默认边框 |
| `--header-surface-border-active` | `rgba(166,114,61,0.24)` | 选中边框 |
| `--header-accent-gradient` | 暖棕渐变 | segmented 选中 / Action 选中 |
| `--header-accent-gradient-strong` | 略深渐变 | Primary 按钮 |
| `--header-control-min-height` | `2rem` | 小组件统一触达高度 |
| `--header-control-font-size` | `0.75rem` | 小组件字号 |

## 组件原语（`header-toolbar-primitives.tsx`）

| 原语 | 用途 |
|------|------|
| `HeaderToolbarChipButton` | 「今天」等圆角 pill |
| `HeaderToolbarActionButton` | 「完整日志 / 当天评分 / 回到访谈」 |
| `HeaderToolbarPrimaryButton` | 「生成日志」 |
| `HeaderToolbarGhostButton` | 管理员「清除对话记录」 |
| `HeaderSummaryChip` | 日历摘要三列 pill |

## Segmented 统一

在 `.site-header-frosted` 下 scoped 覆盖 `--admin` 与 `--calendar` 变体：统一轨道与选中渐变 thumb，保留 admin 变体的五维状态灯 adornment 定位。非顶栏页面（管理员、画像等）不受影响。

## 验收

1. 打开 `header-widget-unity-preview.html` 对照改后效果
2. `npm test -- tests/unit/site-header-calendar.test.tsx tests/unit/site-header-analysis.test.tsx tests/unit/interview-shell.test.tsx`
3. 本地依次进入访谈 / 日历 / 分析，确认五维条、月/周/日、本周/本月 选中色一致，「今天」与「完整日志」按钮同套
