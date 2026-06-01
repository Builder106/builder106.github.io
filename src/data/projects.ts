export type ProjectCluster = "quant" | "systems" | "swe" | "analyst" | "research" | "security";

// Display label for each cluster, shared by every UI surface (rack
// callouts, project card section header, SR-only mirror). Keeps the
// "swe" → "SWE" capitalisation consistent.
export const CLUSTER_DISPLAY: Record<ProjectCluster, string> = {
  quant: "quant",
  systems: "systems",
  swe: "SWE",
  analyst: "analyst",
  research: "research",
  security: "security",
};

export interface Project {
  id: string;
  name: string;
  cluster: ProjectCluster;
  blurb: string;
  stack: string[];
  links: { live?: string; repo?: string };
  // Path to a banner / thumbnail under public/. Optional.
  image?: string;
  // Path to a looping WebM demo under public/. Optional.
  demo?: string;
  // One-line, recruiter-readable signature stat. Rendered as a big
  // monospace headline above the blurb in ProjectCard. Optional.
  headline?: string;
  // Signature accent color for the rack: drives the floor-glow point
  // light under the rack and may be reused for the rack label / chips.
  // CSS-hex string ("#rrggbb").
  color?: string;
  // Square-cropped, transparent-PNG logo. Rendered as a textured plane
  // on the front face of the rack so each rack reads as its own brand
  // from the default isometric vantage.
  logo?: string;
  // Set to false for projects that ship in the semantic mirror / JSON-LD
  // but have no rack authored in the Blender scene yet. Suppresses the
  // dev-only "missing anchor" warning. Defaults to true.
  inScene?: boolean;
  // Each project's id matches an Empty named "anchor_<id>" in the Blender
  // scene (underscore separator — Three.js's GLTFLoader strips dots). See
  // docs/blender-contract.md.
}

export const projects: Project[] = [
  // Back wall (quant cluster) ---------------------------------------------
  {
    id: "econos",
    name: "EconOS",
    cluster: "quant",
    headline: "MARL economy · live shared mainframe",
    blurb:
      "Multi-Agent Reinforcement Learning desktop environment for decentralized economic simulation. PPO-trained agents discover pricing, wage-setting, and consumption strategies inside a glassmorphic OS-style dashboard.",
    stack: ["Python", "PettingZoo", "PPO", "FastAPI", "WebSocket"],
    links: {
      live: "https://econ-os.vercel.app",
      repo: "https://github.com/Builder106/EconOS",
    },
    image: "/img/projects/econos.png",
    demo: "/img/projects/demos/econos.webm",
    color: "#4cf2ff",
    logo: "/img/projects/logos/econos.png",
  },
  {
    id: "ocaml-lob",
    name: "OCaml LOB",
    cluster: "quant",
    headline: "~18M orders/sec · p99 < 1µs",
    blurb:
      "High-performance limit-order-book matching engine in OCaml 5. Allocation-free per-submit hot path, ~18M orders/sec, p99 latency under 1μs. Dream HTTP + SSE backend with a Bloomberg-terminal-style browser dashboard.",
    stack: ["OCaml", "Dream", "Docker", "Tailwind", "Oracle Cloud"],
    links: {
      live: "https://ocaml-lob.vercel.app",
      repo: "https://github.com/Builder106/ocaml_limit",
    },
    image: "/img/projects/ocaml-lob.png",
    demo: "/img/projects/demos/ocaml-lob.webm",
    color: "#f29100",
    logo: "/img/projects/logos/ocaml-lob.png",
  },
  {
    id: "qforge",
    name: "qforge",
    cluster: "quant",
    headline: "Neural net in ~2k LoC C99 · zero deps",
    blurb:
      "A neural network built from scratch in C99 — no TensorFlow, no PyTorch, no dependencies. Trains on market data, runs a DQN trading agent that outperforms buy-and-hold, ships as a WebAssembly demo.",
    stack: ["C99", "WebAssembly", "Emscripten"],
    links: {
      live: "https://qforge-neural.vercel.app",
      repo: "https://github.com/Builder106/qforge",
    },
    image: "/img/projects/qforge.png",
    demo: "/img/projects/demos/qforge.webm",
    color: "#ff5b3c",
    logo: "/img/projects/logos/qforge.png",
  },

  // Left wall (SWE cluster) ----------------------------------------------
  {
    id: "micromatch",
    name: "MicroMatch",
    cluster: "swe",
    headline: "123 tests passing · NGO ↔ volunteer marketplace",
    blurb:
      "A micro-volunteering marketplace pairing NGOs with volunteers for 5–30 minute skill-building tasks. Volunteers browse the feed, claim missions, submit proof, and earn badges. NGOs post tasks and review submissions.",
    stack: ["SvelteKit", "Appwrite", "Bun", "TypeScript", "Tailwind"],
    links: {
      live: "https://trymicromatch.vercel.app",
      repo: "https://github.com/Builder106/MicroMatch",
    },
    image: "/img/projects/micromatch.png",
    demo: "/img/projects/demos/micromatch.webm",
    color: "#ff6f61",
    logo: "/img/projects/logos/micromatch.png",
  },
  {
    id: "staija",
    name: "STAIJA",
    cluster: "swe",
    headline: "Live applicant flow · Nigeria's STEM scholars",
    blurb:
      "Web platform for STAIJA's StepUp Scholars and Dynamerge programs — applicant tracking, mentorship workflow, and public content for Nigeria's STEM students. Application management, role-aware routing, and Mailgun-backed comms.",
    stack: ["Vue 3", "TypeScript", "Firebase", "Tailwind", "Vite"],
    links: {
      live: "https://staija.org",
      repo: "https://github.com/Builder106/STAIJA",
    },
    image: "/img/projects/staija.png",
    demo: "/img/projects/demos/staija.webm",
    color: "#10b981",
    logo: "/img/projects/logos/staija.png",
  },
  {
    id: "studysprint",
    name: "StudySprint",
    cluster: "swe",
    headline: "Focus → plants → leaderboard",
    blurb:
      "A study tracker that turns focus sessions into a growing garden. Run a focus timer, log sessions toward a daily goal, watch plants grow over time, and compare streaks on a public leaderboard.",
    stack: ["Deno 2", "React", "TypeScript", "Vite", "Supabase"],
    links: {
      live: "https://getstudysprint.vercel.app",
      repo: "https://github.com/Builder106/StudySprint",
    },
    image: "/img/projects/studysprint.png",
    demo: "/img/projects/demos/studysprint.webm",
    color: "#84cc16",
    logo: "/img/projects/logos/studysprint.png",
  },

  // Analyst cluster (right wall in landscape, back tier in portrait) -------
  // Statistical / data-pipeline work. capitol-alpha + datafest-2026 each
  // ship a 15 s scroll capture of their live findings page. linuxbenchhub
  // has no live URL yet, so its panel falls back to the static blurb.
  {
    id: "capitol-alpha",
    name: "CapitolAlpha",
    cluster: "analyst",
    headline: "16,203 trades · +2.58% alpha (p < 0.05)",
    blurb:
      "End-to-end Python pipeline auditing 16,203 disclosed Congressional stock trades from 2020–2024. Scrapes Senate and House Periodic Transaction Reports with Playwright + pdfplumber, computes Jensen's alpha against the S&P 500, and ships a Vercel findings page. Semester project for Wesleyan's QAC 420 — Data for Good.",
    stack: ["Python", "Playwright", "pdfplumber", "pandas", "scipy", "Jupyter"],
    links: {
      live: "https://capitolalpha.vercel.app",
      repo: "https://github.com/Builder106/CapitolAlpha",
    },
    demo: "/img/projects/demos/capitol-alpha.webm",
    color: "#cc0000",
    logo: "/img/projects/logos/capitol-alpha.png",
  },
  {
    id: "datafest-2026",
    name: "DataFest 2026",
    cluster: "analyst",
    headline: "3× ED-visit odds · n = 58,639 patients",
    blurb:
      "ASA DataFest 2026 submission for Stormont Vail Health. R + DuckDB pipeline on a 7.6M-row EHR sample joined to a social-determinants questionnaire — patients reporting a transportation barrier show ~3× crude odds of ED visits and inpatient admits, independent of age. Wesleyan team 13.",
    stack: ["R", "DuckDB", "data.table", "ggplot2", "Flourish"],
    links: {
      live: "https://datafest-2026.vercel.app/",
      repo: "https://github.com/Builder106/datafest-2026",
    },
    demo: "/img/projects/demos/datafest-2026.webm",
    color: "#276dc3",
    logo: "/img/projects/logos/datafest-2026.png",
  },
  {
    id: "linuxbenchhub",
    name: "LinuxBenchHub",
    cluster: "analyst",
    headline: "Phoronix Test Suite · monthly CI captures",
    blurb:
      "A benchmarking dataset and Rails 8 dashboard comparing Ubuntu, Fedora, and Debian under identical virtual hardware. Phoronix runs are captured monthly by GitHub Actions; R parsers and the dashboard consume the same composite XML, so the static analysis and the live UI never drift.",
    stack: ["Ruby on Rails", "R", "Phoronix Test Suite", "GitHub Actions", "Docker"],
    links: {
      repo: "https://github.com/Builder106/LinuxBenchHub",
    },
    color: "#cc342d",
    logo: "/img/projects/logos/linuxbenchhub.png",
  },

  // Security cluster -------------------------------------------------------
  // Supply-chain, agent-security, and on-chain-economic-security work.
  // Authored on the right wall (+X) of server-room.glb as the security wing
  // (Rack_/Screen_/StatusLED_/anchor_ per id), mirrored from the left-wall
  // racks. LEDs auto-adopt each project's `color` at runtime. Banner/demo/
  // logo assets live in each project's own repo and aren't copied into
  // public/img/projects/ yet.
  {
    id: "clearhash",
    name: "ClearHash",
    cluster: "security",
    headline: "Source-rebuild gatekeeper · blocks supply-chain tampering",
    blurb:
      "A pre-install gatekeeper that answers “is this binary actually a build of the source it claims?” Fetches a package, verifies its SLSA attestation through Sigstore + Rekor, rebuilds it from the attested source commit in an isolated Docker container, and blocks the install if the rebuilt file tree diverges from the registry artifact. Catches the event-stream / ua-parser-js / xz-utils class of attacks.",
    stack: ["Rust", "Sigstore", "Rekor", "Docker", "Axum"],
    links: {
      live: "https://clear-hash.vercel.app",
      repo: "https://github.com/Builder106/ClearHash",
    },
    color: "#39ff14",
    logo: "/img/projects/logos/clearhash.png",
  },
  {
    id: "halberd",
    name: "Halberd",
    cluster: "security",
    headline: "MCP firewall · p50 ≤ 200µs · 50k req/s",
    blurb:
      "A JSON-RPC firewall that sits between an LLM agent and its Model Context Protocol servers. Every tools/call envelope is parsed, evaluated against a YAML policy bundle, and either forwarded or blocked with a synthetic error before a malicious payload reaches the host — defending against tool poisoning, argument injection, capability creep, and secret exfiltration. The policy engine compiles to WebAssembly for an in-browser playground.",
    stack: ["Go", "WebAssembly", "Next.js", "JSON-RPC", "MCP"],
    links: {
      live: "https://halberd-keep.vercel.app",
      repo: "https://github.com/Builder106/Halberd",
    },
    color: "#e0b341",
    logo: "/img/projects/logos/halberd.png",
  },
  {
    id: "quarry",
    name: "Quarry",
    cluster: "security",
    headline: "188-byte Yul executor · 99.89% arb prediction",
    blurb:
      "A bare-metal MEV arbitrage engine scoped to cross-DEX back-running. A TypeScript mempool scanner spots swaps about to land on Uniswap-V2-shaped pools, solves the optimal back-run input against post-victim reserves, and — if profit beats gas — packs calldata for a 188-byte Yul executor funded by an Aave V3 flashloan. No inventory; predatory sandwich and JIT strategies are explicitly out of scope.",
    stack: ["Solidity", "Yul", "TypeScript", "Foundry", "Bun"],
    links: {
      live: "https://quarry-mev.vercel.app",
      repo: "https://github.com/Builder106/Quarry",
    },
    color: "#ff7a18",
    logo: "/img/projects/logos/quarry.png",
  },
];
