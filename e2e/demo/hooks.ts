import type { Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Before, After } = createBdd();

// ── Tunable knobs (env vars, all optional) ─────────────────────────────────
const DEMO     = process.env.DEMO === "1";
const TAIL_MS  = Number(process.env.DEMO_TAIL_MS ?? 1500);
const DWELL_MS = Number(process.env.DEMO_DWELL_MS ?? 1500);
const ZOOM     = Number(process.env.DEMO_ZOOM ?? 1.0);

// ── Dwell helper ───────────────────────────────────────────────────────────
// slowMo only pauses between Playwright actions. page.goto() and visibility
// assertions resolve instantly. Use this to insert an explicit hold at
// "thing just appeared" beats so the viewer can see it before the next
// interaction races past.
export async function dwellForDemo(page: Page, ms: number = DWELL_MS): Promise<void> {
  if (!DEMO) return;
  try {
    await page.waitForTimeout(ms);
  } catch {
    /* page may already be closed */
  }
}

// ── Cursor injection ───────────────────────────────────────────────────────
// Headless Chromium hides the system cursor; without an injected dot the
// viewer can't see what the test is hovering / clicking. addInitScript runs
// on every navigation so we re-inject on each page load.
const CURSOR_SCRIPT = `
(() => {
  if (window.__demoCursorInstalled) return;
  window.__demoCursorInstalled = true;
  const dot = document.createElement("div");
  dot.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 16px",
    "height: 16px",
    "border-radius: 50%",
    "background: radial-gradient(circle, #4cf2ff 0%, rgba(76,242,255,0.4) 60%, transparent 100%)",
    "border: 1px solid #4cf2ff",
    "box-shadow: 0 0 12px rgba(76,242,255,0.7)",
    "pointer-events: none",
    "z-index: 2147483647",
    "transform: translate(-50%, -50%)",
    "transition: transform 80ms linear",
  ].join(";");
  document.documentElement.appendChild(dot);
  document.addEventListener("mousemove", (e) => {
    dot.style.transform = "translate(" + (e.clientX - 8) + "px, " + (e.clientY - 8) + "px)";
  }, { passive: true });
})();`;

// ── Dark background + zoom pin + animation freeze ─────────────────────────
// 1. Pre-mount white-flash: pin html/body to the brand dark + pre-set theme
//    localStorage so the first frame is on-brand.
// 2. Optional CSS zoom for demo "filmed close" framing.
// 3. Freeze the rack-label-float animation. Playwright's .click() requires
//    position stability across two animation frames; without freezing, the
//    label is permanently in motion and the click auto-wait times out.
const PREMOUNT_SCRIPT = `
(() => {
  try { localStorage.setItem("theme", "dark"); } catch (e) {}
  const style = document.createElement("style");
  style.textContent = [
    "html, body { background: #06060c !important; }",
    "html { zoom: ${ZOOM}; }",
    ".rack-label { animation: none !important; transform: translateY(-4px) !important; }",
  ].join("");
  document.documentElement.appendChild(style);
})();`;

// ── playwright-bdd hooks ───────────────────────────────────────────────────
Before(async ({ page }: { page: Page }) => {
  if (!DEMO) return;
  await page.addInitScript(PREMOUNT_SCRIPT);
  await page.addInitScript(CURSOR_SCRIPT);
});

After(async ({ page }: { page: Page }) => {
  if (!DEMO) return;
  // Hold the final frame so the end state reads as a still.
  try {
    await page.waitForTimeout(TAIL_MS);
  } catch {
    /* already closed */
  }
});
