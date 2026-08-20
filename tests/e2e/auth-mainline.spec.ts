import { expect, test } from "@playwright/test";

import { E2E_ACCOUNTS } from "./support/accounts";
import { registerAccount, registerThenLoginThroughUI } from "./support/auth";
import { entryDateLabelPattern, shanghaiEntryDate } from "./support/date";
import { getE2EDatabase } from "./support/database";

test("登录、匿名保护和上海日期归属", async ({ page }) => {
  const entryDate = shanghaiEntryDate();
  await page.goto(`/interview?mode=event-centered&entryDate=${entryDate}`);
  await expect(page).toHaveURL(/\/login\?next=/u);

  const anonymousApi = await page.context().request.get(
    `/api/journal/day?entryDate=${entryDate}`
  );
  expect(anonymousApi.status()).toBe(401);

  await registerThenLoginThroughUI(page, E2E_ACCOUNTS.auth);
  await page.goto(`/interview?mode=event-centered&entryDate=${entryDate}`);
  await expect(page.getByTestId("event-centered-start-workspace")).toBeVisible();
  await expect(page.getByText(entryDateLabelPattern(entryDate)).first()).toBeVisible();

  await page.context().clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/\/login\?next=/u);
});

test("帮我记保存原话并形成单张事件卡", async ({ page }) => {
  const entryDate = shanghaiEntryDate();
  const original = "下班路上看到晚霞，我停下来拍了一张照片，心里一下安静了。";
  await registerAccount(page, E2E_ACCOUNTS.capture);
  await page.goto(`/interview?mode=event-centered&entryDate=${entryDate}`);
  await page.getByRole("button", { name: "帮我记" }).click();
  const composer = page.locator("#event-centered-dialogue-input");
  await expect(composer).toBeEnabled();
  await composer.fill(original);
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByTestId("event-centered-record-save-context")).toContainText("原话已保存");
  await expect(page.getByTestId("event-centered-message-track")).toContainText(original);

  await page.getByRole("button", { name: "完成记录" }).click();
  await expect(page.getByTestId("event-centered-completion-inline")).toBeVisible();
  await page.getByRole("link", { name: /查看.*日记/u }).click();
  await expect(page).toHaveURL(new RegExp(`/calendar\\?view=day&date=${entryDate}`, "u"));
  await expect(page.getByTestId("journal-day-workspace")).toContainText(original.slice(0, 12));

  const database = getE2EDatabase();
  const user = await database.user.findUniqueOrThrow({ where: { username: E2E_ACCOUNTS.capture.username } });
  const cards = await database.journalEventEntry.count({
    where: { event: { userId: user.id }, status: "saved" }
  });
  expect(cards).toBe(1);
});

test("陪我聊返回完整回应并可回到当天", async ({ page }) => {
  const entryDate = shanghaiEntryDate();
  const original = "今天评审时我很紧张，但把方案讲完后也有一点踏实。";
  await registerAccount(page, E2E_ACCOUNTS.chat);
  await page.goto(`/interview?mode=event-centered&entryDate=${entryDate}`);
  await page.getByRole("button", { name: "陪我聊" }).click();
  const track = page.getByTestId("event-centered-message-track");
  const assistantBefore = await track.locator('[data-message-role="assistant"]').count();
  await page.locator("#event-centered-dialogue-input").fill(original);
  await page.getByRole("button", { name: "发送" }).click();
  await expect(track).toContainText(original);
  await expect(page.locator("#event-centered-dialogue-input")).toBeEnabled();
  await expect.poll(async () => track.locator('[data-message-role="assistant"]').count())
    .toBeGreaterThan(assistantBefore);

  await page.getByRole("link", { name: "日记", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/calendar\\?view=day&date=${entryDate}`, "u"));
});
