// Relative imports (not the `@` alias) so this module is loadable
// both from Vite-compiled client code *and* from the vite.config.ts
// build-time context, which uses Node resolution and doesn't have
// the alias.
import { CLUSTER_DISPLAY, projects } from "../data/projects";
import { experience } from "../data/experience";

// Pure-string HTML generator for the portfolio's semantic mirror.
// Used by the Vite plugin in vite.config.ts to inject the content into
// the static index.html at build time (so non-JS crawlers see it).

const EMAIL = "vaughanolayinka@gmail.com";
const PHONE = "+1 475 331 4070";
const SITE_URL = "https://yinkavaughan.me";

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/Builder106" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/yinka-vaughan/" },
  { label: "Devpost", href: "https://devpost.com/olayinkav" },
];

const BIO = "Built a limit-order-book matching engine at ~18M orders/sec in OCaml, a multi-agent reinforcement-learning economic OS in Python, and a neural network from scratch in C99. Economics + Computer Science at Wesleyan University (declaring fall 2026), based in Middletown, Connecticut.";

const CURRENT = "Currently: ramping up on quant trading systems and shipping side projects on the side.";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSemanticContentHTML(): string {
  // Each project gets a <details><summary> wrapper so crawlers see a
  // clearer per-project section structure and screen-reader users can
  // collapse/expand if the sr-only mirror is ever revealed.
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
      const headline = p.headline ? `<p><strong>${escape(p.headline)}</strong></p>` : "";
      return [
        `<details open>`,
        `<summary><h3 id="project-${escape(p.id)}-heading">${escape(p.name)}</h3></summary>`,
        headline,
        `<p>${escape(p.blurb)}</p>`,
        `<p>Cluster: ${escape(CLUSTER_DISPLAY[p.cluster])}.${stack}</p>`,
        linksBlock,
        `</details>`,
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
    `<p>${escape(BIO)}</p>`,
    `<p><em>${escape(CURRENT)}</em></p>`,
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

// Build-time JSON-LD generator. Person + a CreativeWork entry per
// project, with each project's creator pointing back to the Person.
// Keeps LLM agents and search engines in sync with the projects.ts
// data instead of duplicating it in static HTML.
export function buildStructuredDataJSON(): string {
  const person = {
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: "Olayinka David Vaughan",
    givenName: "Olayinka",
    familyName: "Vaughan",
    alternateName: "Yinka Vaughan",
    url: `${SITE_URL}/`,
    email: EMAIL,
    jobTitle: "Quant Systems & Full-Stack Engineer",
    description: BIO,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Middletown",
      addressRegion: "CT",
      addressCountry: "US",
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Wesleyan University",
    },
    sameAs: SOCIALS.map((s) => s.href),
  };

  const works = projects.map((p) => {
    const work: Record<string, unknown> = {
      "@type": "CreativeWork",
      "@id": `${SITE_URL}/#project-${p.id}`,
      name: p.name,
      description: p.blurb,
      keywords: p.stack.join(", "),
      creator: { "@id": person["@id"] },
    };
    if (p.headline) work.headline = p.headline;
    if (p.links.live) work.url = p.links.live;
    if (p.links.repo) work.codeRepository = p.links.repo;
    if (p.image) work.image = `${SITE_URL}${p.image}`;
    return work;
  });

  const graph = {
    "@context": "https://schema.org",
    "@graph": [person, ...works],
  };

  return JSON.stringify(graph, null, 2);
}
