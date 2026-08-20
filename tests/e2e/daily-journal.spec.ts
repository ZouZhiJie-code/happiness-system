import { expect, test } from "@playwright/test";

import { E2E_ACCOUNTS } from "./support/accounts";
import { registerAccount } from "./support/auth";
import { shanghaiEntryDate } from "./support/date";
import { getE2EDatabase } from "./support/database";
import { createCompletedCapture } from "./support/event-centered";

test("生成、编辑、保存、需更新并保留用户手工修改", async ({ page }) => {
  const entryDate = shanghaiEntryDate();
  const original = "傍晚和朋友散步半小时，我们聊了最近各自担心的事，我觉得轻松了一些。";
  const manualMarker = "【这句是我手工保留的感受】";
  const revisedMarker = "【片段补充：回家后仍然觉得安定】";
  await registerAccount(page, E2E_ACCOUNTS.journal);
  await createCompletedCapture(page, {
    entryDate,
    operationId: "journal-start",
    turnId: "journal-turn",
    exitId: "journal-exit",
    rawText: original
  });

  await page.goto(`/calendar?view=day&date=${entryDate}`);
  const workspace = page.getByTestId("journal-day-workspace");
  await expect(workspace).toBeVisible();
  await expect(workspace).toContainText(original.slice(0, 12));

  await page.getByRole("button", { name: "生成日记" }).click();
  await expect(page.getByRole("button", { name: "继续编辑" })).toBeVisible();
  await page.getByRole("button", { name: "继续编辑" }).click();
  const dailyTitle = page.getByLabel("日记标题");
  const dailyContent = page.getByRole("textbox", { name: "日记正文", exact: true });
  await dailyTitle.fill("今天的一点松弛");
  await dailyContent.fill(`${await dailyContent.inputValue()}\n\n${manualMarker}`);
  await page.getByRole("button", { name: "保存日记" }).click();
  await expect(page.getByRole("button", { name: "编辑日记" })).toBeVisible();
  await expect(workspace).toContainText(manualMarker);

  await page.getByRole("button", { name: "编辑内容" }).click();
  const recordContent = page
    .getByRole("button", { name: "完成编辑" })
    .locator("xpath=ancestor::article[1]")
    .locator("textarea");
  await recordContent.fill(`${await recordContent.inputValue()}\n\n${revisedMarker}`);
  await page.getByRole("button", { name: "完成编辑" }).click();
  await expect(page.getByRole("button", { name: "更新日记" })).toBeVisible();
  await expect(workspace).toContainText("需更新");

  await page.getByRole("button", { name: "更新日记" }).click();
  await expect(workspace).toContainText(manualMarker);
  await page.reload();
  await expect(workspace).toContainText(manualMarker);
  await expect(workspace).toContainText(revisedMarker);

  const database = getE2EDatabase();
  const user = await database.user.findUniqueOrThrow({ where: { username: E2E_ACCOUNTS.journal.username } });
  const daily = await database.journalDailyEntry.findFirstOrThrow({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" }
  });
  expect(daily.content).toContain(manualMarker);
});

test("跨天读取保持隔离并在刷新后恢复当前状态", async ({ page }) => {
  await registerAccount(page, E2E_ACCOUNTS.boundary);
  const today = shanghaiEntryDate();
  const previousDate = new Date(`${today}T04:00:00+08:00`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const yesterday = shanghaiEntryDate(previousDate);
  await createCompletedCapture(page, {
    entryDate: today,
    operationId: "boundary-start",
    turnId: "boundary-turn",
    exitId: "boundary-exit",
    rawText: "这条内容只属于上海日期的今天。"
  });

  const todayResponse = await page.context().request.get(`/api/journal/day?entryDate=${today}`);
  const yesterdayResponse = await page.context().request.get(`/api/journal/day?entryDate=${yesterday}`);
  expect(todayResponse.status()).toBe(200);
  expect(yesterdayResponse.status()).toBe(200);
  const todayView = await todayResponse.json() as { savedSources: unknown[] };
  const yesterdayView = await yesterdayResponse.json() as { savedSources: unknown[] };
  expect(todayView.savedSources).toHaveLength(1);
  expect(yesterdayView.savedSources).toHaveLength(0);

  await page.goto(`/calendar?view=day&date=${today}`);
  await expect(page.getByTestId("journal-day-workspace")).toContainText("这条内容只属于");
  await page.reload();
  await expect(page.getByTestId("journal-day-workspace")).toContainText("这条内容只属于");
});
