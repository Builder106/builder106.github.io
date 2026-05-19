import { useEffect, useState } from "react";

// Two scenes ship in public/models/: a landscape-first composition (the
// authored room with two flanking rack walls and a central desk) and a
// portrait-first composition (three tiered terraces stacked top-to-bottom).
// At runtime we pick whichever fits the viewport's aspect ratio.
//
// Both scenes share the same naming contract (anchor_<id>, Rack_<id>,
// Monitor, Desk — see docs/blender-contract.md) so anchors, click
// resolution, and camera flies work identically across them.

export type SceneVariant = "portrait" | "landscape";

export const MODEL_URLS: Record<SceneVariant, string> = {
  portrait: "/models/server-room-portrait.glb",
  landscape: "/models/server-room.glb",
};

// Portrait when viewport aspect is ≤ 4/5. Matches the threshold the
// previous ResponsiveCamera used inline; promoting it here so glb load,
// camera framing, and OrbitControls target all flip together.
const PORTRAIT_QUERY = "(max-aspect-ratio: 4/5)";

function readInitial(): SceneVariant {
  if (typeof window === "undefined") return "landscape";
  return window.matchMedia(PORTRAIT_QUERY).matches ? "portrait" : "landscape";
}

export function useSceneVariant(): SceneVariant {
  const [variant, setVariant] = useState<SceneVariant>(readInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(PORTRAIT_QUERY);
    const handler = (e: MediaQueryListEvent) =>
      setVariant(e.matches ? "portrait" : "landscape");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return variant;
}
