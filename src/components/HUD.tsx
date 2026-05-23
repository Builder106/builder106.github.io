import "./HUD.css";

interface HUDProps {
  onPing: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  // Whether the user has interacted with any rack / terminal / ping
  // target yet. Once true, the bottom-left "tap a rack" hint fades
  // — they've figured it out. Persisted to localStorage in App so
  // returning visitors don't see the hint on repeat sessions.
  hasExplored: boolean;
}

// Heads-up display: persistent corner UI that frames the 3D scene.
// Top-left: identity / "OV" mark. Top-right: nav. Bottom-left:
// interaction hint (variant per pointer type — see HUD.css). Bottom-
// right: audio mute + "ping" button (contact entry point).
export function HUD({ onPing, audioEnabled, onToggleAudio, hasExplored }: HUDProps) {
  return (
    <div className={`hud ${hasExplored ? "hud--explored" : ""}`} aria-hidden={false}>
      <div className="hud__corner hud__corner--tl">
        <div className="hud__mark">&lt;OV /&gt;</div>
        <div className="hud__sub">Olayinka David Vaughan</div>
      </div>

      <nav className="hud__corner hud__corner--tr hud__nav">
        <a href="https://github.com/Builder106" target="_blank" rel="noreferrer">
          github
        </a>
        <a href="https://www.linkedin.com/in/yinka-vaughan/" target="_blank" rel="noreferrer">
          linkedin
        </a>
        <a href="/Olayinka_Vaughan_Resume.pdf" target="_blank" rel="noreferrer">
          resume
        </a>
      </nav>

      {/* Bottom-left interaction hint. Two variants are rendered side
          by side but only one is visible at a time — fine-pointer
          (mouse) sees the orbit + click line, coarse-pointer (touch)
          sees the "tap a rack" line. CSS picks via (hover: hover)
          and (pointer: coarse). Fades to invisible once hasExplored
          flips, since the user clearly figured it out. */}
      <div className="hud__corner hud__corner--bl">
        <span className="hud__hint hud__hint--fine">
          <span className="hud__hint-key">drag</span>
          <span> to orbit</span>
          <span className="hud__hint-sep">·</span>
          <span className="hud__hint-key">click</span>
          <span> a node</span>
        </span>
        <span className="hud__hint hud__hint--coarse">
          <span className="hud__hint-key">tap</span>
          <span> any rack to explore</span>
        </span>
      </div>

      {/* Bottom-right cluster. Flex parent guarantees both children's
          vertical centres align regardless of their individual heights
          (audio button is square, PING is wider/text-based). */}
      <div className="hud__br-cluster">
        <button
          className="hud__audio"
          onClick={onToggleAudio}
          aria-label={audioEnabled ? "Mute ambient audio" : "Enable ambient audio"}
          title={audioEnabled ? "mute" : "unmute"}
        >
          {audioEnabled ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a4 4 0 0 1 0 7" />
              <path d="M18.5 5.5a8 8 0 0 1 0 13" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          )}
        </button>

        <button className="hud__ping" onClick={onPing}>
          <span className="hud__ping-dot" />
          ping
        </button>
      </div>
    </div>
  );
}
