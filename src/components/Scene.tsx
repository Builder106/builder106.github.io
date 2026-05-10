import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ServerRoom } from "@/scene/ServerRoom";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  type CameraTarget,
} from "@/scene/cameraRig";
import type { ClickTarget } from "@/scene/clickResolver";
import type { SceneAnchor } from "@/scene/anchors";
import { CameraRig } from "./CameraRig";

interface SceneProps {
  cameraTarget: CameraTarget | null;
  freezeOrbit: boolean;
  onSelect: (target: ClickTarget) => void;
  onAnchorsReady: (anchors: Map<string, SceneAnchor>) => void;
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
        <ServerRoom onAnchorsReady={onAnchorsReady} onSelect={onSelect} />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        target={DEFAULT_CAMERA_TARGET.toArray()}
        enablePan={false}
        enableZoom
        enableDamping={false}
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
