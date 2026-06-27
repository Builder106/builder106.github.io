// Custom demo recorder for TradeTell.
//
// Streamlit apps go to sleep on idle, and the standard scroll-capture
// script would record the "Zzzz" sleep screen. This script:
//   1. Wakes the app without recording (phase 1)
//   2. Opens a fresh recording context, navigates, and interacts with
//      the chat UI — clicking a pre-built suggestion and capturing the
//      RAG response streaming in (phase 2)
//   3. Trims + encodes to VP9 WebM with ffmpeg
//
// Usage: node scripts/record-demos/record-tradetell.mjs

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "img", "projects", "demos");

const APP_URL = "https://tradetell.streamlit.app";
// The Streamlit content lives in an iframe at this sub-path.
const FRAME_URL_PATTERN = /\/~\/\+\//;
const CHAT_PLACEHOLDER = "Ask a question, or request a trading algorithm…";
// One of the pre-built suggestion chips visible in the UI.
const SUGGESTION = "What products and position limits are introduced in Round 1?";

const VIDEO_W = 1440;
const VIDEO_H = 900;
const VIDEO_FPS = 24;
const VIDEO_BITRATE = "300k";

// Returns the app iframe Frame once the chat textarea is visible inside it.
async function waitForChatReady(page, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const appFrame = page.frames().find((f) => FRAME_URL_PATTERN.test(f.url()));
    if (appFrame) {
      try {
        const ta = appFrame.locator(`textarea[placeholder="${CHAT_PLACEHOLDER}"]`);
        await ta.waitFor({ state: "visible", timeout: 4_000 });
        return appFrame;
      } catch {
        // not ready yet — fall through to sleep
      }
    }
    await page.waitForTimeout(3_000);
  }
  throw new Error("chat input never became visible within the timeout");
}

// Phase 1 — wake without recording so the startup spinner is not in
// the final video.
async function wakeApp() {
  console.log("[tradetell] phase 1 — waking app (no recording)");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: VIDEO_W, height: VIDEO_H } });
  const page = await ctx.newPage();

  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2_000);

  const wakeBtn = page.locator('[data-testid="wakeup-button-viewer"]');
  if (await wakeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await wakeBtn.click();
    console.log("[tradetell] clicked wake button");
  }

  await waitForChatReady(page);
  console.log("[tradetell] app is awake and ready");

  await ctx.close();
  await browser.close();
}

// Phase 2 — record the actual chat interaction.
async function recordDemo() {
  const workdir = mkdtempSync(path.join(tmpdir(), "demo-tradetell-"));
  console.log(`[tradetell] phase 2 — recording to ${workdir}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    recordVideo: { dir: workdir, size: { width: VIDEO_W, height: VIDEO_H } },
  });
  const page = await ctx.newPage();

  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2_000);

  // Guard: click wake again if the app fell back asleep between phases.
  const wakeBtn = page.locator('[data-testid="wakeup-button-viewer"]');
  if (await wakeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await wakeBtn.click();
  }

  const appFrame = await waitForChatReady(page);
  console.log("[tradetell] chat ready in recording context");

  // Hold on the loaded UI so the viewer can read the interface.
  await page.waitForTimeout(2_500);

  // Click the pre-built suggestion chip.
  const chip = appFrame.getByRole("button", { name: SUGGESTION, exact: true });
  await chip.click();
  console.log(`[tradetell] clicked suggestion: "${SUGGESTION}"`);

  // Wait for the assistant message to start appearing.
  await appFrame.waitForFunction(
    () => document.querySelectorAll('[data-testid="stChatMessage"]').length >= 2,
    { timeout: 60_000 },
  );
  console.log("[tradetell] response streaming...");

  // Poll until the response stops growing (streaming complete).
  let prevLen = 0;
  let stableRuns = 0;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2_000);
    const len = await appFrame.evaluate(() =>
      [...document.querySelectorAll('[data-testid="stChatMessage"]')]
        .map((m) => m.textContent?.length ?? 0)
        .reduce((a, b) => a + b, 0),
    );
    console.log(`[tradetell] response chars: ${len}`);
    if (len === prevLen && len > 0) {
      stableRuns++;
      if (stableRuns >= 2) { console.log("[tradetell] response stable"); break; }
    } else {
      stableRuns = 0;
    }
    prevLen = len;
  }

  // Hold the final state before closing.
  await page.waitForTimeout(3_000);

  await ctx.close();
  await browser.close();

  // Encode — two-pass VP9 to hit the bitrate target on this longer clip.
  const recorded = readdirSync(workdir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => path.join(workdir, f))
    .filter((f) => statSync(f).size > 0)[0];
  if (!recorded) throw new Error(`no .webm produced under ${workdir}`);

  const finalPath = path.join(OUT_DIR, "tradetell.webm");
  const passLogPrefix = path.join(workdir, "vp9pass");
  const common = [
    "-c:v", "libvpx-vp9", "-b:v", VIDEO_BITRATE,
    "-deadline", "good", "-cpu-used", "2", "-row-mt", "1",
    "-vf", `scale=${VIDEO_W}:${VIDEO_H}:flags=lanczos,fps=${VIDEO_FPS}`,
    "-an", "-passlogfile", passLogPrefix,
  ];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", recorded, ...common, "-pass", "1", "-f", "null", "/dev/null"], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", recorded, ...common, "-pass", "2", finalPath], { stdio: "inherit" });
  rmSync(workdir, { recursive: true, force: true });
  console.log(
    `[tradetell] wrote ${path.relative(REPO_ROOT, finalPath)} ` +
    `(${(statSync(finalPath).size / 1024).toFixed(1)} KB)`,
  );
}

await wakeApp();
await recordDemo();
console.log("done");
