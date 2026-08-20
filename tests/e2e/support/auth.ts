import { expect, type Page } from "@playwright/test";

import type { E2ETestAccount } from "./accounts";

export async function registerAccount(page: Page, account: E2ETestAccount) {
  const response = await page.context().request.post("/api/auth/register", {
    data: {
      username: account.username,
      password: account.password,
      acceptedTerms: true,
      acceptedPrivacy: true
    }
  });
  expect(response.status(), await response.text()).toBe(200);
  return account;
}

export async function registerThenLoginThroughUI(page: Page, account: E2ETestAccount) {
  await registerAccount(page, account);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("用户名").fill(account.username);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: "登录并继续" }).click();
  await expect(page).toHaveURL(/\/interview(?:\?|$)/u);
}
