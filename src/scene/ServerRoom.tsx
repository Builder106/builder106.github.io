import { useGLTF, Environment } from "@react-three/drei";
import { useLayoutEffect } from "react";
import { Mesh, MeshStandardMaterial } from "three";
import { collectAnchors, type SceneAnchor } from "./anchors";

// The server room is modelled in Blender and exported as a single .glb.
// See docs/blender-contract.md for the export contract — anchor Empties
// named "anchor.<id>" are inside this scene and resolved at runtime by
// collectAnchors() in @/scene/anchors.ts.

const MODEL_URL = "/models/server-room.glb";

useGLTF.preload(MODEL_URL);

const UNTONED_MATERIALS = new Set(["M_Screen", "M_Monitor"]);

interface ServerRoomProps {
  onAnchorsReady?: (anchors: Map<string, SceneAnchor>) => void;
}

export function ServerRoom({ onAnchorsReady }: ServerRoomProps) {
  const { scene } = useGLTF(MODEL_URL);

  useLayoutEffect(() => {
    // Walk the loaded scene once: opt emissive screens out of ACES
    // tonemapping (so cyan stays cyan) and harvest the anchor Empties.
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const mat = obj.material;
        if (mat instanceof MeshStandardMaterial && UNTONED_MATERIALS.has(mat.name)) {
          mat.toneMapped = false;
        }
      }
    });

    if (onAnchorsReady) {
      onAnchorsReady(collectAnchors(scene));
    }
  }, [scene, onAnchorsReady]);

  return (
    <group>
      <primitive object={scene} />

      {/* Soft hemisphere fill so metallic surfaces (racks, desk, floor) have
          something to reflect. The .glb ships without lights on purpose;
          all runtime lighting lives here. */}
      <hemisphereLight args={["#3a4a7a", "#0a0a14", 0.6]} />
      <ambientLight intensity={0.15} color="#1a1f3a" />

      {/* Three colored key lights echo the neon palette and give the dark
          metals defined highlights from different angles. */}
      <pointLight position={[0, 5, 0]} intensity={1.4} color="#4cf2ff" distance={16} />
      <pointLight position={[-4, 3, 4]} intensity={0.9} color="#ff4cf2" distance={10} />
      <pointLight position={[5, 3, -4]} intensity={0.8} color="#ffb84c" distance={10} />

      {/* Low-intensity HDRI for specular reflections on the metallic rack
          bodies. "warehouse" reads as cool industrial — closer to the
          intended server-room mood than "city" or "lobby". */}
      <Environment preset="warehouse" environmentIntensity={0.25} background={false} />
    </group>
  );
}
