import { defineConfig, devices } from "@playwright/test";

const API_BASE = process.env.API_BASE ?? "http://localhost:3000";
const DASH_BASE = process.env.DASH_BASE ?? "http://localhost:3001";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../playwright-report", open: "never" }],
    ["junit", { outputFile: "../../playwright-report/junit.xml" }],
  ],
  use: {
    baseURL: DASH_BASE,
    extraHTTPHeaders: { accept: "application/json" },
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "api",
      testMatch: /.*\.(api)\.spec\.ts/,
      use: { baseURL: API_BASE },
    },
    {
      name: "ui-chromium",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.(api)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: DASH_BASE },
    },
  ],
  ...(process.env.NO_WEB_SERVER
    ? {}
    : {
  webServer: [
        {
          command: "pnpm run dev",
          cwd: "../..",
          port: 3000,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: "pnpm run dashboards:dev",
          cwd: "../..",
          port: 3001,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
      ],
      }),
});
