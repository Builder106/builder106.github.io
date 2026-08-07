import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectCard } from "./ProjectCard";
import { projects } from "@/data/projects";

describe("ProjectCard stack chips", () => {
  it("renders an icon for every stack chip, including tags with no brand logo", () => {
    const project = projects.find((p) => p.stack.includes("Playwright"))!;
    const html = renderToStaticMarkup(
      <ProjectCard project={project} onClose={() => {}} onNavigate={() => {}} />
    );
    project.stack.forEach((tag) => {
      // Each chip is `<span class="project-card__chip"><svg .../>tag</span>`
      // — assert the tag's text is immediately preceded by a closing </svg>
      // so every chip (icon or fallback) actually rendered one.
      const chipPattern = new RegExp(`</svg>${tag}</span>`);
      expect(html).toMatch(chipPattern);
    });
  });
});
