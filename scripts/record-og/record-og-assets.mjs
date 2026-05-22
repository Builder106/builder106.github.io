// Record the OG video (public/demo.mp4 — landscape) plus a portrait
// counterpart (public/demo-portrait.mp4) and capture the OG card
// (public/og-card.jpg) from the current scene. Standalone Playwright
// run rather than the full e2e/demo BDD suite — these clips are
// shorter and tighter than the recruiter walkthrough, and don't need
// the reporter / per-test slot scaffolding.
//
// Drives the production site at yinkavaughan.me by default. Override
// with OG_BASE_URL for a localhost preview:
//   OG_BASE_URL=http://localhost:5173 node scripts/record-og/record-og-assets.mjs
//
// Dependencies: @playwright/test (in package.json), ffmpeg on PATH.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const BASE_URL = process.env.OG_BASE_URL ?? "https://yinkavaughan.me";

// OG card target: 1200x630 JPEG (Facebook / Twitter recommended size).
const CARD_W = 1200;
const CARD_H = 630;
const CARD_OUT = path.join(REPO_ROOT, "public", "og-card.jpg");

// Two video variants. Landscape is the canonical OG asset (referenced
// from index.html's og:video meta). Portrait ships alongside as a
// standalone asset for mobile-first contexts — README embed, direct
// share to Instagram-style apps, etc. — and isn't currently wired
// into the OG meta because most unfurlers letterbox portrait video
// inside their landscape preview card.
//
// Portrait viewport aspect 0.5625 (1080:1920) sits below the 4/5
// threshold src/scene/sceneVariant.ts uses to flip to the tiered-
// amphitheater layout, so the recorder gets the actually-different
// scene rather than a re-framed landscape one.
const VARIANTS = [
  {
    name: "landscape",
    width:  1920,
    height: 1080,
    output: path.join(REPO_ROOT, "public", "demo.mp4"),
  },
  {
    name: "portrait",
    width:  1080,
    height: 1920,
    output: path.join(REPO_ROOT, "public", "demo-portrait.mp4"),
  },
];

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

// --- 1. Record one variant -------------------------------------------------

async function recordVariant(variant) {
  const workdir = mkdtempSync(path.join(tmpdir(), `og-video-${variant.name}-`));
  const framesDir = path.join(workdir, "frames");
  mkdirSync(framesDir, { recursive: true });
  console.log(`[${variant.name}] recording frames to ${framesDir}`);

  const browser = await chromium.launch({
    headless: true,
    // --headless=new puts Chromium in real-renderer mode (legacy
    // headless is software-only). GPU rasterisation via ANGLE/Metal
    // lets the WebGL scene render at ~60 fps instead of the ~15 fps
    // a CPU rasteriser would manage at 1080p with reflection passes.
    args: [
      "--no-sandbox",
      "--headless=new",
      "--use-angle=metal",
      "--enable-gpu",
      "--enable-gpu-rasterization",
      "--enable-zero-copy",
      "--ignore-gpu-blocklist",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Playwright's recordVideo() caps capture at 25 fps inside Chromium
  // (hardcoded — no API knob), which reads as judder-y on the camera
  // flies. Drive the CDP Page.startScreencast / screencastFrame pair
  // directly instead: every frame the renderer commits gets delivered
  // as JPEG with a real timestamp, so the assembled video runs at
  // whatever fps the GPU actually produced (typically 30-60).
  const client = await page.context().newCDPSession(page);
  const frames = [];
  let firstFrameTs = null;
  client.on("Page.screencastFrame", ({ data, sessionId, metadata }) => {
    const tsMs = (metadata?.timestamp ?? Date.now() / 1000) * 1000;
    if (firstFrameTs === null) firstFrameTs = tsMs;
    frames.push({ data, tMs: tsMs - firstFrameTs });
    // Fire-and-forget ack — without this Chrome stops delivering frames
    // after the first one. Don't await inside the listener because that
    // would serialise frame delivery to round-trip time and bottleneck
    // us back to ~10 fps.
    client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });

  await client.send("Page.startScreencast", {
    format: "jpeg",
    quality: 90,
    maxWidth: variant.width,
    maxHeight: variant.height,
    everyNthFrame: 1,
  });

  // 1. Land + boot.
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30_000 });
  await waitForBoot(page);
  // Wait until the analyst-cluster rack callouts mount + are interactive
  // — the first moment the scene is in its "complete" state and what we
  // want as the trimmed clip's first frame.
  await page.getByRole("button", { name: /CapitolAlpha/i }).first()
    .waitFor({ state: "visible", timeout: 60_000 });
  // Settle so the first frame after trim is a stable composition.
  await page.waitForTimeout(1_500);
  const trimAfterMs = frames.length > 0 ? frames[frames.length - 1].tMs : 0;

  // One click per cluster — quant, analyst, SWE. OCaml LOB leads
  // because "~18M orders/sec · p99 < 1µs" is the strongest hook for
  // a scroll-past viewer. CapitolAlpha and STAIJA round out the
  // breadth across the three clusters; trading_terminal is dropped
  // because it isn't a real project.
  //
  // Panel dwell is 2.4 s — long enough for the headline + first
  // line of blurb to read at OG-preview size, short enough that
  // three clicks still fit a ~16 s window.

  // 2. Quant — OCaml LOB (~18M orders/sec, p99 < 1µs).
  await dispatchClickByName(page, /OCaml LOB/i);
  await page.waitForTimeout(2_400);
  await closeOpenPanel(page);
  await page.waitForTimeout(1_000);

  // 3. Analyst — CapitolAlpha (+2.58% alpha, p < 0.05).
  await dispatchClickByName(page, /CapitolAlpha/i);
  await page.waitForTimeout(2_400);
  await closeOpenPanel(page);
  await page.waitForTimeout(1_000);

  // 4. SWE — STAIJA (live applicant flow, Nigeria's STEM scholars).
  await dispatchClickByName(page, /STAIJA/i);
  await page.waitForTimeout(2_400);
  await closeOpenPanel(page);
  await page.waitForTimeout(2_000);   // final settle for loop point

  await client.send("Page.stopScreencast");
  await context.close();
  await browser.close();

  if (frames.length === 0) {
    throw new Error(`[${variant.name}] no frames captured via CDP screencast`);
  }
  const totalDurMs = frames[frames.length - 1].tMs;
  const captureFps = frames.length / (totalDurMs / 1000);
  console.log(`[${variant.name}] captured ${frames.length} frames at ~${captureFps.toFixed(1)} fps`);
  console.log(`[${variant.name}] trim offset: ${(trimAfterMs / 1000).toFixed(3)}s`);

  // Write frames to disk after the trim point. Re-index from 0 so
  // ffmpeg's image2 demuxer can pick them up as a sequence.
  let kept = 0;
  for (const { data, tMs } of frames) {
    if (tMs < trimAfterMs) continue;
    writeFileSync(
      path.join(framesDir, `f${String(kept).padStart(6, "0")}.jpg`),
      Buffer.from(data, "base64"),
    );
    kept++;
  }
  const trimmedDurSec = (totalDurMs - trimAfterMs) / 1000;
  const finalFps = kept / Math.max(trimmedDurSec, 0.001);
  const fpsRounded = Math.max(20, Math.round(finalFps));
  console.log(
    `[${variant.name}] ${kept} frames kept (${trimmedDurSec.toFixed(2)}s, ${finalFps.toFixed(1)} fps → ${fpsRounded} fps output)`,
  );

  // Encode the JPEG sequence into MP4 at the captured framerate.
  // -framerate in input position tells image2 how to time the stills;
  // -r in output position fixes the stream's claimed fps. Match both
  // to the actual capture rate so motion plays back at native speed.
  const keyint = fpsRounded * 2;     // keyframe every 2 s
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(fpsRounded),
    "-i", path.join(framesDir, "f%06d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-maxrate", "6M", "-bufsize", "12M",
    "-r", String(fpsRounded),
    "-g", String(keyint), "-keyint_min", String(Math.floor(keyint / 2)),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    variant.output,
  ], { stdio: "inherit" });

  const sizeKB = (statSync(variant.output).size / 1024).toFixed(1);
  console.log(`[${variant.name}] wrote ${path.relative(REPO_ROOT, variant.output)} (${sizeKB} KB)`);
  console.log(`[${variant.name}] source frames retained at ${framesDir}`);
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
//
// Filter variants via OG_VARIANT=landscape (or =portrait) for iteration.
const variantFilter = process.env.OG_VARIANT;
const variantsToRun = variantFilter
  ? VARIANTS.filter((v) => v.name === variantFilter)
  : VARIANTS;
if (variantsToRun.length === 0) {
  throw new Error(`OG_VARIANT=${variantFilter} doesn't match any known variant`);
}

for (const variant of variantsToRun) {
  await recordVariant(variant);
}
await captureCard();
console.log("done");
