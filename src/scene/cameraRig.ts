import { Vector3 } from "three";
import { type SceneAnchor } from "./anchors";
import { type SceneVariant } from "./sceneVariant";

// Default isometric vantage. Looking at the origin from the front-right,
// pulled back enough to fit a ~14x14 unit room. Y is up (Three.js space).
// The analyst cluster lives on the left wall's back half so all nine
// racks fit inside the 35° vertical FOV at this distance.
export const DEFAULT_CAMERA_POSITION = new Vector3(8, 6, 8);
export const DEFAULT_CAMERA_TARGET = new Vector3(0, 1, 0);

// Portrait variant: elevated 3/4 vantage that frames the tiered amphitheater
// (quant front, swe mid, research back). Camera pulled farther back + higher
// than the Blender blockout's coordinates because real-device portrait
// viewports run as narrow as ~0.4 aspect, narrower than the 9:16 = 0.5625
// the blockout was authored against. Pivot sits between the front and mid
// tiers so OrbitControls rotation keeps all three tiers in view.
export const PORTRAIT_CAMERA_POSITION = new Vector3(0, 6.0, 10.5);
export const PORTRAIT_CAMERA_TARGET = new Vector3(0, 1.8, -0.5);

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

// Build a camera target for a rack anchor. The pull-back direction depends
// on the scene variant:
//   - landscape: racks are wall-mounted, so step from the anchor toward
//     room centre — the camera ends up between the wall and the centre.
//   - portrait: every rack faces +Z (toward the camera). Step back along
//     +Z so the camera lands in front of the rack rather than behind it.
export function projectCameraTarget(
  anchor: SceneAnchor,
  variant: SceneVariant = "landscape",
): CameraTarget {
  let interiorDir: Vector3;
  if (variant === "portrait") {
    interiorDir = new Vector3(0, 0, 1);
  } else {
    interiorDir = new Vector3(-anchor.position.x, 0, -anchor.position.z)
      .normalize();
    // Anchor at origin → fall back to facing the camera-side wall.
    if (interiorDir.lengthSq() < 0.0001) interiorDir.set(0, 0, 1);
  }

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
