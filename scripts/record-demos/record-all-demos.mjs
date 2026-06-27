// Record short looping screen captures of every project's live site
// and write them as VP9 WebMs under public/img/projects/demos/. Used
// as both the in-scene rack-screen textures *and* the ProjectCard
// hero video, so the source needs to be retina-friendly: previously
// captured at 720×450 with deviceScaleFactor: 1, which the browser
// then 2×-upscaled on retina panels, giving the hero a blurry read.
// Now 1440×900 — sharp at 1× on the rack screens (which downsample
// in the GPU anyway) and at 2× on the project panel.
//
// Usage:
//   node scripts/record-demos/record-all-demos.mjs               # all
//   node scripts/record-demos/record-all-demos.mjs ocaml-lob     # one
//   node scripts/record-demos/record-all-demos.mjs ocaml-lob qforge
//
// Dependencies: @playwright/test (already in package.json), ffmpeg on PATH.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "img", "projects", "demos");

// Render dimensions. 1440×900 is exactly 2× the panel's CSS-pixel
// width (the .panel default is 720 px), so retina displays no longer
// need to upscale. Keeps the 8:5 aspect the existing demos use.
const VIDEO_W = 1440;
const VIDEO_H = 900;
// 24 fps reads as motion (15 fps stuttered on the larger viewport),
// 300 kbps holds VP9 quality through scroll-heavy pages at 1440×900
// while keeping each demo under ~700 KB.
const VIDEO_FPS = 24;
const VIDEO_BITRATE = "300k";

// Per-project recording config. Live URL + total recording duration.
// Order matches projects.ts. linuxbenchhub is intentionally omitted —
// it doesn't ship a live URL, so its panel falls back to the static
// blurb (no hero video). The two analyst pages run a little longer
// because they're long single-column reports with more to show.
const TARGETS = [
  { id: "econos",         url: "https://econ-os.vercel.app",          durationMs: 14_000 },
  { id: "ocaml-lob",      url: "https://ocaml-lob.vercel.app",        durationMs: 14_000 },
  { id: "qforge",         url: "https://qforge-neural.vercel.app",    durationMs: 14_000 },
  { id: "micromatch",     url: "https://trymicromatch.vercel.app",    durationMs: 14_000 },
  { id: "staija",         url: "https://staija.org",                  durationMs: 14_000 },
  { id: "studysprint",    url: "https://getstudysprint.vercel.app",   durationMs: 14_000 },
  { id: "capitol-alpha",  url: "https://capitolalpha.vercel.app",     durationMs: 16_000 },
  { id: "datafest-2026",  url: "https://datafest-2026.vercel.app/",   durationMs: 18_000 },
  { id: "helm",           url: "https://helm-bridge.vercel.app",      durationMs: 16_000 },
  { id: "tradetell",      url: "https://tradetell.streamlit.app",     durationMs: 14_000 },
];

async function recordOne(target) {
  const workdir = mkdtempSync(path.join(tmpdir(), `demo-${target.id}-`));
  console.log(`[${target.id}] recording ${VIDEO_W}×${VIDEO_H} → ${workdir}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    // deviceScaleFactor stays at 1 — we *are* the high-res capture
    // now. Bumping to 2 would inflate VP9 file size for no extra
    // detail beyond what the 1440×900 grid already encodes.
    recordVideo: {
      dir: workdir,
      size: { width: VIDEO_W, height: VIDEO_H },
    },
  });
  const page = await context.newPage();

  // Some live demos keep a websocket/SSE connection open after first
  // paint (ocaml-lob's order-book stream, qforge's training feed),
  // so "networkidle" never fires. domcontentloaded + a generous dwell
  // is both more reliable and faster.
  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2_500);

  // Slow page-scroll to expose the full document in the video. Most
  // pages on the live deploys are tall single-column reports — a
  // smooth scroll from top to bottom is the most readable narrative.
  // For interactive demos (ocaml-lob, qforge) this still works
  // because the landing page is the demo surface.
  const totalScrollMs = target.durationMs - 3_500;
  const scrollSteps = 60;
  const stepMs = Math.max(50, Math.floor(totalScrollMs / scrollSteps));
  await page.evaluate(
    async ({ steps, stepMs }) => {
      const max = Math.max(
        document.body.scrollHeight - window.innerHeight,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      for (let i = 1; i <= steps; i++) {
        window.scrollTo({ top: (max * i) / steps, behavior: "instant" });
        await new Promise((r) => setTimeout(r, stepMs));
      }
    },
    { steps: scrollSteps, stepMs },
  );

  // Hold the end-frame so the loop has a clear "rest" beat before it cuts.
  await page.waitForTimeout(2_000);

  await context.close();
  await browser.close();

  // Playwright drops the recording at a randomized filename inside workdir.
  const recorded = readdirSync(workdir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => path.join(workdir, f))
    .filter((f) => statSync(f).size > 0)[0];
  if (!recorded) {
    throw new Error(`[${target.id}] no .webm produced under ${workdir}`);
  }

  // Re-encode to VP9. Two-pass libvpx-vp9 at 300 kbps lands the
  // 1440×900 / 24 fps demos in the ~400–700 KB range, depending on
  // how scroll-heavy the source page is. Single-pass refuses to
  // honour the budget on motion-heavy clips; pass 1 builds the
  // first-pass stats, pass 2 actually writes the file.
  const finalPath = path.join(OUT_DIR, `${target.id}.webm`);
  const passLogPrefix = path.join(workdir, "vp9pass");
  const common = [
    "-c:v", "libvpx-vp9",
    "-b:v", VIDEO_BITRATE,
    "-deadline", "good", "-cpu-used", "2", "-row-mt", "1",
    "-vf", `scale=${VIDEO_W}:${VIDEO_H}:flags=lanczos,fps=${VIDEO_FPS}`,
    "-an",
    "-passlogfile", passLogPrefix,
  ];
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", recorded,
    ...common, "-pass", "1", "-f", "null", "/dev/null",
  ], { stdio: "inherit" });
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", recorded,
    ...common, "-pass", "2", finalPath,
  ], { stdio: "inherit" });
  rmSync(workdir, { recursive: true, force: true });
  console.log(
    `[${target.id}] wrote ${path.relative(REPO_ROOT, finalPath)} ` +
      `(${(statSync(finalPath).size / 1024).toFixed(1)} KB)`,
  );
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
