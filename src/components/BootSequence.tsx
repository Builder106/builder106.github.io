import { useEffect, useRef, useState } from "react";
import "./BootSequence.css";

// Minimum on-screen time so the bootup actually reads as a sequence and
// doesn't disappear in 200ms on a fast machine. Tune to taste.
const MIN_DURATION_MS = 2200;

const LINES = [
  { text: "[boot] initializing nvram....................[ok]", delay: 120 },
  { text: "[boot] mounting /dev/sda1 → /................[ok]", delay: 90 },
  { text: "[boot] loading kernel modules................[ok]", delay: 110 },
  { text: "[net]  bringing up eth0......................[ok]", delay: 130 },
  { text: "[stack] python  3.12.....linked..............[ok]", delay: 70 },
  { text: "[stack] ocaml   5.2.0....linked..............[ok]", delay: 70 },
  { text: "[stack] typescript  5.6..linked..............[ok]", delay: 70 },
  { text: "[stack] r       4.4.....linked...............[ok]", delay: 70 },
  { text: "[net]  connecting to yinkavaughan.me.........[ok]", delay: 200 },
  { text: "[ok]   handshake complete. opening shell.", delay: 240 },
];

interface BootSequenceProps {
  onComplete: () => void;
}

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [fading, setFading] = useState(false);
  const startedAt = useRef(performance.now());

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setVisibleCount(i);
      if (i < LINES.length) {
        setTimeout(tick, LINES[i].delay);
      } else {
        const elapsed = performance.now() - startedAt.current;
        const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
        setTimeout(() => {
          if (cancelled) return;
          setFading(true);
          setTimeout(() => !cancelled && onComplete(), 450);
        }, remaining);
      }
    };
    setTimeout(tick, LINES[0].delay);
    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return (
    <div className={`boot-sequence ${fading ? "boot-sequence--fading" : ""}`}>
      <div className="boot-sequence__inner">
        <div className="boot-sequence__header">
          <span className="boot-sequence__prompt">yinka@portfolio</span>
          <span className="boot-sequence__sep">:</span>
          <span className="boot-sequence__path">~</span>
          <span className="boot-sequence__sep">$</span>
          <span className="boot-sequence__cmd">./boot --target server-room</span>
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
