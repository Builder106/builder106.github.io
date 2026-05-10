import { Vector3 } from "three";
import { type SceneAnchor } from "./anchors";

// Default isometric vantage. Looking at the origin from the front-right,
// pulled back enough to fit a ~14x14 unit room. Y is up (Three.js space).
export const DEFAULT_CAMERA_POSITION = new Vector3(8, 6, 8);
export const DEFAULT_CAMERA_TARGET = new Vector3(0, 1, 0);

// When flying to a wall-mounted anchor, sit this far back and up from the
// anchor so the camera frames the rack instead of clipping into it. The
// direction is computed from the anchor's position (room interior).
const ANCHOR_PULLBACK = 3.2;
const ANCHOR_RISE = 1.3;

// Central terminal needs a tighter, head-on framing.
const TERMINAL_PULLBACK = 2.6;
const TERMINAL_RISE = 0.6;

export interface CameraTarget {
  position: Vector3;
  lookAt: Vector3;
}

export function defaultCameraTarget(): CameraTarget {
  return {
    position: DEFAULT_CAMERA_POSITION.clone(),
    lookAt: DEFAULT_CAMERA_TARGET.clone(),
  };
}

// Build a camera target from a wall-mounted anchor. Uses the anchor's
// horizontal position to derive a "step back into the room" direction so
// the camera ends up in front of the rack, looking at it.
export function projectCameraTarget(anchor: SceneAnchor): CameraTarget {
  const interiorDir = new Vector3(-anchor.position.x, 0, -anchor.position.z)
    .normalize();
  // If the anchor is somehow at origin, fall back to default-facing.
  if (interiorDir.lengthSq() < 0.0001) interiorDir.set(0, 0, 1);

  const position = anchor.position.clone()
    .addScaledVector(interiorDir, ANCHOR_PULLBACK);
  position.y += ANCHOR_RISE;

  return { position, lookAt: anchor.position.clone() };
}

// Terminal-specific framing: stand directly in front of the monitor.
export function terminalCameraTarget(anchor: SceneAnchor): CameraTarget {
  const interiorDir = new Vector3(0, 0, 1); // monitor faces -Z, camera sits at +Z
  const position = anchor.position.clone()
    .addScaledVector(interiorDir, TERMINAL_PULLBACK);
  position.y += TERMINAL_RISE;
  return { position, lookAt: anchor.position.clone() };
}
