import { Vector3 } from "three";
import { type SceneAnchor } from "./anchors";
import { type SceneVariant } from "./sceneVariant";

// Default isometric vantage. Looking at the origin from the front-right,
// pulled back enough to fit a ~14x14 unit room. Y is up (Three.js space).
// The analyst cluster lives on the left wall's back half so all nine
// racks fit inside the 35° vertical FOV at this distance.
export const DEFAULT_CAMERA_POSITION = new Vector3(8, 6, 8);
export const DEFAULT_CAMERA_TARGET = new Vector3(0, 1, 0);

// Portrait variant now loads the landscape glb (the amphitheater was
// retired — see sceneVariant.ts). The camera sits front-and-centre,
// elevated enough to look *down* into the room (the user complaint about
// the previous framing was that it stared straight through the rack
// silhouettes, flattening perspective). FOV is widened in
// ResponsiveCamera so the side walls still read.
//
// Pivot at desk-height, slightly behind the desk, so OrbitControls
// rotation keeps the back-wall quant cluster centred while the left
// (swe) and right (analyst) walls sweep into view as the camera auto-
// tours.
export const PORTRAIT_CAMERA_POSITION = new Vector3(0, 5.2, 12.5);
export const PORTRAIT_CAMERA_TARGET = new Vector3(0, 1.2, -0.5);

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

export function defaultCameraTarget(variant: SceneVariant = "landscape"): CameraTarget {
  if (variant === "portrait") {
    return {
      position: PORTRAIT_CAMERA_POSITION.clone(),
      lookAt: PORTRAIT_CAMERA_TARGET.clone(),
    };
  }
  return {
    position: DEFAULT_CAMERA_POSITION.clone(),
    lookAt: DEFAULT_CAMERA_TARGET.clone(),
  };
}

// Build a camera target for a rack anchor. Racks are wall-mounted in the
// landscape glb (the only one we ship now — see sceneVariant.ts), so the
// pull-back direction always points from the anchor toward room centre.
// The `variant` argument is kept on the signature so the call sites in
// App.tsx don't need to change; the framing rule itself is now identical
// across viewports.
export function projectCameraTarget(
  anchor: SceneAnchor,
  _variant: SceneVariant = "landscape",
): CameraTarget {
  const interiorDir = new Vector3(-anchor.position.x, 0, -anchor.position.z)
    .normalize();
  // Anchor at origin → fall back to facing the camera-side wall.
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
