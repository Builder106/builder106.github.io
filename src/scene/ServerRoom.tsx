import { useGLTF } from "@react-three/drei";

// The server room is modelled in Blender and exported as a single .glb.
// See docs/blender-contract.md for the export contract — anchor Empties
// named "anchor.<id>" are inside this scene and resolved at runtime by
// collectAnchors() in @/scene/anchors.ts.

const MODEL_URL = "/models/server-room.glb";

// Pre-load so the model fetch starts as soon as the app boots, in parallel
// with the boot-sequence animation. By the time the user finishes the
// terminal-style intro, the .glb is usually already cached.
useGLTF.preload(MODEL_URL);

export function ServerRoom() {
  const { scene } = useGLTF(MODEL_URL);

  return (
    <group>
      <primitive object={scene} />

      {/* Runtime lights — the .glb ships without lights, on purpose. The
          scene's emissive screens carry most of the visual weight; these
          three small lights add subtle highlights on the metallic surfaces
          so the room reads as 3D instead of flat. */}
      <ambientLight intensity={0.25} color="#1a1f3a" />
      <pointLight position={[0, 5, 0]} intensity={1.2} color="#4cf2ff" distance={14} />
      <pointLight position={[-5, 3, 4]} intensity={0.8} color="#ff4cf2" distance={10} />
      <pointLight position={[5, 3, -4]} intensity={0.7} color="#ffb84c" distance={10} />
    </group>
  );
}
