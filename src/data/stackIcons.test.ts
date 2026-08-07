import { describe, expect, it } from "vitest";
import { projects } from "./projects";
import { resolveStackIcon } from "./stackIcons";

describe("resolveStackIcon", () => {
  it("resolves every distinct stack tag used in projects.ts to an icon or documented fallback", () => {
    const allTags = new Set(projects.flatMap((p) => p.stack));
    allTags.forEach((tag) => {
      const result = resolveStackIcon(tag);
      // null is the documented "no icon" case (StackChip renders the
      // fallback glyph for it) — anything else must be a well-formed icon.
      if (result !== null) {
        expect(result.path.length).toBeGreaterThan(0);
        expect(result.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(result.title.length).toBeGreaterThan(0);
      }
    });
  });

  it("resolves known aliases to the same icon as their base tag", () => {
    expect(resolveStackIcon("React 19")?.title).toBe(resolveStackIcon("React")?.title);
    expect(resolveStackIcon("Vue 3")?.title).toBe("Vue.js");
    expect(resolveStackIcon("Next.js 16")?.title).toBe(resolveStackIcon("Next.js")?.title);
  });

  it("returns null for tags with no matching icon", () => {
    expect(resolveStackIcon("AI SDK 5")).toBeNull();
    expect(resolveStackIcon("vector search")).toBeNull();
    expect(resolveStackIcon("Playwright")).toBeNull();
  });

  it("clamps near-black brand colors so they stay visible on a dark chip", () => {
    // Next.js's canonical brand hex is #000000 — unreadable on the
    // chip's near-black background. Resolved hex must be lightened.
    const nextjs = resolveStackIcon("Next.js");
    expect(nextjs?.hex).not.toBe("#000000");
  });
});
