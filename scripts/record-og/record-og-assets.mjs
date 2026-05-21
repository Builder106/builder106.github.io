// Record the OG video (public/demo.mp4) and capture the OG card
// (public/og-card.jpg) from the current scene. Standalone Playwright
// run rather than the full e2e/demo BDD suite — this clip is shorter
// and tighter than the recruiter walkthrough, and doesn't need the
// reporter / per-test slot scaffolding.
//
// Drives the production site at yinkavaughan.me by default. Override
// with OG_BASE_URL for a localhost preview:
//   OG_BASE_URL=http://localhost:5173 node scripts/record-og/record-og-assets.mjs
//
// Dependencies: @playwright/test (in package.json), ffmpeg on PATH.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const BASE_URL = process.env.OG_BASE_URL ?? "https://yinkavaughan.me";

// OG video target: 1920x1080 H.264 at ~1 Mbps, ~22 s total.
const VIDEO_W = 1920;
const VIDEO_H = 1080;

// OG card target: 1200x630 JPEG (Facebook / Twitter recommended size).
const CARD_W = 1200;
const CARD_H = 630;

const DEMO_OUT  = path.join(REPO_ROOT, "public", "demo.mp4");
const CARD_OUT  = path.join(REPO_ROOT, "public", "og-card.jpg");

// --- Helpers ---------------------------------------------------------------

async function waitForBoot(page) {
  // The `<OV />` brand mark is the last thing the HUD paints; once it's
  // visible the scene is fully hydrated and the boot sequence has cleared.
  await page.getByText("<OV />").waitFor({ state: "visible", timeout: 30_000 });
}

async function dispatchClickByName(page, namePattern) {
  // drei <Html> portals re-mount every frame, which breaks Playwright's
  // native .click() (fails position-stability and not-detached checks).
  // Dispatch the synthetic click event via .evaluate() instead — React's
  // delegated handler fires the onClick regardless of element churn.
  const btn = page.getByRole("button", { name: namePattern }).first();
  await btn.evaluate((el) => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function closeOpenPanel(page) {
  const closeBtn = page
    .locator(".panel.panel--open")
    .getByRole("button", { name: "Close" });
  await closeBtn.evaluate((el) => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

// --- 1. Record the video ---------------------------------------------------

async function recordVideo() {
  const workdir = mkdtempSync(path.join(tmpdir(), "og-video-"));
  console.log(`[og-video] recording to ${workdir}`);

  const browser = await chromium.launch({
    headless: true,
    // slowMo paces every Playwright action — keeps interactions readable
    // in the recording without inflating click latency too much. 600 ms
    // strikes a balance between "viewer can tell what happened" and "we
    // need to fit a four-beat scene into ~22 seconds".
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: workdir,
      size: { width: VIDEO_W, height: VIDEO_H },
    },
  });
  const page = await context.newPage();

  // 1. Land + boot. Page-load itself + boot sequence eats ~5 s.
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30_000 });
  await waitForBoot(page);
  // Establish the iso vantage for ~4 s — long enough for the boot-
  // sequence fade-out to complete (the rack callouts mount before the
  // overlay dissipates, but they're not interactive until it's gone)
  // and for social platforms grabbing a single thumbnail to land on a
  // stable composition.
  await page.waitForTimeout(4_000);

  // 2. Click a rack from the newest cluster (analyst) to show off the
  //    feature that motivated this recording.
  await dispatchClickByName(page, /CapitolAlpha/i);
  await page.waitForTimeout(2_500);   // let camera fly + panel mount finish

  // 3. Close. Dwell briefly so the close-animation reads.
  await closeOpenPanel(page);
  await page.waitForTimeout(1_500);

  // 4. Click the central trading terminal to demonstrate that the room's
  //    centerpiece is also interactive.
  await dispatchClickByName(page, /trading_terminal/i);
  await page.waitForTimeout(2_500);

  // 5. Close and settle on the default vantage for the closing frame.
  await closeOpenPanel(page);
  await page.waitForTimeout(2_500);

  await context.close();
  await browser.close();

  // Playwright writes a randomly-named .webm into workdir.
  const recorded = readdirSync(workdir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => path.join(workdir, f))
    .find((f) => statSync(f).size > 0);
  if (!recorded) {
    throw new Error(`no .webm produced in ${workdir}`);
  }

  // Re-encode to H.264 mp4 — the format og:video:type expects. -crf 28
  // + a 1 Mbps cap lands around 2-3 MB for a 22 s 1920x1080 capture and
  // matches the visual quality of the previous demo.mp4. -movflags
  // +faststart puts the moov atom up front so unfurlers can begin
  // playback before the whole file downloads.
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", recorded,
    "-c:v", "libx264", "-preset", "veryslow", "-crf", "28",
    "-maxrate", "1200k", "-bufsize", "2400k",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    DEMO_OUT,
  ], { stdio: "inherit" });

  const sizeKB = (statSync(DEMO_OUT).size / 1024).toFixed(1);
  rmSync(workdir, { recursive: true, force: true });
  console.log(`[og-video] wrote ${path.relative(REPO_ROOT, DEMO_OUT)} (${sizeKB} KB)`);
}

// --- 2. Capture the OG card ------------------------------------------------

async function captureCard() {
  console.log(`[og-card] capturing from ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // 2x DPR so the still card is crisp on retina previews — JPEG
    // compression eats the resulting filesize back down.
    viewport: { width: CARD_W, height: CARD_H },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30_000 });
  await waitForBoot(page);
  // Let idle drift settle off — we want the static default vantage, not
  // a frame mid-rotation. The orbit autoRotate only kicks in after 12 s
  // idle, so 1.5 s here is safely before that threshold.
  await page.waitForTimeout(1_500);

  // Save as a high-quality PNG first, then convert to JPEG via ffmpeg so
  // we can dial the quality knob predictably. (Playwright's JPEG output
  // is fine, but ffmpeg's gives finer control over the size/quality
  // trade-off and matches what we used for the previous og-card.jpg.)
  const tmpPng = path.join(tmpdir(), `og-card-${Date.now()}.png`);
  await page.screenshot({ path: tmpPng, type: "png", fullPage: false });
  await context.close();
  await browser.close();

  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", tmpPng,
    "-vf", `scale=${CARD_W}:${CARD_H}:flags=lanczos`,
    "-q:v", "4",                       // JPEG quality, ~85
    CARD_OUT,
  ], { stdio: "inherit" });

  rmSync(tmpPng, { force: true });
  const sizeKB = (statSync(CARD_OUT).size / 1024).toFixed(1);
  console.log(`[og-card] wrote ${path.relative(REPO_ROOT, CARD_OUT)} (${sizeKB} KB)`);
}

// --- Drive ------------------------------------------------------------------

await recordVideo();
await captureCard();
console.log("done");
