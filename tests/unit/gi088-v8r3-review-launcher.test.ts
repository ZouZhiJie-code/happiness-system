import { readFileSync } from "node:fs";

import { createGi088V8r3GoldenBItems } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/review-golden-b";

describe("GI-088 v8r3 本机裁决启动器", () => {
  it("只监听本机并暴露冻结的三个本地接口", () => {
    const source = readFileSync(
      "scripts/run-gi088-v8r3-review-workbench.ts",
      "utf8"
    );
    expect(source).toContain('const HOST = "127.0.0.1"');
    expect(source).toContain("/api/local/gi088-v8r3/review-session");
    expect(source).toContain("/api/local/gi088-v8r3/review-draft");
    expect(source).toContain("/api/local/gi088-v8r3/review-finalize");
    expect(source).toContain("GI088_REVIEW_LOCAL_ENVIRONMENT_REQUIRED");
    expect(source).not.toMatch(/PrismaClient|getAIProvider|fetch\(\s*["']https?:/u);
  });

  it("提供无需选择文件的一键启动命令", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(packageJson.scripts["eval:gi088:v8r3:review"]).toBe(
      "vite-node -c vitest.config.ts scripts/run-gi088-v8r3-review-workbench.ts"
    );
  });

  it("Golden B 固定为 20 条全新非隐藏材料且内容互不重复", () => {
    const items = createGi088V8r3GoldenBItems();
    expect(items).toHaveLength(20);
    expect(new Set(items.map((item) => item.sampleId)).size).toBe(20);
    expect(new Set(items.map((item) => item.contentFingerprint)).size).toBe(20);
    expect(items.every((item) => item.sourcePartition === "golden_calibration")).toBe(true);
  });

  it("客户端包含恢复、快捷键、底部裁决面板与单一权威保存状态", () => {
    const source = readFileSync(
      "public/gi088-review-workbench-client.js",
      "utf8"
    );
    expect(source).toContain("localStorage.setItem(storageKey()");
    expect(source).toContain('event.key === "ArrowLeft"');
    expect(source).toContain("openReviewPanel");
    expect(source).toContain("正在保存");
  });
});
