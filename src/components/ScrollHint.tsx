import { useEffect, useState } from "react";
import { aisleScroll } from "../scene/aisleScroll";
import "./ScrollHint.css";

// Affordance for the portrait swipe-the-aisle mechanic. Renders a
// bouncing chevron + "scroll" label centred above the bottom HUD row.
// Opacity fades from 1 → 0 once the user has advanced ~12 % into the
// aisle so the hint disappears after they've understood the gesture.
// Pointer-events: none so it never intercepts taps below it.
export function ScrollHint() {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // Subscribe to the virtual scroll progress (driven by
    // AisleScrollRig from wheel + touch capture — *not* window.scrollY,
    // which we deliberately don't use any more).
    const compute = (t: number) => {
      const next = 1 - Math.max(0, Math.min(1, (t - 0.02) / 0.1));
      setOpacity(next);
    };
    compute(aisleScroll.progress);
    return aisleScroll.subscribe(compute);
  }, []);

  if (opacity <= 0.01) return null;

  return (
    <div className="scroll-hint" style={{ opacity }} aria-hidden>
      <svg
        className="scroll-hint__mouse"
        viewBox="0 0 24 40"
        width="22"
        height="36"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="36" rx="10" ry="10" />
        <circle
          className="scroll-hint__mouse-dot"
          cx="12"
          cy="10"
          r="1.8"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    </div>
  );
}
