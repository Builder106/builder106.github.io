import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { BootSequence } from "./components/BootSequence";
import { Scene } from "./components/Scene";
import { HUD } from "./components/HUD";
import { ScrollHint } from "./components/ScrollHint";

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
          <Scene
            cameraTarget={cameraTarget}
            freezeOrbit={active.kind !== "none"}
            panelOpen={active.kind !== "none"}
            onSelect={handleSelect}
            onAnchorsReady={setAnchors}
          />
          <HUD onPing={() => setActive({ kind: "contact" })} />
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
