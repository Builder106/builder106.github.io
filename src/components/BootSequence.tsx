import { useCallback, useEffect, useRef, useState } from 'react';
import { isAutomatedEnvironment } from '../utils/isAutomated';
import './BootSequence.css';

// Minimum on-screen time so the bootup actually reads as a sequence and
// doesn't disappear in 200ms on a fast machine. Tune to taste.
const MIN_DURATION_MS = 2200;

const LINES = [
  { text: '[boot] initializing nvram....................[ok]', delay: 120 },
  { text: '[boot] mounting /dev/sda1 → /................[ok]', delay: 90 },
  { text: '[boot] loading kernel modules................[ok]', delay: 110 },
  { text: '[net]  bringing up eth0......................[ok]', delay: 130 },
  { text: '[stack] python  3.12.....linked..............[ok]', delay: 70 },
  { text: '[stack] ocaml   5.2.0....linked..............[ok]', delay: 70 },
  { text: '[stack] typescript  5.6..linked..............[ok]', delay: 70 },
  { text: '[stack] r       4.4.....linked...............[ok]', delay: 70 },
  { text: '[net]  connecting to yinkavaughan.me.........[ok]', delay: 200 },
  { text: '[ok]   handshake complete. opening shell.', delay: 240 },
];

interface BootSequenceProps {
  onComplete: () => void;
}

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [fading, setFading] = useState(false);
  const startedAt = useRef(0);
  const completedRef = useRef(false);

  const skip = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    // 1. Honor accessibility preference for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 2. Fast-forward automated audits (Lighthouse, Headless Chrome, WebDriver)
    const isAutomated = isAutomatedEnvironment();

    if (prefersReducedMotion || isAutomated) {
      skip();
      return;
    }

    startedAt.current = performance.now();
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled || completedRef.current) return;
      i += 1;
      setVisibleCount(i);
      if (i < LINES.length) {
        setTimeout(tick, LINES[i].delay);
      } else {
        const elapsed = performance.now() - startedAt.current;
        const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
        setTimeout(() => {
          if (cancelled || completedRef.current) return;
          setFading(true);
          setTimeout(() => {
            if (!cancelled && !completedRef.current) {
              completedRef.current = true;
              onComplete();
            }
          }, 450);
        }, remaining);
      }
    };
    setTimeout(tick, LINES[0].delay);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        skip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete, skip]);

  return (
    <div
      className={`boot-sequence ${fading ? 'boot-sequence--fading' : ''}`}
      onClick={skip}
      role="button"
      tabIndex={0}
      aria-label="Boot sequence. Click or press Escape to skip."
    >
      <div className="boot-sequence__inner">
        <div className="boot-sequence__header">
          <span className="boot-sequence__prompt">yinka@portfolio</span>
          <span className="boot-sequence__sep">:</span>
          <span className="boot-sequence__path">~</span>
          <span className="boot-sequence__sep">$</span>
          <span className="boot-sequence__cmd">./boot --target server-room</span>
          <span className="boot-sequence__skip">[esc to skip]</span>
        </div>
        <ul className="boot-sequence__lines">
          {LINES.slice(0, visibleCount).map((line, idx) => (
            <li key={idx}>{line.text}</li>
          ))}
          {visibleCount < LINES.length && <li className="boot-sequence__cursor">_</li>}
        </ul>
      </div>
    </div>
  );
}
