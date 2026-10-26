import { AISLE_ORDER, projects } from '@/data/projects';
import type { CSSProperties } from 'react';

interface AisleStripProps {
  // Rack to light at full height, or null when no rack is nearer than
  // another (landscape console).
  activeId: string | null;
}

const RACKS = AISLE_ORDER.map((id) => projects.find((p) => p.id === id)).filter(
  (p): p is (typeof projects)[number] => p !== undefined,
);

// One light slat per rack in aisle order, drawn like the slats on the rack
// faces and tinted with each project's own colour. A gap opens wherever the
// aisle moves to another wing. Decorative: navigation lives on the
// prev/next buttons beside it, and the rack names are in the panel text.
export function AisleStrip({ activeId }: AisleStripProps) {
  return (
    <span className="aisle" aria-hidden>
      {RACKS.map((rack, i) => (
        <span
          key={rack.id}
          className={[
            'aisle__slat',
            rack.id === activeId ? 'aisle__slat--active' : '',
            i > 0 && RACKS[i - 1].cluster !== rack.cluster ? 'aisle__slat--wing' : '',
          ]
            .join(' ')
            .trim()}
          style={{ '--slat': rack.color ?? '#4cf2ff', '--i': i } as CSSProperties}
        />
      ))}
    </span>
  );
}
