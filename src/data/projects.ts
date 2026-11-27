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

// Order the prev/next buttons and the aisle strip follow: clockwise around the
// landscape room as seen from above. Back wall left to right, right wall back
// to front, front wall right to left, then left wall front to back.
export const TOUR_ORDER: readonly AisleProjectId[] = [
  'econos',
  'ocaml-lob',
  'qforge',
  'quarry',
  'halberd',
  'clearhash',
  'tcg-cabt-lab',
  'vgc-rulebreak',
  'tradetell',
  'micromatch',
  'staija',
  'studysprint',
  'capitol-alpha',
  'datafest-2026',
  'linuxbenchhub',
];

export interface Project {
  id: string;
  name: string;
  cluster: ProjectCluster;
  blurb: string;
  stack: string[];
  links: { live?: string; repo?: string; paper?: string };
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
    headline: 'A MARL economy where every viewer watches the same live kernel',
    blurb:
      'A sandbox economy where learning agents set prices, wages and spending on their own. Every pane of its tiling desktop reads from one live simulation.',
    stack: ['Python', 'PettingZoo', 'PPO', 'FastAPI', 'WebSocket'],
    links: {
      live: 'https://econ-os.vercel.app',
      repo: 'https://github.com/Builder106/econ-os',
    },
    image: '/img/projects/econos.webp',
    demo: '/img/projects/demos/econos.webm',
    color: '#b58fe0',
    logo: '/img/projects/logos/econos.webp',
  },
  {
    id: 'ocaml-lob',
    name: 'OCaml LOB',
    cluster: 'quant',
    headline: '~18M orders/sec with p99 under 1 µs',
    blurb:
      'An order-matching engine for a stock exchange, written in OCaml. A trading-terminal dashboard shows the book filling in real time.',
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
    headline: 'A neural net in about 2k lines of C99, with no dependencies',
    blurb:
      'A neural network built from scratch in C, with no libraries. It trains a trading agent that beats buy-and-hold, and runs in your browser.',
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
    headline: '5 to 30 minute volunteer missions for NGOs',
    blurb:
      'A marketplace that matches NGOs with volunteers for short tasks that build a skill. Volunteers claim a mission, send proof and earn badges.',
    stack: ['SvelteKit', 'Appwrite', 'Bun', 'TypeScript', 'Tailwind'],
    links: {
      live: 'https://trymicromatch.vercel.app',
      repo: 'https://github.com/Builder106/micro-match',
    },
    image: '/img/projects/micromatch.webp',
    demo: '/img/projects/demos/micromatch.webm',
    color: '#ff6b6b',
    logo: '/img/projects/logos/micromatch.webp',
  },
  {
    id: 'staija',
    name: 'STAIJA',
    cluster: 'swe',
    headline: "A live applicant flow for Nigeria's STEM scholars",
    blurb:
      "The web platform for STAIJA's scholarship and mentorship programs for Nigerian STEM students. It runs applications, applicant tracking and mentoring.",
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
    headline: 'Focus sessions that grow a garden',
    blurb:
      'A study timer that grows a garden as you focus. Daily goals and streaks go up on a public leaderboard.',
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
    headline: '3,942 House stock buys, no edge after disclosure',
    blurb:
      "Can you beat the market by copying Congress's stock buys once they're disclosed? No: copying them earned about -1.6% a year, while copying company insiders the same way earned 8.5%.",
    stack: ['Python', 'Playwright', 'pdfplumber', 'pandas', 'scipy', 'Jupyter'],
    links: {
      live: 'https://capitolalpha.vercel.app',
      repo: 'https://github.com/Builder106/capitol-alpha',
      paper: 'https://doi.org/10.5281/zenodo.24560053',
    },
    demo: '/img/projects/demos/capitol-alpha.webm',
    color: '#ff3b5c',
    logo: '/img/projects/logos/capitol-alpha.webp',
  },
  {
    id: 'datafest-2026',
    name: 'DataFest 2026',
    cluster: 'analyst',
    headline: '3× the odds of an ED visit, across 58,639 patients',
    blurb:
      "Wesleyan's ASA DataFest 2026 entry for Stormont Vail Health. Patients without reliable transportation ended up in the emergency room far more often.",
    stack: ['R', 'DuckDB', 'data.table', 'ggplot2', 'Flourish'],
    links: {
      live: 'https://datafest-2026.vercel.app/',
      repo: 'https://github.com/Builder106/datafest-2026',
    },
    demo: '/img/projects/demos/datafest-2026.webm',
    color: '#6fb3bd',
    logo: '/img/projects/logos/datafest-2026.webp',
  },
  {
    id: 'linuxbenchhub',
    name: 'LinuxBenchHub',
    cluster: 'analyst',
    headline: 'Phoronix Test Suite runs captured monthly in CI',
    blurb:
      'Ubuntu, Fedora and Debian benchmarked on identical hardware every month. The dashboard and the written analysis read the same results, so they always agree.',
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
    headline: 'Rebuilds packages from source to catch supply-chain tampering',
    blurb:
      "A check that runs before you install a package. It rebuilds the package from its claimed source and blocks the install if the two don't match.",
    stack: ['Rust', 'Sigstore', 'Rekor', 'Docker', 'Axum'],
    links: {
      live: 'https://clearhash.vercel.app',
      repo: 'https://github.com/Builder106/clear-hash',
    },
    demo: '/img/projects/demos/clearhash.webm',
    color: '#3dff6a',
    logo: '/img/projects/logos/clearhash.webp',
  },
  {
    id: 'halberd',
    name: 'Halberd',
    cluster: 'security',
    headline: 'An MCP firewall that refuses a DROP TABLE in 2.6 µs',
    blurb:
      'A firewall between an AI agent and the tools it calls. It checks every request against your rules and blocks harmful ones before they run.',
    stack: ['Go', 'WebAssembly', 'Next.js', 'JSON-RPC', 'MCP'],
    links: {
      live: 'https://halberd-keep.vercel.app',
      repo: 'https://github.com/Builder106/halberd',
    },
    demo: '/img/projects/demos/halberd.webm',
    color: '#f5c542',
    logo: '/img/projects/logos/halberd.webp',
  },
  {
    id: 'quarry',
    name: 'Quarry',
    cluster: 'security',
    headline: 'A 188-byte Yul executor and 99.89% arb prediction',
    blurb:
      "An arbitrage bot that trades right after a large swap moves a crypto exchange's price, funded by a flash loan through a tiny on-chain contract.",
    stack: ['Solidity', 'Yul', 'TypeScript', 'Foundry', 'Bun'],
    links: {
      live: 'https://quarry-mev.vercel.app',
      repo: 'https://github.com/Builder106/quarry',
    },
    demo: '/img/projects/demos/quarry.webm',
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
    headline: '4 preregistered studies, 7,200 held-out games each',
    blurb:
      'Does training a card-game AI against varied opponents help it face new decks? Four preregistered studies found no difference, and you can replay 360 games card by card.',
    stack: ['Python', 'NumPy', 'CABT', 'Astro', 'Blender'],
    links: {
      live: 'https://tcg-cabt-lab.vercel.app',
      repo: 'https://github.com/Builder106/tcg-cabt-lab',
      paper: '/research/opponent-pool-preprint.pdf',
    },
    color: '#2d7be5',
    logo: '/img/projects/logos/tcg-cabt-lab.webp',
    demo: '/img/projects/demos/tcg-cabt-lab.webm',
  },
  {
    id: 'vgc-rulebreak',
    name: 'VGC Rulebreak',
    cluster: 'ml',
    headline: '1,188 held-out games with Protect cut from 16 to 8 PP',
    blurb:
      "How do game-playing agents cope when a rule changes? With a key move's uses cut in half, no agent ran out in 1,188 games, and every battle replays in the browser.",
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
    headline: 'Four recorded days, 40,000 ticks per good, and answers that cite their sources',
    blurb:
      'A study tool for the IMC Prosperity trading challenge. Scrub through recorded market days, replay a trader, or ask questions that cite their sources.',
    stack: ['Python', 'Streamlit', 'Groq', 'RAG', 'Canvas'],
    links: {
      live: 'https://tradetell.streamlit.app',
      repo: 'https://github.com/Builder106/imc-prosperity',
    },
    color: '#ee5a36',
    logo: '/img/projects/logos/tradetell.webp',
    demo: '/img/projects/demos/tradetell.webm',
  },
];
