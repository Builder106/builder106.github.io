import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

console.log("[test] waiting 16s for idle window…");
await page.waitForTimeout(16_000);

// Sample 12 frames spaced ~350 ms apart — covers the full ~4 s wave.
for (let i = 0; i < 12; i++) {
  await page.screenshot({ path: `/tmp/wave2-${String(i).padStart(2, "0")}.png` });
  await page.waitForTimeout(350);
}
await browser.close();
console.log("done");
