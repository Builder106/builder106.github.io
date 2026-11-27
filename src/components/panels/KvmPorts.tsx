import { TOUR_ORDER, projects } from '@/data/projects';
import type { ActivePanel } from '@/scene/activePanel';
import type { CSSProperties } from 'react';

interface KvmPortsProps {
  // Port whose LED is lit: the rack on screen, or null for none.
  activeId: string | null;
  onNavigate: (target: ActivePanel) => void;
}

const RACKS = TOUR_ORDER.map((id) => projects.find((p) => p.id === id)).filter(
  (p): p is (typeof projects)[number] => p !== undefined,
);

// The KVM switch on the drawer front: one rubber key per rack in tour
// order, grouped by wing the way a switch groups its ports. Each LED takes
// its rack's colour; pressing a key switches the screen to that rack.
export function KvmPorts({ activeId, onNavigate }: KvmPortsProps) {
  return (
    <ul className="kvm-ports" aria-label="Racks">
      {RACKS.map((rack, i) => {
        const active = rack.id === activeId;
        const wingStart = i > 0 && RACKS[i - 1].cluster !== rack.cluster;
        return (
          <li
            key={rack.id}
            className={wingStart ? 'kvm-ports__item kvm-ports__item--wing' : 'kvm-ports__item'}
          >
            <button
              type="button"
              className="kvm-port"
              style={{ '--led': rack.color ?? '#4cf2ff', '--i': i } as CSSProperties}
              aria-current={active ? 'true' : undefined}
              aria-label={`Port ${i + 1}: ${rack.name}`}
              title={rack.name}
              onClick={() => onNavigate({ kind: 'project', projectId: rack.id })}
            >
              <span className="kvm-port__led" aria-hidden />
              <span className="kvm-port__key" aria-hidden />
              <span className="kvm-port__num" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
