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
      <span className="scroll-hint__label">scroll</span>
      <svg
        className="scroll-hint__chevron"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
