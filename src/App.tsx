import { useCallback, useMemo, useState } from "react";
import { BootSequence } from "./components/BootSequence";
import { Scene } from "./components/Scene";
import { HUD } from "./components/HUD";
import { TradingTerminal } from "./components/panels/TradingTerminal";
import { ProjectCard } from "./components/panels/ProjectCard";
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
  | { kind: "project"; projectId: string };

export function App() {
  const [booted, setBooted] = useState(false);
  const [active, setActive] = useState<ActivePanel>({ kind: "none" });
  const [anchors, setAnchors] = useState<Map<string, SceneAnchor> | null>(null);

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
    if (active.kind === "none") return defaultCameraTarget();
    if (active.kind === "terminal") {
      const a = anchors.get("terminal");
      return a ? terminalCameraTarget(a) : defaultCameraTarget();
    }
    const a = anchors.get(active.projectId);
    return a ? projectCameraTarget(a) : defaultCameraTarget();
  }, [active, anchors]);

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
            onSelect={handleSelect}
            onAnchorsReady={setAnchors}
          />
          <HUD onPing={() => (window.location.href = "mailto:vaughanolayinka@gmail.com")} />
          <TradingTerminal open={active.kind === "terminal"} onClose={close} />
          <ProjectCard project={activeProject} onClose={close} />
        </>
      )}
    </>
  );
}
