import { describe, expect, it } from "vitest";
import { AISLE_ORDER, CLUSTER_DISPLAY, projects } from "./projects";

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

  it("AISLE_ORDER contains every project ID and vice versa", () => {
    const projectIds = projects.map((p) => p.id).sort();
    const aisleIds = [...AISLE_ORDER].sort();
    expect(aisleIds).toEqual(projectIds);
  });

  it("every project has valid prev and next rack targets", () => {
    const total = AISLE_ORDER.length;
    projects.forEach((project) => {
      const idx = AISLE_ORDER.indexOf(project.id as (typeof AISLE_ORDER)[number]);
      expect(idx).toBeGreaterThanOrEqual(0);

      const prevId = AISLE_ORDER[(idx - 1 + total) % total];
      const nextId = AISLE_ORDER[(idx + 1) % total];

      const prevProject = projects.find((p) => p.id === prevId);
      const nextProject = projects.find((p) => p.id === nextId);

      expect(prevProject).toBeDefined();
      expect(nextProject).toBeDefined();
    });
  });
});

