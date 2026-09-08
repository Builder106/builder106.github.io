import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

for (const viewport of viewports) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });
    test("homepage remains usable without horizontal overflow", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveTitle(/Olayinka Vaughan/i);
      await expect(page.locator("main").first()).toBeVisible();
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    });
  });
}
