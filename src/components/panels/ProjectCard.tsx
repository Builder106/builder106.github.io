import { type Project } from "@/data/projects";
import "./Panel.css";

interface ProjectCardProps {
  project: Project | null;
  onClose: () => void;
}

const CLUSTER_LABEL: Record<Project["cluster"], string> = {
  quant: "quant",
  systems: "systems",
  products: "products",
  research: "research",
};

export function ProjectCard({ project, onClose }: ProjectCardProps) {
  // We render the panel shell even with no project so the close transition
  // can play out cleanly when the panel is dismissed.
  const open = project !== null;

  return (
    <div className={`panel ${open ? "panel--open" : ""}`} role="dialog" aria-hidden={!open}>
      <header className="panel__header">
        <div className="panel__chrome">
          <span className="panel__chrome-dot panel__chrome-dot--red" />
          <span className="panel__chrome-dot panel__chrome-dot--amber" />
          <span className="panel__chrome-dot panel__chrome-dot--green" />
        </div>
        <h2 className="panel__title">
          // {project ? `node.${project.id}` : "node"}
        </h2>
        <button className="panel__close" onClick={onClose} aria-label="Close">
          <span aria-hidden>esc</span>
        </button>
      </header>

      {project && (
        <div className="panel__body">
          <section className="panel__section">
            <div className="panel__section-label">project / {CLUSTER_LABEL[project.cluster]}</div>
            <h3 className="panel__list-name" style={{ fontSize: 18, marginBottom: 10 }}>
              {project.name}
            </h3>
            <p className="panel__list-blurb" style={{ fontSize: 14 }}>{project.blurb}</p>
          </section>

          <section className="panel__section">
            <div className="panel__section-label">stack</div>
            <div className="panel__chips">
              {project.stack.map((tag) => (
                <span key={tag} className="panel__chip">{tag}</span>
              ))}
            </div>
          </section>

          {(project.links.live || project.links.repo) && (
            <section className="panel__section">
              <div className="panel__section-label">links</div>
              <div className="panel__links">
                {project.links.live && (
                  <a href={project.links.live} target="_blank" rel="noreferrer">
                    live →
                  </a>
                )}
                {project.links.repo && (
                  <a href={project.links.repo} target="_blank" rel="noreferrer">
                    repo →
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
