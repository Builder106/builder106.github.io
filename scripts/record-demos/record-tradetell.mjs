// Custom demo recorder for TradeTell.
//
// Two problems make the generic scroll-capture script unusable here:
//
//   1. Streamlit Community Cloud apps sleep on idle. The generic script
//      would record the "Zzzz, wake this app up?" screen.
//   2. The app is one price section driven by a probe slider, so a plain
//      page scroll never shows the order book changing.
//
// This script fixes both:
//   - Phase 1 wakes the app in a throwaway context (no recording), so the
//     startup spinner never reaches the video.
//   - Phase 2 records at 1440×720 — exactly the 2:1 aspect of the card's
//     hero box, so object-fit:contain doesn't letterbox. It holds on the
//     headline, scrolls to the section, sweeps the probe across all four
//     recorded days, then rests on the order book at the last tick.
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
const PROBE = '[role="slider"]';
const ORDER_BOOK = '[aria-label="Order book at the probe"]';

// 1440×720 = 2:1, the exact aspect of the ProjectCard hero box (it renders
// ~720×360 CSS px). Matching it means object-fit:contain shows the whole
// frame with no wasted letterbox. 1440 wide is 2× the card's 720 CSS width,
// so it stays sharp on retina.
const VIDEO_W = 1440;
const VIDEO_H = 720;
const VIDEO_FPS = 24;
const VIDEO_BITRATE = "320k";

// Returns the app iframe Frame once the probe slider is visible inside it.
async function waitForSectionReady(page, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const appFrame = page.frames().find((f) => FRAME_URL_PATTERN.test(f.url()));
    if (appFrame) {
      try {
        await appFrame.locator(PROBE).waitFor({ state: "visible", timeout: 4_000 });
        return appFrame;
      } catch {
        // not ready yet — fall through to sleep
      }
    }
    await page.waitForTimeout(3_000);
  }
  throw new Error("probe slider never became visible within the timeout");
}

// Scroll the app document so `top` (document px) sits at the top of the
// viewport, easing over `durationMs` so the move reads in the video.
async function glideTo(appFrame, page, top, durationMs) {
  const steps = 30;
  const start = await appFrame.evaluate(() => window.scrollY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await appFrame.evaluate(
      (y) => window.scrollTo({ top: y, behavior: "instant" }),
      start + (top - start) * eased,
    );
    await page.waitForTimeout(durationMs / steps);
  }
}

// Document-space top of the first element matching `selector`.
async function topOf(appFrame, selector, margin = 24) {
  return appFrame.evaluate(
    ({ sel, margin }) => {
      const el = document.querySelector(sel);
      return el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - margin) : 0;
    },
    { sel: selector, margin },
  );
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

  await waitForSectionReady(page);
  console.log("[tradetell] app is awake and ready");

  await ctx.close();
  await browser.close();
}

// Phase 2 — record the section walkthrough.
async function recordDemo() {
  const workdir = mkdtempSync(path.join(tmpdir(), "demo-tradetell-"));
  console.log(`[tradetell] phase 2 — recording to ${workdir}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    recordVideo: { dir: workdir, size: { width: VIDEO_W, height: VIDEO_H } },
  });

  // Pin a dark background in every frame (outer shell + the Streamlit
  // iframe) before any script runs, so the recording never opens on the
  // white pre-theme flash.
  await ctx.addInitScript(() => {
    const apply = () => {
      const s = document.createElement("style");
      s.textContent = "html,body{background:#0e1117 !important;}";
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.head || document.documentElement) apply();
    else document.addEventListener("DOMContentLoaded", apply);
  });

  const page = await ctx.newPage();
  // Video recording begins roughly when the page is created. Timestamp it so
  // we can trim the variable iframe-reconnect lead-in to exactly the moment
  // content first paints (see leadSec below).
  const tStart = Date.now();

  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2_000);

  // Guard: click wake again if the app fell back asleep between phases.
  const wakeBtn = page.locator('[data-testid="wakeup-button-viewer"]');
  if (await wakeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await wakeBtn.click();
  }

  const appFrame = await waitForSectionReady(page);
  console.log("[tradetell] section ready in recording context");

  // The "Hosted with Streamlit" kite badge lives in the OUTER shell page,
  // outside the iframe, so it has to be hidden from here.
  await page.addStyleTag({
    content: `a[href*="streamlit.io"], [class*="viewerBadge"], [data-testid="stStatusWidget"] { display: none !important; }`,
  }).catch(() => {});

  // Park the probe on the first tick so the sweep starts at the left edge.
  const probe = appFrame.locator(PROBE);
  await probe.focus();
  await probe.press("Home");
  await appFrame.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await appFrame.getByRole("heading", { level: 1 }).first()
    .waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(600);
  // Everything recorded before now is the empty-dark reconnect lead-in.
  // Keep ~0.4s of it so the open isn't an abrupt hard cut.
  const leadSec = Math.max(0, (Date.now() - tStart) / 1000 - 0.4);
  console.log(`[tradetell] trimming ${leadSec.toFixed(1)}s lead-in`);

  // Beat 1: hold on the headline so the viewer reads what this is.
  await page.waitForTimeout(3_000);

  // Beat 2: bring the price section into frame and sweep the probe across
  // all four days. PageUp moves it 100 ticks, so 400 presses cross 40,000.
  await glideTo(appFrame, page, await topOf(appFrame, PROBE, VIDEO_H - 80), 1_400);
  for (let i = 0; i < 400; i++) {
    await probe.press("PageUp");
    if (i % 4 === 3) await page.waitForTimeout(70);
  }
  await page.waitForTimeout(1_200);

  // Beat 3: rest on the order book at the last tick.
  await glideTo(appFrame, page, await topOf(appFrame, ORDER_BOOK), 1_400);
  await page.waitForTimeout(2_500);

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
    "-ss", leadSec.toFixed(2),
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
