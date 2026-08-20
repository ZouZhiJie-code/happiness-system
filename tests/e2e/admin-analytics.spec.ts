import { expect, test } from "@playwright/test";

import { E2E_ACCOUNTS } from "./support/accounts";
import { registerAccount } from "./support/auth";
import { shanghaiEntryDate } from "./support/date";
import { getE2EDatabase } from "./support/database";
import { createCompletedCapture } from "./support/event-centered";

test("管理后台保持服务端匿名保护", async ({ page }) => {
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/login\?next=/u);
  const response = await page.context().request.get("/api/admin/analytics/funnel");
  expect(response.status()).toBe(401);
});

test("分析合同 v2 与受控事件中心主链逐步一致", async ({ page }) => {
  const entryDate = shanghaiEntryDate();
  const analyticsDate = "2026-08-01";
  await registerAccount(page, E2E_ACCOUNTS.admin);

  // The page render is the first funnel step. The remaining writes use the
  // public product contracts so this case validates the same path users take.
  await page.goto(`/interview?mode=event-centered&entryDate=${entryDate}`);
  await expect(page.getByTestId("event-centered-start-workspace")).toBeVisible();
  await createCompletedCapture(page, {
    entryDate,
    operationId: "analytics-start",
    turnId: "analytics-turn",
    exitId: "analytics-exit",
    rawText: "今天完成了受控回归，并把结果保存到当天。"
  });

  await page.goto(`/calendar?view=day&date=${entryDate}`);
  await page.getByRole("button", { name: "生成日记" }).click();
  await page.getByRole("button", { name: "继续编辑" }).click();
  await page.getByRole("button", { name: "保存日记" }).click();
  await expect(page.getByRole("button", { name: "编辑日记" })).toBeVisible();

  // Keep this aggregate assertion deterministic while the other independent
  // browser scenarios run in parallel. Only this account's evidence is moved
  // into a controlled historical day inside the disposable schema.
  const database = getE2EDatabase();
  const user = await database.user.findUniqueOrThrow({
    where: { username: E2E_ACCOUNTS.admin.username }
  });
  const at = (minute: number) => new Date(`2026-08-01T04:${String(minute).padStart(2, "0")}:00.000Z`);
  await database.$transaction([
    database.analyticsEvent.updateMany({
      where: { userId: user.id, eventName: "event_centered_entry_opened" },
      data: { occurredAt: at(0) }
    }),
    database.analyticsEvent.updateMany({
      where: { userId: user.id, eventName: "event_centered_first_content_submitted" },
      data: { occurredAt: at(1) }
    }),
    database.analyticsEvent.updateMany({
      where: { userId: user.id, eventName: "event_centered_response_completed" },
      data: { occurredAt: at(2) }
    }),
    database.journalEventEntry.updateMany({
      where: { event: { userId: user.id }, savedRevision: { not: null } },
      data: { savedAt: at(3) }
    }),
    database.journalDailyEntryGeneration.updateMany({
      where: { userId: user.id, kind: "generate", status: "completed" },
      data: { completedAt: at(4) }
    }),
    database.journalDailyEntry.updateMany({
      where: { userId: user.id },
      data: { createdAt: at(4), savedAt: at(5) }
    })
  ]);

  const response = await page.context().request.get(
    `/api/admin/analytics/funnel?startDate=${analyticsDate}&endDate=${analyticsDate}`
  );
  expect(response.status(), await response.text()).toBe(200);
  const payload = await response.json() as {
    contractVersion: number;
    currentProductFunnel: Array<{ key: string; count: number }>;
    legacyFunnel: unknown;
  };
  expect(payload.contractVersion).toBe(2);
  expect(payload.currentProductFunnel).toEqual([
    { key: "openedDay", count: 1 },
    { key: "firstContentSubmitted", count: 1 },
    { key: "completeResponseReceived", count: 1 },
    { key: "eventCardSaved", count: 1 },
    { key: "dailyJournalGenerated", count: 1 },
    { key: "dailyJournalSaved", count: 1 }
  ]);
  expect(payload.legacyFunnel).toBeDefined();
});
