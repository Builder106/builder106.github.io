// Custom demo recorder for TradeTell.
//
// Two problems make the generic scroll-capture script unusable here:
//
//   1. Streamlit Community Cloud apps sleep on idle. The generic script
//      would record the "Zzzz, wake this app up?" screen.
//   2. Streamlit's default layout (left sidebar + a max-width-constrained
//      centre column inside a 1440px viewport) shrinks to microscopic text
//      once the recording is letterboxed into the ~720×360 ProjectCard hero.
//
// This script fixes both:
//   - Phase 1 wakes the app in a throwaway context (no recording), so the
//     startup spinner never reaches the video.
//   - Phase 2 records at 1440×720 — exactly the 2:1 aspect of the card's
//     hero box, so object-fit:contain doesn't letterbox. Before recording
//     the interaction it injects CSS into the Streamlit iframe that hides
//     the sidebar, lets the conversation use the full width, and zooms the
//     content 2× so text stays legible after the card scales it down. The
//     demo submits a question and slow-scrolls through the grounded answer
//     to the "N source document(s)" citation row.
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
// Question submitted for the demo.
const QUESTION = "What products and position limits are in Round 1?";

// 1440×720 = 2:1, the exact aspect of the ProjectCard hero box (it renders
// ~720×360 CSS px). Matching it means object-fit:contain shows the whole
// frame with no wasted letterbox. 1440 wide is 2× the card's 720 CSS width,
// so it stays sharp on retina.
const VIDEO_W = 1440;
const VIDEO_H = 720;
const VIDEO_FPS = 24;
const VIDEO_BITRATE = "320k";

// CSS injected into the Streamlit iframe so the conversation reads large.
// Hides the sidebar (the demo submits via the textarea, so its suggestion
// buttons aren't needed), lets the centre column span the full width, and
// zooms everything 2× for legibility once the card scales the video down.
// Legibility CSS. `hideChrome` strips the fixed chat-input bar and the
// Streamlit viewer badges for the read-through, so the frame is filled with
// conversation text instead of a floating input over empty dark space.
function legibilityCss({ hideChrome }) {
  return `
    [data-testid="stSidebar"],
    [data-testid="stSidebarCollapsedControl"],
    [data-testid="collapsedControl"],
    [data-testid="stSidebarCollapseButton"] { display: none !important; }
    section.main .block-container,
    [data-testid="stMainBlockContainer"],
    .block-container { max-width: 100% !important; padding: 2.5rem 2.5rem 1.5rem !important; }
    [data-testid="stAppViewContainer"] { left: 0 !important; }
    [data-testid="stStatusWidget"],
    [class*="viewerBadge"],
    [data-testid="stDecoration"],
    a[href*="streamlit.io"] { display: none !important; }
    ${hideChrome ? `
      [data-testid="stChatInput"],
      [data-testid="stBottomBlockContainer"],
      [data-testid="stBottom"] { display: none !important; }
    ` : ""}
    html { zoom: 2 !important; }
  `;
}

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

// Idempotently (re)inject the legibility CSS. Streamlit re-renders its
// <head> on rerun, so call this again after the answer settles.
async function injectLegibilityCss(appFrame, { hideChrome = false } = {}) {
  await appFrame.evaluate((css) => {
    let el = document.getElementById("tt-demo-css");
    if (!el) {
      el = document.createElement("style");
      el.id = "tt-demo-css";
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, legibilityCss({ hideChrome }));
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

// Smoothly scroll from the top of the conversation to the bottom over
// `durationMs`. Called only after the chat input + badges are hidden and the
// bottom padding is minimal, so the document is just the conversation — every
// frame stays full of text with no empty padding or floating input at the end.
async function slowScrollThrough(appFrame, page, durationMs) {
  const steps = 70;
  const stepMs = Math.max(40, Math.floor(durationMs / steps));
  for (let i = 1; i <= steps; i++) {
    await appFrame.evaluate((frac) => {
      const max = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      ) - window.innerHeight;
      window.scrollTo({ top: max * frac, behavior: "instant" });
    }, i / steps);
    await page.waitForTimeout(stepMs);
  }
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

  const appFrame = await waitForChatReady(page);
  console.log("[tradetell] chat ready in recording context");

  // The "Hosted with Streamlit" kite badge lives in the OUTER shell page,
  // outside the iframe, so the iframe CSS can't reach it — hide it here.
  await page.addStyleTag({
    content: `a[href*="streamlit.io"], [class*="viewerBadge"], [data-testid="stStatusWidget"] { display: none !important; }`,
  }).catch(() => {});

  await injectLegibilityCss(appFrame);
  await appFrame.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  // Confirm the header heading has actually painted before we treat the
  // recording as "content has started" — this is the trim point.
  await appFrame.getByText(/IMC Prosperity Trading Assistant/i).first()
    .waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  // Everything recorded before now is the empty-dark reconnect lead-in.
  // Keep ~0.4s of it so the open isn't an abrupt hard cut.
  const leadSec = Math.max(0, (Date.now() - tStart) / 1000 - 0.4);
  console.log(`[tradetell] trimming ${leadSec.toFixed(1)}s lead-in`);
  // Beat 1: hold on the header / intro so the viewer reads what this is.
  await page.waitForTimeout(3_000);

  // Beat 2: submit the question. The user bubble appearing is the visible
  // interaction (the fixed textarea sits below the zoomed viewport, so we
  // drive it programmatically rather than showing the cursor in it).
  const chatInput = appFrame.locator(`textarea[placeholder="${CHAT_PLACEHOLDER}"]`);
  await chatInput.fill(QUESTION);
  await page.waitForTimeout(500);
  await chatInput.press("Enter");
  console.log(`[tradetell] submitted: "${QUESTION}"`);

  // Wait for the assistant message to start appearing.
  await appFrame.waitForFunction(
    () => document.querySelectorAll('[data-testid="stChatMessage"]').length >= 2,
    { timeout: 60_000 },
  );
  console.log("[tradetell] response streaming...");

  // Submitting reruns the Streamlit app, which rebuilds <head> and drops
  // our injected CSS — and Streamlit auto-scrolls to the (empty) bottom by
  // the input. So while the answer streams, tick every ~350ms to re-apply
  // the legibility CSS and pin the scroll to the top, where the question
  // bubble sits and the answer grows in. This keeps the streaming footage
  // zoomed and full of content instead of an empty, unzoomed void.
  let prevLen = 0;
  let stableRuns = 0;
  for (let i = 0; i < 170; i++) {
    await injectLegibilityCss(appFrame);
    await appFrame.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(350);
    if (i % 6 !== 0) continue; // measure length ~every 2.1s
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

  // Read-through phase: now hide the fixed chat-input bar and Streamlit
  // badges and drop the bottom padding, so the document is just the
  // conversation — no floating input over empty dark space (the "9 source
  // document(s)" pill at the end already proves the answer is grounded).
  await injectLegibilityCss(appFrame, { hideChrome: true });
  await appFrame.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1_500);
  await slowScrollThrough(appFrame, page, 11_000);

  // Hold the final state (sources pill in view) before closing.
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
