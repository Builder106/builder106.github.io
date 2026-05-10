import { useGLTF, Environment, useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mesh, MeshStandardMaterial } from "three";
import { collectAnchors, type SceneAnchor } from "./anchors";
import { resolveClick, type ClickTarget } from "./clickResolver";

// The server room is modelled in Blender and exported as a single .glb.
// See docs/blender-contract.md for the export contract — anchor Empties
// named "anchor_<id>" are inside this scene and resolved at runtime by
// collectAnchors() in @/scene/anchors.ts.

const MODEL_URL = "/models/server-room.glb";

useGLTF.preload(MODEL_URL);

const UNTONED_MATERIAL_NAMES = new Set(["M_Screen", "M_Monitor"]);

// On hover the screen of the targeted project (or the central monitor)
// brightens by this multiplier. Premium-feel motion: ~180ms 95% rise.
const HOVER_INTENSITY_MULTIPLIER = 1.8;
const HOVER_TIME_CONSTANT = 0.06;

// Per-mesh state for the emission lerp. We clone the shared M_Screen and
// M_Monitor materials so each emissive surface can be addressed separately.
interface Interactive {
  mat: MeshStandardMaterial;
  base: number;
  hover: number;
  current: number;
  hoverKey: string; // "project:<id>" or "terminal"
}

function hoverKeyForState(state: ClickTarget): string | null {
  if (state === null) return null;
  if (state.kind === "terminal") return "terminal";
  return `project:${state.projectId}`;
}

function hoverKeyForMesh(name: string): string | null {
  const m = name.match(/^Screen_(.+)$/);
  if (m) return `project:${m[1]}`;
  if (name === "Monitor") return "terminal";
  return null;
}

interface ServerRoomProps {
  onAnchorsReady?: (anchors: Map<string, SceneAnchor>) => void;
  onSelect?: (target: ClickTarget) => void;
}

export function ServerRoom({ onAnchorsReady, onSelect }: ServerRoomProps) {
  const { scene } = useGLTF(MODEL_URL);
  const sentAnchorsRef = useRef(false);
  const interactivesRef = useRef<Interactive[]>([]);
  const [hover, setHover] = useState<ClickTarget>(null);

  useCursor(hover !== null);

  useLayoutEffect(() => {
    // Walk the loaded scene once: clone each emissive material per-mesh so
    // we can mutate emission intensity independently on hover, and turn
    // off ACES tonemapping on those clones so cyan stays cyan.
    const interactives: Interactive[] = [];
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const mat = obj.material;
      if (!(mat instanceof MeshStandardMaterial)) return;
      if (!UNTONED_MATERIAL_NAMES.has(mat.name)) return;

      const cloned = mat.clone();
      cloned.toneMapped = false;
      obj.material = cloned;

      const key = hoverKeyForMesh(obj.name);
      if (key === null) return;

      const base = cloned.emissiveIntensity ?? 1.0;
      interactives.push({
        mat: cloned,
        base,
        hover: base * HOVER_INTENSITY_MULTIPLIER,
        current: base,
        hoverKey: key,
      });
    });
    interactivesRef.current = interactives;
  }, [scene]);

  useEffect(() => {
    if (sentAnchorsRef.current || !onAnchorsReady) return;
    sentAnchorsRef.current = true;
    onAnchorsReady(collectAnchors(scene));
  }, [scene, onAnchorsReady]);

  // Smoothly lerp each interactive's emission intensity toward its
  // current target (hovered or idle) every frame. Time-constant-based
  // smoothing is frame-rate independent.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta / HOVER_TIME_CONSTANT);
    const activeKey = hoverKeyForState(hover);
    for (const it of interactivesRef.current) {
      const target = it.hoverKey === activeKey ? it.hover : it.base;
      it.current += (target - it.current) * k;
      it.mat.emissiveIntensity = it.current;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const hit = resolveClick(e.object);
    if (hit && onSelect) onSelect(hit);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(resolveClick(e.object));
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(null);
  };

  return (
    <group>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

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
