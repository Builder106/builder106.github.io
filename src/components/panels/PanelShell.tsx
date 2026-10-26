import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import './Panel.css';

interface PanelShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Extra class applied to the outer .panel root. Used by callers
  // that need a wider/taller variant — e.g. TradingTerminal asks for
  // `.panel--console` so the terminal + push list have room to breathe.
  variantClass?: string;
  // Content placed in the bezel between the title and the close button:
  // the aisle strip and prev/next on a project card, the aisle telemetry
  // on the console.
  bezel?: ReactNode;
  // Accent colour of the thing that was clicked. Drives the chassis edge,
  // glow, slats and primary action through --accent. Defaults to the
  // room's cyan in Panel.css.
  accent?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared chassis for every dialog panel (TradingTerminal, ProjectCard,
// ContactPing): rack-body housing, a bezel across the top with the title
// and close control, and an accent taken from what was clicked.
export function PanelShell({
  open,
  title,
  onClose,
  children,
  variantClass,
  bezel,
  accent,
}: PanelShellProps) {
  // Set the `inert` DOM property on the root when closed. inert removes
  // every descendant from focus + the accessibility tree, which fixes
  // the Lighthouse "aria-hidden=true with focusable descendents" audit
  // (the close button + the contact-card COPY buttons were tab-reachable
  // even when the panel was visually hidden).
  const rootRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !open;

    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Move focus into the dialog so keyboard users start in its scope.
      // A child that already took focus (the console prompt) keeps it.
      const focusTimer = window.setTimeout(() => {
        if (rootRef.current?.contains(document.activeElement)) return;
        closeButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key !== 'Tab' || !rootRef.current) return;
        // Keep Tab inside the dialog: wrap from the last control to the
        // first and back.
        const focusable = rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const inside = rootRef.current.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.clearTimeout(focusTimer);
        window.removeEventListener('keydown', handleKeyDown);
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [open, onClose]);

  const style = accent ? ({ '--accent': accent } as CSSProperties) : undefined;

  return (
    <div
      ref={rootRef}
      className={`panel ${open ? 'panel--open' : ''} ${variantClass ?? ''}`.trim()}
      role="dialog"
      aria-modal={open}
      aria-labelledby={titleId}
      aria-hidden={!open}
      style={style}
    >
      <div className="panel__inner">
        <header className="panel__header">
          <h2 className="panel__title" id={titleId}>
            {title}
          </h2>
          {bezel}
          <button
            ref={closeButtonRef}
            type="button"
            className="panel__close"
            onClick={onClose}
            aria-label="Close (Esc)"
          >
            <span className="panel__close-key" aria-hidden>
              esc
            </span>
            <span className="panel__close-touch" aria-hidden>
              close
            </span>
          </button>
        </header>

        <div className="panel__body">{children}</div>
      </div>
    </div>
  );
}
