export type ProjectCluster = "quant" | "systems" | "products" | "research";

export interface Project {
  id: string;
  name: string;
  cluster: ProjectCluster;
  blurb: string;
  stack: string[];
  links: { live?: string; repo?: string };
  // Anchor name in the Blender scene that this project's rack/screen maps to.
  // The anchor is an Empty named "anchor.<id>" — see docs/blender-contract.md.
  anchor: string;
}

// Keep this file the single source of truth for project content. The 3D scene
// reads anchors from here; the React panels read everything else.
export const projects: Project[] = [
  {
    id: "imc-prosperity",
    name: "IMC Trading Prosperity 3",
    cluster: "quant",
    blurb:
      "Algorithmic trading challenge — built a market-making and arbitrage bot in Python over five rounds.",
    stack: ["Python", "Pandas", "NumPy"],
    links: {},
    anchor: "anchor.imc-prosperity",
  },
  {
    id: "capitol-alpha",
    name: "Capitol Alpha",
    cluster: "quant",
    blurb:
      "R-based pipeline analyzing Congressional trading disclosures for signal generation.",
    stack: ["R", "tidyverse", "PostgreSQL"],
    links: {},
    anchor: "anchor.capitol-alpha",
  },
  {
    id: "linuxbenchhub",
    name: "LinuxBenchHub",
    cluster: "systems",
    blurb:
      "Performance benchmarking of Linux distributions across virtual machines, with persisted results and analysis.",
    stack: ["Ruby", "PostgreSQL", "R", "Vue.js"],
    links: { repo: "https://github.com/Builder106/LinuxBenchHub" },
    anchor: "anchor.linuxbenchhub",
  },
  {
    id: "naijatank",
    name: "NaijaTank",
    cluster: "products",
    blurb: "Fuel-availability tracker for Nigerian drivers.",
    stack: ["Angular", "Supabase", "TypeScript", "Tailwind"],
    links: { live: "https://naijatank.me", repo: "https://github.com/Builder106/NaijaTank" },
    anchor: "anchor.naijatank",
  },
  {
    id: "staija",
    name: "STAIJA",
    cluster: "products",
    blurb: "Website for an NGO connecting Nigerian students with research opportunities.",
    stack: ["Vue.js", "Tailwind", "Firebase", "Contentful"],
    links: { live: "https://staija.org", repo: "https://github.com/Builder106/STAIJA" },
    anchor: "anchor.staija",
  },
  {
    id: "applytok",
    name: "ApplyTok",
    cluster: "products",
    blurb: "TikTok-inspired job application platform.",
    stack: ["Next.js", "Nest.js", "AWS", "Supabase", "TypeScript"],
    links: { live: "https://applytok.tech", repo: "https://github.com/Builder106/ApplyTok" },
    anchor: "anchor.applytok",
  },
];
