import { AISLE_ORDER, CLUSTER_DISPLAY, projects, type Project } from '@/data/projects';
import { repoStats } from '@/data/repoStats.generated';
import type { ActivePanel } from '@/scene/activePanel';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AisleStrip } from './AisleStrip';
import { PanelShell } from './PanelShell';
import { StackChip } from './StackChip';

interface ProjectCardProps {
  project: Project | null;
  onClose: () => void;
  onNavigate: (target: ActivePanel) => void;
}

// Matches the close transition in Panel.css, so the last project stays
// rendered until the chassis has retracted.
const CLOSE_MS = 240;

// Resolve a repo URL → "<owner>/<name>" slug, the same key the
// build-time stats script uses.
function repoSlug(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+\/[^/?#]+)/);
  return m ? m[1].replace(/\.git$/, '') : null;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.max(0, Math.round((Date.now() - then) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function ProjectCard({ project, onClose, onNavigate }: ProjectCardProps) {
  const open = project !== null;

  // Keep the last project on screen while the panel closes, then drop it
  // so the hidden video stops decoding.
  const [shown, setShown] = useState<Project | null>(project);
  if (project && project !== shown) setShown(project);
  useEffect(() => {
    if (project) return;
    const id = window.setTimeout(() => setShown(null), CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [project]);

  // The demo loops, so it needs a pause control (WCAG 2.2.2). Visitors who
  // ask for reduced motion start with it paused.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPaused(false);
      return;
    }
    video.pause();
    setPaused(true);
  };

  const slug = shown ? repoSlug(shown.links.repo) : null;
  const stats = slug ? repoStats[slug] : null;

  // Aisle neighbours for prev/next. Wraps around so the user can keep
  // paging through projects without ever closing the panel.
  const { prevProject, nextProject } = useMemo(() => {
    if (!shown) return { prevProject: null, nextProject: null };
    const idx = AISLE_ORDER.indexOf(shown.id as (typeof AISLE_ORDER)[number]);
    if (idx === -1) return { prevProject: null, nextProject: null };
    const total = AISLE_ORDER.length;
    const prevId = AISLE_ORDER[(idx - 1 + total) % total];
    const nextId = AISLE_ORDER[(idx + 1) % total];
    return {
      prevProject: projects.find((p) => p.id === prevId) ?? null,
      nextProject: projects.find((p) => p.id === nextId) ?? null,
    };
  }, [shown]);

  const bezel = shown && (prevProject || nextProject) && (
    <nav className="project-card__nav" aria-label="Project navigation">
      {prevProject && (
        <button
          type="button"
          className="project-card__nav-btn project-card__nav-btn--prev"
          onClick={() => onNavigate({ kind: 'project', projectId: prevProject.id })}
          aria-label={`Previous rack: ${prevProject.name}`}
        >
          <span aria-hidden>←</span>
          <span className="project-card__nav-name" aria-hidden>
            {prevProject.name}
          </span>
        </button>
      )}
      <AisleStrip activeId={shown.id} />
      {nextProject && (
        <button
          type="button"
          className="project-card__nav-btn project-card__nav-btn--next"
          onClick={() => onNavigate({ kind: 'project', projectId: nextProject.id })}
          aria-label={`Next rack: ${nextProject.name}`}
        >
          <span className="project-card__nav-name" aria-hidden>
            {nextProject.name}
          </span>
          <span aria-hidden>→</span>
        </button>
      )}
    </nav>
  );

  return (
    <PanelShell
      open={open}
      title={shown?.name ?? 'Project'}
      onClose={onClose}
      variantClass="panel--project"
      bezel={bezel}
      accent={shown?.color}
    >
      {shown && (
        <>
          {(shown.demo || shown.image) && (
            <div className="project-card__media">
              {/* Shimmer underneath the media so the box isn't blank
                  before the first frame decodes. */}
              <div className="project-card__media-skeleton" aria-hidden />
              {shown.demo ? (
                <>
                  <video
                    ref={videoRef}
                    className="panel__hero panel__hero--video"
                    src={shown.demo}
                    autoPlay={!paused}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={`${shown.name} demo loop`}
                  />
                  <button type="button" className="project-card__playback" onClick={togglePlayback}>
                    {paused ? 'play' : 'pause'}
                    <span className="sr-only"> demo</span>
                  </button>
                </>
              ) : (
                <picture>
                  <source srcSet={shown.image?.replace(/\.png$/, '.webp')} type="image/webp" />
                  <img
                    src={shown.image}
                    alt={`${shown.name} banner`}
                    loading="lazy"
                    decoding="async"
                    className="panel__hero"
                  />
                </picture>
              )}
            </div>
          )}

          <div className="project-card__text">
            {shown.headline && (
              <p className="project-card__headline">
                {shown.headline.split(' · ').map((part, i) => (
                  <Fragment key={part}>
                    {i > 0 && (
                      <span className="project-card__headline-rule" aria-hidden>
                        |
                      </span>
                    )}
                    {i > 0 && <span className="sr-only">, </span>}
                    {part}
                  </Fragment>
                ))}
              </p>
            )}

            <p className="project-card__blurb">{shown.blurb}</p>

            <p className="project-card__meta">
              {CLUSTER_DISPLAY[shown.cluster]} wing
              {slug && (
                <>
                  <span className="project-card__meta-rule" aria-hidden>
                    |
                  </span>
                  <span className="sr-only">, </span>
                  {slug}
                </>
              )}
            </p>

            <ul className="project-card__chips" aria-label="Stack">
              {shown.stack.map((tag) => (
                <li key={tag}>
                  <StackChip tag={tag} />
                </li>
              ))}
            </ul>

            {(shown.links.live || shown.links.repo || stats) && (
              <div className="project-card__actions">
                {shown.links.live && (
                  <a
                    className="project-card__cta project-card__cta--primary"
                    href={shown.links.live}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open live demo
                    <span aria-hidden>→</span>
                  </a>
                )}
                {shown.links.repo && (
                  <a
                    className="project-card__cta project-card__cta--secondary"
                    href={shown.links.repo}
                    target="_blank"
                    rel="noreferrer"
                  >
                    view source
                  </a>
                )}
                {stats && (
                  <span className="project-card__repo">
                    <span className="project-card__repo-stat">
                      <span aria-hidden>★</span> {stats.stars}
                      <span className="sr-only"> stars</span>
                    </span>
                    <span className="project-card__repo-stat">
                      pushed {relativeTime(stats.pushed_at)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </PanelShell>
  );
}
