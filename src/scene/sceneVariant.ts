import { useEffect, useState } from "react";

// One glb ships at /models/server-room.glb — the landscape "cityscape"
// composition (back wall + two flanking rack walls + central desk). On
// portrait viewports we used to load a separate tiered-amphitheater glb,
// but it read as a cramped column with overlapping racks and stacked
// labels. We now load the same landscape scene everywhere and reframe
// the camera per viewport instead. The amphitheater .blend/.glb files
// remain in the repo for reference but aren't loaded at runtime.
//
// The `SceneVariant` enum is still a "portrait viewport vs landscape
// viewport" flag — used for camera framing, label density, and the
// per-anchor face-normal logic in ServerRoom — even though both
// variants now point at the same model.

export type SceneVariant = "portrait" | "landscape";

export const MODEL_URLS: Record<SceneVariant, string> = {
  portrait: "/models/server-room.glb",
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
