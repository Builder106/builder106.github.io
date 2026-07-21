import { describe, expect, it } from "vitest";
import { CLUSTER_DISPLAY, projects } from "./projects";

describe("portfolio projects data", () => {
  it("contains unique non-empty IDs for every project", () => {
    const ids = projects.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    ids.forEach((id) => {
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });
  });

  it("all projects have required valid fields", () => {
    projects.forEach((p) => {
      expect(p.name).toBeTruthy();
      expect(p.blurb).toBeTruthy();
      expect(Array.isArray(p.stack)).toBe(true);
      expect(p.stack.length).toBeGreaterThan(0);
      expect(Object.keys(CLUSTER_DISPLAY)).toContain(p.cluster);

      if (p.links.live) {
        expect(p.links.live).toMatch(/^https?:\/\//);
      }
      if (p.links.repo) {
        expect(p.links.repo).toMatch(/^https?:\/\//);
      }
    });
  });
});
