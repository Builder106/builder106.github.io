import { useEffect, useRef, type ReactNode } from "react";
import "./Panel.css";

interface PanelShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Extra class applied to the outer .panel root. Used by callers
  // that need a wider/taller variant — e.g. TradingTerminal asks for
  // `.panel--console` so the dashboard + log have room to breathe.
  variantClass?: string;
}

// Shared chrome for every dialog panel (TradingTerminal, ProjectCard,
// ContactPing). Gives each one the same Mac-style traffic-light header,
// reticle-corner brackets, scan-line reveal, and close button so the
// entrance animation is consistent across the site.
export function PanelShell({ open, title, onClose, children, variantClass }: PanelShellProps) {
  // Set the `inert` DOM property on the root when closed. inert removes
  // every descendant from focus + the accessibility tree, which fixes
  // the Lighthouse "aria-hidden=true with focusable descendents" audit
  // (the close button + the contact-card COPY buttons were tab-reachable
  // even when the panel was visually hidden). Set via ref because
  // React 18 doesn't type the inert JSX prop yet (added in React 19).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !open;
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`panel ${open ? "panel--open" : ""} ${variantClass ?? ""}`.trim()}
      role="dialog"
      aria-hidden={!open}
    >
      {/* Brackets sit on the outer wrapper so they aren't clipped by the
          inner box's overflow:hidden + rounded corners. */}
      <span className="panel__bracket panel__bracket--tl" aria-hidden />
      <span className="panel__bracket panel__bracket--tr" aria-hidden />
      <span className="panel__bracket panel__bracket--bl" aria-hidden />
      <span className="panel__bracket panel__bracket--br" aria-hidden />

      <div className="panel__inner">
        <span className="panel__scan" aria-hidden />
        {/* Slow continuous scan-line overlay, only on variants that opt
            in (currently just the control console). Sibling of the
            scrollable body so it floats over content without moving
            with scroll. */}
        {variantClass?.includes("console") && (
          <span className="panel__overlay-scan" aria-hidden />
        )}

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
