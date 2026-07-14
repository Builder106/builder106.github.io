import { createBdd } from "playwright-bdd";
import { expect, type Page } from "@playwright/test";
import { dwellForDemo } from "../demo/hooks";

const { Given, When, Then } = createBdd();

// ── Setup ──────────────────────────────────────────────────────────────────
Given("I am on the home page", async ({ page }: { page: Page }) => {
  await page.goto("/");
  // Wait for the boot sequence to complete + the scene's HUD to render.
  // The `<OV />` brand mark is the last thing the HUD paints, so it makes
  // a good "scene is ready" anchor.
  await page.getByText("<OV />").waitFor({ state: "visible" });
  await dwellForDemo(page);
});

// ── Rack interaction ───────────────────────────────────────────────────────
// The floating callouts are <button>s inside drei's <Html>. drei re-portals
// the element on every animation frame, which makes Playwright's normal
// .click() fail both the position-stability check AND the not-detached
// check. We dispatch a synthetic click event directly on the element via
// .evaluate() — the event bubbles up to React's delegated handler and fires
// the onClick that opens the panel, without Playwright caring whether the
// element was moving or remounted between locator + click. Hacky for QA;
// fine for demos where we just need the action to happen reliably.
async function clickButton(page: Page, namePattern: RegExp): Promise<void> {
  const btn = page.getByRole("button", { name: namePattern }).first();
  await btn.evaluate((el) => {
    (el as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

When("I click the {string} project rack", async ({ page }: { page: Page }, name: string) => {
  await clickButton(page, new RegExp(name, "i"));
  await dwellForDemo(page);
});

When("I click the trading terminal", async ({ page }: { page: Page }) => {
  // Label was renamed "trading_terminal" → "console" in the HUD pass.
  // Step phrasing stays for narrative continuity; only the selector
  // tracks the actual DOM. The terminal also exposes a "// console"
  // aria-name on the desk-monitor mesh, but the floating callout above
  // the desk is what the user actually sees and clicks.
  await clickButton(page, /^console$/i);
  await dwellForDemo(page);
});

When("I click the ping button", async ({ page }: { page: Page }) => {
  // Rendered text is "ping" — the CSS `text-transform: uppercase` only
  // affects visual presentation, not the underlying text content used by
  // getByRole's accessible name match.
  await clickButton(page, /^ping$/i);
  await dwellForDemo(page);
});

// ── Panel close ────────────────────────────────────────────────────────────
// All 3 panels sit in the DOM at once; only the .panel--open one is
// actually visible to a human. Scope to the open panel + use the same
// dispatch-event trick used for rack clicks.
When("I close the panel", async ({ page }: { page: Page }) => {
  const closeBtn = page
    .locator(".panel.panel--open")
    .getByRole("button", { name: "Close" });
  await closeBtn.evaluate((el) => {
    (el as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await dwellForDemo(page, 800);
});

// ── Assertions (light — demos aren't tests) ────────────────────────────────
// PanelShell renders its title as `// node.<projectId>` in an h2. The
// project's name (e.g. "EconOS") is in an h3 inside the panel body. Match
// on the .panel__title h2 specifically — the body has multiple headings.
Then("I see the project card for {string}", async ({ page }: { page: Page }, name: string) => {
  const panel = page.locator(".panel.panel--open");
  await expect(panel).toBeVisible();
  // Panel title uses the project id (lowercase, possibly hyphenated)
  // rather than the display name. Just assert the title is present; the
  // demo viewer can read which project from the rendered body.
  await expect(panel.locator(".panel__title")).toBeVisible();
  // Also assert the project name appears somewhere in the body — catches
  // panel-wired-to-wrong-project regressions cheaply.
  await expect(panel).toContainText(new RegExp(name, "i"));
  await dwellForDemo(page);
});

Then("I see the trading terminal", async ({ page }: { page: Page }) => {
  const panel = page.locator(".panel.panel--open");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".panel__title")).toBeVisible();
  await dwellForDemo(page);
});

Then("I see the contact form", async ({ page }: { page: Page }) => {
  const panel = page.locator(".panel.panel--open");
  await expect(panel).toBeVisible();
  await dwellForDemo(page);
});

Then("no panel is open", async ({ page }: { page: Page }) => {
  await expect(page.locator(".panel.panel--open")).toHaveCount(0);
});

// ── Idle-wave wait ─────────────────────────────────────────────────────────
// The room fires its attractor wave after IDLE_BEFORE_WAVE_MS (=15 000 ms)
// of no interaction. The sweep itself takes ~6 s to traverse all nine racks
// in landscape. This step holds the page idle long enough for one full
// sweep to be visible in the recording.
When("I wait for the idle wave to fire", async ({ page }: { page: Page }) => {
  // 15 s idle threshold + 7 s for the wave's full sweep + tail.
  await page.waitForTimeout(22_000);
});

// ── Hover-only beats (for showing UI without committing to a click) ───────
// drei's <Html> portal rerenders the element on every animation frame, so
// btn.hover() fails Playwright's element-stability check indefinitely.
// Fix: snapshot the bounding rect via evaluate (no stability guard), move
// the mouse there in steps so the cursor arc is visible in the recording,
// then fire a synthetic mouseenter so any hover CSS state triggers.
When(
  "I hover the {string} project rack",
  async ({ page }: { page: Page }, name: string) => {
    const btn = page.getByRole("button", { name: new RegExp(name, "i") }).first();
    const pos = await btn.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.move(pos.x, pos.y, { steps: 12 });
    await btn.evaluate((el) => {
      (el as HTMLElement).dispatchEvent(
        new MouseEvent("mouseenter", { bubbles: true, cancelable: true }),
      );
    });
    await dwellForDemo(page);
  },
);
