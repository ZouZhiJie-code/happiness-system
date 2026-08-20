# Daily Light 全站重构视觉验收

本目录对应 `2026-08-13` 的零写入视觉候选。所有页面均使用本地固定数据；不会写入真实数据库，也不会发起模型调用。

## 确认一：设计基础

- `01-foundation-1440x900.png`
- `02-foundation-1024x768.png`

## 确认二：核心流程

- `04-interview-start-1024x768.png`
- `05-interview-pending-1024x768.png`
- `06-interview-limit-toast-1024x768.png`
- `07-interview-chat-1440x900.png`
- `08-interview-chat-1024x768.png`
- `09-day-1440x900.png`
- `10-week-1440x900.png`
- `11-month-1024x768.png`
- `18-day-200-percent-reflow.png`

## 确认三：其余用户页面

- `12-home-1440x900.png`
- `13-home-1024x768.png`
- `14-insights-trends-1440x900.png`
- `15-insights-portrait-1024x768.png`
- `16-auth-1024x768.png`
- `17-settings-1440x900.png`

## 本地验收入口

```text
http://127.0.0.1:3000/preview/daily-light-visual-review?screen=foundation&clean=1
```

页面右下角验收工具栏可切换全部状态；`clean=1` 用于隐藏工具栏并保存纯页面截图。

已实测：记录方式选择、两条未完成限制、双气泡与反馈、重新生成菜单、完成记录、日／周／月切换、两类侧栏拖拽和阈值收起、账户菜单与弹窗焦点恢复、1024×768 重排以及 200% 等效重排。

Production 继续保持 `legacy + baseline`。
