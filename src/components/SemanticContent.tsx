import { projects } from "@/data/projects";
import { experience } from "@/data/experience";

// Plain-HTML mirror of the entire portfolio. Visually hidden via the
// `.sr-only` CSS pattern so it doesn't interfere with the 3D scene,
// but it IS in the live DOM — so search engines, LLM agents, screen
// readers, link-preview cards, and JS-disabled fallback users all
// have a complete textual representation of who you are and what
// you've built.

const EMAIL = "vaughanolayinka@gmail.com";
const PHONE = "+1 475 331 4070";

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/Builder106" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/yinka-vaughan/" },
  { label: "Devpost", href: "https://devpost.com/olayinkav" },
];

export function SemanticContent() {
  return (
    <main className="sr-only" aria-label="Olayinka David Vaughan — portfolio content">
      <h1>Olayinka David Vaughan</h1>
      <p>
        Quant systems and full-stack engineer. Economics major declaring
        Computer Science in fall 2026 at Wesleyan University. Based in
        Middletown, Connecticut. Interactive 3D portfolio built with React
        Three Fiber, Blender, and custom GLSL shaders.
      </p>

      <section aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact</h2>
        <ul>
          <li>Email: <a href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
          <li>Phone: <a href={`tel:${PHONE.replace(/\s/g, "")}`}>{PHONE}</a></li>
          <li>Location: Middletown, Connecticut, United States</li>
          {SOCIALS.map((s) => (
            <li key={s.label}>
              {s.label}: <a href={s.href}>{s.href.replace(/^https?:\/\//, "")}</a>
            </li>
          ))}
          <li>Resume: <a href="/Olayinka_Vaughan_Resume.pdf">Download PDF</a></li>
        </ul>
      </section>

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading">Projects</h2>
        {projects.map((p) => (
          <article key={p.id} aria-labelledby={`project-${p.id}-heading`}>
            <h3 id={`project-${p.id}-heading`}>{p.name}</h3>
            <p>{p.blurb}</p>
            <p>
              Cluster: {p.cluster}.
              {p.stack.length > 0 && <> Stack: {p.stack.join(", ")}.</>}
            </p>
            {(p.links.live || p.links.repo) && (
              <ul>
                {p.links.live && (
                  <li>Live: <a href={p.links.live}>{p.links.live}</a></li>
                )}
                {p.links.repo && (
                  <li>Repository: <a href={p.links.repo}>{p.links.repo}</a></li>
                )}
              </ul>
            )}
          </article>
        ))}
      </section>

      <section aria-labelledby="experience-heading">
        <h2 id="experience-heading">Experience</h2>
        {experience.map((e, i) => (
          <article key={`${e.org}-${i}`}>
            <h3>{e.role} — {e.org}</h3>
            <p>{e.period}</p>
            <ul>
              {e.bullets.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
