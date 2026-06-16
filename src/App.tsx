import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BootSequence } from "./components/BootSequence";
import { HUD } from "./components/HUD";
import { ScrollHint } from "./components/ScrollHint";
import {
  DEFAULT_TRACK_ID,
  isTrackId,
  useAisleAudio,
  type TrackId,
} from "./components/useAisleAudio";
// Side-effect import: pins SESSION_START_MS at app load so the
// TradingTerminal's uptime widget can read the correct timestamp even
// when the panel chunk loads lazily later.
import "./scene/sessionStart";

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
// The semantic text mirror is generated at build time by
// buildSemanticContentHTML() in src/utils/semanticHtml.ts and injected
// into index.html by the Vite plugin in vite.config.ts as a sibling of
// #root — never rendered by React. Non-JS crawlers, LLM agents, and
// screen readers get the full portfolio at first byte.
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
  // Ambient audio (streamed CC-BY mp3 — see useAisleAudio). Defaults
  // on post-boot; browser autoplay policy requires a user gesture to
  // actually start playback, so first interaction is what really kicks
  // it off. The selected track persists across sessions so returning
  // visitors keep their pick.
  const [audioEnabled, setAudioEnabled] = useState(true);
  const AUDIO_TRACK_KEY = "ov_audio_track_v1";
  const [trackId, setTrackId] = useState<TrackId>(() => {
    if (typeof window === "undefined") return DEFAULT_TRACK_ID;
    try {
      const saved = window.localStorage.getItem(AUDIO_TRACK_KEY);
      if (isTrackId(saved)) return saved;
    } catch {
      /* quota / private-mode failures are non-fatal */
    }
    return DEFAULT_TRACK_ID;
  });
  const handleSelectTrack = useCallback((id: TrackId) => {
    setTrackId(id);
    try {
      window.localStorage.setItem(AUDIO_TRACK_KEY, id);
    } catch {
      /* quota / private-mode failures are non-fatal */
    }
  }, []);
  useAisleAudio({ enabled: booted && audioEnabled, trackId });
  const variant = useSceneVariant();

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), []);

  const close = useCallback(() => setActive({ kind: "none" }), []);

  // First-time-interaction signal for the HUD's "tap a rack" hint.
  // Persisted to localStorage so returning visitors don't see the
  // hint again on repeat sessions. Flips on the first real selection
  // (project / terminal / contact panel opens).
  const HAS_EXPLORED_KEY = "ov_has_explored_v1";
  const [hasExplored, setHasExplored] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(HAS_EXPLORED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const markExplored = useCallback(() => {
    setHasExplored((prev) => {
      if (prev) return prev;
      try {
        window.localStorage.setItem(HAS_EXPLORED_KEY, "1");
      } catch {
        /* quota / private-mode failures are non-fatal */
      }
      return true;
    });
  }, []);

  // Suppress null-selects (Canvas onPointerMissed) that fire in the
  // same micro-window as a fresh non-null select. The label-button
  // path and Canvas's pointerup-missed path both feed handleSelect,
  // and depending on browser the missed callback fires *after* the
  // button click — overwriting the just-opened panel with "none". A
  // 150 ms ignore window lets a real "click outside to close" still
  // work without clobbering a deliberate select.
  const lastSelectRef = useRef(0);
  const handleSelect = useCallback((target: ClickTarget) => {
    const now = performance.now();
    if (target === null && now - lastSelectRef.current < 150) return;
    lastSelectRef.current = now;
    if (target === null) {
      setActive({ kind: "none" });
      return;
    }
    markExplored();
    if (target.kind === "terminal") {
      setActive({ kind: "terminal" });
      return;
    }
    if (target.kind === "linkedin") {
      // Operator holo click → open LinkedIn. Stays out of the panel
      // system since this is a navigation, not an in-app view.
      if (typeof window !== "undefined") {
        window.open(
          "https://www.linkedin.com/in/yinka-vaughan/",
          "_blank",
          "noopener,noreferrer",
        );
      }
      return;
    }
    setActive({ kind: "project", projectId: target.projectId });
  }, [markExplored]);

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
            onPing={() => {
              markExplored();
              setActive({ kind: "contact" });
            }}
            audioEnabled={audioEnabled}
            onToggleAudio={() => setAudioEnabled((v) => !v)}
            hasExplored={hasExplored}
          />
          {variant === "portrait" && active.kind === "none" && <ScrollHint />}
          <Suspense fallback={null}>
            <TradingTerminal
              open={active.kind === "terminal"}
              onClose={close}
              onNavigate={setActive}
              audioEnabled={audioEnabled}
              onToggleAudio={() => setAudioEnabled((v) => !v)}
              trackId={trackId}
              onSelectTrack={handleSelectTrack}
            />
            <ProjectCard project={activeProject} onClose={close} onNavigate={setActive} />
            <ContactPing open={active.kind === "contact"} onClose={close} />
          </Suspense>
        </>
      )}
    </>
  );
}
