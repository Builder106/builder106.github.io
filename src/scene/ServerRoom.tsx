import { useGLTF, useCursor, Html, MeshReflectorMaterial, Grid } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  type ShaderMaterial,
} from "three";
import { collectAnchors, type SceneAnchor } from "./anchors";
import { resolveClick, type ClickTarget } from "./clickResolver";
import { createSwarmMaterial, type SwarmUniforms } from "./swarmShader";
import { projects } from "@/data/projects";

const MODEL_URL = "/models/server-room.glb";

useGLTF.preload(MODEL_URL);

// Materials whose emission should bypass ACES tonemapping.
function isUntonedMaterial(name: string): boolean {
  return (
    name === "M_Screen" ||
    name.startsWith("M_Cable_") ||
    name.startsWith("M_StatusLED_")
  );
}

// Hover behavior tuning.
const HOVER_INTENSITY_MULTIPLIER = 1.6;
const DIM_INTENSITY_MULTIPLIER = 0.35;
const HOVER_TIME_CONSTANT = 0.07;

// Bright fluorescent-quality lighting designed to light dark
// concept-art surfaces enough that they actually read. Intensities
// pushed ~30% above the prior baseline because dark-blue base colors
// reflect only a small fraction of incident light per channel.
const LIGHTS = {
  hemi:        { idle: 2.2,  dim: 1.10 },
  ambient:     { idle: 0.95, dim: 0.45 },
  pointKey:    { idle: 1.2,  dim: 0.55 },   // central cyan accent
  topDown:     { idle: 3.4,  dim: 1.70 },
  ceilingGrid: { idle: 8.0,  dim: 3.6 },
};

// Four ceiling light positions in a symmetric grid above the room.
// Same height (4.4m), even spread so coverage is uniform left-to-right
// and front-to-back rather than biased to one corner.
const CEILING_LIGHTS = [
  [-3.5, 4.4, -3.5],
  [ 3.5, 4.4, -3.5],
  [-3.5, 4.4,  3.5],
  [ 3.5, 4.4,  3.5],
] as const;

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
  panelOpen?: boolean;
}

export function ServerRoom({ onAnchorsReady, onSelect, panelOpen }: ServerRoomProps) {
  const { scene } = useGLTF(MODEL_URL);
  const { scene: rootScene } = useThree();
  const sentAnchorsRef = useRef(false);
  const interactivesRef = useRef<Interactive[]>([]);
  const monitorShaderRef = useRef<(ShaderMaterial & { uniforms: SwarmUniforms }) | null>(null);
  const [hover, setHover] = useState<ClickTarget>(null);
  const [anchorMap, setAnchorMap] = useState<Map<string, SceneAnchor>>(new Map());

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), []);

  const hemiRef = useRef<HemisphereLight | null>(null);
  const ambientRef = useRef<AmbientLight | null>(null);
  const keyRef = useRef<PointLight | null>(null);
  const topDownRef = useRef<DirectionalLight | null>(null);
  const ceilingRefs = useRef<(PointLight | null)[]>([null, null, null, null]);

  useCursor(hover !== null);

  useLayoutEffect(() => {
    const interactives: Interactive[] = [];
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;

      // The static glb floor is hidden — a separate JSX <mesh> with
      // MeshReflectorMaterial (below) renders the reflective floor
      // instead, so the racks and cables actually mirror onto it.
      if (obj.name === "Floor") {
        obj.visible = false;
        return;
      }

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
    const collected = collectAnchors(scene);
    setAnchorMap(collected);
    onAnchorsReady(collected);
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
    lerpLight(topDownRef.current, LIGHTS.topDown.idle,     LIGHTS.topDown.dim);
    for (const ceil of ceilingRefs.current) {
      lerpLight(ceil, LIGHTS.ceilingGrid.idle, LIGHTS.ceilingGrid.dim);
    }

    // No HDRI environment — its directional cast was bleeding into
    // the reflective floor. Force scene.environmentIntensity to 0.
    rootScene.environmentIntensity = 0;

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

      {/* Bright fluorescent-quality overhead lighting tinted slightly
          cool. Hemisphere top is near-white, ground is mid-grey so
          shadow areas catch some bounce instead of going pitch black.
          Boosted intensities so the dark concept-art surfaces actually
          read clearly. */}
      <hemisphereLight
        ref={hemiRef}
        args={["#d4dbe8", "#525870", LIGHTS.hemi.idle]}
      />
      <ambientLight ref={ambientRef} intensity={LIGHTS.ambient.idle} color="#8a93a6" />

      {/* Central cyan accent — the only colored light, motivated by
          the screens it lives among. */}
      <pointLight
        ref={keyRef}
        position={[0, 5, 0]}
        intensity={LIGHTS.pointKey.idle}
        color="#4cf2ff"
        distance={14}
      />

      {/* Top-down directional light — parallel rays from straight
          overhead. No distance falloff means uniform brightness
          across the entire floor and rack tops. This is what
          actually makes the room read as "evenly lit from above". */}
      <directionalLight
        ref={topDownRef}
        position={[0, 10, 0]}
        intensity={LIGHTS.topDown.idle}
        color="#dde4f5"
      />

      {/* 2x2 ceiling-panel grid for additional local highlights. */}
      {CEILING_LIGHTS.map((pos, i) => (
        <pointLight
          key={i}
          ref={(el) => { ceilingRefs.current[i] = el; }}
          position={pos}
          intensity={LIGHTS.ceilingGrid.idle}
          color="#cfd8f5"
          distance={12}
          decay={1.4}
        />
      ))}

      {/* HDRI environment removed: its directional cast was being
          mirrored by the reflective floor as a bright right-side
          gradient. Without it, the floor reflects only the actual
          symmetric scene geometry (racks, cables, monitor) and reads
          evenly. Metallic specular highlights now come purely from
          the four ceiling lights + the central cyan key. */}

      {/* Polished dark floor — concept-art palette, lit by the bright
          overhead fluorescents above. Reads as glossy dark concrete
          / polished tile rather than office vinyl. Soft real-time
          reflection picks up the rack LED bars and the ceiling
          lights. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          mixBlur={1.0}
          mixStrength={1.4}
          resolution={1024}
          mirror={0.5}
          mixContrast={1.0}
          depthScale={1.0}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.5}
          color="#1a1d2e"
          metalness={0.55}
          roughness={0.4}
        />
      </mesh>

      {/* 1m floor tile grid sitting just above the reflective surface.
          Datacenter-floor read; the section lines every 4m mark the
          larger panels. Faded out toward the room edges so it doesn't
          feel like a flat geometric overlay. */}
      <Grid
        position={[0, 0.005, 0]}
        args={[14, 14]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#3d4258"
        sectionSize={4}
        sectionThickness={1.0}
        sectionColor="#5a607a"
        fadeDistance={11}
        fadeStrength={1.4}
        infiniteGrid={false}
        side={2}  // DoubleSide so it shows from both faces if camera dips
      />

      {/* Engraved-style nameplate on the front face of the desk.
          Same idle visibility rule as the rack callouts. */}
      {!panelOpen && (
        <Html
          position={[0, 0.55, 3.105]}
          center
          rotation={[0, 0, 0]}
          distanceFactor={4.2}
          zIndexRange={[0, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="desk-nameplate">Olayinka David Vaughan</div>
        </Html>
      )}

      {/* Floating callout labels above each rack + the central monitor.
          Each label is a clickable shortcut that triggers the same
          ClickTarget the underlying mesh would. Tap-friendly target on
          phones; doesn't hurt desktop. Hidden while a panel is open so
          the panel content owns the screen. */}
      {!panelOpen && Array.from(anchorMap.entries()).map(([id, anchor]) => {
        if (id === "terminal") {
          return (
            <Html
              key={id}
              position={[0, 2.55, anchor.position.z - 0.7]}
              center
              distanceFactor={9}
              zIndexRange={[0, 0]}
              style={{ userSelect: "none" }}
            >
              <button
                type="button"
                className="rack-label rack-label--terminal"
                onClick={() => onSelect?.({ kind: "terminal" })}
              >
                <span className="rack-label__name">trading_terminal</span>
                <span className="rack-label__cluster">// quant</span>
              </button>
            </Html>
          );
        }
        const project = projectsById.get(id);
        if (!project) return null;
        return (
          <Html
            key={id}
            position={[anchor.position.x, anchor.position.y + 1.7, anchor.position.z]}
            center
            distanceFactor={9}
            zIndexRange={[0, 0]}
            style={{ userSelect: "none" }}
          >
            <button
              type="button"
              className="rack-label"
              onClick={() => onSelect?.({ kind: "project", projectId: id })}
            >
              <span className="rack-label__name">{project.name}</span>
              <span className="rack-label__cluster">// {project.cluster}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}
