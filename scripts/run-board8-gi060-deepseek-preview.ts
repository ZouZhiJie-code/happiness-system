// GI-060 复用已验证的 Board8 执行器，只切换候选血缘与一次独立审计窗口。
// Preview 仍使用隔离数据库，Production 配置不参与本命令。
process.env.BOARD8_PREVIEW_CANDIDATE = "gi060";
await import("./run-board8-gi058-deepseek-preview");

export {};
