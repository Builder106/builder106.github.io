import { useState } from "react";
import { BootSequence } from "./components/BootSequence";
import { Scene } from "./components/Scene";
import { HUD } from "./components/HUD";
import { TradingTerminal } from "./components/panels/TradingTerminal";

export function App() {
  const [booted, setBooted] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      {booted && (
        <>
          <Scene paused={terminalOpen} />
          <HUD onPing={() => (window.location.href = "mailto:vaughanolayinka@gmail.com")} />
          <TradingTerminal open={terminalOpen} onClose={() => setTerminalOpen(false)} />
          {/*
            Temporary: open the terminal panel from a HUD-adjacent button until
            raycaster click-on-monitor is wired. Lets you exercise the
            open/close transition right after a fresh boot.
          */}
          <button
            type="button"
            onClick={() => setTerminalOpen(true)}
            style={{
              position: "fixed",
              top: 18,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              padding: "8px 14px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: "rgba(76, 242, 255, 0.06)",
              border: "1px solid rgba(76, 242, 255, 0.3)",
              borderRadius: 3,
              color: "var(--neon-cyan)",
              cursor: "pointer",
            }}
          >
            open trading terminal
          </button>
        </>
      )}
    </>
  );
}
