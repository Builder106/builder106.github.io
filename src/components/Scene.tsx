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
import { aisleScroll } from "@/scene/aisleScroll";
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
// in ~100 ms, which feels "attached" to the gesture without snapping
// on mobile's discrete 80–120 px scroll ticks.
const SCROLL_SMOOTHING = 0.001;

// Inertia decay rate per second. After the user releases a swipe, the
// captured velocity multiplies by this fraction each second so the
// camera coasts and then settles. 0.0001 = ~10 % of the gesture's
// total distance carries past release; tuned so a deliberate swipe
// moves the camera 1/4–1/3 of the aisle without overshooting.
const INERTIA_DECAY = 0.0001;
// Each gesture-pixel translates into `1 / (innerHeight × GESTURE_SPAN)`
// progress. 4 × innerHeight means a full-viewport swipe advances ~25 %,
// so the user crosses the whole aisle in 3–4 deliberate swipes.
const GESTURE_SPAN = 4;

function AisleScrollRig() {
  const { camera } = useThree();
  const smoothPos = useRef(new Vector3().copy(SCROLL_CAMERA_START));
  const smoothLook = useRef(new Vector3().copy(SCROLL_TARGET_START));
  const targetPos = useRef(new Vector3());
  const targetLook = useRef(new Vector3());

  // Inertia state. velocityRef is "progress per second". We update it on
  // each touchmove and decay it in useFrame after touchend so the camera
  // coasts naturally.
  const velocity = useRef(0);
  const lastTouchY = useRef<number | null>(null);
  const lastTouchTime = useRef(0);

  useEffect(() => {
    const fullGesture = () => Math.max(window.innerHeight * GESTURE_SPAN, 800);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      aisleScroll.add(e.deltaY / fullGesture());
      // Wheel ticks aren't continuous — kill any leftover swipe inertia
      // so the camera doesn't drift past where the user stopped scrolling.
      velocity.current = 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      lastTouchY.current = e.touches[0].clientY;
      lastTouchTime.current = performance.now();
      velocity.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (lastTouchY.current === null || e.touches.length !== 1) return;
      e.preventDefault();
      const now = performance.now();
      const y = e.touches[0].clientY;
      const dy = lastTouchY.current - y;
      const dt = Math.max(0.001, (now - lastTouchTime.current) / 1000);
      const dp = dy / fullGesture();
      aisleScroll.add(dp);
      // Track velocity for post-release inertia. Use the latest sample's
      // instantaneous rate rather than averaging — feels more responsive.
      velocity.current = dp / dt;
      lastTouchY.current = y;
      lastTouchTime.current = now;
    };

    const onTouchEnd = () => {
      lastTouchY.current = null;
      // Cap so a stray flick doesn't shoot the camera through the aisle.
      const max = 2.0;
      if (velocity.current > max) velocity.current = max;
      if (velocity.current < -max) velocity.current = -max;
    };

    const onKey = (e: KeyboardEvent) => {
      const step = 1 / 8;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        aisleScroll.add(step);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        aisleScroll.add(-step);
      } else if (e.key === "Home") {
        aisleScroll.set(0);
      } else if (e.key === "End") {
        aisleScroll.set(1);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useFrame((_, delta) => {
    // Inertia coast after touchend. The velocity decays exponentially;
    // we add per-frame contribution to aisleScroll until it falls below
    // a threshold and we round it to zero.
    if (velocity.current !== 0) {
      aisleScroll.add(velocity.current * delta);
      velocity.current *= Math.pow(INERTIA_DECAY, delta);
      if (Math.abs(velocity.current) < 0.001) velocity.current = 0;
    }

    const t = aisleScroll.progress;
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
