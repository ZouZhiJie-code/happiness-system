import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Vercel Prisma build contract", () => {
  it("regenerates both Prisma clients immediately before the Next.js build", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")
    ) as {
      framework?: string;
      buildCommand?: string;
    };

    expect(config.framework).toBe("nextjs");
    expect(config.buildCommand?.split("&&").map((command) => command.trim())).toEqual([
      "pnpm exec prisma generate",
      "pnpm exec prisma generate --schema prisma/evaluation/schema.prisma",
      "pnpm run build"
    ]);
  });
});
