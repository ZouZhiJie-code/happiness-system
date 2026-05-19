import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("prisma persistence indexes", () => {
  it("declares date-range indexes for session and entry queries", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("@@index([userId, entryDate])");
    expect(schema).toContain("@@index([userId, date])");
    expect(schema).toContain("@@index([userId, status, date])");
  });
});
