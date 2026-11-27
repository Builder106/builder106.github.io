// Record short looping screen captures of every project's live site
// and write them as VP9 WebMs under public/img/projects/demos/. Used
// as both the in-scene rack-screen textures and the ProjectCard hero
// video.
//
// Frames are captured one at a time (see capture.mjs), so the scroll
// is smooth no matter how slowly the machine renders. 1440×720 is the 2:1 shape
// of the ProjectCard demo box, so nothing is letterboxed.
//
// Usage:
//   node scripts/record-demos/record-all-demos.mjs               # all
//   node scripts/record-demos/record-all-demos.mjs ocaml-lob     # one
//   node scripts/record-demos/record-all-demos.mjs ocaml-lob qforge
//
// Dependencies: @playwright/test (already in package.json), ffmpeg on PATH.

import { chromium } from "@playwright/test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeFrames, frameRecorder, installClock, launchOptions } from "./capture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "img", "projects", "demos");

const VIDEO_W = 1440;
const VIDEO_H = 720;
// 30 fps with no dropped frames reads as smooth scrolling; 700 kbps keeps
// text edges clean through the scroll at about 1 to 1.5 MB per demo.
const VIDEO_FPS = 30;
const VIDEO_BITRATE = "700k";
// Opening and closing holds, in ms of video.
const HOLD_START_MS = 2_500;
const HOLD_END_MS = 2_000;

// Per-project recording config. Live URL + total recording duration.
// Order matches projects.ts. The analyst pages run a little longer
// because they're long single-column reports with more to show.
const TARGETS = [
  // econos streams from a tailnet kernel; record it from a machine that can
  // reach wss://econos-kernel.*.ts.net, or the capture shows the retry dialog.
  { id: "econos",         url: "https://econ-os.vercel.app",          durationMs: 14_000 },
  { id: "ocaml-lob",      url: "https://ocaml-lob.vercel.app",        durationMs: 14_000 },
  { id: "qforge",         url: "https://qforge-neural.vercel.app",    durationMs: 14_000 },
  { id: "micromatch",     url: "https://trymicromatch.vercel.app",    durationMs: 14_000 },
  { id: "staija",         url: "https://staija.org",                  durationMs: 14_000 },
  { id: "studysprint",    url: "https://getstudysprint.vercel.app",   durationMs: 14_000 },
  { id: "capitol-alpha",  url: "https://capitolalpha.vercel.app",     durationMs: 16_000 },
  { id: "datafest-2026",  url: "https://datafest-2026.vercel.app/",   durationMs: 18_000 },
  { id: "linuxbenchhub",  url: "https://linuxbenchhub.vercel.app",    durationMs: 16_000 },
  { id: "clearhash",      url: "https://clearhash.vercel.app",        durationMs: 16_000 },
  { id: "halberd",        url: "https://halberd-keep.vercel.app",     durationMs: 16_000 },
  { id: "quarry",         url: "https://quarry-mev.vercel.app",       durationMs: 16_000 },
  { id: "tcg-cabt-lab",   url: "https://tcg-cabt-lab.vercel.app",     durationMs: 16_000 },
  { id: "vgc-rulebreak",  url: "https://vgc-rulebreak.vercel.app",    durationMs: 16_000 },
  // tradetell uses a custom script — see scripts/record-demos/record-tradetell.mjs
];

// Close intro dialogs and cookie banners so the demo opens on the page
// itself. Escape first, then any visible close or accept control.
async function dismissOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  const controls = page.locator(
    [
      '[role="dialog"] button[aria-label*="close" i]',
      '[role="dialog"] button:has-text("×")',
      'button:has-text("Explore")',
      'button:has-text("Accept")',
      'button:has-text("Got it")',
      'button:has-text("Dismiss")',
    ].join(", "),
  );
  for (let i = 0; i < 3; i++) {
    const first = controls.first();
    if (!(await first.isVisible({ timeout: 500 }).catch(() => false))) break;
    await first.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function recordOne(target) {
  const workdir = mkdtempSync(path.join(tmpdir(), `demo-${target.id}-`));
  console.log(`[${target.id}] recording ${VIDEO_W}×${VIDEO_H} @ ${VIDEO_FPS} fps → ${workdir}`);

  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({ viewport: { width: VIDEO_W, height: VIDEO_H } });
    await installClock(context);
    const page = await context.newPage();

    // Some live demos keep a websocket/SSE connection open after first
    // paint, so "networkidle" never fires. domcontentloaded plus a dwell
    // lets them settle before capture starts.
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3_000);
    await dismissOverlays(page);
    await page.evaluate(() => window.scrollTo(0, 0));

    const rec = await frameRecorder(page, { fps: VIDEO_FPS, dir: workdir });
    await rec.hold(HOLD_START_MS);

    // Glide from top to bottom so the whole page shows in the loop.
    const max = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    );
    const scrollMs = target.durationMs - HOLD_START_MS - HOLD_END_MS;
    await rec.tween(scrollMs, (t) => page.evaluate((y) => window.scrollTo(0, y), Math.round(max * t)));
    await rec.hold(HOLD_END_MS);

    const finalPath = path.join(OUT_DIR, `${target.id}.webm`);
    encodeFrames(workdir, VIDEO_FPS, finalPath, VIDEO_BITRATE);
    console.log(
      `[${target.id}] wrote ${path.relative(REPO_ROOT, finalPath)} ` +
        `(${rec.count} frames, capture took ${rec.slowdown.toFixed(1)}× real time, ${(statSync(finalPath).size / 1024).toFixed(1)} KB)`,
    );
  } finally {
    await browser.close();
    rmSync(workdir, { recursive: true, force: true });
  }
}

// CLI: positional args select a subset of TARGETS. No args = record
// everything.
const requested = process.argv.slice(2);
const queue = requested.length
  ? TARGETS.filter((t) => requested.includes(t.id))
  : TARGETS;
if (requested.length && queue.length === 0) {
  console.error(`No matching targets. Known: ${TARGETS.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

// Serial, not parallel — recording two pages at once would race for
// ffmpeg + risk hitting the rate limits on either target. Wrap each
// recording in a try so one failed target (slow network, server
// down, schema change) doesn't take the whole batch with it.
const failures = [];
for (const t of queue) {
  try {
    // eslint-disable-next-line no-await-in-loop
    await recordOne(t);
  } catch (err) {
    console.error(`[${t.id}] FAILED:`, err.message?.split("\n")[0] ?? err);
    failures.push(t.id);
  }
}
if (failures.length > 0) {
  console.error(`\nfailed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("done");
