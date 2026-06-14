#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { createAcceptanceClient } from "./launch-acceptance-runner.mjs";

const BASE_URL = process.env.ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3000";
const SCREENSHOT_DIR = process.env.BROWSER_FLOW_SCREENSHOTS ?? "/tmp/happiness-browser-flow";
const ENTRY_DATE =
  process.env.BROWSER_FLOW_ENTRY_DATE ??
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());

function logStep(steps, step, ok, detail = {}) {
  const entry = { step, ok, ...detail };
  steps.push(entry);
  process.stdout.write(`${ok ? "✓" : "✗"} ${step}${detail.error ? `: ${detail.error}` : ""}\n`);
  return entry;
}

async function waitForTurnSettled(page) {
  await page.waitForFunction(
    () => {
      const body = document.body.textContent ?? "";
      const thinking = body.includes("正在思考中...");
      const composerVisible = Boolean(
        document.querySelector('[data-testid="interview-floating-composer"] button[aria-label="发送回答"]')
      );
      const journalVisible = Boolean(document.querySelector('[data-testid="journal-editor-card"]'));
      const generateVisible = Array.from(document.querySelectorAll("button")).some((button) =>
        /^生成.+维度日志$/.test(button.textContent?.trim() ?? "")
      );
      const draftFailedVisible = body.includes("这次没能成功生成日志");

      return !thinking && (composerVisible || journalVisible || generateVisible || draftFailedVisible);
    },
    null,
    { timeout: 120_000 }
  );
}

async function ensureJournalEditor(page) {
  const editor = page.getByTestId("journal-editor-card");
  if (await editor.isVisible().catch(() => false)) {
    return editor;
  }

  const draftFailure = page.getByText("这次没能成功生成日志");
  if (await draftFailure.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "重试生成" }).click();
    await editor.waitFor({ timeout: 120_000 });
    return editor;
  }

  const generateButton = page.getByRole("button", { name: /^生成.+维度日志$/ });
  if (await generateButton.isVisible().catch(() => false)) {
    await generateButton.click();
    await editor.waitFor({ timeout: 120_000 });
    return editor;
  }

  const composer = page.getByRole("textbox");
  if (await composer.isVisible().catch(() => false)) {
    await composer.fill("帮我整理成日志");
    await page.getByRole("button", { name: "发送回答" }).click();
    await waitForTurnSettled(page);
  }

  if (await draftFailure.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "重试生成" }).click();
  }

  await editor.waitFor({ timeout: 120_000 });
  return editor;
}

async function screenshot(page, name) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

export async function runBrowserFullFlow({ baseUrl = BASE_URL } = {}) {
  const steps = [];
  const client = createAcceptanceClient({ baseUrl });
  const account = await client.registerAccount("browserflow");

  const browser = await chromium.launch({
    headless: process.env.BROWSER_FLOW_HEADED !== "1"
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);

  try {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("用户名").fill(account.username);
    await page.getByLabel("密码").fill(account.password);
    await page.getByRole("button", { name: "登录并继续" }).click();
    await page.waitForURL(/\/interview/);
    await page.goto(`${baseUrl}/interview?dimension=joy&entryDate=${ENTRY_DATE}`);
    await page.getByTestId("interview-entry-date-label").getByText(ENTRY_DATE).waitFor();
    logStep(steps, "browser_login", true, { username: account.username, entryDate: ENTRY_DATE });
    await screenshot(page, "01-interview-after-login");

    const composer = page.getByRole("textbox");
    await composer.waitFor();

    await composer.fill("今天和家人一起吃饭聊天，因为我最近很少这么放松。");
    await page.getByRole("button", { name: "发送回答" }).click();
    await waitForTurnSettled(page);
    logStep(steps, "browser_first_reply", true);
    await screenshot(page, "02-after-first-reply");

    await composer.fill("那一刻我整个人都松下来了，心里很踏实，想一直这样待着。");
    await page.getByRole("button", { name: "发送回答" }).click();
    await waitForTurnSettled(page);
    logStep(steps, "browser_second_reply", true);
    await screenshot(page, "03-after-second-reply");

    await ensureJournalEditor(page);
    logStep(steps, "browser_generate_journal", true);
    await screenshot(page, "05-journal-editor");

    await page.getByRole("button", { name: "关闭日志面板" }).click();
    await page.getByTestId("today-journal-panel").waitFor();
    logStep(steps, "browser_today_panel", true);
    await screenshot(page, "05b-today-panel");

    // Reopen the dimension journal from the persistent today panel (the bookmark is gone).
    await page.getByTestId("today-journal-block-joy-toggle").click();
    await page.getByTestId("today-journal-open-joy").click();
    await page.getByTestId("journal-editor-card").waitFor();

    await page.getByRole("button", { name: "保存正式日志" }).click();
    const saveDialog = page.getByRole("dialog", { name: "确定保存这篇日志吗？" });
    await saveDialog.waitFor();
    await saveDialog.getByRole("button", { name: "确定保存" }).click();
    // After saving, the journal sheet closes and the conversation stays open: the composer
    // remains available and the journal stays reachable in the today panel.
    await page.getByTestId("today-journal-panel").waitFor({ timeout: 30_000 });
    await page.getByTestId("interview-floating-composer").waitFor({ timeout: 30_000 });
    logStep(steps, "browser_save_journal", true);
    await screenshot(page, "06-interview-after-save");

    // Keep talking directly in the composer; sending silently reopens the saved session.
    const reopenedComposer = page.getByRole("textbox");
    await reopenedComposer.fill("我还想再补充一句。");
    await page.getByRole("button", { name: "发送回答" }).click();
    await waitForTurnSettled(page);

    const reopenIssue = page.getByText("没能回到访谈");
    if (await reopenIssue.isVisible().catch(() => false)) {
      throw new Error("SESSION_NOT_REOPENABLE surfaced in UI");
    }

    logStep(steps, "browser_reopen_interview", true);

    await screenshot(page, "07-reopen-result");

    // The complete journal is generated and saved from the today panel day-action button,
    // which then lands on the full daily-journal page (no header button, no in-page harvest button).
    const dayAction = page.getByTestId("today-journal-day-action");
    await dayAction.waitFor();
    await page
      .waitForFunction(
        () => {
          const button = document.querySelector('[data-testid="today-journal-day-action"]');
          return Boolean(button && !button.disabled);
        },
        null,
        { timeout: 30_000 }
      )
      .catch(() => {
        throw new Error("今日日志日级按钮不可用");
      });

    await dayAction.click();
    await page.getByTestId("daily-journal-workspace").waitFor({ timeout: 120_000 });
    await page.getByTestId("daily-journal-editor").waitFor({ timeout: 120_000 });
    await page.getByText(`${Number(ENTRY_DATE.slice(5, 7))}月${Number(ENTRY_DATE.slice(8, 10))}日`).waitFor();
    logStep(steps, "browser_generate_daily_journal", true);
    await screenshot(page, "08-daily-journal");

    return {
      ok: steps.every((step) => step.ok),
      baseUrl,
      account: { username: account.username },
      entryDate: ENTRY_DATE,
      steps,
      screenshots: SCREENSHOT_DIR
    };
  } catch (error) {
    logStep(steps, "browser_flow_failed", false, {
      error: error instanceof Error ? error.message : String(error)
    });
    await screenshot(page, "error").catch(() => {});

    return {
      ok: false,
      baseUrl,
      account: { username: account.username },
      steps,
      screenshots: SCREENSHOT_DIR,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const summary = await runBrowserFullFlow();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
}
