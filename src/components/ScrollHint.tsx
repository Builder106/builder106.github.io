import { useEffect, useState } from "react";
import "./ScrollHint.css";

// Affordance for the portrait scroll-the-aisle mechanic. Renders a
// bouncing chevron + "scroll" label centred above the bottom HUD row.
// Opacity fades from 1 → 0 as the user scrolls past the first ~12% of
// the page so the hint disappears once they've understood the gesture.
// Pointer-events: none so it never intercepts taps on the terminal /
// PING button below it.
export function ScrollHint() {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const t = max > 0 ? window.scrollY / max : 0;
      // Fully visible until 2 % scroll, then linear fade to 0 by 12 %.
      // Tuned so a single deliberate flick on a phone drops the hint
      // away before the user looks back down.
      const next = 1 - Math.max(0, Math.min(1, (t - 0.02) / 0.1));
      setOpacity(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
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
