import { projects } from "@/data/projects";
import { PanelShell } from "./PanelShell";

interface TradingTerminalProps {
  open: boolean;
  onClose: () => void;
}

// "Bloomberg-style" data terminal. Bound to the central monitor in the scene.
// The opening hero is the actual OCaml LOB demo loop — that *is* the
// trading terminal the panel is named after. The quant-cluster project
// list sits underneath as a "explore further" surface.
const OCAML_LOB = projects.find((p) => p.id === "ocaml-lob");

export function TradingTerminal({ open, onClose }: TradingTerminalProps) {
  const quantProjects = projects.filter((p) => p.cluster === "quant");

  return (
    <PanelShell open={open} title="// trading_terminal" onClose={onClose}>
      {OCAML_LOB?.demo && (
        <section className="panel__section panel__section--media">
          <div className="panel__section-label">order_book.flow</div>
          <video
            className="panel__hero panel__hero--video"
            src={OCAML_LOB.demo}
            poster={OCAML_LOB.image?.replace(/\.png$/, ".webp")}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="OCaml LOB live order-book demo loop"
          />
          {OCAML_LOB.headline && (
            <p className="panel__headline panel__headline--hero">
              {OCAML_LOB.headline}
            </p>
          )}
          {OCAML_LOB.links.live && (
            <div className="panel__links panel__links--cta">
              <a
                href={OCAML_LOB.links.live}
                target="_blank"
                rel="noreferrer"
                className="panel__cta-link"
              >
                open live terminal →
              </a>
            </div>
          )}
        </section>
      )}

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
