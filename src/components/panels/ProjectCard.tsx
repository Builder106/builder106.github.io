import { type Project } from "@/data/projects";
import { PanelShell } from "./PanelShell";

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
  // The shell is rendered even when project is null so the close
  // animation can play out cleanly when the panel is dismissed.
  const open = project !== null;
  const title = project ? `// node.${project.id}` : "// node";

  return (
    <PanelShell open={open} title={title} onClose={onClose}>
      {project && (
        <>
          {(project.demo || project.image) && (
            <section className="panel__section panel__section--media">
              {project.demo ? (
                <video
                  className="panel__hero panel__hero--video"
                  src={project.demo}
                  poster={project.image}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={`${project.name} demo loop`}
                />
              ) : (
                <img
                  src={project.image}
                  alt={`${project.name} banner`}
                  loading="lazy"
                  decoding="async"
                  className="panel__hero"
                />
              )}
            </section>
          )}

          <section className="panel__section">
            <div className="panel__section-label">project / {CLUSTER_LABEL[project.cluster]}</div>
            <h3 className="panel__list-name" style={{ fontSize: 18, marginBottom: 6 }}>
              {project.name}
            </h3>
            {project.headline && (
              <p className="panel__headline">{project.headline}</p>
            )}
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
        </>
      )}
    </PanelShell>
  );
}
