export type ProjectCluster =
  'quant' | 'systems' | 'swe' | 'analyst' | 'research' | 'security' | 'ml';

// Display label for each cluster, shared by every UI surface (rack
// callouts, project card section header, SR-only mirror). Keeps the
// "swe" → "SWE" capitalisation consistent.
export const CLUSTER_DISPLAY: Record<ProjectCluster, string> = {
  quant: 'quant',
  systems: 'systems',
  swe: 'SWE',
  analyst: 'analyst',
  research: 'research',
  security: 'cybersec',
  ml: 'AI/ML',
};

// Project ids in the order they should appear down the portrait aisle and
// in project card prev/next navigation — closest to camera first, receding
// into the fog. Centralized here so ProjectCard, TradingTerminal, and
// ServerRoom stay in lockstep without dragging WebGL/Three.js into light chunks.
export const AISLE_ORDER = [
  'econos',
  'ocaml-lob',
  'qforge',
  'micromatch',
  'staija',
  'studysprint',
  'capitol-alpha',
  'datafest-2026',
  'linuxbenchhub',
  'clearhash',
  'halberd',
  'quarry',
  'tcg-cabt-lab',
  'vgc-rulebreak',
  'tradetell',
] as const;

export type AisleProjectId = (typeof AISLE_ORDER)[number];

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
    id: 'econos',
    name: 'EconOS',
    cluster: 'quant',
    headline: 'MARL economy · one live kernel for every viewer',
    blurb:
      'A sandbox economy run by reinforcement-learning agents. PPO-trained buyers, sellers, and workers discover pricing, wage-setting, and consumption strategies in one shared simulation, shown on a tiling desktop in the i3/sway tradition where every pane reads from the running kernel.',
    stack: ['Python', 'PettingZoo', 'PPO', 'FastAPI', 'WebSocket'],
    links: {
      live: 'https://econ-os.vercel.app',
      repo: 'https://github.com/Builder106/econ-os',
    },
    image: '/img/projects/econos.webp',
    demo: '/img/projects/demos/econos.webm',
    color: '#36d4ff',
    logo: '/img/projects/logos/econos.webp',
  },
  {
    id: 'ocaml-lob',
    name: 'OCaml LOB',
    cluster: 'quant',
    headline: '~18M orders/sec · p99 < 1µs',
    blurb:
      'High-performance limit-order-book matching engine in OCaml 5. Allocation-free per-submit hot path, ~18M orders/sec, p99 latency under 1μs. Dream HTTP + SSE backend with a Bloomberg-terminal-style browser dashboard.',
    stack: ['OCaml', 'Dream', 'Docker', 'Tailwind', 'Oracle Cloud'],
    links: {
      live: 'https://ocaml-lob.vercel.app',
      repo: 'https://github.com/Builder106/ocaml-limit',
    },
    image: '/img/projects/ocaml-lob.webp',
    demo: '/img/projects/demos/ocaml-lob.webm',
    color: '#ffab2e',
    logo: '/img/projects/logos/ocaml-lob.webp',
  },
  {
    id: 'qforge',
    name: 'qforge',
    cluster: 'quant',
    headline: 'Neural net in ~2k LoC C99 · zero deps',
    blurb:
      'A neural network built from scratch in C99 — no TensorFlow, no PyTorch, no dependencies. Trains on market data, runs a DQN trading agent that outperforms buy-and-hold, ships as a WebAssembly demo.',
    stack: ['C99', 'WebAssembly', 'Emscripten'],
    links: {
      live: 'https://qforge-neural.vercel.app',
      repo: 'https://github.com/Builder106/qforge',
    },
    image: '/img/projects/qforge.webp',
    demo: '/img/projects/demos/qforge.webm',
    color: '#ff5240',
    logo: '/img/projects/logos/qforge.webp',
  },

  // Left wall (SWE cluster) ----------------------------------------------
  {
    id: 'micromatch',
    name: 'MicroMatch',
    cluster: 'swe',
    headline: '5–30 minute missions · NGO ↔ volunteer marketplace',
    blurb:
      'A micro-volunteering marketplace pairing NGOs with volunteers for 5–30 minute skill-building tasks. Volunteers claim missions, submit proof, and earn badges; NGOs post tasks and review submissions. The whole site is one quilt, and each block opens into its page.',
    stack: ['SvelteKit', 'Appwrite', 'Bun', 'TypeScript', 'Tailwind'],
    links: {
      live: 'https://trymicromatch.vercel.app',
      repo: 'https://github.com/Builder106/micro-match',
    },
    image: '/img/projects/micromatch.webp',
    demo: '/img/projects/demos/micromatch.webm',
    color: '#ff6f91',
    logo: '/img/projects/logos/micromatch.webp',
  },
  {
    id: 'staija',
    name: 'STAIJA',
    cluster: 'swe',
    headline: "Live applicant flow · Nigeria's STEM scholars",
    blurb:
      "Web platform for STAIJA's StepUp Scholars and Dynamerge programs — applicant tracking, mentorship workflow, and public content for Nigeria's STEM students. Application management, role-aware routing, and Mailgun-backed comms.",
    stack: ['Vue 3', 'TypeScript', 'Firebase', 'Tailwind', 'Vite'],
    links: {
      live: 'https://staija.org',
      repo: 'https://github.com/Builder106/staija',
    },
    image: '/img/projects/staija.webp',
    demo: '/img/projects/demos/staija.webm',
    color: '#1fd99b',
    logo: '/img/projects/logos/staija.webp',
  },
  {
    id: 'studysprint',
    name: 'StudySprint',
    cluster: 'swe',
    headline: 'Focus → plants → leaderboard',
    blurb:
      'A study tracker that turns focus sessions into a growing garden. Run a focus timer, log sessions toward a daily goal, watch plants grow over time, and compare streaks on a public leaderboard.',
    stack: ['Deno 2', 'React', 'TypeScript', 'Vite', 'Supabase'],
    links: {
      live: 'https://getstudysprint.vercel.app',
      repo: 'https://github.com/Builder106/study-sprint',
    },
    image: '/img/projects/studysprint.webp',
    demo: '/img/projects/demos/studysprint.webm',
    color: '#a6e22e',
    logo: '/img/projects/logos/studysprint.webp',
  },

  // Analyst cluster (right wall in landscape, back tier in portrait) -------
  // Statistical / data-pipeline work. Each ships a scroll capture of its
  // live findings page.
  {
    id: 'capitol-alpha',
    name: 'CapitolAlpha',
    cluster: 'analyst',
    headline: '16,203 trades · +2.58% alpha (p < 0.05)',
    blurb:
      "End-to-end Python pipeline auditing 16,203 disclosed Congressional stock trades from 2020–2024. Scrapes Senate and House Periodic Transaction Reports with Playwright + pdfplumber, computes Jensen's alpha against the S&P 500, and ships a Vercel findings page. Semester project for Wesleyan's QAC 420 — Data for Good.",
    stack: ['Python', 'Playwright', 'pdfplumber', 'pandas', 'scipy', 'Jupyter'],
    links: {
      live: 'https://capitolalpha.vercel.app',
      repo: 'https://github.com/Builder106/capitol-alpha',
    },
    demo: '/img/projects/demos/capitol-alpha.webm',
    color: '#ff3b5c',
    logo: '/img/projects/logos/capitol-alpha.webp',
  },
  {
    id: 'datafest-2026',
    name: 'DataFest 2026',
    cluster: 'analyst',
    headline: '3× ED-visit odds · n = 58,639 patients',
    blurb:
      'ASA DataFest 2026 submission for Stormont Vail Health. R + DuckDB pipeline on 7.6M encounters joined to a social-needs questionnaire. Patients who reported a transportation barrier made about four times as many ED visits per person-year, with 3.17× the odds of any ED visit after adjusting for age and sex. Wesleyan team 13.',
    stack: ['R', 'DuckDB', 'data.table', 'ggplot2', 'Flourish'],
    links: {
      live: 'https://datafest-2026.vercel.app/',
      repo: 'https://github.com/Builder106/datafest-2026',
    },
    demo: '/img/projects/demos/datafest-2026.webm',
    color: '#3b9bff',
    logo: '/img/projects/logos/datafest-2026.webp',
  },
  {
    id: 'linuxbenchhub',
    name: 'LinuxBenchHub',
    cluster: 'analyst',
    headline: 'Phoronix Test Suite · monthly CI captures',
    blurb:
      'A benchmarking dataset and Rails 8 dashboard comparing Ubuntu, Fedora, and Debian under identical virtual hardware. Phoronix runs are captured monthly by GitHub Actions; R parsers and the dashboard consume the same composite XML, so the static analysis and the live UI never drift.',
    stack: ['Ruby on Rails', 'R', 'Phoronix Test Suite', 'GitHub Actions', 'Docker'],
    links: {
      live: 'https://linuxbenchhub.vercel.app',
      repo: 'https://github.com/Builder106/linux-bench-hub',
    },
    demo: '/img/projects/demos/linuxbenchhub.webm',
    color: '#b06bff',
    logo: '/img/projects/logos/linuxbenchhub.webp',
  },

  // Security cluster -------------------------------------------------------
  // Supply-chain, agent-security, and on-chain-economic-security work.
  // Authored on the right wall (+X) of server-room.glb as the security wing
  // (Rack_/Screen_/StatusLED_/anchor_ per id), mirrored from the left-wall
  // racks. LEDs auto-adopt each project's `color` at runtime. Banner/demo/
  // logo assets live in each project's own repo and aren't copied into
  // public/img/projects/ yet.
  {
    id: 'clearhash',
    name: 'ClearHash',
    cluster: 'security',
    headline: 'Source-rebuild gatekeeper · blocks supply-chain tampering',
    blurb:
      'A pre-install gatekeeper that answers “is this binary actually a build of the source it claims?” Fetches a package, verifies its SLSA attestation through Sigstore + Rekor, rebuilds it from the attested source commit in an isolated Docker container, and blocks the install if the rebuilt file tree diverges from the registry artifact. Catches the event-stream / ua-parser-js / xz-utils class of attacks.',
    stack: ['Rust', 'Sigstore', 'Rekor', 'Docker', 'Axum'],
    links: {
      live: 'https://clear-hash.vercel.app',
      repo: 'https://github.com/Builder106/clear-hash',
    },
    color: '#3dff6a',
    logo: '/img/projects/logos/clearhash.webp',
  },
  {
    id: 'halberd',
    name: 'Halberd',
    cluster: 'security',
    headline: 'MCP firewall · 2.6 µs to refuse a DROP TABLE',
    blurb:
      'A JSON-RPC firewall that sits between an LLM agent and its Model Context Protocol servers. Every tools/call envelope is parsed, evaluated against a YAML policy bundle, and either forwarded or blocked with a synthetic error before a malicious payload reaches the host — defending against tool poisoning, argument injection, capability creep, and secret exfiltration. The site plays a PostgreSQL MCP session through the proxy, and its console runs the WebAssembly build of the policy engine in the browser.',
    stack: ['Go', 'WebAssembly', 'Next.js', 'JSON-RPC', 'MCP'],
    links: {
      live: 'https://halberd-keep.vercel.app',
      repo: 'https://github.com/Builder106/halberd',
    },
    color: '#f5c542',
    logo: '/img/projects/logos/halberd.webp',
  },
  {
    id: 'quarry',
    name: 'Quarry',
    cluster: 'security',
    headline: '188-byte Yul executor · 99.89% arb prediction',
    blurb:
      'A bare-metal MEV arbitrage engine scoped to cross-DEX back-running. A TypeScript mempool scanner spots swaps about to land on Uniswap-V2-shaped pools, solves the optimal back-run input against post-victim reserves, and — if profit beats gas — packs calldata for a 188-byte Yul executor funded by an Aave V3 flashloan. No inventory; predatory sandwich and JIT strategies are explicitly out of scope.',
    stack: ['Solidity', 'Yul', 'TypeScript', 'Foundry', 'Bun'],
    links: {
      live: 'https://quarry-mev.vercel.app',
      repo: 'https://github.com/Builder106/quarry',
    },
    color: '#ff8a1f',
    logo: '/img/projects/logos/quarry.webp',
  },

  // AI/ML cluster ----------------------------------------------------------
  // Agent research and applied ML: each project reports a number from a real,
  // logged run, not a model-zoo demo. Authored on the **front wall (+Z)** of
  // server-room.glb as the AI/ML wing — the three quant back-wall racks
  // point-mirrored across room centre (180° about Z), the same technique the
  // security wing used, so the shared bake stays consistent. Each has the usual `Rack_<id>` +
  // `Screen_<id>` + 12× `StatusLED_<id>_*` meshes and an `anchor_<id>` Empty.
  // Live in code: AISLE_ORDER (portrait), the slotIndexByKey `order` tuple +
  // landscape `waveSlotCount` (=5), the `ml` wave colour `#a06bff`, and the
  // front-wall case in `wallNormalFor`. LEDs recolour at runtime from `color`.
  {
    id: 'tcg-cabt-lab',
    name: 'TCG CABT Lab',
    cluster: 'ml',
    headline: '360 held-out games · 2,881-parameter policy',
    blurb:
      'A study of compact agents for the 60-card Pokémon Trading Card Game on the CABT simulation engine. It asks whether training against varied opponents helps on deck families the agent never trained on. Over 360 matched-pair games on held-out decks it did not: 58.3% for fixed-pool training against 57.8% for the diverse pool. The showcase lays every game out as a card on a table and replays any of them decision by decision.',
    stack: ['Python', 'NumPy', 'CABT', 'Astro', 'Blender'],
    links: {
      live: 'https://tcg-cabt-lab.vercel.app',
      repo: 'https://github.com/Builder106/tcg-cabt-lab',
    },
    color: '#2d7be5',
    logo: '/img/projects/logos/tcg-cabt-lab.webp',
    demo: '/img/projects/demos/tcg-cabt-lab.webm',
  },
  {
    id: 'vgc-rulebreak',
    name: 'VGC Rulebreak',
    cluster: 'ml',
    headline: '1,188 held-out games · Protect 16 → 8 PP',
    blurb:
      'A study of how competitive agents handle rules they were not trained for, run on Pokémon Showdown. The first study cuts Protect from 16 PP to 8. In 1,188 recorded held-out games no agent ever ran out of Protect PP, and an audit found the compared formats differed in more than PP, so a Protect-only rerun comes next. The showcase is a fan-made battle client that plays back every recorded game with open team sheets.',
    stack: ['Python', 'Pokémon Showdown', 'TypeScript', 'Astro'],
    links: {
      live: 'https://vgc-rulebreak.vercel.app',
      repo: 'https://github.com/Builder106/vgc-rulebreak',
    },
    color: '#c8f542',
    logo: '/img/projects/logos/vgc-rulebreak.webp',
    demo: '/img/projects/demos/vgc-rulebreak.webm',
  },
  {
    id: 'tradetell',
    name: 'TradeTell',
    cluster: 'ml',
    headline: '4 recorded days · 40,000 ticks per good · cited answers',
    blurb:
      'A workbench for the IMC Prosperity 4 market. It draws four recorded days on Intara as one price section you can probe tick by tick, replays a built-in Round 1 or Round 2 Trader through any day with fills and P&L on the same ticks, and answers questions from the competition wiki, market data, and code examples with the passages behind each answer.',
    stack: ['Python', 'Streamlit', 'Groq', 'RAG', 'Canvas'],
    links: {
      live: 'https://tradetell.streamlit.app',
      repo: 'https://github.com/Builder106/imc-prosperity',
    },
    color: '#ff4b4b',
    logo: '/img/projects/logos/tradetell.webp',
    demo: '/img/projects/demos/tradetell.webm',
  },
];
