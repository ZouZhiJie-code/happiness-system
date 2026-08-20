import { expect, test } from "@playwright/test";

import { E2E_ACCOUNTS } from "./support/accounts";
import { registerAccount } from "./support/auth";
import { shanghaiEntryDate } from "./support/date";

test("事件中心主链在验收尺寸内可见、可输入且无横向溢出", async ({ page }, testInfo) => {
  const account = testInfo.project.name === "chromium-1024-smoke"
    ? E2E_ACCOUNTS.viewport1024
    : E2E_ACCOUNTS.viewport1440;
  await registerAccount(page, account);
  const entryDate = shanghaiEntryDate();
  await page.goto(`/interview?mode=event-centered&entryDate=${entryDate}`);
  await expect(page.getByTestId("event-centered-start-workspace")).toBeVisible();
  await page.getByRole("button", { name: "帮我记" }).click();
  const composer = page.locator("#event-centered-dialogue-input");
  await expect(composer).toBeVisible();
  await composer.fill("验收尺寸下，这段输入和回应都需要完整可见。\n第二行也要保留。" );
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByTestId("event-centered-message-track")).toContainText("验收尺寸下");
  await expect(composer).toBeEnabled();

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
});
