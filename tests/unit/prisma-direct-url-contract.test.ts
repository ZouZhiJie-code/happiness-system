import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("prisma direct URL contract", () => {
  it("declares DIRECT_URL for migration-safe direct connections", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain('directUrl = env("DIRECT_URL")');
  });
});
