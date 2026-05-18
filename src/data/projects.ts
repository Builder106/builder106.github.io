export type ProjectCluster = "quant" | "systems" | "products" | "research";

export interface Project {
  id: string;
  name: string;
  cluster: ProjectCluster;
  blurb: string;
  stack: string[];
  links: { live?: string; repo?: string };
  // Path to a banner / thumbnail under public/. Optional.
  image?: string;
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
    blurb:
      "Multi-Agent Reinforcement Learning desktop environment for decentralized economic simulation. PPO-trained agents discover pricing, wage-setting, and consumption strategies inside a glassmorphic OS-style dashboard.",
    stack: ["Python", "PettingZoo", "PPO", "FastAPI", "WebSocket"],
    links: {
      live: "https://econ-os.vercel.app",
      repo: "https://github.com/Builder106/EconOS",
    },
    image: "/img/projects/econos.png",
  },
  {
    id: "ocaml-lob",
    name: "OCaml LOB",
    cluster: "quant",
    blurb:
      "High-performance limit-order-book matching engine in OCaml 5. Allocation-free per-submit hot path, ~18M orders/sec, p99 latency under 1μs. Dream HTTP + SSE backend with a Bloomberg-terminal-style browser dashboard.",
    stack: ["OCaml", "Dream", "Docker", "Tailwind", "Oracle Cloud"],
    links: {
      live: "https://ocaml-lob.vercel.app",
      repo: "https://github.com/Builder106/ocaml_limit",
    },
    image: "/img/projects/ocaml-lob.png",
  },
  {
    id: "qforge",
    name: "qforge",
    cluster: "quant",
    blurb:
      "A neural network built from scratch in C99 — no TensorFlow, no PyTorch, no dependencies. Trains on market data, runs a DQN trading agent that outperforms buy-and-hold, ships as a WebAssembly demo.",
    stack: ["C99", "WebAssembly", "Emscripten"],
    links: {
      live: "https://qforge-neural.vercel.app",
      repo: "https://github.com/Builder106/qforge",
    },
    image: "/img/projects/qforge.png",
  },

  // Left wall (products cluster) ------------------------------------------
  {
    id: "micromatch",
    name: "MicroMatch",
    cluster: "products",
    blurb:
      "A micro-volunteering marketplace pairing NGOs with volunteers for 5–30 minute skill-building tasks. Volunteers browse the feed, claim missions, submit proof, and earn badges. NGOs post tasks and review submissions.",
    stack: ["SvelteKit", "Appwrite", "Bun", "TypeScript", "Tailwind"],
    links: {
      live: "https://trymicromatch.vercel.app",
      repo: "https://github.com/Builder106/MicroMatch",
    },
    image: "/img/projects/micromatch.png",
  },
  {
    id: "staija",
    name: "STAIJA",
    cluster: "products",
    blurb:
      "Web platform for STAIJA's StepUp Scholars and Dynamerge programs — applicant tracking, mentorship workflow, and public content for Nigeria's STEM students. Application management, role-aware routing, and Mailgun-backed comms.",
    stack: ["Vue 3", "TypeScript", "Firebase", "Tailwind", "Vite"],
    links: {
      live: "https://staija.org",
      repo: "https://github.com/Builder106/STAIJA",
    },
    image: "/img/projects/staija.png",
  },
  {
    id: "studysprint",
    name: "StudySprint",
    cluster: "products",
    blurb:
      "A study tracker that turns focus sessions into a growing garden. Run a focus timer, log sessions toward a daily goal, watch plants grow over time, and compare streaks on a public leaderboard.",
    stack: ["Deno 2", "React", "TypeScript", "Vite", "Supabase"],
    links: {
      live: "https://getstudysprint.vercel.app",
      repo: "https://github.com/Builder106/StudySprint",
    },
    image: "/img/projects/studysprint.png",
  },
];
