import { Object3D } from "three";
import { projects } from "@/data/projects";

// What a 3D click resolves to in app-state terms.
export type ClickTarget =
  | { kind: "project"; projectId: string }
  | { kind: "terminal" }
  | { kind: "linkedin" }
  | null;

const PROJECT_IDS = new Set(projects.map((p) => p.id));

// Walks up from the picked mesh to the nearest named ancestor that maps
// to something the UI cares about. Underscore-not-dot separator: see
// anchors.ts for why.
const NAMED_NODE_RE = /^(Rack|Screen)_(.+)$/;

export function resolveClick(picked: Object3D | null): ClickTarget {
  let cur: Object3D | null = picked;
  while (cur) {
    // OperatorHolo is parented to Desk in the GLB. Check it first so a
    // click on the holo doesn't fall through to the Desk → terminal
    // branch below.
    if (cur.name === "OperatorHolo") {
      return { kind: "linkedin" };
    }
    const m = cur.name.match(NAMED_NODE_RE);
    if (m && PROJECT_IDS.has(m[2])) {
      return { kind: "project", projectId: m[2] };
    }
    if (cur.name === "Monitor" || cur.name === "Desk") {
      return { kind: "terminal" };
    }
    cur = cur.parent;
  }
  return null;
}
