import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });
    test("homepage has no WCAG 2.2 A or AA violations", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const failures = results.violations.flatMap(({ id, nodes }) =>
        nodes.map((node) => `${id}: ${node.target.join(" ")} (${node.any.map((check) => check.message).join("; ")})`),
      );
      expect(failures).toEqual([]);
    });
  });
}
