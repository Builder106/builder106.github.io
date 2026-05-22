import { Image, useGLTF, useCursor, Html, MeshReflectorMaterial, Grid, Stars } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Vector3,
  type Material,
  type ShaderMaterial,
} from "three";
import { assertAnchorCoverage, collectAnchors, type SceneAnchor } from "./anchors";
import { resolveClick, type ClickTarget } from "./clickResolver";
import { createSwarmMaterial, type SwarmUniforms } from "./swarmShader";
import { MODEL_URLS, type SceneVariant } from "./sceneVariant";
import { CLUSTER_DISPLAY, projects } from "@/data/projects";

// Preload the one glb both variants now resolve to (portrait used to
// load a separate amphitheater file — retired, see sceneVariant.ts).
useGLTF.preload(MODEL_URLS.landscape);

// Materials whose emission should bypass ACES tonemapping.
function isUntonedMaterial(name: string): boolean {
  return (
    name === "M_Screen" ||
    name.startsWith("M_Cable_") ||
    name.startsWith("M_StatusLED_")
  );
}

// Hover behavior tuning. DIM is aggressive on purpose — we want the
// hovered rack to feel spotlit, everything else to recede into shadow.
const HOVER_INTENSITY_MULTIPLIER = 1.8;
const DIM_INTENSITY_MULTIPLIER = 0.12;
const HOVER_TIME_CONSTANT = 0.07;

// Bright fluorescent-quality lighting designed to light dark
// concept-art surfaces enough that they actually read. Intensities
// pushed ~30% above the prior baseline because dark-blue base colors
// reflect only a small fraction of incident light per channel.
const LIGHTS = {
  hemi:        { idle: 2.2,  dim: 0.55 },
  ambient:     { idle: 0.95, dim: 0.22 },
  pointKey:    { idle: 1.2,  dim: 0.18 },   // central cyan accent
  topDown:     { idle: 3.4,  dim: 0.85 },
  ceilingGrid: { idle: 8.0,  dim: 1.6 },
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

// Deterministic transforms for the distant-rack scatter. Generated
// once per "isMobile" flip; each transform places one rack instance.
interface RackInstanceTransform {
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

function buildDistantRackTransforms(isMobile: boolean): RackInstanceTransform[] {
  const rng = mulberry32(0xCAFE_BABE);
  const count = isMobile ? 22 : 56;
  const out: RackInstanceTransform[] = [];
  for (let i = 0; i < count; i++) {
    // Pull the inner radius out to 26m so distant racks don't crowd
    // the silhouette of the main back-wall racks; outer radius 52m so
    // there's still a sense of depth.
    const r = 26 + rng() * 26;
    const theta = rng() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    // Skip anything inside the visible-room footprint plus a small
    // breathing margin.
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    // Random orientation but bias toward facing the room interior so
    // the LED strip on the front of each rack reads at distance.
    const facing = Math.atan2(-x, -z);
    const jitter = (rng() - 0.5) * Math.PI * 0.6;  // ±54°
    const rotationY = facing + jitter;
    out.push({
      position: [x, 0, z],
      rotationY,
      scale: 0.85 + rng() * 0.3,
    });
  }
  return out;
}

interface DistantRacksProps {
  bodyGeom: BufferGeometry | null;
  bodyMat: Material | null;
  ledGeom: BufferGeometry | null;
  ledMat: Material | null;
  isMobile: boolean;
}

// Two InstancedMesh: one for the rack body, one for the LED accent
// strip. Same per-instance transform applied to both so each rack
// reads as a single object. Materials/geometries come from the loaded
// glb (authored in Blender) — the template meshes themselves are
// hidden by the scene traversal that finds them.
function DistantRacks({
  bodyGeom,
  bodyMat,
  ledGeom,
  ledMat,
  isMobile,
}: DistantRacksProps) {
  const transforms = useMemo(() => buildDistantRackTransforms(isMobile), [isMobile]);

  // Build the per-instance Matrix4 array once. Shared between the
  // body and LED InstancedMesh.
  const matrices = useMemo(() => {
    const dummy = new Object3D();
    return transforms.map((t) => {
      dummy.position.set(t.position[0], t.position[1], t.position[2]);
      dummy.rotation.set(0, t.rotationY, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [transforms]);

  if (!bodyGeom || !bodyMat || !ledGeom || !ledMat) return null;

  return (
    <group>
      <instancedMesh args={[bodyGeom, bodyMat, matrices.length]} frustumCulled={false}
        ref={(m) => {
          if (!m) return;
          matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
          m.instanceMatrix.needsUpdate = true;
        }}
      />
      <instancedMesh args={[ledGeom, ledMat, matrices.length]} frustumCulled={false}
        ref={(m) => {
          if (!m) return;
          matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
          m.instanceMatrix.needsUpdate = true;
        }}
      />
    </group>
  );
}

// Project ids in the order they should appear down the portrait aisle —
// closest to camera first, receding into the fog. Quant cluster anchors
// the front because OCaml LOB / qforge are the strongest "headline" tech
// surfaces; swe + analyst clusters follow in cluster groupings so the
// colour-coding reads as you walk.
const AISLE_ORDER = [
  "ocaml-lob",
  "qforge",
  "econos",
  "staija",
  "studysprint",
  "micromatch",
  "capitol-alpha",
  "datafest-2026",
  "linuxbenchhub",
] as const;

// Aisle geometry. Spacing is wide enough that adjacent racks don't
// overlap at the working camera FOV; Z_START sits a hair behind the
// (relocated) terminal desk so the first rack reads as the user's first
// step "into" the hall.
const AISLE_SPACING = 2.6;
const AISLE_Z_START = 1.0;
const AISLE_TERMINAL_Z = 4.2;

// Per-rack-id sets of mesh-name predicates: anything matching gets moved
// into the rack's transform group when we re-lay-out for portrait.
function isRackMesh(name: string, id: string): boolean {
  return (
    name === `Rack_${id}` ||
    name === `Screen_${id}` ||
    name.startsWith(`StatusLED_${id}_`)
  );
}

// Whitelist of mesh-name patterns that should remain visible after the
// portrait aisle layout is applied. Walls, ceiling beams, and other
// authored "room" geometry get hidden — the racks now stand in a fogged
// void rather than inside the four-walled landscape room, so anything
// not in the whitelist would float in place of a missing wall.
function isPortraitKeepMesh(name: string): boolean {
  if (
    name.startsWith("Rack_") ||
    name.startsWith("Screen_") ||
    name.startsWith("StatusLED_") ||
    name.startsWith("BackgroundTower_") ||
    name === "Monitor" ||
    name === "Desk" ||
    name === "Floor" ||
    name === "DistantRackBody" ||
    name === "DistantRackLED"
  ) return true;
  return false;
}

// Determine which wall a landscape-glb rack lives on, given its anchor
// world position. Returns the anchor-plane axis-aligned unit vector
// pointing *outward from the wall* (i.e. the rack's forward direction
// in the landscape composition).
function wallNormalFor(anchorPos: Vector3): Vector3 {
  const ANCHOR_PLANE = 4.7;
  const distToLeft  = Math.abs(anchorPos.x + ANCHOR_PLANE);
  const distToRight = Math.abs(anchorPos.x - ANCHOR_PLANE);
  const distToBack  = Math.abs(anchorPos.z + ANCHOR_PLANE);
  const minDist = Math.min(distToLeft, distToRight, distToBack);
  if (minDist === distToLeft)  return new Vector3(1, 0, 0);   // left wall faces +X
  if (minDist === distToRight) return new Vector3(-1, 0, 0);  // right wall faces -X
  return new Vector3(0, 0, 1);                                 // back wall faces +Z
}

// Apply the portrait aisle layout to a *cloned* scene. Mutates the scene
// in place: each rack (Rack_<id> + Screen_<id> + StatusLED_<id>_*) and
// its anchor empty get reparented into a per-rack Group, which is then
// positioned along the -Z axis and rotated to face +Z. The Monitor + Desk
// pair move forward to z=AISLE_TERMINAL_Z. Non-whitelisted geometry
// (walls, ceiling, decorative trim) is hidden so the aisle reads in the
// fogged void rather than as racks poking through an empty room.
function applyAisleLayout(scene: Object3D): void {
  // Cache anchor refs by id so we can update them in lockstep with the
  // meshes they pin. Anchors are Object3D empties named "anchor_<id>".
  const anchorByName = new Map<string, Object3D>();
  scene.traverse((node) => {
    if (node.name.startsWith("anchor_")) {
      anchorByName.set(node.name.slice("anchor_".length), node);
    }
  });

  // First pass: collect each rack's meshes. We do this before any
  // reparenting because traversal order during attach() can skip nodes
  // that have moved subtrees.
  const meshesByRack = new Map<string, Object3D[]>();
  for (const id of AISLE_ORDER) {
    meshesByRack.set(id, []);
  }
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    for (const id of AISLE_ORDER) {
      if (isRackMesh(node.name, id)) {
        meshesByRack.get(id)!.push(node);
        return;
      }
    }
  });

  // Second pass: per rack, build a transform group at the rack's
  // original pivot, reparent meshes (+ anchor) into it via attach()
  // (which preserves world transforms), then translate + rotate the
  // group to the aisle target. attach() handles the world↔local
  // conversion for us.
  const tmpWorld = new Vector3();
  for (let i = 0; i < AISLE_ORDER.length; i++) {
    const id = AISLE_ORDER[i];
    const anchor = anchorByName.get(id);
    if (!anchor) continue;

    anchor.getWorldPosition(tmpWorld);
    const normal = wallNormalFor(tmpWorld);
    // Rack body sits ~1m *behind* its anchor (anchor is authored 1m in
    // front of the rack face per the Blender contract).
    const origPivot = tmpWorld.clone().sub(normal);
    // Rotation needed to turn the rack's outward normal into +Z (the
    // direction the aisle camera looks from).
    const origAngle = Math.atan2(normal.x, normal.z);
    const deltaAngle = -origAngle;

    const group = new Group();
    group.position.copy(origPivot);
    scene.add(group);

    group.attach(anchor);
    for (const mesh of meshesByRack.get(id) ?? []) {
      group.attach(mesh);
    }

    // Aisle target: x=0, original Y, receding -Z. Rotation flips the
    // rack to face the camera.
    group.position.set(0, origPivot.y, AISLE_Z_START - i * AISLE_SPACING);
    group.rotation.y = deltaAngle;
  }

  // Pull the terminal/desk forward so it sits *in front of* the first
  // aisle rack. The terminal anchor name is `anchor_terminal`; the
  // Monitor + Desk meshes share its frame in the authored scene.
  const terminalAnchor = anchorByName.get("terminal");
  if (terminalAnchor) {
    terminalAnchor.getWorldPosition(tmpWorld);
    const termPivot = tmpWorld.clone();
    // Pre-collect Monitor/Desk before reparenting — calling attach()
    // splices the node out of its parent's children array, which would
    // corrupt the traverse iteration if done inline.
    const termMeshes: Object3D[] = [];
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (node.name === "Monitor" || node.name === "Desk") {
        termMeshes.push(node);
      }
    });
    const termGroup = new Group();
    termGroup.position.copy(termPivot);
    scene.add(termGroup);
    termGroup.attach(terminalAnchor);
    for (const m of termMeshes) termGroup.attach(m);
    termGroup.position.set(0, termPivot.y, AISLE_TERMINAL_Z);
  }

  // Hide everything not in the keep-list. Run *after* the rack
  // repositions so we don't accidentally hide meshes we were about to
  // move.
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (!isPortraitKeepMesh(node.name)) {
      node.visible = false;
    }
  });
}

interface ServerRoomProps {
  onAnchorsReady?: (anchors: Map<string, SceneAnchor>) => void;
  onSelect?: (target: ClickTarget) => void;
  panelOpen?: boolean;
  isMobile?: boolean;
  variant?: SceneVariant;
}

export function ServerRoom({
  onAnchorsReady,
  onSelect,
  panelOpen,
  isMobile = false,
  variant = "landscape",
}: ServerRoomProps) {
  const { scene: originalScene } = useGLTF(MODEL_URLS[variant]);
  // Portrait viewports get a procedural aisle layout (racks repositioned
  // into a single -Z column with the desk pulled forward) baked onto a
  // cloned scene. Landscape uses the authored geometry unchanged. Clone
  // is keyed on the loaded glb identity so a re-load (variant flip,
  // HMR) produces a fresh transform.
  const scene = useMemo(() => {
    if (variant !== "portrait") return originalScene;
    const cloned = originalScene.clone(true);
    try {
      applyAisleLayout(cloned);
    } catch (err) {
      console.error("[aisle] applyAisleLayout threw:", err);
    }
    return cloned;
  }, [originalScene, variant]);
  const { scene: rootScene } = useThree();
  const interactivesRef = useRef<Interactive[]>([]);
  // Wall-clock accumulator for the BackgroundTower_*_strip pulse in
  // useFrame. We don't cache material refs — instead we traverse the
  // scene each frame and modify materials in place (cached refs were
  // causing the modified material not to reach the renderer; see the
  // useFrame block for details).
  const elapsedRef = useRef(0);
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

  // Templates harvested from the glb: their geometry + material is
  // reused by InstancedMesh in <DistantRacks> below. State so the
  // first render after the glb loads triggers the rack scatter.
  const [distantTemplates, setDistantTemplates] = useState<{
    bodyGeom: BufferGeometry | null;
    bodyMat: Material | null;
    ledGeom: BufferGeometry | null;
    ledMat: Material | null;
  }>({ bodyGeom: null, bodyMat: null, ledGeom: null, ledMat: null });

  useCursor(hover !== null);

  useLayoutEffect(() => {
    const interactives: Interactive[] = [];
    let bodyGeom: BufferGeometry | null = null;
    let bodyMat: Material | null = null;
    let ledGeom: BufferGeometry | null = null;
    let ledMat: Material | null = null;
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;

      // Skip BackgroundTower_*_strip meshes — their materials are
      // animated directly in useFrame, in place, without cloning.
      if (obj.name.startsWith("BackgroundTower_") && obj.name.endsWith("_strip")) {
        return;
      }

      // The static glb floor is hidden — a separate JSX <mesh> with
      // MeshReflectorMaterial (below) renders the reflective floor
      // instead, so the racks and cables actually mirror onto it.
      if (obj.name === "Floor") {
        obj.visible = false;
        return;
      }

      // The two DistantRack* templates are authored in Blender at a
      // parked location far outside the room. Hide them and stash
      // refs to their geometry + material so InstancedMesh can scatter
      // copies in the void.
      if (obj.name === "DistantRackBody") {
        obj.visible = false;
        bodyGeom = obj.geometry;
        bodyMat = obj.material as Material;
        return;
      }
      if (obj.name === "DistantRackLED") {
        obj.visible = false;
        ledGeom = obj.geometry;
        // Clone the material so the dim-for-distance treatment doesn't
        // affect any future render of the original template mesh.
        const src = obj.material as MeshStandardMaterial;
        const cloned = src.clone();
        cloned.toneMapped = false;
        // The Blender material had emissionStrength=4.0 so the LEDs
        // would read in the bake. At runtime they overpowered the main
        // racks; knock the runtime emission way down so the distant
        // strips read as faint ambient hint, not headlamps.
        cloned.emissiveIntensity = 0.45;
        ledMat = cloned;
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
    if (bodyGeom && bodyMat && ledGeom && ledMat) {
      setDistantTemplates({ bodyGeom, bodyMat, ledGeom, ledMat });
    }
  }, [scene]);

  // Re-emit anchors every time the loaded glTF scene changes — this is what
  // makes a portrait↔landscape variant flip pick up the new layout instead
  // of holding stale positions from the previous variant.
  useEffect(() => {
    const collected = collectAnchors(scene);
    setAnchorMap(collected);
    onAnchorsReady?.(collected);
    assertAnchorCoverage(
      collected,
      projects.filter((p) => p.inScene !== false).map((p) => p.id),
      variant,
    );
  }, [scene, onAnchorsReady, variant]);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta / HOVER_TIME_CONSTANT);
    const isHovering = hover !== null;
    const activeKey = hoverKeyForState(hover);
    elapsedRef.current += delta;

    // Per-emissive-material targets (rack screens).
    for (const it of interactivesRef.current) {
      let target: number;
      if (it.hoverKey === activeKey) target = it.hover;
      else if (isHovering) target = it.dim;
      else target = it.base;
      it.current += (target - it.current) * k;
      it.mat.emissiveIntensity = it.current;
    }

    // Background tower accent pulse. Force all strips to brand cyan and
    // modulate brightness by scaling the emit colour each frame (with
    // toneMapped=false so the colour reads literally). Keeping intensity
    // low (peak emission ~2.0) so the red channel stays well below 1
    // and the strips read as bright cyan rather than saturating to white.
    const tNow = elapsedRef.current;
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (!(node.name.startsWith("BackgroundTower_") && node.name.endsWith("_strip"))) return;
      const m = node.material;
      if (!(m instanceof MeshStandardMaterial)) return;
      m.toneMapped = false;
      // Per-strip phase + speed so towers don't pulse in sync.
      const h = strHash(node.name);
      const phase = ((h % 1000) / 1000) * Math.PI * 2;
      const speed = 0.6 + (((h >>> 8) % 100) / 100) * 1.2;
      const wave = 0.5 + 0.5 * Math.sin(tNow * speed + phase);
      const t = 0.35 + 0.65 * wave;   // 0.35 — 1.00 of base brightness
      m.emissive.setRGB(0.30 * t, 0.95 * t, 1.00 * t);
      m.emissiveIntensity = 2.0;
    });

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
      {/* Soft linear fog: anything past ~30m fades to black. Hides the
          hard edge of the reflective floor + the static room's neon
          edge strips when the user zooms out, so the room reads as
          one lit island in a much larger dark facility. Pushed back
          out from [18,45] → [24,65] so the floor stays readable in
          the mid-ground instead of crushing to black right past the
          room edge. */}
      <fog attach="fog" args={["#0a0d18", 24, 65]} />

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
        // Determine the rack's front-face normal (pointing away from the
        // rack into the room). On portrait the aisle layout rotates
        // every rack to face +Z, so the normal is uniform. On landscape
        // anchors lie on one of the planes X=±4.7 or Z=±4.7; pick the
        // closest. A naïve |z|>=|x| dominance check breaks down when a
        // rack sits deep on a side wall (e.g. analyst at X=-4.7, Z=-6.5:
        // |z| wins but the rack is still on the left wall, not the back).
        let nx: number, nz: number;
        if (variant === "portrait") {
          nx = 0; nz = 1;
        } else {
          const ax = anchor.position.x;
          const az = anchor.position.z;
          const ANCHOR_PLANE = 4.7;
          const distToLeft  = Math.abs(ax + ANCHOR_PLANE);
          const distToRight = Math.abs(ax - ANCHOR_PLANE);
          const distToBack  = Math.abs(az + ANCHOR_PLANE);
          const minDist = Math.min(distToLeft, distToRight, distToBack);
          if (minDist === distToLeft) {
            nx = 1; nz = 0;          // left wall, faces +X
          } else if (minDist === distToRight) {
            nx = -1; nz = 0;         // right wall, faces -X
          } else {
            nx = 0; nz = 1;          // back wall, faces +Z
          }
        }
        // Anchors are positioned 1.0m *in front* of the rack body (they
        // double as "stand here to view this" points for the camera
        // rig). The rack's actual front face is one metre back along
        // the face normal; we want the badge sitting ~1cm proud of
        // that face so it reads as a panel marking, not a hovering
        // sticker.
        const FACE_OFFSET = 0.99;
        const x = anchor.position.x - nx * FACE_OFFSET;
        const z = anchor.position.z - nz * FACE_OFFSET;
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
          color="#262a3d"
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
          cellThickness={0.7}
          cellColor="#4e5476"
          sectionSize={4}
          sectionThickness={1.1}
          sectionColor="#727a9c"
          fadeDistance={55}
          fadeStrength={1.2}
          infiniteGrid
          side={2}
        />
      )}

      {/* Distant data-center skyline: rack-shaped templates authored
          in Blender, instanced ~80x in a 22–50m ring around the room.
          The body mesh is matte dark; the LED accent strip is bright
          cyan emissive. Fog erases most of the silhouette and leaves
          the LED bars reading as far-off panel lights. */}
      <DistantRacks
        bodyGeom={distantTemplates.bodyGeom}
        bodyMat={distantTemplates.bodyMat}
        ledGeom={distantTemplates.ledGeom}
        ledMat={distantTemplates.ledMat}
        isMobile={isMobile}
      />

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
          gradient rather than a hard cut. Slight lift from #02040a so
          the far floor doesn't disappear into pure black before the
          fog has a chance to do its work. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshBasicMaterial color="#11151f" fog />
      </mesh>

      {/* Engraved-style nameplate on the front face of the desk. On
          portrait the desk has been pulled forward to z≈AISLE_TERMINAL_Z
          by applyAisleLayout, so the nameplate position rides off the
          (moved) terminal anchor rather than the authored z=3.105. */}
      {!panelOpen && (() => {
        const isPortrait = variant === "portrait";
        const terminalAnchor = anchorMap.get("terminal");
        // Landscape: hardcoded front face of the original desk.
        // Portrait: anchor.z + a small forward offset puts the plate
        // on the desk's user-facing edge.
        const z = isPortrait && terminalAnchor
          ? terminalAnchor.position.z + 0.55
          : 3.105;
        return (
          <Html
            position={[0, 0.55, z]}
            center
            rotation={[0, 0, 0]}
            distanceFactor={4.2}
            zIndexRange={[0, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div className="desk-nameplate">Olayinka David Vaughan</div>
          </Html>
        );
      })()}

      {/* Floating callout labels above each rack + the central monitor.
          Each label is a clickable shortcut that triggers the same
          ClickTarget the underlying mesh would. Tap-friendly target on
          phones; doesn't hurt desktop. Hidden while a panel is open so
          the panel content owns the screen.

          Portrait-only treatments:
            - Smaller distanceFactor → labels render at a smaller world
              size so adjacent racks don't crash into each other.
            - Cluster sublabel ("// quant", "// swe") dropped — on a
              narrow viewport the duplicate cluster tag across three
              adjacent racks reads as noise. The project name + the
              colour-coded rack body carry the cluster identity already.
        */}
      {!panelOpen && Array.from(anchorMap.entries()).map(([id, anchor]) => {
        const isPortrait = variant === "portrait";
        const labelDistance = isPortrait ? 5 : 9;
        // Depth-based opacity for portrait aisle labels. drei <Html>
        // elements live in DOM, not WebGL, so they don't naturally
        // respect 3D occlusion — without this every rack's label would
        // pile on top of every other label in the back of the aisle.
        // Map anchor.z (running from ~+5 at the desk to ~-20 at the
        // farthest rack) to opacity 1.0 → 0.0 with a knee that keeps
        // the front three racks fully readable and fades the back six
        // toward the fog. Landscape always renders at full opacity.
        let labelOpacity = 1;
        if (isPortrait && id !== "terminal") {
          const z = anchor.position.z;
          // Front-of-aisle z≈+2 → 1.0; back-of-aisle z≈-19 → 0.05.
          labelOpacity = Math.max(0.05, Math.min(1, (z + 18) / 18));
        }
        if (id === "terminal") {
          return (
            <Html
              key={id}
              position={[0, 2.55, anchor.position.z - 0.7]}
              center
              distanceFactor={labelDistance}
              zIndexRange={[0, 0]}
              style={{ userSelect: "none" }}
            >
              <button
                type="button"
                className="rack-label rack-label--terminal"
                onClick={() => onSelect?.({ kind: "terminal" })}
              >
                <span className="rack-label__name">trading_terminal</span>
                {!isPortrait && (
                  <span className="rack-label__cluster">// quant</span>
                )}
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
            distanceFactor={labelDistance}
            zIndexRange={[0, 0]}
            style={{
              userSelect: "none",
              opacity: labelOpacity,
              transition: "opacity 220ms ease",
              // Disable interaction on fully-faded labels so users can't
              // accidentally tap an invisible button.
              pointerEvents: labelOpacity < 0.2 ? "none" : "auto",
            }}
          >
            <button
              type="button"
              className="rack-label"
              onClick={() => onSelect?.({ kind: "project", projectId: id })}
            >
              <span className="rack-label__name">{project.name}</span>
              {!isPortrait && (
                <span className="rack-label__cluster">// {CLUSTER_DISPLAY[project.cluster]}</span>
              )}
            </button>
          </Html>
        );
      })}
    </group>
  );
}
