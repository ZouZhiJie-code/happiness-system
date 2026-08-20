import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.DAILY_LIGHT_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const browserChannel = process.env.DAILY_LIGHT_E2E_BROWSER_CHANNEL?.trim() || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    channel: browserChannel,
    baseURL,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off"
  },
  projects: [
    {
      name: "chromium-1440",
      use: { viewport: { width: 1440, height: 900 } }
    },
    {
      name: "chromium-1024-smoke",
      testMatch: /viewport-smoke\.spec\.ts/u,
      use: { viewport: { width: 1024, height: 768 } }
    }
  ]
});
