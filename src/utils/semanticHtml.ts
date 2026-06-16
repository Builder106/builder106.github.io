// Relative imports (not the `@` alias) so this module is loadable
// both from Vite-compiled client code *and* from the vite.config.ts
// build-time context, which uses Node resolution and doesn't have
// the alias.
import { CLUSTER_DISPLAY, projects, type ProjectCluster } from "../data/projects";
import { experience } from "../data/experience";

// Pure-string generators for the portfolio's machine-readable surfaces:
//   buildSemanticContentHTML() — sr-only <main> text mirror (injected
//     into index.html as a sibling of #root)
//   buildStructuredDataJSON()  — JSON-LD @graph (injected into the
//     index.html <script type="application/ld+json">)
//   buildLlmsTxt()             — /llms.txt (emitted as a standalone asset)
// All three are driven by projects.ts so the three representations stay
// in lockstep with the data instead of being hand-maintained.

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

// Narrative order the discipline clusters are presented in — matches the
// five rack "wings" authored in the 3D scene (see AISLE_ORDER in
// ServerRoom.tsx). Only clusters that actually contain projects are
// listed; the unused `systems`/`research` CLUSTER_DISPLAY keys are
// intentionally absent. Every consumer iterates THIS array and skips
// empty clusters, so a project can never be stranded and an empty
// heading can never be emitted.
const CLUSTER_ORDER: ProjectCluster[] = [
  "quant",
  "swe",
  "analyst",
  "security",
  "ml",
];

// One-line, recruiter-readable gloss per cluster. Shared by the sr-only
// mirror (sub-heading description) and llms.txt (section intro).
const CLUSTER_BLURB: Partial<Record<ProjectCluster, string>> = {
  quant: "Low-latency trading systems and from-scratch numerical code.",
  swe: "Shipped full-stack products with real users.",
  analyst: "Statistical and data-pipeline work over real datasets.",
  security: "Supply-chain, agent, and on-chain economic security.",
  ml: "Applied-LLM work with measured cost and accuracy per run.",
};

// Languages we recognize inside a project's stack[]. Anything not in
// this map stays a plain keyword (frameworks like Dream/FastAPI, infra
// like Docker/Supabase) rather than being mis-emitted as a
// programmingLanguage. Keys are the exact stack labels used in projects.ts.
const LANGUAGE_ALIASES: Record<string, string> = {
  OCaml: "OCaml",
  Rust: "Rust",
  Go: "Go",
  Python: "Python",
  C99: "C",
  Solidity: "Solidity",
  Yul: "Yul",
  TypeScript: "TypeScript",
  JavaScript: "JavaScript",
  R: "R",
  "Ruby on Rails": "Ruby",
};

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function projectsForCluster(cluster: ProjectCluster) {
  return projects.filter((p) => p.cluster === cluster);
}

function programmingLanguagesFor(stack: string[]): string[] {
  const langs = stack
    .map((s) => LANGUAGE_ALIASES[s])
    .filter((s): s is string => Boolean(s));
  return Array.from(new Set(langs));
}

// Human-readable, comma-and-"and" joined cluster name list, e.g.
// "quant, SWE, analyst, cybersec, and AI/ML". Derived from the data so
// it never drifts from CLUSTER_ORDER / CLUSTER_DISPLAY.
function clusterNameList(): string {
  const names = CLUSTER_ORDER.map((c) => CLUSTER_DISPLAY[c]);
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
}

export function buildSemanticContentHTML(): string {
  // Each project gets a <details><summary> wrapper so crawlers see a
  // clear per-project section and screen-reader users can collapse/expand
  // if the sr-only mirror is ever revealed. Projects are grouped under
  // their discipline cluster so the spatial grouping of the 3D scene
  // survives as document structure, not just an inline label.
  function renderProject(p: (typeof projects)[number]): string {
    const stack =
      p.stack.length > 0 ? `<p>Stack: ${escape(p.stack.join(", "))}.</p>` : "";
    const links: string[] = [];
    if (p.links.live) {
      links.push(
        `<li>Live: <a href="${escape(p.links.live)}">${escape(p.links.live)}</a></li>`,
      );
    }
    if (p.links.repo) {
      links.push(
        `<li>Repository: <a href="${escape(p.links.repo)}">${escape(p.links.repo)}</a></li>`,
      );
    }
    const linksBlock = links.length > 0 ? `<ul>${links.join("")}</ul>` : "";
    const headline = p.headline
      ? `<p><strong>${escape(p.headline)}</strong></p>`
      : "";
    return [
      `<details open>`,
      `<summary><h4 id="project-${escape(p.id)}-heading">${escape(p.name)}</h4></summary>`,
      headline,
      `<p>${escape(p.blurb)}</p>`,
      stack,
      linksBlock,
      `</details>`,
    ].join("");
  }

  const projectClusters = CLUSTER_ORDER.map((cluster) => {
    const inCluster = projectsForCluster(cluster);
    if (inCluster.length === 0) return ""; // never emit an empty wing
    const label = escape(CLUSTER_DISPLAY[cluster]);
    const count = inCluster.length;
    const blurb = CLUSTER_BLURB[cluster]
      ? `<p>${escape(CLUSTER_BLURB[cluster] as string)}</p>`
      : "";
    return [
      `<section aria-labelledby="cluster-${cluster}-heading">`,
      `<h3 id="cluster-${cluster}-heading">${label} cluster (${count} ${count === 1 ? "rack" : "racks"})</h3>`,
      blurb,
      inCluster.map(renderProject).join(""),
      `</section>`,
    ].join("");
  }).join("");

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
        s.href.replace(/^https?:\/\//, ""),
      )}</a></li>`,
  ).join("");

  const sceneDesc =
    `This portfolio is an interactive 3D scene rendered as a server farm. ` +
    `Each of the ${projects.length} projects below is a server rack, and the racks are ` +
    `grouped into ${CLUSTER_ORDER.length} discipline clusters — ${clusterNameList()}. ` +
    `The 3D canvas itself is not machine-readable; the text below is a complete mirror of ` +
    `that scene — every rack, grouped by its cluster, with the same headline, description, stack, and links.`;

  return [
    `<main class="sr-only" aria-label="Olayinka David Vaughan — portfolio content">`,
    `<h1>Olayinka David Vaughan</h1>`,
    `<p>${escape(BIO)}</p>`,
    `<p><em>${escape(CURRENT)}</em></p>`,
    `<p>${escape(sceneDesc)}</p>`,
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
    projectClusters,
    `</section>`,
    `<section aria-labelledby="experience-heading">`,
    `<h2 id="experience-heading">Experience</h2>`,
    experienceArticles,
    `</section>`,
    `</main>`,
  ].join("");
}

// Build-time JSON-LD generator. The @graph carries: a ProfilePage that
// describes the page itself as an interactive 3D server-farm
// visualization, the Person, an ItemList that fixes project order, and
// one software node per project (SoftwareSourceCode, additionally typed
// SoftwareApplication when it has a live URL). Everything is derived from
// projects.ts so LLM agents and search engines stay in sync with the data.
// `dateModified` is the git HEAD ISO timestamp threaded in from
// vite.config.ts; falls back to build wall-clock when called standalone.
export function buildStructuredDataJSON(dateModified?: string): string {
  const BUILD_TIMESTAMP = dateModified ?? new Date().toISOString();

  const disciplines = CLUSTER_ORDER.map((c) => CLUSTER_DISPLAY[c]);
  const allStacks = Array.from(new Set(projects.flatMap((p) => p.stack)));

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
    // The recruiter-assistant's primary "what does this person know?"
    // signal: the five disciplines plus every distinct stack entry.
    knowsAbout: [...disciplines, ...allStacks],
    sameAs: SOCIALS.map((s) => s.href),
    mainEntityOfPage: { "@id": `${SITE_URL}/#webpage` },
  };

  // ProfilePage turns the scene's meaning into a structured claim: this
  // page is a WebGL server farm of N projects grouped into M clusters.
  const webpage = {
    "@type": "ProfilePage",
    "@id": `${SITE_URL}/#webpage`,
    url: `${SITE_URL}/`,
    name: "Olayinka David Vaughan — Portfolio",
    inLanguage: "en",
    dateModified: BUILD_TIMESTAMP,
    mainEntity: { "@id": person["@id"] },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: `${SITE_URL}/og-card.jpg`,
      width: 1200,
      height: 630,
    },
    hasPart: { "@id": `${SITE_URL}/#projects-list` },
    description:
      `An interactive 3D WebGL portfolio rendered as a server farm: each of ` +
      `${projects.length} projects is a server rack, and the racks are grouped into ` +
      `${CLUSTER_ORDER.length} discipline clusters (${disciplines.join(", ")}). The canvas ` +
      `is not machine-readable; this structured data and the page's sr-only text mirror are ` +
      `the parallel machine-readable representation of the scene's content.`,
  };

  const projectsList = {
    "@type": "ItemList",
    "@id": `${SITE_URL}/#projects-list`,
    name: "Projects",
    numberOfItems: projects.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: projects.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@id": `${SITE_URL}/#project-${p.id}` },
    })),
  };

  const works = projects.map((p) => {
    const langs = programmingLanguagesFor(p.stack);
    const isApp = Boolean(p.links.live);
    const image = p.image
      ? `${SITE_URL}${p.image}`
      : p.logo
        ? `${SITE_URL}${p.logo}`
        : undefined;
    const work: Record<string, unknown> = {
      "@type": isApp
        ? ["SoftwareSourceCode", "SoftwareApplication"]
        : "SoftwareSourceCode",
      "@id": `${SITE_URL}/#project-${p.id}`,
      name: p.name,
      description: p.blurb,
      keywords: p.stack,
      // Discipline cluster as a topical DefinedTerm — a queryable grouping
      // fact. (about/DefinedTerm fits a topic grouping better than genre,
      // which means a work's artistic/creative category.)
      about: {
        "@type": "DefinedTerm",
        name: CLUSTER_DISPLAY[p.cluster],
      },
      author: { "@id": person["@id"] },
      creator: { "@id": person["@id"] },
      isPartOf: { "@id": `${SITE_URL}/#projects-list` },
      dateModified: BUILD_TIMESTAMP,
    };
    if (langs.length > 0) work.programmingLanguage = langs;
    if (p.headline) work.headline = p.headline;
    if (p.links.repo) work.codeRepository = p.links.repo;
    if (p.links.live) work.url = p.links.live;
    if (image) work.image = image;
    // SoftwareApplication rich-result eligibility needs applicationCategory.
    // offers/aggregateRating are intentionally omitted — never fake a rating.
    if (isApp) {
      work.applicationCategory = "DeveloperApplication";
      work.operatingSystem = "Web";
    }
    return work;
  });

  const graph = {
    "@context": "https://schema.org",
    // Page-level node first so a crawler reads "what this page is" before
    // the entities it contains.
    "@graph": [webpage, person, projectsList, ...works],
  };

  return JSON.stringify(graph, null, 2);
}

// Build-time generator for /llms.txt (llmstxt.org): a curated, Markdown
// summary for LLM agents, emitted as a standalone asset by the Vite
// plugin in vite.config.ts. Derived from projects.ts like the other two
// generators so it never drifts. NOTE: this is Markdown, not HTML — do
// NOT run values through escape(); Markdown needs no entity-escaping and
// the blurbs' intentional smart quotes render fine.
export function buildLlmsTxt(): string {
  const lines: string[] = [];

  lines.push("# Olayinka David Vaughan");
  lines.push("");
  lines.push(
    `> Quant systems & full-stack engineer (Economics + Computer Science at ` +
      `Wesleyan University, declaring fall 2026). This portfolio renders as an ` +
      `interactive 3D "server farm": each of ${projects.length} projects is a server ` +
      `rack, grouped into ${CLUSTER_ORDER.length} discipline clusters ` +
      `(${clusterNameList()}). The scene is WebGL and invisible to text crawlers; ` +
      `this file is the machine-readable mirror of what it shows.`,
  );
  lines.push("");
  lines.push(BIO);
  lines.push("");
  lines.push(`Site: ${SITE_URL}/`);
  lines.push("");

  for (const cluster of CLUSTER_ORDER) {
    const inCluster = projectsForCluster(cluster);
    if (inCluster.length === 0) continue;
    lines.push(`## ${CLUSTER_DISPLAY[cluster]}`);
    lines.push("");
    if (CLUSTER_BLURB[cluster]) {
      lines.push(CLUSTER_BLURB[cluster] as string);
      lines.push("");
    }
    for (const p of inCluster) {
      const url =
        p.links.live ?? p.links.repo ?? `${SITE_URL}/#project-${p.id}`;
      const repoNote =
        p.links.live && p.links.repo ? ` (source: ${p.links.repo})` : "";
      const note = p.headline ? `${p.headline} — ${p.blurb}` : p.blurb;
      lines.push(`- [${p.name}](${url}): ${note}${repoNote}`);
    }
    lines.push("");
  }

  lines.push("## Links");
  lines.push("");
  for (const s of SOCIALS) lines.push(`- [${s.label}](${s.href})`);
  lines.push(`- [Resume (PDF)](${SITE_URL}/Olayinka_Vaughan_Resume.pdf)`);
  lines.push(`- [Email](mailto:${EMAIL})`);
  lines.push("");

  return lines.join("\n");
}
