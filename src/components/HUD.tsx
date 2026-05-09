import "./HUD.css";

interface HUDProps {
  onPing: () => void;
}

// Heads-up display: persistent corner UI that frames the 3D scene.
// Top-left: identity / "OV" mark. Top-right: nav. Bottom-left: hint.
// Bottom-right: "ping" button (contact entry point).
export function HUD({ onPing }: HUDProps) {
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

      <button className="hud__ping" onClick={onPing}>
        <span className="hud__ping-dot" />
        ping
      </button>
    </div>
  );
}
