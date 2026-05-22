import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { BootSequence } from "./components/BootSequence";
import { HUD } from "./components/HUD";
import { ScrollHint } from "./components/ScrollHint";
import { useAisleAudio } from "./components/useAisleAudio";

// The 3D scene drags in three.js + drei + the entire WebGL world —
// ~80 % of the initial bundle. Lazy-loading it moves the heavy chunk
// out of the critical path, so the BootSequence renders against a
// tiny initial JS payload and LCP improves substantially. The chunk
// is prefetched in an effect below the moment App mounts, so by the
// time the boot animation finishes the JS is usually already cached
// and there's no visible loading step.
const Scene = lazy(() =>
  import("./components/Scene").then((m) => ({ default: m.Scene })),
);

// Panels only render after a click resolves to a target, so they're
// prime split-points. Named exports get unwrapped into the default
// shape React.lazy expects.
const TradingTerminal = lazy(() =>
  import("./components/panels/TradingTerminal").then((m) => ({
    default: m.TradingTerminal,
  })),
);
const ProjectCard = lazy(() =>
  import("./components/panels/ProjectCard").then((m) => ({
    default: m.ProjectCard,
  })),
);
const ContactPing = lazy(() =>
  import("./components/panels/ContactPing").then((m) => ({
    default: m.ContactPing,
  })),
);
// SemanticContent is now injected as static HTML by the Vite plugin
// in vite.config.ts — see src/utils/semanticHtml.ts. React doesn't
// render it on the client; non-JS crawlers see the full content at
// first byte.
import {
  defaultCameraTarget,
  projectCameraTarget,
  terminalCameraTarget,
  type CameraTarget,
} from "./scene/cameraRig";
import type { SceneAnchor } from "./scene/anchors";
import type { ClickTarget } from "./scene/clickResolver";
import { useSceneVariant } from "./scene/sceneVariant";
import { projects } from "./data/projects";

type ActivePanel =
  | { kind: "none" }
  | { kind: "terminal" }
  | { kind: "project"; projectId: string }
  | { kind: "contact" };

// How long to keep lerping the camera toward the active anchor (or
// default) after a panel-state transition. After this window expires
// the rig stops fighting OrbitControls and the user can orbit / pan /
// zoom freely. Roughly matches the ~700ms convergence of the lerp at
// SMOOTHING=0.0015.
const TARGET_SETTLE_MS = 850;

export function App() {
  const [booted, setBooted] = useState(false);
  const [active, setActive] = useState<ActivePanel>({ kind: "none" });
  const [anchors, setAnchors] = useState<Map<string, SceneAnchor> | null>(null);
  // Prefetch the heavy Scene chunk the moment App mounts. The
  // BootSequence runs for ~1–2 s, which is normally enough to fully
  // download three.js + drei + the scene module on a half-decent
  // connection; by the time `booted` flips and Suspense reaches for
  // the chunk, it's already cached and there's no visible loading
  // step. Slow connections still get a graceful BootSequence fallback.
  useEffect(() => {
    void import("./components/Scene");
  }, []);
  // Ambient audio (WebAudio synth — see useAisleAudio). Defaults on
  // post-boot; the synth needs a user-gesture to actually start per
  // browser policy, so first interaction is what really kicks it off.
  const [audioEnabled, setAudioEnabled] = useState(true);
  useAisleAudio(booted && audioEnabled);
  // Drives the "fly back to home" target after a panel closes — portrait
  // and landscape have different default vantages, so we route the
  // variant into defaultCameraTarget() below.
  const variant = useSceneVariant();
  // True only during the brief window after `active` changes; outside
  // that window cameraTarget becomes null and OrbitControls owns the
  // camera.
  const [transitioning, setTransitioning] = useState(true);

  useEffect(() => {
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), TARGET_SETTLE_MS);
    return () => clearTimeout(t);
  }, [active]);

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), []);

  const close = useCallback(() => setActive({ kind: "none" }), []);

  const handleSelect = useCallback((target: ClickTarget) => {
    if (target === null) {
      setActive({ kind: "none" });
      return;
    }
    if (target.kind === "terminal") {
      setActive({ kind: "terminal" });
      return;
    }
    setActive({ kind: "project", projectId: target.projectId });
  }, []);

  const cameraTarget: CameraTarget | null = useMemo(() => {
    if (!anchors) return null;
    // Once the post-transition window expires we stop steering the
    // camera and let OrbitControls own it. Re-engages on the next
    // active change.
    if (active.kind === "none" && !transitioning) return null;
    if (active.kind === "none") return defaultCameraTarget(variant);
    if (active.kind === "contact") return defaultCameraTarget(variant);
    if (active.kind === "terminal") {
      const a = anchors.get("terminal");
      return a ? terminalCameraTarget(a) : defaultCameraTarget(variant);
    }
    const a = anchors.get(active.projectId);
    return a ? projectCameraTarget(a, variant) : defaultCameraTarget(variant);
  }, [active, anchors, transitioning, variant]);

  const activeProject =
    active.kind === "project" ? projectsById.get(active.projectId) ?? null : null;

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      {booted && (
        <>
          {/* Suspense fallback is null because the chunk is almost always
              prefetched by the BootSequence-paced effect above. If a
              very slow connection somehow leaves it un-cached, the user
              gets a brief black flash rather than an in-place spinner
              — preferable to a spinner clashing with the boot aesthetic. */}
          <Suspense fallback={null}>
            <Scene
              cameraTarget={cameraTarget}
              freezeOrbit={active.kind !== "none"}
              panelOpen={active.kind !== "none"}
              onSelect={handleSelect}
              onAnchorsReady={setAnchors}
            />
          </Suspense>
          <HUD
            onPing={() => setActive({ kind: "contact" })}
            audioEnabled={audioEnabled}
            onToggleAudio={() => setAudioEnabled((v) => !v)}
          />
          {variant === "portrait" && active.kind === "none" && <ScrollHint />}
          <Suspense fallback={null}>
            <TradingTerminal open={active.kind === "terminal"} onClose={close} />
            <ProjectCard project={activeProject} onClose={close} />
            <ContactPing open={active.kind === "contact"} onClose={close} />
          </Suspense>
        </>
      )}
    </>
  );
}
