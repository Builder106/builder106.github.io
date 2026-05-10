import { Object3D, Vector3 } from "three";

// Blender Empty objects exported with names like "anchor_<id>" become
// invisible Object3D nodes in the .glb. This module finds them and exposes
// their world position so the camera rig can fly to them and React panels
// can be pinned to their projected screen-space coordinates.
//
// See docs/blender-contract.md for the full naming convention.

// Underscore separator (not a dot) because Three.js's GLTFLoader strips
// dots from node names — it reserves them for animation property paths.
export const ANCHOR_PREFIX = "anchor_";

export interface SceneAnchor {
  id: string;
  position: Vector3;
  rotation: Vector3;
}

export function collectAnchors(root: Object3D): Map<string, SceneAnchor> {
  const out = new Map<string, SceneAnchor>();
  root.traverse((node) => {
    if (!node.name.startsWith(ANCHOR_PREFIX)) return;
    const id = node.name.slice(ANCHOR_PREFIX.length);
    const position = new Vector3();
    node.getWorldPosition(position);
    const rotation = new Vector3(node.rotation.x, node.rotation.y, node.rotation.z);
    out.set(id, { id, position, rotation });
  });
  return out;
}
