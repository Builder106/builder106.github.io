import { useEffect, useState } from "react";

// Reactive mobile-or-not flag based on a `(max-width: <px>)` media query.
// Used outside the Canvas to choose perf settings (DPR, shadow maps,
// reflector resolution) and inside ServerRoom to skip heavy lights.

const DEFAULT_QUERY = "(max-width: 720px)";

export function useIsMobile(query: string = DEFAULT_QUERY): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return isMobile;
}
