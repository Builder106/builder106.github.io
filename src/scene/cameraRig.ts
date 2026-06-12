import { Vector3 } from "three";
import { type SceneAnchor } from "./anchors";
import { type SceneVariant } from "./sceneVariant";

// Default isometric vantage. Looking at the origin from the front-right,
// pulled back + up enough to fit the full four-wall room. Y is up (Three.js
// space). The +Z front wall now holds the AI/ML wing, so the camera sits
// further out on +Z and a little higher than the original (8,6,8): the
// extra height tilts the view down so the front-wall racks read in the
// lower foreground while quant (back) + the side wings stay in frame.
export const DEFAULT_CAMERA_POSITION = new Vector3(7, 6, 13);
export const DEFAULT_CAMERA_TARGET = new Vector3(0.3, 1.1, 0);

// Portrait variant: the scene is procedurally re-laid into a two-row
// aisle by ServerRoom.applyAisleLayout — each project rack on the left
// (x=-AISLE_HALF_WIDTH) facing +X, a mirrored clone on the right facing
// -X, terminal desk straddling the corridor centre. Camera sits dead-
// centre in the corridor at roughly head height with a gentle downward
// pitch. We don't need the asymmetric X offset the single-row layout
// required — the symmetric rack pairs naturally break the look-vector
// occlusion that flattened the previous static-frame view.
export const PORTRAIT_CAMERA_POSITION = new Vector3(0, 3.4, 8.5);
export const PORTRAIT_CAMERA_TARGET = new Vector3(0, 0.4, -8.0);

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

// Build a camera target for a rack anchor. Pull-back direction depends
// on the scene variant:
//   - landscape: racks are wall-mounted, so step from the anchor toward
//     room centre — the camera ends up between the wall and the centre.
//   - portrait: the aisle layout (ServerRoom.applyAisleLayout) rotates
//     every rack to face +Z, so step back along +Z to land in front of
//     the rack rather than behind it.
export function projectCameraTarget(
  anchor: SceneAnchor,
  variant: SceneVariant = "landscape",
): CameraTarget {
  let interiorDir: Vector3;
  if (variant === "portrait") {
    interiorDir = new Vector3(0, 0, 1);
  } else if (anchor.position.z > 4.7) {
    // AI/ML front-wing racks face the entrance (+Z) rather than the room
    // interior, so the camera must approach from OUTSIDE (+Z) to frame the
    // rack face — stepping toward room centre would land it behind the screen.
    interiorDir = new Vector3(0, 0, 1);
  } else {
    interiorDir = new Vector3(-anchor.position.x, 0, -anchor.position.z)
      .normalize();
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
