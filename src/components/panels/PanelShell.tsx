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
  // Controls on the drawer front between the label and the eject key:
  // the KVM port keys and prev/next on a project card and the console.
  tray?: ReactNode;
  // Text for the KVM on-screen display in the screen's top corner,
  // e.g. "PORT 02". Omitted on panels with no port.
  osd?: string;
  // Accent colour of the thing that was clicked. Drives the chassis edge,
  // glow, slats and primary action through --accent. Defaults to the
  // room's cyan in Panel.css.
  accent?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared chassis for every dialog panel (TradingTerminal, ProjectCard,
// ContactPing): the rack's KVM console drawer. The 1U drawer front rolls
// out with a label-maker tag (the title), the port keys and an eject key;
// the screen hinges up behind it and shows the content. The accent is the
// colour of what was clicked and lights the screen and the port LED.
export function PanelShell({
  open,
  title,
  onClose,
  children,
  variantClass,
  tray,
  osd,
  accent,
}: PanelShellProps) {
  // Set the `inert` DOM property on the root when closed. inert removes
  // every descendant from focus + the accessibility tree, which fixes
  // the Lighthouse "aria-hidden=true with focusable descendents" audit
  // (the close button + the contact-card COPY buttons were tab-reachable
  // even when the panel was visually hidden).
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !open;

    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Move focus into the dialog so keyboard users start in its scope.
      // The title takes it, not the eject key, so no control lights up as
      // if it were pressed. A child that already took focus (the console
      // prompt) keeps it.
      const focusTimer = window.setTimeout(() => {
        if (rootRef.current?.contains(document.activeElement)) return;
        titleRef.current?.focus({ preventScroll: true });
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
    <>
      <div
        className={`panel-dim ${open ? 'panel-dim--on' : ''}`.trim()}
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={rootRef}
        className={`panel kvm ${open ? 'panel--open' : ''} ${variantClass ?? ''}`.trim()}
        role="dialog"
        aria-modal={open}
        aria-labelledby={titleId}
        aria-hidden={!open}
        style={style}
      >
        <div className="kvm__lid">
          <div className="kvm__screen">
            {osd && (
              <p className="kvm__osd" aria-hidden>
                {osd}
              </p>
            )}
            <div className="panel__body">{children}</div>
          </div>
        </div>
        <div className="kvm__hinge" aria-hidden />
        <div className="kvm__tray">
          <span className="kvm__handle" aria-hidden />
          <h2 className="panel__title kvm__label" id={titleId} ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          <div className="kvm__controls">{tray}</div>
          <button
            type="button"
            className="kvm__eject panel__close"
            onClick={onClose}
            aria-label="Close (Esc)"
          >
            <span className="kvm-port__key" aria-hidden />
            <span className="kvm__eject-text" aria-hidden>
              <span className="panel__close-key">esc</span>
              <span className="panel__close-touch">close</span>
            </span>
          </button>
          <span className="kvm__handle kvm__handle--right" aria-hidden />
        </div>
      </div>
    </>
  );
}
