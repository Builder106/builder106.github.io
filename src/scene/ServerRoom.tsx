import { Image, useGLTF, useCursor, Html, MeshReflectorMaterial, Grid, Stars } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  Color,
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

// Deterministic 32-bit hash over a string. Used so the per-LED random
// pattern is stable across reloads — same input → same colour / dim
// state. (xmur3-derived; small, fast, no collisions for our 72 keys.)
function strHash(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

// Parse "StatusLED_<projectId>_r<row>_c<col>" → projectId, or null
// if the mesh name isn't a rack LED.
function ledProjectId(name: string): string | null {
  const m = name.match(/^StatusLED_(.+?)_r\d+_c\d+$/);
  return m ? m[1] : null;
}

// Tiny seeded RNG so the distant-rack layout is stable across reloads.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DistantRacksProps {
  isMobile: boolean;
}

// Scatters short, slightly emissive rack-shaped pillars in a wide ring
// outside the main room. The fog kills most of them; what survives is
// the tiny glow at the top of each rack, reading as far-off cabinets
// in a much bigger data hall.
function DistantRacks({ isMobile }: DistantRacksProps) {
  const racks = useMemo(() => {
    const rng = mulberry32(0xCAFE_BABE);
    const count = isMobile ? 24 : 64;
    const out: { pos: [number, number, number]; rot: number; color: string }[] = [];
    const palette = ["#4cf2ff", "#f29100", "#10b981", "#ff5b3c", "#ffb347", "#84cc16"];
    for (let i = 0; i < count; i++) {
      const r = 22 + rng() * 28;             // 22–50m from origin
      const theta = rng() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      // Skip anything that lands inside the room footprint.
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      out.push({
        pos: [x, 1.4 + rng() * 0.4, z],
        rot: rng() * Math.PI,
        color: palette[(i + Math.floor(rng() * palette.length)) % palette.length],
      });
    }
    return out;
  }, [isMobile]);

  return (
    <group>
      {racks.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={[0, r.rot, 0]}>
          <boxGeometry args={[1, 2.8, 0.6]} />
          <meshStandardMaterial
            color="#08090d"
            emissive={r.color}
            emissiveIntensity={0.45}
            toneMapped={false}
            roughness={0.85}
            metalness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

interface ServerRoomProps {
  onAnchorsReady?: (anchors: Map<string, SceneAnchor>) => void;
  onSelect?: (target: ClickTarget) => void;
  panelOpen?: boolean;
  isMobile?: boolean;
}

export function ServerRoom({ onAnchorsReady, onSelect, panelOpen, isMobile = false }: ServerRoomProps) {
  const { scene } = useGLTF(MODEL_URL);
  const { scene: rootScene } = useThree();
  const sentAnchorsRef = useRef(false);
  const interactivesRef = useRef<Interactive[]>([]);
  const monitorShaderRef = useRef<(ShaderMaterial & { uniforms: SwarmUniforms }) | null>(null);
  const [hover, setHover] = useState<ClickTarget>(null);
  const [anchorMap, setAnchorMap] = useState<Map<string, SceneAnchor>>(new Map());

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), []);

  // Mobile-adjusted light intensities. We compensate for the dropped
  // ceiling-grid lights by boosting the remaining top-down sources;
  // the hover-spotlight lerp uses these so the brighter idle isn't
  // undone every frame.
  const lightLevels = useMemo(() => {
    const m = isMobile;
    return {
      hemi:    { idle: LIGHTS.hemi.idle    * (m ? 1.45 : 1), dim: LIGHTS.hemi.dim    * (m ? 1.45 : 1) },
      ambient: { idle: LIGHTS.ambient.idle * (m ? 1.40 : 1), dim: LIGHTS.ambient.dim * (m ? 1.40 : 1) },
      key:     { idle: LIGHTS.pointKey.idle,                  dim: LIGHTS.pointKey.dim },
      topDown: { idle: LIGHTS.topDown.idle * (m ? 1.50 : 1),  dim: LIGHTS.topDown.dim * (m ? 1.50 : 1) },
      ceiling: { idle: LIGHTS.ceilingGrid.idle,               dim: LIGHTS.ceilingGrid.dim },
    };
  }, [isMobile]);

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

      // Per-rack LED variation — deterministic recolour / dim / hide
      // so the six racks read as distinct identities instead of six
      // identical amber + green columns. Driven by the per-mesh hash
      // and the project's signature accent colour.
      const ledId = ledProjectId(obj.name);
      if (ledId !== null) {
        const project = projectsById.get(ledId);
        const accent = project?.color;
        const h = strHash(obj.name);
        const pick = h % 100;
        // 8% of LEDs are off (varied density per rack)
        if (pick < 8) {
          obj.visible = false;
          return;
        }
        // 12% are dim (idle / heartbeat look)
        const dimFactor = pick < 20 ? 0.25 : 1.0;
        // Color selection: 55% project, 25% amber (original), 20% green
        const slot = (h >>> 8) % 100;
        if (slot < 55 && accent) {
          cloned.emissive = new Color(accent);
          cloned.color = new Color(accent).multiplyScalar(0.35);
        } else if (slot < 80) {
          cloned.emissive = new Color("#ffb347");
          cloned.color = new Color("#7a4f1e");
        } else {
          cloned.emissive = new Color("#3aff8a");
          cloned.color = new Color("#1a5a32");
        }
        cloned.emissiveIntensity = (cloned.emissiveIntensity ?? 1.0) * dimFactor;
        return;
      }

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
    lerpLight(hemiRef.current,    lightLevels.hemi.idle,    lightLevels.hemi.dim);
    lerpLight(ambientRef.current, lightLevels.ambient.idle, lightLevels.ambient.dim);
    lerpLight(keyRef.current,     lightLevels.key.idle,     lightLevels.key.dim);
    lerpLight(topDownRef.current, lightLevels.topDown.idle, lightLevels.topDown.dim);
    for (const ceil of ceilingRefs.current) {
      lerpLight(ceil, lightLevels.ceiling.idle, lightLevels.ceiling.dim);
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
      {/* Soft linear fog: anything past ~28m fades to black. Hides the
          hard edge of the reflective floor + the static room's neon
          edge strips when the user zooms out, so the room reads as
          one lit island in a much larger dark facility. */}
      <fog attach="fog" args={["#000000", 22, 55]} />

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
        args={[
          "#d4dbe8",
          "#525870",
          isMobile ? LIGHTS.hemi.idle * 1.45 : LIGHTS.hemi.idle,
        ]}
      />
      <ambientLight
        ref={ambientRef}
        intensity={isMobile ? LIGHTS.ambient.idle * 1.4 : LIGHTS.ambient.idle}
        color="#8a93a6"
      />

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
        intensity={isMobile ? LIGHTS.topDown.idle * 1.5 : LIGHTS.topDown.idle}
        color="#dde4f5"
      />

      {/* 2x2 ceiling-panel grid for additional local highlights.
          Skipped on mobile — every fragment shader iterates all
          lights, so 4 extra point lights compound across 161 mesh
          primitives. The directional + hemi + cyan key cover the
          essentials. */}
      {!isMobile && CEILING_LIGHTS.map((pos, i) => (
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

      {/* Per-rack floor-glow accent: a small low-decay point light
          at the foot of each rack, tinted with the project's signature
          color. Reads as a coloured pool on the reflective floor and
          subtly stains the rack's lower panels. Skipped on mobile —
          every extra point light compounds across every fragment in
          the scene. */}
      {!isMobile && Array.from(anchorMap.entries()).map(([id, anchor]) => {
        const project = projectsById.get(id);
        if (!project?.color) return null;
        return (
          <pointLight
            key={`glow-${id}`}
            position={[anchor.position.x, 0.25, anchor.position.z]}
            color={project.color}
            intensity={1.6}
            distance={2.6}
            decay={2.0}
          />
        );
      })}

      {/* Per-rack brand badges: each project's logo as a textured plane
          mounted on the rack's front face, near the top. Sized to live
          *above* the LED columns so it reads as a vendor strip on a
          server, not a sticker covering the displays. Faces the room
          interior so the right side of the screen reads from the
          default vantage. */}
      {Array.from(anchorMap.entries()).map(([id, anchor]) => {
        const project = projectsById.get(id);
        if (!project?.logo) return null;
        // Racks are wall-mounted; the front face is perpendicular to
        // whichever wall (back z=-4.7 or left x=-4.7) the rack sits on.
        // Decide axis by which coordinate dominates, then build a unit
        // normal pointing from the wall into the room.
        const ax = anchor.position.x;
        const az = anchor.position.z;
        const isBackWall = Math.abs(az) >= Math.abs(ax);
        const nx = isBackWall ? 0 : -Math.sign(ax);
        const nz = isBackWall ? -Math.sign(az) : 0;
        // Anchors are positioned 1.0m *in front* of the rack body (they
        // double as "stand here to view this" points for the camera
        // rig). The rack's actual front face is one metre back along
        // the face normal; we want the badge sitting ~1cm proud of
        // that face so it reads as a panel marking, not a hovering
        // sticker.
        const FACE_OFFSET = 0.99;
        const x = ax - nx * FACE_OFFSET;
        const z = az - nz * FACE_OFFSET;
        // +0.40 from the anchor lands the badge in the upper third of
        // the rack face. Rack body extends ±1.30 around the anchor in
        // Y, so this is comfortably within bounds.
        const y = anchor.position.y + 0.4;
        // planeGeometry's default normal is +Z. Rotate around Y so the
        // plane faces (nx, 0, nz).
        const ry = Math.atan2(nx, nz);
        return (
          <Image
            key={`logo-${id}`}
            url={project.logo}
            position={[x, y, z]}
            rotation={[0, ry, 0]}
            scale={[0.5, 0.5]}
            // transparent={true} keeps each PNG's own alpha channel
            // (so the logo silhouette stays clean against the rack
            // face) without dimming the visible pixels themselves.
            transparent
            toneMapped={false}
          />
        );
      })}

      {/* Polished dark floor — concept-art palette, lit by the bright
          overhead fluorescents above. Reads as glossy dark concrete
          / polished tile rather than office vinyl. Soft real-time
          reflection picks up the rack LED bars and the ceiling
          lights. Extended to 60×60 so the user can't see the floor
          edge before the fog hides it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          // Reflection texture is by far the most expensive thing in
          // the scene. Drop resolution + simplify on mobile.
          blur={isMobile ? [180, 60] : [300, 100]}
          mixBlur={isMobile ? 1.4 : 1.0}
          mixStrength={isMobile ? 1.0 : 1.4}
          resolution={isMobile ? 256 : 1024}
          mirror={isMobile ? 0.35 : 0.5}
          mixContrast={1.0}
          depthScale={1.0}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.5}
          color="#1a1d2e"
          metalness={0.55}
          roughness={0.4}
        />
      </mesh>

      {/* Infinite floor-tile grid. Renders over the reflective floor
          inside the room and extends out into the fogged void, so the
          eye reads it as a vast data hall. Skipped on mobile — it's a
          separate render pass and gets pricey across an infinite
          fade distance. */}
      {!isMobile && (
        <Grid
          position={[0, 0.005, 0]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#3d4258"
          sectionSize={4}
          sectionThickness={1.0}
          sectionColor="#5a607a"
          fadeDistance={40}
          fadeStrength={1.4}
          infiniteGrid
          side={2}
        />
      )}

      {/* Distant data-center skyline: temporarily disabled — the
          procedural box pillars read as toy blocks, not racks. Proper
          rack geometry will be modelled in Blender and instanced
          here. */}
      {false && <DistantRacks isMobile={isMobile} />}

      {/* Starfield overhead. Cyan/desaturated so it reads as distant
          data-hall ceiling lights, not a planetarium. Drei's <Stars>
          is a single Points draw call so it's cheap. */}
      <Stars
        radius={80}
        depth={40}
        count={isMobile ? 1200 : 3500}
        factor={2.2}
        saturation={0.35}
        fade
        speed={0.25}
      />

      {/* Floor-level fog tint underneath the reflective floor so the
          horizon line where the floor meets the fog reads as a soft
          gradient rather than a hard cut. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color="#02040a" fog />
      </mesh>

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
