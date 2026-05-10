import { projects } from "@/data/projects";
import { PanelShell } from "./PanelShell";

interface TradingTerminalProps {
  open: boolean;
  onClose: () => void;
}

// "Bloomberg-style" data terminal. Bound to the central monitor in the scene.
// Hosts the quant-cluster projects (IMC Prosperity, Capitol Alpha) plus a
// stand-in "order book flow" visualization. The visualization is intentionally
// a CSS-only stand-in until you wire a real particle system.
export function TradingTerminal({ open, onClose }: TradingTerminalProps) {
  const quantProjects = projects.filter((p) => p.cluster === "quant");

  return (
    <PanelShell open={open} title="// trading_terminal" onClose={onClose}>
      <section className="panel__section">
        <div className="panel__section-label">order_book.flow</div>
        <div className="panel__chart" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="panel__bar"
              style={{
                height: `${20 + ((Math.sin(i * 0.7) + 1) / 2) * 70}%`,
                animationDelay: `${i * 60}ms`,
              }}
            />
          ))}
        </div>
      </section>

      <section className="panel__section">
        <div className="panel__section-label">projects.quant</div>
        <ul className="panel__list">
          {quantProjects.map((p) => (
            <li key={p.id} className="panel__list-item">
              <div className="panel__list-row">
                <span className="panel__list-name">{p.name}</span>
                <span className="panel__list-stack">{p.stack.join(" · ")}</span>
              </div>
              <p className="panel__list-blurb">{p.blurb}</p>
            </li>
          ))}
        </ul>
      </section>
    </PanelShell>
  );
}
