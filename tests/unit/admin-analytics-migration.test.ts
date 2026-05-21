import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("admin analytics migration", () => {
  it("adds analytics_event and admin_audit_log tables in a formal migration", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "prisma/migrations/20260521120000_add_admin_analytics_tables/migration.sql"),
      "utf8"
    );

    expect(sql).toContain('CREATE TABLE "AnalyticsEvent"');
    expect(sql).toContain('CREATE TABLE "AdminAuditLog"');
    expect(sql).toContain('CREATE UNIQUE INDEX "AnalyticsEvent_dedupeKey_key"');
    expect(sql).toContain('CREATE INDEX "AnalyticsEvent_eventName_occurredAt_idx"');
    expect(sql).toContain('CREATE INDEX "AdminAuditLog_adminUsername_createdAt_idx"');
  });
});
