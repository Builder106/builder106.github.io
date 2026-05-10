import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ServerRoom } from "@/scene/ServerRoom";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  type CameraTarget,
} from "@/scene/cameraRig";
import { resolveClick, type ClickTarget } from "@/scene/clickResolver";
import { CameraRig } from "./CameraRig";

interface SceneProps {
  cameraTarget: CameraTarget | null;
  freezeOrbit: boolean;
  onSelect: (target: ClickTarget) => void;
  // Allows the parent (App) to receive a callback when the .glb's anchor
  // map is ready, so it can build CameraTargets from anchor IDs.
  onAnchorsReady: (anchors: Map<string, import("@/scene/anchors").SceneAnchor>) => void;
}

export function Scene({ cameraTarget, freezeOrbit, onSelect, onAnchorsReady }: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: "var(--bg-deep)" }}
      onPointerMissed={() => onSelect(null)}
    >
      <PerspectiveCamera
        makeDefault
        position={DEFAULT_CAMERA_POSITION.toArray()}
        fov={35}
        near={0.1}
        far={100}
      />
      <Suspense fallback={null}>
        <group
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            const hit = resolveClick(e.object);
            if (hit) onSelect(hit);
          }}
        >
          <ServerRoom onAnchorsReady={onAnchorsReady} />
        </group>
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        target={DEFAULT_CAMERA_TARGET.toArray()}
        enablePan={false}
        enableZoom
        minDistance={5}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
      />
      <CameraRig
        target={cameraTarget}
        controlsRef={controlsRef}
        freeze={freezeOrbit}
      />
    </Canvas>
  );
}
