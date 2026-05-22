import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MathUtils, Vector3 } from "three";
import { ServerRoom } from "@/scene/ServerRoom";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  PORTRAIT_CAMERA_POSITION,
  PORTRAIT_CAMERA_TARGET,
  type CameraTarget,
} from "@/scene/cameraRig";
import type { ClickTarget } from "@/scene/clickResolver";
import type { SceneAnchor } from "@/scene/anchors";
import { useSceneVariant, type SceneVariant } from "@/scene/sceneVariant";
import { CameraRig } from "./CameraRig";
import { useIsMobile } from "./useIsMobile";

// Per-variant camera framing. Portrait reframes the procedural aisle
// (racks repositioned in ServerRoom.applyAisleLayout) — camera sits just
// in front of the desk, looking down -Z. Landscape uses the authored
// cityscape vantage.
function ResponsiveCamera({ variant }: { variant: SceneVariant }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);

  const { position, fov } = useMemo(() => {
    if (variant === "portrait") {
      // FOV widens on tall viewports so the aisle's first rack reads at
      // a comfortable scale without exploding the perspective. We deliberately
      // *don't* push the camera much farther on narrower viewports — the
      // aisle has plenty of depth, so widening the FOV alone is enough.
      if (aspect < 0.5) {
        return { position: PORTRAIT_CAMERA_POSITION.clone(), fov: 70 };
      }
      if (aspect < 0.65) {
        return { position: PORTRAIT_CAMERA_POSITION.clone(), fov: 62 };
      }
      // Squarish portrait (tablet, phone-landscape that still tripped
      // the 4/5 aspect threshold). Pull the camera back a bit so the
      // first rack doesn't fill the frame.
      const pos = PORTRAIT_CAMERA_POSITION.clone();
      pos.z = 9.5;
      return { position: pos, fov: 50 };
    }
    if (aspect < 1.3) {
      // Squarish landscape (tablet portrait that didn't trip the variant
      // threshold, or a near-square desktop window).
      return {
        position: new Vector3(8, 6.2, 8),
        fov: 45,
      };
    }
    return { position: DEFAULT_CAMERA_POSITION.clone(), fov: 35 };
  }, [variant, aspect]);

  return (
    <PerspectiveCamera
      makeDefault
      position={position.toArray()}
      fov={fov}
      near={0.1}
      far={100}
    />
  );
}

// Scroll-driven aisle camera for portrait. Reads window.scrollY (the
// page is made scrollable by the .aisle-scroll-spacer + portrait media
// query in globals.css) and lerps the camera + orbit target along the
// -Z aisle every frame. At progress 0 the camera sits at the corridor
// entrance (the PORTRAIT_CAMERA_POSITION baseline); at progress 1 it
// has walked roughly to the back of the rack column. The rig disables
// itself while a panel is open so the click-fly rig can take over.
// Camera Z pulled back from the original 5.5 so the trading terminal
// (anchored at z≈4.2, y≈1) is inside the vertical FOV at the entrance
// frame. At z=5.5 the desk sat at ~49° below the look-vector — outside
// the 35° vertical half-FOV. z=8.5 drops the lateral angle to ~19° so
// the desk reads as a foreground element under the racks.
const SCROLL_CAMERA_START = new Vector3(0, 3.4, 8.5);
// End camera sits roughly between racks 5 and 6 of the aisle (rack
// spacing 2.6m, indexed from z=1). Going further makes the next pair
// pass behind the camera at >35° lateral angle — outside the narrow
// horizontal FOV on portrait — so the user sees only empty void.
const SCROLL_CAMERA_END = new Vector3(0, 1.8, -12.0);
const SCROLL_TARGET_START = new Vector3(0, 0.4, -8.0);
const SCROLL_TARGET_END = new Vector3(0, 0.6, -22.0);

// Frame-rate-independent smoothing toward the scroll target. At 60 fps
// with SMOOTHING=0.001 the camera reaches ~95 % of the target distance
// in ~100 ms, which feels "attached" to the scroll without snapping on
// mobile's discrete 80–120 px scroll ticks.
const SCROLL_SMOOTHING = 0.001;

function AisleScrollRig() {
  const { camera } = useThree();
  // Smoothed camera + look-at vectors, updated each frame with a lerp
  // toward the scroll-derived target. Reading window.scrollY directly
  // inside useFrame (rather than via a scroll-event listener writing to
  // a ref) keeps the rig in sync with whatever value the browser has
  // *right now*, avoiding the one-frame lag where useFrame runs before
  // a scroll event has fired.
  const smoothPos = useRef(new Vector3().copy(SCROLL_CAMERA_START));
  const smoothLook = useRef(new Vector3().copy(SCROLL_TARGET_START));
  const targetPos = useRef(new Vector3());
  const targetLook = useRef(new Vector3());

  useFrame((_, delta) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const t = max > 0
      ? Math.max(0, Math.min(1, window.scrollY / max))
      : 0;

    targetPos.current.set(
      MathUtils.lerp(SCROLL_CAMERA_START.x, SCROLL_CAMERA_END.x, t),
      MathUtils.lerp(SCROLL_CAMERA_START.y, SCROLL_CAMERA_END.y, t),
      MathUtils.lerp(SCROLL_CAMERA_START.z, SCROLL_CAMERA_END.z, t),
    );
    targetLook.current.set(
      MathUtils.lerp(SCROLL_TARGET_START.x, SCROLL_TARGET_END.x, t),
      MathUtils.lerp(SCROLL_TARGET_START.y, SCROLL_TARGET_END.y, t),
      MathUtils.lerp(SCROLL_TARGET_START.z, SCROLL_TARGET_END.z, t),
    );

    const k = 1 - Math.pow(SCROLL_SMOOTHING, delta);
    smoothPos.current.lerp(targetPos.current, k);
    smoothLook.current.lerp(targetLook.current, k);

    camera.position.copy(smoothPos.current);
    camera.lookAt(smoothLook.current);
  });

  return null;
}

interface SceneProps {
  cameraTarget: CameraTarget | null;
  freezeOrbit: boolean;
  panelOpen: boolean;
  onSelect: (target: ClickTarget) => void;
  onAnchorsReady: (anchors: Map<string, SceneAnchor>) => void;
}

// Idle window before the camera begins drifting (ms). Tuned so casual
// readers see motion before they get bored, but anyone exploring isn't
// interrupted mid-glance. Portrait viewports lose the "wow" fastest
// from a static view (no peripheral cues, racks crammed into a column),
// so we kick the auto-tour in much sooner there.
const IDLE_DELAY_DESKTOP_MS = 12_000;
const IDLE_DELAY_PORTRAIT_MS = 2_500;

export function Scene({ cameraTarget, freezeOrbit, panelOpen, onSelect, onAnchorsReady }: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const isMobile = useIsMobile();
  const variant = useSceneVariant();
  const orbitTarget = variant === "portrait" ? PORTRAIT_CAMERA_TARGET : DEFAULT_CAMERA_TARGET;
  const idleDelayMs = variant === "portrait" ? IDLE_DELAY_PORTRAIT_MS : IDLE_DELAY_DESKTOP_MS;

  // Track whether the user is currently idle. Drift only kicks in after
  // IDLE_DELAY_MS without any orbit/pan/zoom, and only while no panel
  // is open. Any interaction resets the timer; panel close also resets.
  const [idle, setIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    const armTimer = () => {
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => setIdle(true), idleDelayMs);
    };
    const wake = () => {
      setIdle(false);
      armTimer();
    };

    // Only "start" — fired when the user begins a drag/pan/wheel.
    // "change" fires every frame autoRotate runs, which would create a
    // loop where the drift cancels itself.
    ctrl.addEventListener("start", wake);
    armTimer();

    return () => {
      ctrl.removeEventListener("start", wake);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
  }, [idleDelayMs]);

  // Any panel state change is "activity": wake the camera, re-arm the
  // timer. Without this, opening then closing a panel would leave the
  // scene immediately drifting which feels jumpy.
  useEffect(() => {
    setIdle(false);
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    if (!panelOpen) {
      idleTimerRef.current = window.setTimeout(() => setIdle(true), idleDelayMs);
    }
  }, [panelOpen, cameraTarget, idleDelayMs]);

  const autoRotate = idle && !panelOpen && !freezeOrbit;

  return (
    // Wrapper exists so the portrait scrollytelling CSS can pin *the
    // container* to the viewport without collapsing the WebGL parent
    // that R3F observes for sizing. See .scene-canvas-wrapper in
    // globals.css under the (max-aspect-ratio: 4/5) media query.
    <div className="scene-canvas-wrapper" style={{ width: "100%", height: "100%" }}>
    <Canvas
      // Cap DPR so we don't shade 9x more pixels on a phone. Big perf
      // win on high-DPI screens where 1.5x and 2x already look great.
      dpr={isMobile ? [1, 1.25] : [1, 1.75]}
      // No mesh in this scene actually casts shadows — disable so the
      // shadow-map render pass + texture allocation are skipped.
      shadows={false}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      style={{ background: "var(--bg-deep)" }}
      onPointerMissed={() => onSelect(null)}
    >
      <ResponsiveCamera variant={variant} />
      <Suspense fallback={null}>
        <ServerRoom
          onAnchorsReady={onAnchorsReady}
          onSelect={onSelect}
          panelOpen={panelOpen}
          isMobile={isMobile}
          variant={variant}
        />
      </Suspense>
      {/* Portrait viewport doesn't render OrbitControls at all — its
          pointerdown handler calls setPointerCapture on the canvas
          before any enable flag check, which kills the browser's
          touch-pan-y scroll and the wheel-bubble path that
          AisleScrollRig depends on. CameraRig has a lookAt fallback
          when controlsRef.current is null, so click-fly still works
          for project panels. */}
      {variant !== "portrait" && (
        <OrbitControls
          ref={controlsRef}
          target={orbitTarget.toArray()}
          enablePan
          enableZoom
          enableRotate
          enableDamping={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.18}
          minDistance={2.5}
          maxDistance={28}
          maxPolarAngle={Math.PI / 2.05}
          screenSpacePanning
          touches={{ ONE: 0, TWO: 2 }}
          mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
        />
      )}
      <CameraRig
        target={cameraTarget}
        controlsRef={controlsRef}
        freeze={freezeOrbit}
      />
      {variant === "portrait" && !panelOpen && <AisleScrollRig />}
    </Canvas>
    </div>
  );
}
