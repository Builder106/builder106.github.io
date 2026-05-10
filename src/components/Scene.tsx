import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3 } from "three";
import { ServerRoom } from "@/scene/ServerRoom";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  type CameraTarget,
} from "@/scene/cameraRig";
import type { ClickTarget } from "@/scene/clickResolver";
import type { SceneAnchor } from "@/scene/anchors";
import { CameraRig } from "./CameraRig";
import { useIsMobile } from "./useIsMobile";

// Pull the camera back and widen FOV on narrow / portrait viewports so
// the room actually fits in the frame on phones. Desktop landscape gets
// the original isometric vantage.
function ResponsiveCamera() {
  const { size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);

  const { position, fov } = useMemo(() => {
    if (aspect < 0.8) {
      // Portrait phone: pulled in close so racks are big enough to
      // tap, with a wider FOV so the scene still fits horizontally.
      return {
        position: new Vector3(6.5, 5, 6.5),
        fov: 60,
      };
    }
    if (aspect < 1.3) {
      // Squarish (tablet portrait, landscape phone).
      return {
        position: new Vector3(8, 6.2, 8),
        fov: 45,
      };
    }
    return { position: DEFAULT_CAMERA_POSITION.clone(), fov: 35 };
  }, [aspect]);

  return (
    <PerspectiveCamera
      makeDefault
      position={position.toArray()}
      fov={fov}
      near={0.1}
      far={100}
    />
  );
}

interface SceneProps {
  cameraTarget: CameraTarget | null;
  freezeOrbit: boolean;
  panelOpen: boolean;
  onSelect: (target: ClickTarget) => void;
  onAnchorsReady: (anchors: Map<string, SceneAnchor>) => void;
}

export function Scene({ cameraTarget, freezeOrbit, panelOpen, onSelect, onAnchorsReady }: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const isMobile = useIsMobile();

  return (
    <Canvas
      // Cap DPR so we don't shade 9x more pixels on a phone. Big perf
      // win on high-DPI screens where 1.5x and 2x already look great.
      dpr={isMobile ? [1, 1.25] : [1, 1.75]}
      // No mesh in this scene actually casts shadows — disable so the
      // shadow-map render pass + texture allocation are skipped.
      shadows={false}
      gl={{ antialias: !isMobile, alpha: false, powerPreference: "high-performance" }}
      style={{ background: "var(--bg-deep)" }}
      onPointerMissed={() => onSelect(null)}
    >
      <ResponsiveCamera />
      <Suspense fallback={null}>
        <ServerRoom
          onAnchorsReady={onAnchorsReady}
          onSelect={onSelect}
          panelOpen={panelOpen}
          isMobile={isMobile}
        />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        target={DEFAULT_CAMERA_TARGET.toArray()}
        enablePan
        enableZoom
        enableRotate
        enableDamping={false}
        minDistance={2.5}
        maxDistance={28}
        maxPolarAngle={Math.PI / 2.05}
        screenSpacePanning
        // Touch gesture mapping: 1 finger = rotate, 2 fingers = pan +
        // pinch-zoom. Without this drei sometimes uses the desktop
        // mapping (right-click pan) which doesn't translate.
        touches={{
          ONE: 0 /* THREE.TOUCH.ROTATE */,
          TWO: 2 /* THREE.TOUCH.DOLLY_PAN */,
        }}
        // Mouse mapping: left = orbit, middle = pan, right = pan.
        mouseButtons={{
          LEFT: 0 /* THREE.MOUSE.ROTATE */,
          MIDDLE: 1 /* THREE.MOUSE.DOLLY */,
          RIGHT: 2 /* THREE.MOUSE.PAN */,
        }}
      />
      <CameraRig
        target={cameraTarget}
        controlsRef={controlsRef}
        freeze={freezeOrbit}
      />
    </Canvas>
  );
}
