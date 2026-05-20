import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// Demo config — produces narrative video walkthroughs for documentation.
// Runs single-worker with slowMo so the recorded videos are watchable at
// 1× speed. Companion QA config (if/when added) inverts these — fast,
// parallel, video on failure only.
//
// See CLAUDE.md "Gherkin E2E + Demo Video Recording" for the full rationale
// behind each setting (the 0-byte first-video bug, slowMo nuance, reporter
// race conditions).

const testDir = defineBddConfig({
  features: "e2e/demo/features/**/*.feature",
  steps: [
    "e2e/steps/**/*.ts",
    "e2e/demo/hooks.ts",
  ],
});

export default defineConfig({
  testDir,
  // Demos are long; the boot sequence alone is ~3-5 s and each scenario
  // can run 20-60 s once slowMo is applied.
  timeout: 180_000,
  // Single-worker recordings only. Parallel breaks video subsystem.
  fullyParallel: false,
  workers: 1,
  // Re-runs would overwrite the prior video. If a scenario fails, fix it
  // and re-run rather than letting Playwright retry over its own recording.
  retries: 0,
  reporter: [
    ["list"],
    ["./e2e/demo/reporter.ts"],
  ],
  use: {
    baseURL: process.env.DEMO_BASE_URL ?? "http://localhost:5173",
    headless: true,
    viewport: { width: 1920, height: 1080 },
    video: {
      mode: "on",
      size: { width: 1920, height: 1080 },
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      // 800-1500 ms is the readable range. 1000 is the value tuned for
      // this scene — anything faster makes the rack-label dispatchEvent
      // step race ahead of React's commit and the panel never appears.
      slowMo: Number(process.env.DEMO_SLOWMO ?? 1000),
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The device preset overrides the top-level viewport silently;
        // re-pin it here so the recorded video matches what we set above.
        viewport: { width: 1920, height: 1080 },
        video: {
          mode: "on",
          size: { width: 1920, height: 1080 },
        },
      },
    },
  ],
  // Auto-start the dev server if it isn't already up. baseURL above
  // points to localhost:5173 which is Vite's default.
  webServer: process.env.DEMO_NO_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
