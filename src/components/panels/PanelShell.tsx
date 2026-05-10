import type { ReactNode } from "react";
import "./Panel.css";

interface PanelShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Shared chrome for every dialog panel (TradingTerminal, ProjectCard,
// ContactPing). Gives each one the same Mac-style traffic-light header,
// reticle-corner brackets, scan-line reveal, and close button so the
// entrance animation is consistent across the site.
export function PanelShell({ open, title, onClose, children }: PanelShellProps) {
  return (
    <div className={`panel ${open ? "panel--open" : ""}`} role="dialog" aria-hidden={!open}>
      {/* Brackets sit on the outer wrapper so they aren't clipped by the
          inner box's overflow:hidden + rounded corners. */}
      <span className="panel__bracket panel__bracket--tl" aria-hidden />
      <span className="panel__bracket panel__bracket--tr" aria-hidden />
      <span className="panel__bracket panel__bracket--bl" aria-hidden />
      <span className="panel__bracket panel__bracket--br" aria-hidden />

      <div className="panel__inner">
        <span className="panel__scan" aria-hidden />

        <header className="panel__header">
          <div className="panel__chrome">
            <span className="panel__chrome-dot panel__chrome-dot--red" />
            <span className="panel__chrome-dot panel__chrome-dot--amber" />
            <span className="panel__chrome-dot panel__chrome-dot--green" />
          </div>
          <h2 className="panel__title">{title}</h2>
          <button className="panel__close" onClick={onClose} aria-label="Close">
            <span aria-hidden>esc</span>
          </button>
        </header>

        <div className="panel__body">{children}</div>
      </div>
    </div>
  );
}
