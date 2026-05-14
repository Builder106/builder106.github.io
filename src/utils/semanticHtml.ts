// Relative imports (not the `@` alias) so this module is loadable
// both from Vite-compiled client code *and* from the vite.config.ts
// build-time context, which uses Node resolution and doesn't have
// the alias.
import { projects } from "../data/projects";
import { experience } from "../data/experience";

// Pure-string HTML generator for the portfolio's semantic mirror.
// Used twice: by the Vite plugin in vite.config.ts to inject the
// content into the static index.html at build time (so non-JS crawlers
// see it), and conceptually as the canonical source of truth that the
// SemanticContent React component used to render at runtime.

const EMAIL = "vaughanolayinka@gmail.com";
const PHONE = "+1 475 331 4070";

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/Builder106" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/yinka-vaughan/" },
  { label: "Devpost", href: "https://devpost.com/olayinkav" },
];

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSemanticContentHTML(): string {
  const projectArticles = projects
    .map((p) => {
      const stack = p.stack.length > 0
        ? ` Stack: ${escape(p.stack.join(", "))}.`
        : "";
      const links: string[] = [];
      if (p.links.live) {
        links.push(`<li>Live: <a href="${escape(p.links.live)}">${escape(p.links.live)}</a></li>`);
      }
      if (p.links.repo) {
        links.push(`<li>Repository: <a href="${escape(p.links.repo)}">${escape(p.links.repo)}</a></li>`);
      }
      const linksBlock = links.length > 0 ? `<ul>${links.join("")}</ul>` : "";
      return [
        `<article aria-labelledby="project-${escape(p.id)}-heading">`,
        `<h3 id="project-${escape(p.id)}-heading">${escape(p.name)}</h3>`,
        `<p>${escape(p.blurb)}</p>`,
        `<p>Cluster: ${escape(p.cluster)}.${stack}</p>`,
        linksBlock,
        `</article>`,
      ].join("");
    })
    .join("");

  const experienceArticles = experience
    .map((e) => {
      const bullets = e.bullets.map((b) => `<li>${escape(b)}</li>`).join("");
      return [
        `<article>`,
        `<h3>${escape(e.role)} — ${escape(e.org)}</h3>`,
        `<p>${escape(e.period)}</p>`,
        `<ul>${bullets}</ul>`,
        `</article>`,
      ].join("");
    })
    .join("");

  const socialsItems = SOCIALS.map(
    (s) =>
      `<li>${escape(s.label)}: <a href="${escape(s.href)}">${escape(
        s.href.replace(/^https?:\/\//, "")
      )}</a></li>`
  ).join("");

  return [
    `<main class="sr-only" aria-label="Olayinka David Vaughan — portfolio content">`,
    `<h1>Olayinka David Vaughan</h1>`,
    `<p>Quant systems and full-stack engineer. Economics major declaring Computer Science in fall 2026 at Wesleyan University. Based in Middletown, Connecticut. Interactive 3D portfolio built with React Three Fiber, Blender, and custom GLSL shaders.</p>`,
    `<section aria-labelledby="contact-heading">`,
    `<h2 id="contact-heading">Contact</h2>`,
    `<ul>`,
    `<li>Email: <a href="mailto:${escape(EMAIL)}">${escape(EMAIL)}</a></li>`,
    `<li>Phone: <a href="tel:${escape(PHONE.replace(/\s/g, ""))}">${escape(PHONE)}</a></li>`,
    `<li>Location: Middletown, Connecticut, United States</li>`,
    socialsItems,
    `<li>Resume: <a href="/Olayinka_Vaughan_Resume.pdf">Download PDF</a></li>`,
    `</ul>`,
    `</section>`,
    `<section aria-labelledby="projects-heading">`,
    `<h2 id="projects-heading">Projects</h2>`,
    projectArticles,
    `</section>`,
    `<section aria-labelledby="experience-heading">`,
    `<h2 id="experience-heading">Experience</h2>`,
    experienceArticles,
    `</section>`,
    `</main>`,
  ].join("");
}
