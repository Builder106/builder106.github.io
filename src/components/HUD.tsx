import "./HUD.css";

interface HUDProps {
  onPing: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
}

// Heads-up display: persistent corner UI that frames the 3D scene.
// Top-left: identity / "OV" mark. Top-right: nav. Bottom-left: hint.
// Bottom-right: audio mute + "ping" button (contact entry point).
export function HUD({ onPing, audioEnabled, onToggleAudio }: HUDProps) {
  return (
    <div className="hud" aria-hidden={false}>
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

      <div className="hud__corner hud__corner--bl">
        <span className="hud__hint-key">drag</span>
        <span> to orbit</span>
        <span className="hud__hint-sep">·</span>
        <span className="hud__hint-key">click</span>
        <span> a node</span>
      </div>

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
  );
}
