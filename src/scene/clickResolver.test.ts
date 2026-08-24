import { describe, expect, it } from "vitest";
import { Object3D } from "three";
import { resolveClick } from "./clickResolver";

describe("resolveClick", () => {
  it("resolves named project, terminal, LinkedIn, and unknown ancestors", () => {
    const project = new Object3D();
    project.name = "Rack_staija";
    expect(resolveClick(project)).toEqual({ kind: "project", projectId: "staija" });
    const desk = new Object3D();
    desk.name = "Desk";
    const monitor = new Object3D();
    monitor.name = "Monitor";
    desk.add(monitor);
    expect(resolveClick(monitor)).toEqual({ kind: "terminal" });
    const holo = new Object3D();
    holo.name = "HoloPedestal";
    expect(resolveClick(holo)).toEqual({ kind: "linkedin" });
    expect(resolveClick(new Object3D())).toBeNull();
    expect(resolveClick(null)).toBeNull();
  });
});
