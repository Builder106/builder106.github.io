import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3 } from "three";
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

// Per-variant camera framing. Portrait and landscape variants now load
// the same landscape glb (see sceneVariant.ts) — the amphitheater was
// retired. We still reframe the camera based on viewport aspect so the
// authored cityscape reads well in a narrow viewport.
function ResponsiveCamera({ variant }: { variant: SceneVariant }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);

  const { position, fov } = useMemo(() => {
    if (variant === "portrait") {
      // Portrait vantage: front-and-centre, elevated, pulled back further
      // than landscape. FOV widens aggressively on tall viewports — at
      // aspect 0.5 (typical phone) we need ~70° vertical FOV to keep the
      // 14m-wide room readable without squashing it. The camera is also
      // angled *down* slightly (target.y < camera.y) so the user reads
      // the scene as "looking into a data hall" rather than "staring
      // through rack silhouettes," which was the previous complaint.
      const pos = PORTRAIT_CAMERA_POSITION.clone();
      // Phone-narrow viewports (aspect < 0.5) want even more pullback +
      // FOV so the side walls stay in frame.
      if (aspect < 0.5) {
        pos.z = 14.5;
        pos.y = 5.6;
        return { position: pos, fov: 72 };
      }
      if (aspect < 0.65) {
        return { position: pos, fov: 66 };
      }
      // Squarish portrait (tablet, phone-landscape that still tripped the
      // 4/5 aspect threshold).
      return { position: pos, fov: 58 };
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
      <OrbitControls
        ref={controlsRef}
        target={orbitTarget.toArray()}
        enablePan
        enableZoom
        enableRotate
        enableDamping={false}
        // Idle drift speed. On desktop ~1°/s reads as "the camera's
        // alive" without distracting from exploration. On portrait the
        // user can't see the whole room at once, so we crank the orbit
        // ~3x faster — the camera actively *tours* the racks instead of
        // drifting in place, which restores the "wow" from desktop.
        autoRotate={autoRotate}
        autoRotateSpeed={variant === "portrait" ? 0.55 : 0.18}
        minDistance={2.5}
        maxDistance={28}
        maxPolarAngle={Math.PI / 2.05}
        screenSpacePanning
        // Touch gesture mapping: 1 finger = rotate, 2 fingers = pan +
        // pinch-zoom. Without this drei sometimes uses the desktop
        // mapping (right-click pan) which doesn't translate.
        touches={{
          ONE: 0 /* THREE.TOUCH.ROTATE */,
          TWO: 2 /* THREE.TOUCH.DOLLY_PAN */,
        }}
        // Mouse mapping: left = orbit, middle = pan, right = pan.
        mouseButtons={{
          LEFT: 0 /* THREE.MOUSE.ROTATE */,
          MIDDLE: 1 /* THREE.MOUSE.DOLLY */,
          RIGHT: 2 /* THREE.MOUSE.PAN */,
        }}
      />
      <CameraRig
        target={cameraTarget}
        controlsRef={controlsRef}
        freeze={freezeOrbit}
      />
    </Canvas>
  );
}
