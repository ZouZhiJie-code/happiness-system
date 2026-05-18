import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("prisma drift contract", () => {
  it("captures JoyEntry.eventBlocks in a formal migration and keeps daily journal array defaults aligned", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260518123000_add_joy_entry_event_blocks/migration.sql"
      ),
      "utf8"
    );

    expect(schema).toContain("eventBlocks     Json?");
    expect(schema).toContain("sourceEntryIds   String[]           @default([])");
    expect(schema).toContain("sourceSessionIds String[]           @default([])");

    expect(migration).toContain('ALTER TABLE "JoyEntry"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "eventBlocks" JSONB;');
  });
});
