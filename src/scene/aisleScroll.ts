// Virtual scroll progress for the portrait aisle camera. We deliberately
// do *not* use window.scrollY — letting the page scroll caused two real
// issues on real iOS Safari:
//   1. The momentum-scrolled body un-pinned the position:fixed canvas
//      wrapper so the scene visibly slid up the screen.
//   2. The user perceived the experience as "scrolling a tall page"
//      rather than "walking down an aisle" because there *was* a real
//      scrollbar / page motion.
// Instead, AisleScrollRig captures wheel + touchmove events and feeds
// a number in [0, 1] here. The page itself remains overflow: hidden.
// ScrollHint subscribes for the entrance-affordance fade.

type Listener = (progress: number) => void;

const listeners = new Set<Listener>();
let current = 0;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export const aisleScroll = {
  get progress(): number {
    return current;
  },

  set(value: number): void {
    const next = clamp01(value);
    if (next === current) return;
    current = next;
    for (const fn of listeners) fn(next);
  },

  add(delta: number): void {
    this.set(current + delta);
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
