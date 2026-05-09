import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense } from "react";
import { ServerRoom } from "@/scene/ServerRoom";
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "@/scene/cameraRig";

interface SceneProps {
  // Once panel-pinning is wired we'll lift this to a parent and pass anchors out.
  // For now the scene is self-contained.
  paused?: boolean;
}

export function Scene({ paused = false }: SceneProps) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: "var(--bg-deep)" }}
      frameloop={paused ? "demand" : "always"}
    >
      <PerspectiveCamera
        makeDefault
        position={DEFAULT_CAMERA_POSITION.toArray()}
        fov={35}
        near={0.1}
        far={100}
      />
      <Suspense fallback={null}>
        <ServerRoom />
      </Suspense>
      <OrbitControls
        target={DEFAULT_CAMERA_TARGET.toArray()}
        enablePan={false}
        enableZoom
        minDistance={5}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
