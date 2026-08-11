import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("GI-088 v8r3 Golden 修订启动器", () => {
  it("只监听本机，并固定零数据库、零模型、零上传", async () => {
    const source = await readFile(
      resolve(process.cwd(), "scripts/run-gi088-v8r3-golden-revision.ts"),
      "utf8"
    );
    expect(source).toContain('const HOST = "127.0.0.1"');
    expect(source).toContain("GI088_GOLDEN_REVISION_LOCAL_ENVIRONMENT_REQUIRED");
    expect(source).toContain("databaseCalls: 0");
    expect(source).toContain("externalModelCalls: 0");
    expect(source).toContain("uploads: 0");
    expect(source).not.toContain("https://");
    expect(source).not.toContain("PrismaClient");
  });

  it("页面只呈现 8 条替换和沿用 32 条，不再展示候选 80 条", async () => {
    const [launcher, client] = await Promise.all([
      readFile(
        resolve(process.cwd(), "scripts/run-gi088-v8r3-golden-revision.ts"),
        "utf8"
      ),
      readFile(
        resolve(process.cwd(), "public/gi088-golden-revision-client.js"),
        "utf8"
      )
    ]);
    expect(launcher).toContain("Golden 8 条替换裁决");
    expect(launcher).toContain("原 32 条原样沿用");
    expect(client).toContain("沿用 32/32");
    expect(client).toContain("替换 8/8");
    expect(client).not.toContain("候选质量 0/80");
  });
});
