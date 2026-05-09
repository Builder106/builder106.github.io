import { Vector3 } from "three";

// Default isometric vantage. Looking at the origin from the front-right,
// pulled back enough to fit a ~10x10x4 unit room. Tweak after first Blender
// export — these numbers are placeholders for the stand-in geometry.
export const DEFAULT_CAMERA_POSITION = new Vector3(8, 6, 8);
export const DEFAULT_CAMERA_TARGET = new Vector3(0, 1, 0);

// When flying to an anchor we offset slightly so the camera frames the
// anchor instead of sitting on top of it.
export const ANCHOR_CAMERA_OFFSET = new Vector3(2.5, 1.8, 2.5);

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

export function anchorCameraTarget(anchor: Vector3): CameraTarget {
  return {
    position: anchor.clone().add(ANCHOR_CAMERA_OFFSET),
    lookAt: anchor.clone(),
  };
}
