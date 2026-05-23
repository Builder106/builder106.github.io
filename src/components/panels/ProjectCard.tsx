import { useMemo } from "react";
import { CLUSTER_DISPLAY, projects, type Project } from "@/data/projects";
import { repoStats } from "@/data/repoStats.generated";
import type { ActivePanel } from "@/scene/activePanel";
import { PanelShell } from "./PanelShell";

interface ProjectCardProps {
  project: Project | null;
  onClose: () => void;
  onNavigate: (target: ActivePanel) => void;
}

// Aisle ordering (front of corridor → back). Duplicated rather than
// imported from ServerRoom because that module pulls three.js; this
// panel must stay in its own lazy chunk so the initial bundle doesn't
// drag in WebGL.
const AISLE_ORDER = [
  "ocaml-lob",
  "qforge",
  "econos",
  "staija",
  "studysprint",
  "micromatch",
  "capitol-alpha",
  "datafest-2026",
  "linuxbenchhub",
] as const;

// Resolve a repo URL → "<owner>/<name>" slug, the same key the
// build-time stats script uses.
function repoSlug(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+\/[^/?#]+)/);
  return m ? m[1].replace(/\.git$/, "") : null;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const days = Math.max(0, Math.round((Date.now() - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function ProjectCard({ project, onClose, onNavigate }: ProjectCardProps) {
  // The shell is rendered even when project is null so the close
  // animation can play out cleanly when the panel is dismissed.
  const open = project !== null;
  const title = project ? `// node.${project.id}` : "// node";
  const slug = project ? repoSlug(project.links.repo) : null;
  const stats = slug ? repoStats[slug] : null;

  // Aisle neighbours for the prev/next footer. Wraps around so the
  // user can keep paging through projects without ever closing the
  // panel — bottom of the analyst stack rolls back to the front of
  // the quant stack.
  const { prevProject, nextProject } = useMemo(() => {
    if (!project) return { prevProject: null, nextProject: null };
    const idx = AISLE_ORDER.indexOf(project.id as typeof AISLE_ORDER[number]);
    if (idx === -1) return { prevProject: null, nextProject: null };
    const total = AISLE_ORDER.length;
    const prevId = AISLE_ORDER[(idx - 1 + total) % total];
    const nextId = AISLE_ORDER[(idx + 1) % total];
    return {
      prevProject: projects.find((p) => p.id === prevId) ?? null,
      nextProject: projects.find((p) => p.id === nextId) ?? null,
    };
  }, [project]);

  // Cluster modifier flows --cluster-color through every component on
  // the panel via Panel.css. Falls back to a non-cluster variant if
  // project is null (during the close animation).
  const variantClass = project
    ? `panel--project panel--project--${project.cluster}`
    : "panel--project";

  return (
    <PanelShell open={open} title={title} onClose={onClose} variantClass={variantClass}>
      {project && (
        <>
          {/* Identity strip: cluster lozenge + project name + repo slug.
              The lozenge is filled with the cluster colour so each card
              telegraphs its cluster at first glance instead of relying
              on a small uppercase label. Reads first now (above the
              hero) so the recruiter-relevant signal — "this is a
              <cluster> project called <name>" — lands before they
              even see the demo video. */}
          <section className="panel__section project-card__identity">
            <span className="project-card__cluster">
              {CLUSTER_DISPLAY[project.cluster]}
            </span>
            <h3 className="project-card__name">{project.name}</h3>
            {slug && (
              <span className="project-card__slug" title={slug}>
                {slug}
              </span>
            )}
          </section>

          {/* Money-shot headline. Bigger and cluster-tinted so it lands
              as the card's signature stat rather than a regular line of
              copy. Promoted above the hero so the "16,203 trades ·
              +2.58% alpha" type of stat hits the eye before the visual
              evidence. */}
          {project.headline && (
            <p className="project-card__headline">{project.headline}</p>
          )}

          {(project.demo || project.image) && (
            <section
              className="panel__section panel__section--media"
              style={{ position: "relative" }}
            >
              {/* Shimmer placeholder underneath the real media —
                  prevents the brief blank flash between panel-open
                  and first-frame-decoded. The video/img above paints
                  on top once loaded. */}
              <div className="panel__hero-skeleton" aria-hidden />
              {project.demo ? (
                <video
                  className="panel__hero panel__hero--video"
                  src={project.demo}
                  // Posters can't go through <picture>, but every
                  // supported browser handles WebP natively now — swap
                  // the .png extension to .webp so the poster is the
                  // smaller asset.
                  poster={project.image?.replace(/\.png$/, ".webp")}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={`${project.name} demo loop`}
                  style={{ position: "relative", zIndex: 1 }}
                />
              ) : (
                <picture>
                  <source
                    srcSet={project.image?.replace(/\.png$/, ".webp")}
                    type="image/webp"
                  />
                  <img
                    src={project.image}
                    alt={`${project.name} banner`}
                    loading="lazy"
                    decoding="async"
                    className="panel__hero"
                    style={{ position: "relative", zIndex: 1 }}
                  />
                </picture>
              )}
            </section>
          )}

          <p className="project-card__blurb">{project.blurb}</p>

          <section className="panel__section">
            <div className="panel__section-label">stack</div>
            <div className="project-card__chips">
              {project.stack.map((tag) => (
                <span key={tag} className="project-card__chip">{tag}</span>
              ))}
            </div>
          </section>

          {stats && (
            <section className="panel__section">
              <div className="panel__section-label">repo</div>
              <div className="project-card__repo">
                {stats.lang && (
                  <span className="project-card__repo-stat">
                    <span className="project-card__repo-dot" aria-hidden />
                    {stats.lang}
                  </span>
                )}
                <span className="project-card__repo-sep" aria-hidden>·</span>
                <span className="project-card__repo-stat">
                  <span aria-hidden>★</span> {stats.stars}
                </span>
                <span className="project-card__repo-sep" aria-hidden>·</span>
                <span className="project-card__repo-stat">
                  <span aria-hidden>⟳</span> {relativeTime(stats.pushed_at)}
                </span>
              </div>
            </section>
          )}

          {(project.links.live || project.links.repo) && (
            <section className="panel__section project-card__ctas">
              {project.links.live && (
                <a
                  className="project-card__cta project-card__cta--primary"
                  href={project.links.live}
                  target="_blank"
                  rel="noreferrer"
                >
                  open live demo
                  <span className="project-card__cta-arrow" aria-hidden>→</span>
                </a>
              )}
              {project.links.repo && (
                <a
                  className="project-card__cta project-card__cta--secondary"
                  href={project.links.repo}
                  target="_blank"
                  rel="noreferrer"
                >
                  view source
                  <span className="project-card__cta-arrow" aria-hidden>→</span>
                </a>
              )}
            </section>
          )}

          {/* Aisle-order prev/next so the user can page through
              projects without closing the panel and re-clicking a
              rack. Wraps so it's also a tour mode — keep clicking
              "next" to cycle through all 9. */}
          {(prevProject || nextProject) && (
            <nav className="project-card__nav" aria-label="Project navigation">
              {prevProject && (
                <button
                  type="button"
                  className={`project-card__nav-btn project-card__nav-btn--prev project-card__nav-btn--${prevProject.cluster}`}
                  onClick={() => onNavigate({ kind: "project", projectId: prevProject.id })}
                >
                  <span className="project-card__nav-dir" aria-hidden>←</span>
                  <span className="project-card__nav-meta">
                    <span className="project-card__nav-label">prev rack</span>
                    <span className="project-card__nav-name">{prevProject.name}</span>
                  </span>
                </button>
              )}
              {nextProject && (
                <button
                  type="button"
                  className={`project-card__nav-btn project-card__nav-btn--next project-card__nav-btn--${nextProject.cluster}`}
                  onClick={() => onNavigate({ kind: "project", projectId: nextProject.id })}
                >
                  <span className="project-card__nav-meta">
                    <span className="project-card__nav-label">next rack</span>
                    <span className="project-card__nav-name">{nextProject.name}</span>
                  </span>
                  <span className="project-card__nav-dir" aria-hidden>→</span>
                </button>
              )}
            </nav>
          )}
        </>
      )}
    </PanelShell>
  );
}
