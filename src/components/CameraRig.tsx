import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { type CameraTarget, defaultCameraTarget } from "@/scene/cameraRig";

interface CameraRigProps {
  target: CameraTarget | null;
  // Ref to the OrbitControls instance so we can lerp its target alongside
  // the camera. The controls component (drei) populates this for us.
  controlsRef: React.RefObject<{
    target: Vector3;
    update: () => void;
    enabled: boolean;
  } | null>;
  // While a target panel is open we lock orbit so the user doesn't fight
  // the camera.
  freeze: boolean;
}

// Frame-rate-independent lerp factor: at 60fps with smoothing=0.001 we
// converge in ~150 ms. Lower values = snappier, higher = more drift.
const SMOOTHING = 0.0015;

export function CameraRig({ target, controlsRef, freeze }: CameraRigProps) {
  const { camera } = useThree();
  // Resolve the actual target each frame; null means "go home".
  const home = useRef(defaultCameraTarget());

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (ctrl) ctrl.enabled = !freeze;

    // No target = user-controlled state. Don't lerp; let OrbitControls
    // own the camera so the user can orbit / pan / zoom freely without
    // the rig fighting them every frame.
    if (target === null) return;

    const k = 1 - Math.pow(SMOOTHING, delta);
    camera.position.lerp(target.position, k);

    if (ctrl) {
      ctrl.target.lerp(target.lookAt, k);
      ctrl.update();
    } else {
      camera.lookAt(target.lookAt);
    }
  });

  // Suppress unused-variable warning for home — kept for API stability
  // in case we want to re-engage default-target lerping later.
  void home;

  return null;
}
