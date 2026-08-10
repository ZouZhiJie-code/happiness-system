// GI-066 复用 Board8 已验证的隔离数据库、日志闭环和旧五维冒烟执行器，
// 由候选标识切换为 thought_only 的判断地图 8+2 轨迹。
process.env.BOARD8_PREVIEW_CANDIDATE = "gi066";
await import("./run-board8-gi058-deepseek-preview");

export {};
