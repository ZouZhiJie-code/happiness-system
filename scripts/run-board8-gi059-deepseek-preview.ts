// GI-059 复用已验证的 Board8 执行器，只切换候选、隔离库守卫、
// 目标响应脚本和证据口径。导入后由执行器完成一次 8+2。
process.env.BOARD8_PREVIEW_CANDIDATE = "gi059";
await import("./run-board8-gi058-deepseek-preview");

export {};
