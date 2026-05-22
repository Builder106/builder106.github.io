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
import type { ClickTarget } from "./scene/clickResolver";
import { useSceneVariant } from "./scene/sceneVariant";
import { projects } from "./data/projects";
import type { ActivePanel } from "./scene/activePanel";

export function App() {
  const [booted, setBooted] = useState(false);
  const [active, setActive] = useState<ActivePanel>({ kind: "none" });
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
  const variant = useSceneVariant();

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
              — preferable to a spinner clashing with the boot aesthetic.
              Camera target resolution (anchors → CameraTarget) lives
              inside Scene so App stays out of three.js's dependency
              tree — keeps Vector3 + the rest of three in the lazy
              Scene chunk rather than the initial bundle. */}
          <Suspense fallback={null}>
            <Scene active={active} onSelect={handleSelect} />
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
