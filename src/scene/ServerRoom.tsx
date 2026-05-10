import { useGLTF, Environment, useCursor } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AmbientLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from "three";
import { collectAnchors, type SceneAnchor } from "./anchors";
import { resolveClick, type ClickTarget } from "./clickResolver";

// The server room is modelled in Blender and exported as a single .glb.
// See docs/blender-contract.md for the export contract — anchor Empties
// named "anchor_<id>" are inside this scene and resolved at runtime by
// collectAnchors() in @/scene/anchors.ts.

const MODEL_URL = "/models/server-room.glb";

useGLTF.preload(MODEL_URL);

// Materials that should bypass ACES tonemapping so saturated cyan /
// magenta emission renders as the literal hex value rather than a
// chroma-compressed pastel. Screens, monitor, and every M_Cable_* one.
function isUntonedMaterial(name: string): boolean {
  return name === "M_Screen" || name === "M_Monitor" || name.startsWith("M_Cable_");
}

// Spotlight effect: while something is hovered, the hovered emissive
// brightens, every other emissive dims dramatically, and the runtime
// fill lights pull back so the rest of the room sinks into shadow.
const HOVER_INTENSITY_MULTIPLIER = 1.6;
const DIM_INTENSITY_MULTIPLIER = 0.35;  // non-hovered emissives this fraction of idle
const HOVER_TIME_CONSTANT = 0.07;       // ~210ms to 95% — Premium archetype.

// Light intensities mapped between idle and hover-dim states. Aim is a
// readable "lights-down" feel rather than a blackout — non-hovered racks
// should still be navigable, just clearly de-emphasised.
const LIGHTS = {
  hemi: { idle: 0.6, dim: 0.28 },
  ambient: { idle: 0.15, dim: 0.07 },
  pointKey: { idle: 1.4, dim: 0.55 },
  pointFillA: { idle: 0.9, dim: 0.36 },
  pointFillB: { idle: 0.8, dim: 0.32 },
  envIntensity: { idle: 0.25, dim: 0.12 },
};

interface Interactive {
  mat: MeshStandardMaterial;
  base: number;
  hover: number;
  dim: number;
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
  const { scene: rootScene } = useThree();
  const sentAnchorsRef = useRef(false);
  const interactivesRef = useRef<Interactive[]>([]);
  const [hover, setHover] = useState<ClickTarget>(null);

  // Light refs so we can lerp intensities each frame.
  const hemiRef = useRef<HemisphereLight | null>(null);
  const ambientRef = useRef<AmbientLight | null>(null);
  const keyRef = useRef<PointLight | null>(null);
  const fillARef = useRef<PointLight | null>(null);
  const fillBRef = useRef<PointLight | null>(null);

  useCursor(hover !== null);

  useLayoutEffect(() => {
    // Walk the loaded scene once: clone each emissive material per-mesh
    // so we can mutate emission intensity independently. Disable ACES
    // tonemapping on the clones so cyan stays cyan.
    const interactives: Interactive[] = [];
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const mat = obj.material;
      if (!(mat instanceof MeshStandardMaterial)) return;
      if (!isUntonedMaterial(mat.name)) return;

      const cloned = mat.clone();
      cloned.toneMapped = false;
      obj.material = cloned;

      const key = hoverKeyForMesh(obj.name);
      // Cables stay always-bright; only screens/monitor are interactive.
      // For the others we still set toneMapped=false above and bail here.
      if (key === null) return;

      const base = cloned.emissiveIntensity ?? 1.0;
      interactives.push({
        mat: cloned,
        base,
        hover: base * HOVER_INTENSITY_MULTIPLIER,
        dim: base * DIM_INTENSITY_MULTIPLIER,
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

  // Smoothly lerp emission intensities and runtime light intensities each
  // frame. Time-constant-based smoothing is frame-rate independent.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta / HOVER_TIME_CONSTANT);
    const isHovering = hover !== null;
    const activeKey = hoverKeyForState(hover);

    // Per-emissive-material targets.
    for (const it of interactivesRef.current) {
      let target: number;
      if (it.hoverKey === activeKey) target = it.hover;
      else if (isHovering) target = it.dim;
      else target = it.base;
      it.current += (target - it.current) * k;
      it.mat.emissiveIntensity = it.current;
    }

    // Runtime fill / key lights pull back when hovering.
    const lerpLight = (
      light: { intensity: number } | null,
      idle: number,
      dim: number,
    ) => {
      if (!light) return;
      const t = isHovering ? dim : idle;
      light.intensity += (t - light.intensity) * k;
    };
    lerpLight(hemiRef.current, LIGHTS.hemi.idle, LIGHTS.hemi.dim);
    lerpLight(ambientRef.current, LIGHTS.ambient.idle, LIGHTS.ambient.dim);
    lerpLight(keyRef.current, LIGHTS.pointKey.idle, LIGHTS.pointKey.dim);
    lerpLight(fillARef.current, LIGHTS.pointFillA.idle, LIGHTS.pointFillA.dim);
    lerpLight(fillBRef.current, LIGHTS.pointFillB.idle, LIGHTS.pointFillB.dim);

    // Environment intensity is a Scene property; lerp it too.
    const envTarget = isHovering ? LIGHTS.envIntensity.dim : LIGHTS.envIntensity.idle;
    rootScene.environmentIntensity += (envTarget - rootScene.environmentIntensity) * k;
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

      {/* Soft hemisphere fill so metallic surfaces have something to
          reflect. Intensities animate down when something is hovered. */}
      <hemisphereLight
        ref={hemiRef}
        args={["#3a4a7a", "#0a0a14", LIGHTS.hemi.idle]}
      />
      <ambientLight ref={ambientRef} intensity={LIGHTS.ambient.idle} color="#1a1f3a" />

      {/* Three colored key lights echo the neon palette. */}
      <pointLight
        ref={keyRef}
        position={[0, 5, 0]}
        intensity={LIGHTS.pointKey.idle}
        color="#4cf2ff"
        distance={16}
      />
      <pointLight
        ref={fillARef}
        position={[-4, 3, 4]}
        intensity={LIGHTS.pointFillA.idle}
        color="#ff4cf2"
        distance={10}
      />
      <pointLight
        ref={fillBRef}
        position={[5, 3, -4]}
        intensity={LIGHTS.pointFillB.idle}
        color="#ffb84c"
        distance={10}
      />

      <Environment
        preset="warehouse"
        environmentIntensity={LIGHTS.envIntensity.idle}
        background={false}
      />
    </group>
  );
}
