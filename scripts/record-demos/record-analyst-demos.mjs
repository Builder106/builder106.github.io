// Record short looping screen captures of the analyst-cluster project
// live sites. Saves as 720×450 VP9 WebM under public/img/projects/demos/
// to match the existing six demos (econos, staija, etc.).
//
// Usage:
//   node scripts/record-demos/record-analyst-demos.mjs
//
// Dependencies: @playwright/test (already in package.json), ffmpeg on PATH.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "img", "projects", "demos");

// Matches existing demos: 720×450 at ~24 fps, short and small.
const VIDEO_W = 720;
const VIDEO_H = 450;

const TARGETS = [
  {
    id: "capitol-alpha",
    url: "https://capitolalpha.vercel.app",
    durationMs: 16_000,
  },
  {
    id: "datafest-2026",
    url: "https://datafest-2026.vercel.app/",
    durationMs: 18_000,
  },
];

async function recordOne(target) {
  const workdir = mkdtempSync(path.join(tmpdir(), `demo-${target.id}-`));
  console.log(`[${target.id}] recording → ${workdir}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: VIDEO_W, height: VIDEO_H },
    // deviceScaleFactor stays at 1 — the existing demos are scaled down
    // anyway and a 2× capture inflates VP9 file size by 3-5× for no
    // visible benefit at the rack-screen render size (~0.73m wide).
    recordVideo: {
      dir: workdir,
      size: { width: VIDEO_W, height: VIDEO_H },
    },
  });
  const page = await context.newPage();

  await page.goto(target.url, { waitUntil: "networkidle", timeout: 30_000 });
  // Initial dwell so the first frame is the landing hero, not a half-painted page.
  await page.waitForTimeout(1_500);

  // Slow page-scroll to expose the full document in the video. Pages on
  // both targets are tall single-column reports — a smooth scroll from
  // top to bottom is the most readable narrative.
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

  // Re-encode to VP9 with the size + bitrate envelope the existing demos
  // use. Existing six webms run ~50-160 KB at 7-21 s; single-pass libvpx-vp9
  // refuses to honour a 60-80 kbps target on heavy scroll motion, so this
  // takes the two-pass route which actually hits the budget. 15 fps + 60 kbps
  // lands inside the 50-160 KB range observed in the other demos and matches
  // their perceived compression level (visible macroblocks on solid colours,
  // legible body text). -an strips audio (none of the existing have any).
  const finalPath = path.join(OUT_DIR, `${target.id}.webm`);
  const passLogPrefix = path.join(workdir, "vp9pass");
  const common = [
    "-c:v", "libvpx-vp9",
    "-b:v", "60k",
    "-deadline", "good", "-cpu-used", "2", "-row-mt", "1",
    "-vf", `scale=${VIDEO_W}:${VIDEO_H}:flags=lanczos,fps=15`,
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

for (const t of TARGETS) {
  // Serial, not parallel — recording two pages at once would race for
  // ffmpeg + risk hitting the rate limits on either target.
  // eslint-disable-next-line no-await-in-loop
  await recordOne(t);
}
console.log("done");
