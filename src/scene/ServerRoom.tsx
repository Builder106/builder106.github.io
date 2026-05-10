import { useGLTF, Environment, useCursor } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AmbientLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  type ShaderMaterial,
} from "three";
import { collectAnchors, type SceneAnchor } from "./anchors";
import { resolveClick, type ClickTarget } from "./clickResolver";
import { createSwarmMaterial, type SwarmUniforms } from "./swarmShader";

const MODEL_URL = "/models/server-room.glb";

useGLTF.preload(MODEL_URL);

// Materials whose emission should bypass ACES tonemapping.
function isUntonedMaterial(name: string): boolean {
  return name === "M_Screen" || name.startsWith("M_Cable_");
}

// Hover behavior tuning.
const HOVER_INTENSITY_MULTIPLIER = 1.6;
const DIM_INTENSITY_MULTIPLIER = 0.35;
const HOVER_TIME_CONSTANT = 0.07;

const LIGHTS = {
  hemi:        { idle: 0.6,  dim: 0.28 },
  ambient:     { idle: 0.15, dim: 0.07 },
  pointKey:    { idle: 1.4,  dim: 0.55 },
  pointFillA:  { idle: 0.9,  dim: 0.36 },
  pointFillB:  { idle: 0.8,  dim: 0.32 },
  envIntensity:{ idle: 0.25, dim: 0.12 },
};

interface Interactive {
  mat: MeshStandardMaterial;
  base: number;
  hover: number;
  dim: number;
  current: number;
  hoverKey: string;
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
  // The curved monitor is rendered with a custom GLSL shader (see
  // swarmShader.ts). Its uniforms are mutated each frame instead of
  // going through the standard Principled-BSDF path.
  const monitorShaderRef = useRef<(ShaderMaterial & { uniforms: SwarmUniforms }) | null>(null);
  const [hover, setHover] = useState<ClickTarget>(null);

  const hemiRef = useRef<HemisphereLight | null>(null);
  const ambientRef = useRef<AmbientLight | null>(null);
  const keyRef = useRef<PointLight | null>(null);
  const fillARef = useRef<PointLight | null>(null);
  const fillBRef = useRef<PointLight | null>(null);

  useCursor(hover !== null);

  useLayoutEffect(() => {
    const interactives: Interactive[] = [];
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;

      // The Monitor mesh gets the swarm shader, replacing its baked
      // M_Monitor material entirely. From here on it's hover-driven
      // through uniforms, not emissionIntensity.
      if (obj.name === "Monitor") {
        const swarmMat = createSwarmMaterial();
        obj.material = swarmMat;
        monitorShaderRef.current = swarmMat;
        return;
      }

      const mat = obj.material;
      if (!(mat instanceof MeshStandardMaterial)) return;
      if (!isUntonedMaterial(mat.name)) return;

      // Clone so per-mesh emission lerps don't leak.
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

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta / HOVER_TIME_CONSTANT);
    const isHovering = hover !== null;
    const activeKey = hoverKeyForState(hover);

    // Per-emissive-material targets (rack screens).
    for (const it of interactivesRef.current) {
      let target: number;
      if (it.hoverKey === activeKey) target = it.hover;
      else if (isHovering) target = it.dim;
      else target = it.base;
      it.current += (target - it.current) * k;
      it.mat.emissiveIntensity = it.current;
    }

    // Runtime fill / key lights.
    const lerpLight = (
      light: { intensity: number } | null,
      idle: number,
      dim: number,
    ) => {
      if (!light) return;
      const t = isHovering ? dim : idle;
      light.intensity += (t - light.intensity) * k;
    };
    lerpLight(hemiRef.current,    LIGHTS.hemi.idle,        LIGHTS.hemi.dim);
    lerpLight(ambientRef.current, LIGHTS.ambient.idle,     LIGHTS.ambient.dim);
    lerpLight(keyRef.current,     LIGHTS.pointKey.idle,    LIGHTS.pointKey.dim);
    lerpLight(fillARef.current,   LIGHTS.pointFillA.idle,  LIGHTS.pointFillA.dim);
    lerpLight(fillBRef.current,   LIGHTS.pointFillB.idle,  LIGHTS.pointFillB.dim);

    const envTarget = isHovering ? LIGHTS.envIntensity.dim : LIGHTS.envIntensity.idle;
    rootScene.environmentIntensity += (envTarget - rootScene.environmentIntensity) * k;

    // Curved-monitor swarm shader. Always runs (uTime advances every
    // frame); uHover boosts it when this monitor is the hover target,
    // uDim pulls it down when a different panel is hovered.
    const shader = monitorShaderRef.current;
    if (shader) {
      shader.uniforms.uTime.value += delta;
      const hoverTarget = activeKey === "terminal" ? 1 : 0;
      const dimTarget = isHovering && activeKey !== "terminal" ? 1 : 0;
      shader.uniforms.uHover.value += (hoverTarget - shader.uniforms.uHover.value) * k;
      shader.uniforms.uDim.value += (dimTarget - shader.uniforms.uDim.value) * k;
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

      <hemisphereLight
        ref={hemiRef}
        args={["#3a4a7a", "#0a0a14", LIGHTS.hemi.idle]}
      />
      <ambientLight ref={ambientRef} intensity={LIGHTS.ambient.idle} color="#1a1f3a" />

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
