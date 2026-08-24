import { projects } from '@/data/projects';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectCard } from './ProjectCard';

describe('ProjectCard stack chips', () => {
  it('renders an icon for every stack chip, including tags with no brand logo', () => {
    const project = projects.find((p) => p.stack.includes('Playwright'))!;
    const html = renderToStaticMarkup(
      <ProjectCard project={project} onClose={() => {}} onNavigate={() => {}} />,
    );
    project.stack.forEach((tag) => {
      // Each chip is `<span class="project-card__chip"><svg .../>tag</span>`
      // — assert the tag's text is immediately preceded by a closing </svg>
      // so every chip (icon or fallback) actually rendered one.
      const chipPattern = new RegExp(`</svg>${tag}</span>`);
      expect(html).toMatch(chipPattern);
    });
  });

  it('renders the closed shell without project content', () => {
    const html = renderToStaticMarkup(
      <ProjectCard project={null} onClose={() => {}} onNavigate={() => {}} />,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('// node');
    expect(html).not.toContain('project-card__blurb');
  });

  it('renders media, stats, links, and navigation for a complete project', () => {
    const project = projects[0];
    const navigated: unknown[] = [];
    const html = renderToStaticMarkup(
      <ProjectCard
        project={project}
        onClose={() => {}}
        onNavigate={(target) => navigated.push(target)}
      />,
    );

    expect(html).toContain('panel__hero--video');
    expect(html).toContain('project-card__repo-stat');
    expect(html).toContain('open live demo');
    expect(html).toContain('view source');
    expect(html).toContain('Project navigation');
    expect(navigated).toHaveLength(0);
  });

  it('renders an image-only project and handles missing repo stats', () => {
    const project = {
      ...projects[0],
      id: 'local-only',
      demo: undefined,
      links: { live: undefined, repo: undefined },
    };
    const html = renderToStaticMarkup(
      <ProjectCard project={project} onClose={() => {}} onNavigate={() => {}} />,
    );
    expect(html).toContain('<picture>');
    expect(html).toContain('panel__hero');
    expect(html).not.toContain('open live demo');
    expect(html).not.toContain('view source');
    expect(html).not.toContain('project-card__repo');
  });
});
