import { useGLTF, useCursor, useTexture, Html, MeshReflectorMaterial, Grid, Sparkles, Stars } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SRGBColorSpace,
  Vector3,
  type Material,
  type ShaderMaterial,
} from "three";
import { assertAnchorCoverage, collectAnchors, type SceneAnchor } from "./anchors";
import { resolveClick, type ClickTarget } from "./clickResolver";
import { aisleScroll } from "./aisleScroll";
import { createConsoleMaterial, type ConsoleUniforms } from "./consoleShader";
import { createWaveBeamMaterial, type WaveBeamUniforms } from "./waveBeamShader";
import { createWaveFloorMaterial, type WaveFloorUniforms } from "./waveFloorShader";
import { createOperatorHoloMaterial, type OperatorHoloUniforms } from "./operatorHoloShader";
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
  if (state.kind === "linkedin") return "linkedin";
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

// ADSR-shaped pulse for the wave. t ∈ [0, 1].
//   attack  [0,    0.08]  → 0 → 1.0  (snap rise)
//   sustain [0.08, 0.40]  → 1.0      (hold)
//   decay   [0.40, 1.0]   → 1.0 → 0  (quadratic ease-out)
// Replaces the prior sin(πt) bump — the snap-rise + hold + slow-decay
// shape reads as a "drop" rather than a soft swell, which is what the
// techno-club aesthetic needs.
function adsrPulse(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.08) return t / 0.08;
  if (t < 0.40) return 1.0;
  const dt = (t - 0.40) / 0.60;
  return 1.0 - dt * dt;
}

// Strobe attack: 1.0 → 0.0 linear fade over the first 15 % of the
// pulse window (~150 ms at WAVE_PULSE_DUR_S=1.0). Mixes the beam +
// disc + rack-body emissive colour toward white during this window
// so each slot hit reads with a camera-flash quality before settling
// into the cluster colour for the sustain + decay.
function strobeFlash(t: number): number {
  if (t <= 0 || t >= 0.15) return 0;
  return 1.0 - t / 0.15;
}

// Per-cluster wave colours. Pure-neon hues with at least one channel
// at 0 so the body emissive's ~9× intensity boost can saturate the
// other channels without producing a hue shift (e.g. orange #f29100
// at 9× clamps to yellow because R+G both saturate before B). These
// three match the scene's existing cyan/magenta cable palette so the
// wave reads as "the room's neon system reacting" rather than the
// project's brand colours pasted in.
//
// Project-level accent colours (per projects.ts) are still used for
// LED variation — those are tiny dots where saturation matters less.
const WAVE_CLUSTER_COLORS: Record<string, string> = {
  quant:   "#00d4ff",   // electric cyan      (R = 0)
  swe:     "#ff0080",   // hot magenta-pink   (G = 0)
  analyst: "#aa00ff",   // electric violet    (G = 0)
};

function waveColorForProject(
  projectId: string,
  byId: Map<string, { cluster?: string }>,
): string {
  const project = byId.get(projectId);
  const cluster = project?.cluster ?? "quant";
  return WAVE_CLUSTER_COLORS[cluster] ?? WAVE_CLUSTER_COLORS.quant;
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

// Aisle geometry. Racks line both sides of a centre corridor, each pair
// sharing the same Z position. AISLE_HALF_WIDTH is the lateral offset
// from the corridor centreline to each rack's pivot — 1.5m gives a ~3m
// walkway that reads as a real data-centre aisle without crowding the
// front pair at the camera. Z_START sits a hair behind the (relocated)
// terminal desk so the first pair reads as the user's first step into
// the hall.
const AISLE_SPACING = 2.6;
const AISLE_Z_START = 1.0;
const AISLE_TERMINAL_Z = 4.2;
// 1.2 m half-width (2.4 m aisle) keeps the rack bodies inside the
// narrow ~18° portrait horizontal half-FOV until the camera is within
// ~3.7 m of them, instead of dropping off at ~4.6 m with the original
// 1.5 m half-width. Closer cut-off lets the opacity rule peak labels
// while the rack is still 4–5 m ahead — when the rack body fills a
// meaningful chunk of the frame — instead of pushing peak readability
// out to the 7–12 m range where the labelled rack reads as "the one
// far down the aisle" rather than "the one I'm walking past."
const AISLE_HALF_WIDTH = 1.2;

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
//
// Cable_* meshes are the neon cyan/magenta data-cable runs that arc
// across the ceiling, floor, and back/left walls of the landscape
// composition. They're authored at the original landscape coordinates;
// keeping them on portrait paints them as cables stretched *around*
// the relocated aisle (above and behind the racks), which matches the
// desktop wire feel.
//
// Keyboard_* — the desk keyboard has ~80 individual <Mesh> children
// (one per key + body). Each is a separate draw call on mobile GPUs,
// and the portrait camera puts the desk at z≈4 — too far for the
// individual keys to be legible anyway. Keep landscape (close-up
// camera reads them), drop on portrait.
function isPortraitKeepMesh(name: string): boolean {
  if (
    name.startsWith("Rack_") ||
    name.startsWith("Screen_") ||
    name.startsWith("StatusLED_") ||
    name.startsWith("BackgroundTower_") ||
    name.startsWith("Cable_") ||
    name.startsWith("DeskNameplate_") ||
    name === "Monitor" ||
    name === "OperatorHolo" ||
    name === "HoloPedestal" ||
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
  // (which preserves world transforms), translate to the *left* side of
  // the aisle (x = −AISLE_HALF_WIDTH) facing +X, then deep-clone the
  // group to the *right* side facing −X. The clone shares geometries
  // and materials with the original; the per-mesh material clone in
  // useLayoutEffect runs *after* this and gives each its own instance.
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
    // Rotation that turns the rack's outward normal into +X — the
    // direction a left-side rack must face to address the corridor.
    const leftAngle = (Math.PI / 2) - Math.atan2(normal.x, normal.z);
    const targetZ = AISLE_Z_START - i * AISLE_SPACING;

    const group = new Group();
    group.position.copy(origPivot);
    scene.add(group);

    group.attach(anchor);
    for (const mesh of meshesByRack.get(id) ?? []) {
      group.attach(mesh);
    }

    // Left side of the aisle, rack face pointing +X (toward corridor).
    group.position.set(-AISLE_HALF_WIDTH, origPivot.y, targetZ);
    group.rotation.y = leftAngle;

    // Mirror clone on the right side. The 180° rotation flips the
    // outward normal from +X to −X so the rack faces the corridor from
    // the right wall.
    const mirror = group.clone(true);
    scene.add(mirror);
    mirror.position.set(AISLE_HALF_WIDTH, origPivot.y, targetZ);
    mirror.rotation.y = leftAngle + Math.PI;

    // Strip anchor names from the mirror so collectAnchors finds only
    // the original — one label per project, anchored off the left side.
    // The mirror's meshes keep their real names (Rack_<id> etc.) so
    // hovering or clicking either side still resolves to the project.
    mirror.traverse((node) => {
      if (node.name.startsWith("anchor_")) {
        node.name = "_mirror_" + node.name;
      }
    });
  }

  // Pull the terminal/desk forward so it sits *in front of* the first
  // aisle rack. The terminal anchor name is `anchor_terminal`; the
  // Monitor + Desk meshes share its frame in the authored scene.
  const terminalAnchor = anchorByName.get("terminal");
  if (terminalAnchor) {
    terminalAnchor.getWorldPosition(tmpWorld);
    const termPivot = tmpWorld.clone();
    // Pre-collect Monitor/Desk before reparenting — calling attach()
    // splices the node out of its parent's children array, which
    // would corrupt the traverse iteration if done inline. Keyboard_*
    // meshes used to be in here too, but they're now hidden on
    // portrait via isPortraitKeepMesh (mobile-perf cut), so there's
    // no point reparenting them.
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
  const { scene: rootScene, gl } = useThree();
  // Preload every project logo as a texture and crank the anisotropy
  // to the GPU max. Without this the rack badges are sampled with
  // basic trilinear filtering and blur out at the grazing camera
  // angles the portrait aisle creates (camera in the corridor, badges
  // on side-wall planes at ~70° off-axis — classic anisotropy case).
  const logoUrlMap = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of projects) if (p.logo) out[p.id] = p.logo;
    return out;
  }, []);
  const logoTextures = useTexture(logoUrlMap) as Record<string, import("three").Texture>;
  // Operator portrait — fed into the OperatorHolo shader as uTexture.
  // Single-image useTexture call; the SRGB + anisotropy fix-up happens
  // alongside the rack logos below.
  const pfpTexture = useTexture("/LinkedIn_PFP.png") as import("three").Texture;
  useLayoutEffect(() => {
    // Anisotropic filtering + sRGB colour space. The colour-space
    // step matters because drei's <Image> internally sets
    // SRGBColorSpace on the texture; useTexture leaves it at the
    // default LinearSRGBColorSpace, so logos rendered through the
    // sRGB output pipeline come out gamma-uncorrected and look washed
    // out / desaturated.
    //
    // Anisotropy: cap at 4× on mobile (was max — usually 16). Visually
    // indistinguishable at the small viewport size + small badge size,
    // but the texture-sample cost on a phone GPU is non-trivial.
    const max = gl.capabilities.getMaxAnisotropy();
    const target = isMobile ? Math.min(4, max) : max;
    for (const t of [...Object.values(logoTextures), pfpTexture]) {
      let touched = false;
      if (t.anisotropy !== target) {
        t.anisotropy = target;
        touched = true;
      }
      if (t.colorSpace !== SRGBColorSpace) {
        t.colorSpace = SRGBColorSpace;
        touched = true;
      }
      if (touched) t.needsUpdate = true;
    }
    // PFP-only: glTF UV convention has origin at bottom-left; useTexture
    // ships with flipY=true (matches drei <Image> and most CSS contexts)
    // which inverts the photo when sampled by the GLB-authored plane's
    // UVs. The logos don't hit this because they're rendered through
    // drei's <Image> with its own UV handling. Force flipY=false here so
    // the holo plane reads the texture right-side up.
    if (pfpTexture.flipY) {
      pfpTexture.flipY = false;
      pfpTexture.needsUpdate = true;
    }
  }, [logoTextures, pfpTexture, gl, isMobile]);
  const interactivesRef = useRef<Interactive[]>([]);
  // Cached BackgroundTower_*_strip material refs + their per-strip
  // phase/speed. Populated once in the useLayoutEffect below; the
  // useFrame pulse loop iterates this array instead of doing a full
  // scene.traverse() every frame. (Earlier version traversed each
  // frame; that's a measurable cost when the scene has hundreds of
  // meshes after applyAisleLayout.)
  const towerStripsRef = useRef<{
    mat: MeshStandardMaterial;
    phase: number;
    speed: number;
  }[]>([]);
  // Wall-clock accumulator for the BackgroundTower_*_strip pulse in
  // useFrame. We don't cache material refs — instead we traverse the
  // scene each frame and modify materials in place (cached refs were
  // causing the modified material not to reach the renderer; see the
  // useFrame block for details).
  const elapsedRef = useRef(0);
  const monitorShaderRef = useRef<(ShaderMaterial & { uniforms: ConsoleUniforms }) | null>(null);
  const operatorHoloShaderRef = useRef<(ShaderMaterial & { uniforms: OperatorHoloUniforms }) | null>(null);
  const [hover, setHover] = useState<ClickTarget>(null);
  const [anchorMap, setAnchorMap] = useState<Map<string, SceneAnchor>>(new Map());

  // Track aisle-scroll progress so rack labels can fade based on how
  // close the camera is to each rack — not a fixed "front 3 racks
  // only" rule, which was the previous behaviour and only ever showed
  // the quant cluster. Subscribing here re-renders the label list on
  // every scroll tick; React handles the 9 Html reconciliations
  // cheaply.
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => aisleScroll.subscribe(setScrollProgress), []);

  // Idle-attractor wave. After IDLE_BEFORE_WAVE_MS of no interaction
  // a moving spotlight travels rack-to-rack along the aisle — the
  // rack at the peak of its pulse goes bright, *everything else
  // dims*, so the highlighted rack reads as a focal spot rather
  // than a slow ripple. Resets on any real input; skipped while a
  // panel is open or while the user is hovering.
  //
  // Implementation lerps each rack's target between WAVE_DIM and
  // WAVE_BRIGHT based on its sin-curve pulse intensity (0 outside
  // its own window, 1 at peak). Stacks on the existing hover-state
  // lerp by replacing it entirely while the wave is active — hover
  // is already suppressed during the wave, so the two never need to
  // compose.
  const IDLE_BEFORE_WAVE_MS = 15_000;
  // 1.0 s per-slot pulse (down from 1.2): the ADSR curve has a faster
  // attack + shorter sustain so the slot reads as a hit rather than
  // a swell, and 1.0 keeps the total wave duration tight at ~4.55 s
  // in portrait.
  const WAVE_PULSE_DUR_S = 1.0;
  // Per-slot delay differs by variant:
  //   portrait  → 9 individual racks, 0.35 s apart (rack-by-rack)
  //   landscape → 3 cluster groups, 0.70 s apart (3 racks at once)
  // Landscape uses cluster groups because the racks aren't on a line
  // in 3D — they're on three walls. A rack-by-rack sweep would bounce
  // around the room; a cluster sweep tells the "three categories of
  // work" story spatially, since each cluster owns its own wall.
  const WAVE_RACK_DELAY_S = 0.35;
  const WAVE_CLUSTER_DELAY_S = 0.7;
  const lastInteractionRef = useRef<number>(performance.now());
  const waveStartRef = useRef<number | null>(null);
  // Frame counter for the ~1 Hz idle-tick diagnostic. Resets to 0 in
  // useFrame each time it reaches 60.
  const waveTickCounterRef = useRef<number>(0);

  // Variant-aware "which time slot does this rack fire in?" map.
  // Portrait = 9 slots, one per rack in AISLE_ORDER. Landscape = 3
  // slots, one per cluster. The terminal counts as quant (slot 0)
  // in landscape so the desk lights up with the first wave step.
  // Keys here MUST match the `hoverKey` format set by hoverKeyForMesh,
  // which is `project:<id>` for racks and `"terminal"` for the desk
  // monitor. Storing raw ids was the bug that kept every rack pinned
  // to the dim target — the lookup missed and waveIntensity stayed 0.
  const slotIndexByKey = useMemo(() => {
    const m = new Map<string, number>();
    if (variant === "portrait") {
      AISLE_ORDER.forEach((id, i) => m.set(`project:${id}`, i));
    } else {
      const order = ["quant", "swe", "analyst"] as const;
      for (const p of projects) {
        const idx = order.indexOf(p.cluster as typeof order[number]);
        if (idx >= 0) m.set(`project:${p.id}`, idx);
      }
      m.set("terminal", 0);
    }
    return m;
  }, [variant]);

  // One volumetric cone beam per slot, apex at the ceiling and base on
  // the floor, positioned over the rack pair for that slot. Pulsed by
  // the slot's ADSR window during a wave; intensity 0 otherwise.
  const slotBeamsRef = useRef<{
    mesh: Mesh;
    uniforms: WaveBeamUniforms;
    slot: number;
  }[]>([]);

  // One floor disc per slot, sat ~2 cm above the reflective floor.
  // Radial-gradient shader produces a "neon puddle" under the rack
  // pair during its slot; the disc is in the scene above the floor
  // so the MeshReflectorMaterial's mirror reflection picks it up too.
  const slotDiscsRef = useRef<{
    mesh: Mesh;
    uniforms: WaveFloorUniforms;
    slot: number;
  }[]>([]);

  // Per-slot rack body materials. Cloned at scene-build time so each
  // slot's body emissive is independently driven by the wave. Each
  // entry holds both the original and the mirrored rack's material
  // (same slot fires both racks of the pair in portrait).
  const slotBodiesRef = useRef<{
    materials: MeshStandardMaterial[];
    accentColor: Color;
    slot: number;
  }[]>([]);

  const waveSlotDelayS =
    variant === "portrait" ? WAVE_RACK_DELAY_S : WAVE_CLUSTER_DELAY_S;
  const waveSlotCount = variant === "portrait" ? AISLE_ORDER.length : 3;
  const WAVE_TOTAL_S =
    waveSlotCount * waveSlotDelayS + WAVE_PULSE_DUR_S + 0.4;

  // Universal "user did something" listener. Captures pointer/touch/
  // key/wheel at the document level, plus aisleScroll progress
  // changes (touch-swipe-aisle on portrait). Any of these resets the
  // idle timer and cancels an in-flight wave.
  //
  // Diagnostic: each handler logs which source fired so we can spot
  // a runaway reset (e.g. a synth event firing every frame) when the
  // wave never elapses despite no apparent user input.
  useEffect(() => {
    const reset = (source: string) => {
      lastInteractionRef.current = performance.now();
      waveStartRef.current = null;
      if (typeof console !== "undefined") {
        // eslint-disable-next-line no-console
        console.log("[wave] reset by", source);
      }
    };
    const onPointer = () => reset("pointerdown");
    const onTouch = () => reset("touchstart");
    const onKey = () => reset("keydown");
    const onWheel = () => reset("wheel");
    const onScrollProgress = () => reset("aisleScroll");
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("touchstart", onTouch, { passive: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("wheel", onWheel, { passive: true });
    const unsubScroll = aisleScroll.subscribe(onScrollProgress);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("touchstart", onTouch);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("wheel", onWheel);
      unsubScroll();
    };
  }, []);

  // Panel open / close also counts as activity — we don't want the
  // wave to start mid-panel-read or fire the instant a panel closes.
  useEffect(() => {
    lastInteractionRef.current = performance.now();
    waveStartRef.current = null;
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[wave] reset by panelOpen change →", panelOpen);
    }
  }, [panelOpen]);

  // Force-fire hook for the hidden `wave` console command. Lets you
  // verify the visual effect without sitting through the 15 s idle
  // window — useful for both QA and debugging when the timer-based
  // path mysteriously doesn't kick in.
  useEffect(() => {
    const onForce = () => {
      waveStartRef.current = performance.now();
      // Push lastInteractionRef forward so the next idle window
      // starts counting from when the wave finishes, not from the
      // moment of the forced fire.
      lastInteractionRef.current = performance.now();
    };
    window.addEventListener("ov-force-wave", onForce);
    return () => window.removeEventListener("ov-force-wave", onForce);
  }, []);

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
    const bodyMap = new Map<number, {
      materials: MeshStandardMaterial[];
      accentColor: Color;
      slot: number;
    }>();
    let bodyGeom: BufferGeometry | null = null;
    let bodyMat: Material | null = null;
    let ledGeom: BufferGeometry | null = null;
    let ledMat: Material | null = null;
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;

      // BackgroundTower_*_strip meshes: cache the material + per-
      // strip phase/speed once. The useFrame pulse loop reads from
      // towerStripsRef and skips the per-frame scene.traverse + per-
      // strip strHash that earlier versions did. Setting toneMapped
      // here (instead of every frame) is also a small win.
      if (obj.name.startsWith("BackgroundTower_") && obj.name.endsWith("_strip")) {
        const mat = obj.material;
        if (mat instanceof MeshStandardMaterial) {
          mat.toneMapped = false;
          const h = strHash(obj.name);
          towerStripsRef.current.push({
            mat,
            phase: ((h % 1000) / 1000) * Math.PI * 2,
            speed: 0.6 + (((h >>> 8) % 100) / 100) * 1.2,
          });
        }
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

      // The Monitor mesh gets the console-panel shader, replacing its
      // baked M_Monitor material entirely. Renders a control-panel HUD
      // (oscilloscope traces, bar graph, status dots) so the desk
      // monitor reads as "this is actively driving the room." From
      // here on it's hover-driven through uniforms, not emissive.
      if (obj.name === "Monitor") {
        const consoleMat = createConsoleMaterial(isMobile);
        obj.material = consoleMat;
        monitorShaderRef.current = consoleMat;
        return;
      }

      // The OperatorHolo plane (above the keyboard, parented to Desk in
      // Blender) gets its placeholder M_OperatorHolo material swapped
      // for the holo shader: cyan-tinted greyscale of LinkedIn_PFP.png,
      // additive blend, scan lines + vignette + slow flicker so it
      // reads as a projected operator-ID hologram rather than a flat
      // photo pinned to the air.
      if (obj.name === "OperatorHolo") {
        const holoMat = createOperatorHoloMaterial(pfpTexture);
        obj.material = holoMat;
        operatorHoloShaderRef.current = holoMat;
        return;
      }

      // Rack body wash. Each Rack_<id> mesh (original + portrait
      // mirror share the same name) gets its material cloned so the
      // wave can crank emissive without leaking to other racks. The
      // cloned material is stored by slot — both rack-pair materials
      // for a given slot fire together. Emissive starts white so the
      // strobe attack can swap to accent without a colour pop.
      //
      // CRITICAL: the source M_Bake_Rack_<id> material ships with an
      // emissiveTexture (baked lighting). Three.js multiplies the
      // emissive output by that texture per-fragment, so wherever the
      // baked texture is black, our wash colour × intensity is gated
      // to zero — the racks never glow no matter how high we push
      // emissiveIntensity. Nulling emissiveMap on the clone makes
      // the wash paint uniformly across the rack body.
      if (obj.name.startsWith("Rack_")) {
        const projectId = obj.name.slice("Rack_".length);
        const slot = slotIndexByKey.get(`project:${projectId}`);
        if (slot === undefined) return;
        const accent = waveColorForProject(projectId, projectsById);
        const accentColor = new Color(accent);
        const body = obj.material instanceof MeshStandardMaterial
          ? obj.material.clone()
          : new MeshStandardMaterial({ color: 0x111111 });
        body.emissive = new Color(1, 1, 1);
        body.emissiveIntensity = 0;
        body.emissiveMap = null;
        body.toneMapped = false;
        obj.material = body;
        let entry = bodyMap.get(slot);
        if (!entry) {
          entry = { materials: [], accentColor, slot };
          bodyMap.set(slot, entry);
        }
        entry.materials.push(body);
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
    // Set once: no HDRI environment — its directional cast was bleeding
    // into the reflective floor. Previously this was inside useFrame
    // and ran every frame; same value, same effect, no need to re-set.
    rootScene.environmentIntensity = 0;

    // Wave beams + floor discs — portrait-only for now. One downward-
    // pointing cone per slot at corridor centerline (apex y=4.4, base
    // y=0) plus one disc just above the floor (y=0.02). Shared geometry
    // per layer keeps GPU buffer count low; per-slot material instances
    // own the uniforms.
    const beams: { mesh: Mesh; uniforms: WaveBeamUniforms; slot: number }[] = [];
    const discs: { mesh: Mesh; uniforms: WaveFloorUniforms; slot: number }[] = [];
    let sharedBeamGeom: ConeGeometry | null = null;
    let sharedDiscGeom: CircleGeometry | null = null;
    if (variant === "portrait") {
      const beamHeight = 4.4;
      const beamRadius = 1.8;
      const discRadius = 2.2;
      sharedBeamGeom = new ConeGeometry(beamRadius, beamHeight, 24, 4, true);
      sharedDiscGeom = new CircleGeometry(discRadius, 48);
      for (let i = 0; i < AISLE_ORDER.length; i++) {
        const id = AISLE_ORDER[i];
        const color = waveColorForProject(id, projectsById);
        const z = AISLE_Z_START - i * AISLE_SPACING;

        const beamMat = createWaveBeamMaterial(color, beamHeight);
        const beamMesh = new Mesh(sharedBeamGeom, beamMat);
        beamMesh.position.set(0, beamHeight / 2, z);
        beamMesh.frustumCulled = false;
        beamMesh.raycast = () => {};
        scene.add(beamMesh);
        beams.push({ mesh: beamMesh, uniforms: beamMat.uniforms, slot: i });

        const discMat = createWaveFloorMaterial(color);
        const discMesh = new Mesh(sharedDiscGeom, discMat);
        // CircleGeometry lies in the XY plane (normal +Z). Rotate
        // -π/2 around X so it lies flat in XZ (normal +Y). y=0.02
        // clears the reflective floor at y=0.
        discMesh.rotation.x = -Math.PI / 2;
        discMesh.position.set(0, 0.02, z);
        discMesh.frustumCulled = false;
        discMesh.raycast = () => {};
        scene.add(discMesh);
        discs.push({ mesh: discMesh, uniforms: discMat.uniforms, slot: i });
      }
    }
    slotBeamsRef.current = beams;
    slotDiscsRef.current = discs;
    slotBodiesRef.current = Array.from(bodyMap.values());

    return () => {
      // Dispose beam + disc materials + shared geometries + cloned
      // rack body materials on scene rebuild (variant flip). Meshes
      // are children of the cloned scene which gets GC'd; the GPU
      // buffers won't.
      for (const b of beams) {
        b.mesh.removeFromParent();
        (b.mesh.material as ShaderMaterial).dispose();
      }
      for (const entry of bodyMap.values()) {
        for (const mat of entry.materials) {
          mat.dispose();
        }
      }
      for (const d of discs) {
        d.mesh.removeFromParent();
        (d.mesh.material as ShaderMaterial).dispose();
      }
      sharedBeamGeom?.dispose();
      sharedDiscGeom?.dispose();
    };
  }, [scene, rootScene, variant, projectsById, pfpTexture]);

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

    // Idle-attractor wave. Trigger when nothing's happened for
    // IDLE_BEFORE_WAVE_MS and no panel is open. Inflight wave clears
    // when the total duration elapses; lastInteractionRef resets so
    // the next idle window starts counting from "now."
    //
    // We intentionally do NOT block on `isHovering`. On mobile the
    // mesh pointerover state can stick (no real "hover off" gesture
    // on touch), and on desktop a cursor resting over a rack still
    // counts as hover — blocking on those was preventing the wave
    // from ever firing in practice. Real input (pointerdown, touch,
    // wheel, keydown, aisle-scroll, panel toggle) still resets the
    // idle timer via the document listeners + aisleScroll subscribe
    // higher up.
    const now = performance.now();
    const idleEnoughForWave =
      !panelOpen &&
      waveStartRef.current === null &&
      now - lastInteractionRef.current > IDLE_BEFORE_WAVE_MS;
    if (idleEnoughForWave) {
      waveStartRef.current = now;
      // Diagnostic: print to the browser console whenever the wave
      // actually fires from the idle gate, plus to the on-page event
      // bus so the idle-debug HUD (HUD.tsx wave indicator) shows the
      // fire event. Lets us tell apart "idle timer never elapsed" vs
      // "wave fired but rendered invisibly".
      if (typeof console !== "undefined") {
        // eslint-disable-next-line no-console
        console.log("[wave] idle gate elapsed → firing wave", {
          idleMs: Math.round(now - lastInteractionRef.current),
          variant,
          interactivesCount: interactivesRef.current.length,
        });
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ov-wave-fired"));
      }
    }
    // Diagnostic: every 60 frames (~1 s) emit an "idle tick" with
    // the current gap so the HUD indicator can display it.
    waveTickCounterRef.current += 1;
    if (waveTickCounterRef.current >= 60 && typeof window !== "undefined") {
      waveTickCounterRef.current = 0;
      window.dispatchEvent(
        new CustomEvent("ov-idle-tick", {
          detail: {
            idleMs: Math.round(now - lastInteractionRef.current),
            waveActive: waveStartRef.current !== null,
            panelOpen,
          },
        }),
      );
    }
    let waveElapsedS = 0;
    let waveActive = false;
    if (waveStartRef.current !== null) {
      waveElapsedS = (now - waveStartRef.current) / 1000;
      if (waveElapsedS > WAVE_TOTAL_S || panelOpen) {
        // Wave window elapsed (or a panel opened mid-wave). Reset the
        // idle clock so the cycle doesn't immediately re-trigger.
        waveStartRef.current = null;
        lastInteractionRef.current = now;
      } else {
        waveActive = true;
      }
    }

    // Slot beams + floor discs + rack body wash: all three layers pulse
    // during the slot's ADSR window. Beam (peak 2.0) descends from
    // ceiling. Disc (peak 1.6) lights the floor + its reflection. Body
    // wash (peak 5.0) makes the rack itself glow.
    //
    // uIntensity is lerped on the hover `k` so layers settle smoothly.
    // uFlash is set directly (no lerp) because the strobe needs to
    // snap white at slot start and fade within 150 ms — lerping would
    // smear the attack.
    const beamPeak = 2.0;
    const discPeak = 1.6;
    // Body peak bumped 5 → 9: the rack's base material is dark, so
    // emissive at 5.0 read as "warmer rack," not "glowing rack." 9.0
    // pushes the rack body to a luminous wash that clearly dominates
    // the visual hierarchy when its slot fires.
    const bodyPeak = 9.0;
    for (const b of slotBeamsRef.current) {
      let target = 0;
      let flash = 0;
      if (waveActive) {
        const slotStartS = b.slot * waveSlotDelayS;
        const localT = (waveElapsedS - slotStartS) / WAVE_PULSE_DUR_S;
        target = adsrPulse(localT) * beamPeak;
        flash = strobeFlash(localT);
      }
      b.uniforms.uIntensity.value += (target - b.uniforms.uIntensity.value) * k;
      b.uniforms.uFlash.value = flash;
    }
    for (const d of slotDiscsRef.current) {
      let target = 0;
      let flash = 0;
      if (waveActive) {
        const slotStartS = d.slot * waveSlotDelayS;
        const localT = (waveElapsedS - slotStartS) / WAVE_PULSE_DUR_S;
        target = adsrPulse(localT) * discPeak;
        flash = strobeFlash(localT);
      }
      d.uniforms.uIntensity.value += (target - d.uniforms.uIntensity.value) * k;
      d.uniforms.uFlash.value = flash;
    }
    for (const body of slotBodiesRef.current) {
      let intensityTarget = 0;
      let flash = 0;
      if (waveActive) {
        const slotStartS = body.slot * waveSlotDelayS;
        const localT = (waveElapsedS - slotStartS) / WAVE_PULSE_DUR_S;
        intensityTarget = adsrPulse(localT) * bodyPeak;
        flash = strobeFlash(localT);
      }
      // Body emissive colour: mix accent → white based on flash.
      // White during the first 150 ms of the slot, then snaps to the
      // accent colour for the sustain + decay.
      const r = body.accentColor.r + (1 - body.accentColor.r) * flash;
      const g = body.accentColor.g + (1 - body.accentColor.g) * flash;
      const b2 = body.accentColor.b + (1 - body.accentColor.b) * flash;
      for (const mat of body.materials) {
        mat.emissiveIntensity += (intensityTarget - mat.emissiveIntensity) * k;
        mat.emissive.setRGB(r, g, b2);
      }
    }

    // Per-emissive-material targets (rack screens) — hover/idle lerp.
    // The wave does *not* drive these in the current rebuild; the new
    // beam + floor disc + body wash stack handles the wave visual on
    // a separate layer (see commits 2–4 of the techno-wave rebuild).
    for (const it of interactivesRef.current) {
      let target: number;
      if (it.hoverKey === activeKey) {
        target = it.hover;
      } else if (isHovering) {
        target = it.dim;
      } else {
        target = it.base;
      }
      it.current += (target - it.current) * k;
      it.mat.emissiveIntensity = it.current;
    }

    // Background tower accent pulse. Iterates the cached strip refs
    // built in useLayoutEffect — no per-frame scene walk, no per-frame
    // strHash. Just the sin/lerp + emissive write each strip needs.
    const tNow = elapsedRef.current;
    for (const strip of towerStripsRef.current) {
      const wave = 0.5 + 0.5 * Math.sin(tNow * strip.speed + strip.phase);
      const t = 0.35 + 0.65 * wave;   // 0.35 — 1.00 of base brightness
      strip.mat.emissive.setRGB(0.30 * t, 0.95 * t, 1.00 * t);
      strip.mat.emissiveIntensity = 2.0;
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

    // Operator holo: uTime drives the scan-line drift + flicker. No
    // hover/dim channels — the holo always reads at the same intensity.
    const holo = operatorHoloShaderRef.current;
    if (holo) {
      holo.uniforms.uTime.value += delta;
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

      {/* Overhead fluorescent strips for the portrait aisle. The two-row
          rack layout left a void above the corridor; these emissive
          strips fill the top third of the frame and read as a real
          data-centre's ceiling lighting receding into the fog.
          Positioned high (y=6) and *behind* the first rack pair so the
          camera doesn't see the front strip edge-on as a giant glow
          slab — it starts at z=0 (between the first two rack pairs)
          and recedes into the fog. Length is along Z so each strip is
          a long tube parallel to the aisle. */}
      {variant === "portrait" && (
        <group name="aisle-atmosphere">
          {/* Overhead fluorescent strips. 16 total on desktop — front
              10 cover the rack column, trailing 6 fade into the fog.
              Mobile keeps 10 (just enough to span the visible rack
              column); the fog-trailing strips are barely visible at
              the narrow FOV anyway. */}
          {Array.from({ length: isMobile ? 10 : 16 }).map((_, i) => (
            <mesh
              key={`fluo-${i}`}
              position={[
                0,
                6,
                -i * AISLE_SPACING * 0.9,
              ]}
            >
              <boxGeometry args={[0.35, 0.06, 1.6]} />
              <meshBasicMaterial
                color="#9fe6ff"
                toneMapped={false}
                fog
              />
            </mesh>
          ))}

          {/* Glowing centre-line strip embedded in the aisle floor.
              Typical data-centre "walking lane" marker. Lays just
              above the reflective floor so its reflection adds to
              the depth read. */}
          <mesh
            position={[0, 0.005, -10]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.18, 28]} />
            <meshBasicMaterial
              color="#4cf2ff"
              toneMapped={false}
              transparent
              opacity={0.55}
              fog
            />
          </mesh>

          {/* Drifting dust in the aisle volume. Subtle cyan motes
              catching the overhead lights. Mobile gets 25 motes; the
              GPU spends real cycles on each particle's vertex shader
              and a count of 70 was visibly hitting frame rate on
              mid-range phones. The visual difference between 25 and
              70 motes drifting through a corridor is imperceptible. */}
          <Sparkles
            count={isMobile ? 25 : 70}
            size={2.4}
            speed={0.25}
            noise={0.4}
            scale={[5.5, 4, 30]}
            position={[0, 1.8, -8]}
            color="#a8eeff"
            opacity={0.55}
          />

          {/* Backwall terminus at the end of the corridor — a dim
              wall with a single cyan accent strip. Anchors the aisle
              with a destination instead of fading into pure fog. */}
          <mesh position={[0, 1.8, -22]}>
            <planeGeometry args={[6, 3.6]} />
            <meshBasicMaterial color="#0a1422" toneMapped={false} fog />
          </mesh>
          <mesh position={[0, 2.6, -21.99]}>
            <planeGeometry args={[4.4, 0.06]} />
            <meshBasicMaterial color="#4cf2ff" toneMapped={false} fog />
          </mesh>

        </group>
      )}

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
        const tex = logoTextures[id];
        if (!tex) return null;
        const y = anchor.position.y + 0.4;
        if (variant === "portrait") {
          const FRONT_OFFSET = AISLE_HALF_WIDTH - 0.01;
          return (
            <group key={`logo-${id}`}>
              <mesh position={[-FRONT_OFFSET, y, anchor.position.z]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.5, 0.5]} />
                <meshBasicMaterial map={tex} transparent toneMapped={false} />
              </mesh>
              <mesh position={[FRONT_OFFSET, y, anchor.position.z]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[0.5, 0.5]} />
                <meshBasicMaterial map={tex} transparent toneMapped={false} />
              </mesh>
            </group>
          );
        }
        // Landscape wall-mounted logic: anchors lie on one of the
        // planes X=±4.7 or Z=±4.7; pick the closest. A naïve |z|>=|x|
        // dominance check breaks down when a rack sits deep on a side
        // wall (e.g. analyst at X=-4.7, Z=-6.5: |z| wins but the rack
        // is still on the left wall, not the back).
        const ax = anchor.position.x;
        const az = anchor.position.z;
        const ANCHOR_PLANE = 4.7;
        const distToLeft  = Math.abs(ax + ANCHOR_PLANE);
        const distToRight = Math.abs(ax - ANCHOR_PLANE);
        const distToBack  = Math.abs(az + ANCHOR_PLANE);
        const minDist = Math.min(distToLeft, distToRight, distToBack);
        let nx: number, nz: number;
        if (minDist === distToLeft) {
          nx = 1; nz = 0;
        } else if (minDist === distToRight) {
          nx = -1; nz = 0;
        } else {
          nx = 0; nz = 1;
        }
        const FACE_OFFSET = 0.99;
        const x = anchor.position.x - nx * FACE_OFFSET;
        const z = anchor.position.z - nz * FACE_OFFSET;
        const ry = Math.atan2(nx, nz);
        return (
          <mesh key={`logo-${id}`} position={[x, y, z]} rotation={[0, ry, 0]}>
            <planeGeometry args={[0.5, 0.5]} />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        );
      })}

      {/* Polished dark floor — concept-art palette, lit by the bright
          overhead fluorescents above. Reads as glossy dark concrete
          / polished tile rather than office vinyl. Soft real-time
          reflection picks up the rack LED bars + the wave's floor
          discs and ceiling lights. Extended to 60×60 so the user
          can't see the floor edge before the fog hides it.
          Mobile uses 256² reflection texture vs 1024² on desktop —
          16× less fragment work per frame, still enough resolution
          for the perceived-glossy read at the smaller viewport. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          blur={isMobile ? [200, 60] : [300, 100]}
          mixBlur={1.0}
          mixStrength={1.4}
          resolution={isMobile ? 256 : 1024}
          mirror={0.5}
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
          eye reads it as a vast data hall. Mobile fades the grid out
          at 35 m instead of 55 m so fewer tiles paint per frame at the
          narrower viewport — visually nearly identical because the
          fog at [24, 65] already swallows the far cells anyway. */}
      <Grid
        position={[0, 0.005, 0]}
        cellSize={1}
        cellThickness={0.7}
        cellColor="#4e5476"
        sectionSize={4}
        sectionThickness={1.1}
        sectionColor="#727a9c"
        fadeDistance={isMobile ? 35 : 55}
        fadeStrength={1.2}
        infiniteGrid
        side={2}
      />

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
          data-hall ceiling lights, not a planetarium. One Points
          draw call but the GPU still pixel-shades each particle.
          Portrait skips it entirely — the corridor's overhead-light
          strips + backwall block the sky from view anyway, so the
          stars are pure cost with zero visual contribution. */}
      {variant !== "portrait" && (
        <Stars
          radius={80}
          depth={40}
          count={isMobile ? 600 : 3500}
          factor={2.2}
          saturation={0.35}
          fade
          speed={0.25}
        />
      )}

      {/* Floor-level fog tint underneath the reflective floor so the
          horizon line where the floor meets the fog reads as a soft
          gradient rather than a hard cut. Slight lift from #02040a so
          the far floor doesn't disappear into pure black before the
          fog has a chance to do its work. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshBasicMaterial color="#11151f" fog />
      </mesh>

      {/* Desk nameplate is now a 3D mesh in the GLB (DeskNameplate_plate +
          DeskNameplate_text, parented to the Desk in Blender so it rides
          along when applyAisleLayout pulls the desk forward in portrait).
          The previous drei-<Html> CSS overlay is gone — the engraved-plate
          look is geometry now, with proper PBR lighting + reflective-floor
          pickup. */}

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
        // Labels render via drei <Html> with distanceFactor: scale =
        // distanceFactor / distance-from-camera. Portrait labels share
        // world y + x at every depth, so adjacent ones project to
        // near-identical screen slots — the smaller we keep them, the
        // less they pile up. 3.5 reads as legible at the front of the
        // aisle without making 2 deep racks' labels collide.
        const labelDistance = isPortrait ? 3.5 : 9;
        // Depth-based opacity for portrait aisle labels. drei <Html>
        // elements live in DOM, not WebGL, so they don't naturally
        // respect 3D occlusion — without this every rack's label would
        // pile on top of every other label in the back of the aisle.
        // Map anchor.z (running from ~+5 at the desk to ~-20 at the
        // farthest rack) to opacity 1.0 → 0.0 with a knee that keeps
        // the front three racks fully readable and fades the back six
        // toward the fog. Landscape always renders at full opacity.
        let labelOpacity = 1;
        // Camera Z lerped across the scroll progress, used by both
        // rack-label and terminal-label opacity. Hoisted here so both
        // branches below can use it without recomputing.
        const camZ = 8.5 + (-16 - 8.5) * scrollProgress;
        // Portrait label-opacity rule. ahead = cameraZ − rackBodyZ;
        // positive when the rack is in front of the camera, negative
        // when the camera has scrolled past it.
        //
        // Critical constraint: the rack pair sits at x = ±AISLE_HALF_WIDTH
        // (1.2 m). The portrait horizontal half-FOV is ~18°, so a rack
        // body's lateral angle atan(1.2 / ahead) only fits inside the
        // frame when ahead > 1.2 / tan(18°) ≈ 3.7 m. When the camera
        // is closer than that, the rack bodies swing off the sides of
        // the screen, but a label at x = 0 stays anchored in the
        // centre — which produced the original "label hovering above
        // the wrong rack" effect: OCaml LOB's body was off-screen
        // lateral while its label was still visible.
        //
        // So: only show a label when its rack body would itself be
        // on-screen (ahead > 3.7). Peak readability falls inside that
        // visible window at 4–7 m ahead, which is close enough that
        // the rack pair fills a meaningful chunk of the frame and the
        // label reads as "the rack I'm walking past" rather than
        // "the rack far down the aisle."
        //
        //   ahead < 3.7      → 0  (rack body off-screen lateral)
        //   ahead in [3.7, 5] → fade in 0 → 1
        //   ahead in [5, 9]   → peak
        //   ahead in [9, 14]  → fade out 1 → 0
        //   ahead > 14        → 0  (too far)
        const portraitOpacityForAhead = (ahead: number): number => {
          if (ahead < 3.7) return 0;
          if (ahead < 5) return (ahead - 3.7) / 1.3;
          if (ahead < 9) return 1;
          if (ahead < 14) return (14 - ahead) / 5;
          return 0;
        };
        // Both opacity and label render-position reference the *rack
        // body* z, not anchor.z. The anchor is authored 1 m in front
        // of the rack body — using it as the opacity reference means
        // a label fades out a metre before the camera actually reaches
        // its rack, so the label visually feels like it belongs to
        // the rack ahead of it instead of the one it names. Subtracting
        // 1 puts both calculations on the rack body.
        const rackZ = anchor.position.z - 1;
        if (isPortrait && id === "terminal") {
          const ahead = camZ - rackZ;
          labelOpacity = portraitOpacityForAhead(ahead);
          if (labelOpacity < 0.2) return null;
        }
        if (isPortrait && id !== "terminal") {
          // Rack-label opacity peaks when the camera is 2-4 m in
          // front of the *rack body* (not the anchor 1 m further
          // ahead). Earlier off-by-one meant labels disappeared 1 m
          // before the camera actually reached their rack, which
          // visually associated them with the wrong rack pair.
          const ahead = camZ - rackZ;
          labelOpacity = portraitOpacityForAhead(ahead);
        }
        // Below ~0.2 opacity the rack label is too faded to read and
        // too tiny on screen to be a valid tap target. Drop it entirely.
        if (labelOpacity < 0.2 && id !== "terminal") return null;
        if (id === "terminal") {
          // Terminal anchor is closer to the camera than the rack
          // labels (~5 m vs ~7 m). Portrait: distanceFactor 2.6 makes
          // the "console" badge ~85% bigger than the front rack label
          // (which was the prior 1.4 target) — the desk monitor is
          // the room's control surface, so its label should read as
          // the dominant on-screen anchor when nothing's hovered.
          const terminalDistance = isPortrait ? 2.6 : labelDistance;
          return (
            <Html
              key={id}
              position={[0, 2.55, anchor.position.z - 0.7]}
              center
              distanceFactor={terminalDistance}
              style={{
                userSelect: "none",
                opacity: labelOpacity,
                transition: "opacity 220ms ease",
                pointerEvents: labelOpacity < 0.2 ? "none" : "auto",
              }}
            >
              <button
                type="button"
                className="rack-label rack-label--terminal"
                onClick={() => onSelect?.({ kind: "terminal" })}
              >
                <span className="rack-label__name">console</span>
              </button>
            </Html>
          );
        }
        const project = projectsById.get(id);
        if (!project) return null;
        // Portrait centres each label in the aisle (x=0) so it reads
        // as a label for the *pair* of racks at that depth rather than
        // floating over the left rack only. The label's Z also shifts
        // 1m back from the anchor (which was authored 1m *in front* of
        // the rack face) so the label sits directly above the rack
        // body — otherwise as the camera approaches the anchor, the
        // label projects to a screen position one rack pair forward
        // and looks like it's labelling the *next* rack instead.
        const labelX = isPortrait ? 0 : anchor.position.x;
        // Use the same rackZ already computed above for opacity, so
        // both opacity and visual position track the same world Z.
        const labelZ = isPortrait ? rackZ : anchor.position.z;
        // Y-offset: 1.7 m on landscape (label hovers above the wall-
        // mounted rack as a callout), 1.1 m on portrait (label sits
        // just above the rack top so it reads as a nameplate for the
        // rack pair, not as a balloon floating in mid-air over it).
        const labelY = anchor.position.y + (isPortrait ? 1.1 : 1.7);
        return (
          <Html
            key={id}
            position={[labelX, labelY, labelZ]}
            center
            distanceFactor={labelDistance}
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
              <span className="rack-label__cluster">// {CLUSTER_DISPLAY[project.cluster]}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}
