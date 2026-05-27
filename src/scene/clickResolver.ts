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
    // OperatorHolo + its HoloPedestal stand are parented to Desk in
    // the GLB. Both resolve to LinkedIn so the whole stand reads as a
    // single click target. Has to fire before the Desk → terminal
    // branch below or clicks would fall through to "terminal".
    if (cur.name === "OperatorHolo" || cur.name === "HoloPedestal") {
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
