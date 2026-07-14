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
  // Demos are long. The master tour adds a 22 s idle-wave wait on top
  // of ~30 s of click + dwell beats; with slowMo (~1 s/action) and
  // teardown headroom, body+teardown can brush 180 s and trip the
  // default timeout. 300 s keeps the budget comfortable.
  timeout: 300_000,
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
    // Record HEADED so the WebGL server-room scene renders on the GPU.
    // Headless Chromium software-renders WebGL (SwiftShader); once the scene
    // grew to the 12-rack / AI-ML-wing layout, software-GL + 1080p video
    // capture saturated the browser and each step took 30-70 s, blowing past
    // `timeout` (the recording "hung"). Headed (GPU) keeps steps at ~1-2 s.
    // Set DEMO_HEADLESS=1 to force headless (only viable on a GPU-backed host).
    headless: process.env.DEMO_HEADLESS === "1",
    // deviceScaleFactor:2 halves the on-screen window (960×540) while keeping
    // the canvas at 1920×1080 physical pixels — Three.js reads devicePixelRatio
    // and renders at 2×, so Playwright's physical-pixel video capture stays
    // full 1080p without an upscaling step.
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
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
      // --use-angle=metal: tell ANGLE to use Apple's Metal backend even in
      // headless mode. Without this flag, headless Chrome falls back to
      // SwiftShader (pure-CPU software rasterizer) because it can't create
      // a native CAMetalLayer without a display window. ANGLE's Metal backend
      // CAN render into an IOSurface-backed offscreen surface, giving real GPU
      // acceleration in headless. 3–10× faster than SwiftShader for complex
      // Three.js scenes on Apple Silicon.
      // Start the window in the background so it doesn't steal focus from
      // whatever the user is working on. The recording still captures the
      // full GPU-rendered scene; the window just doesn't come to front.
      args: ["--start-maximized"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Re-pin viewport + deviceScaleFactor here — the device preset
        // overrides the top-level use block silently.
        viewport: { width: 960, height: 540 },
        deviceScaleFactor: 2,
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
