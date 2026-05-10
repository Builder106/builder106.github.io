import { useCallback, useEffect, useMemo, useState } from "react";
import { BootSequence } from "./components/BootSequence";
import { Scene } from "./components/Scene";
import { HUD } from "./components/HUD";
import { TradingTerminal } from "./components/panels/TradingTerminal";
import { ProjectCard } from "./components/panels/ProjectCard";
import { ContactPing } from "./components/panels/ContactPing";
import {
  defaultCameraTarget,
  projectCameraTarget,
  terminalCameraTarget,
  type CameraTarget,
} from "./scene/cameraRig";
import type { SceneAnchor } from "./scene/anchors";
import type { ClickTarget } from "./scene/clickResolver";
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
    if (active.kind === "none") return defaultCameraTarget();
    if (active.kind === "contact") return defaultCameraTarget();
    if (active.kind === "terminal") {
      const a = anchors.get("terminal");
      return a ? terminalCameraTarget(a) : defaultCameraTarget();
    }
    const a = anchors.get(active.projectId);
    return a ? projectCameraTarget(a) : defaultCameraTarget();
  }, [active, anchors, transitioning]);

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
          <TradingTerminal open={active.kind === "terminal"} onClose={close} />
          <ProjectCard project={activeProject} onClose={close} />
          <ContactPing open={active.kind === "contact"} onClose={close} />
        </>
      )}
    </>
  );
}
