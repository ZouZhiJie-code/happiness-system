// GI-062 复用同一套脚本化 Preview 轨迹，只切换候选血缘与独立审计窗口。
// Preview 仍使用隔离数据库，Production 配置不参与本命令。
process.env.BOARD8_PREVIEW_CANDIDATE = "gi062";
await import("./run-board8-gi058-deepseek-preview");

export {};
