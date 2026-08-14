import {
  siAppwrite,
  siBun,
  siC,
  siDeno,
  siDocker,
  siDuckdb,
  siFastapi,
  siFirebase,
  siGithubactions,
  siGo,
  siGooglegemini,
  siJupyter,
  siModelcontextprotocol,
  siNextdotjs,
  siNodedotjs,
  siOcaml,
  siOllama,
  siPandas,
  siPython,
  siR,
  siReact,
  siRubyonrails,
  siRust,
  siScipy,
  siSolidity,
  siStreamlit,
  siSupabase,
  siSvelte,
  siTailwindcss,
  siTypescript,
  siVite,
  siVuedotjs,
  siWebassembly,
  type SimpleIcon,
} from 'simple-icons';

export interface ResolvedStackIcon {
  path: string;
  hex: string;
  title: string;
}

// simple-icons exports one object per brand; this keys them by the
// icon's own slug so TAG_TO_SLUG (below) can map several project.stack
// spellings onto a single icon without importing it twice.
const SLUG_ICON: Record<string, SimpleIcon> = {
  appwrite: siAppwrite,
  bun: siBun,
  c: siC,
  deno: siDeno,
  docker: siDocker,
  duckdb: siDuckdb,
  fastapi: siFastapi,
  firebase: siFirebase,
  githubactions: siGithubactions,
  go: siGo,
  googlegemini: siGooglegemini,
  jupyter: siJupyter,
  modelcontextprotocol: siModelcontextprotocol,
  nextdotjs: siNextdotjs,
  nodedotjs: siNodedotjs,
  ocaml: siOcaml,
  ollama: siOllama,
  pandas: siPandas,
  python: siPython,
  r: siR,
  react: siReact,
  rubyonrails: siRubyonrails,
  rust: siRust,
  scipy: siScipy,
  solidity: siSolidity,
  streamlit: siStreamlit,
  supabase: siSupabase,
  svelte: siSvelte,
  tailwindcss: siTailwindcss,
  typescript: siTypescript,
  vite: siVite,
  vuedotjs: siVuedotjs,
  webassembly: siWebassembly,
};

// Lowercased project.stack tag -> SLUG_ICON key. Multiple tags (version
// suffixes, alternate names) intentionally point at the same slug.
const TAG_TO_SLUG: Record<string, string> = {
  appwrite: 'appwrite',
  bun: 'bun',
  c99: 'c',
  'deno 2': 'deno',
  docker: 'docker',
  duckdb: 'duckdb',
  fastapi: 'fastapi',
  firebase: 'firebase',
  'gemini 3.1 flash lite': 'googlegemini',
  'github actions': 'githubactions',
  go: 'go',
  jupyter: 'jupyter',
  mcp: 'modelcontextprotocol',
  'next.js': 'nextdotjs',
  'next.js 16': 'nextdotjs',
  node: 'nodedotjs',
  ocaml: 'ocaml',
  ollama: 'ollama',
  pandas: 'pandas',
  python: 'python',
  r: 'r',
  react: 'react',
  'react 19': 'react',
  'ruby on rails': 'rubyonrails',
  rust: 'rust',
  scipy: 'scipy',
  solidity: 'solidity',
  streamlit: 'streamlit',
  supabase: 'supabase',
  sveltekit: 'svelte',
  tailwind: 'tailwindcss',
  typescript: 'typescript',
  vite: 'vite',
  'vue 3': 'vuedotjs',
  webassembly: 'webassembly',
};

// Simple Icons ships one canonical brand hex per icon; several (Next.js,
// Rust, Bun, Deno, Ollama, MCP) are pure black, and a couple more
// (Solidity, pandas) sit in near-black navy/charcoal. Any of those would
// be unreadable against the chip's near-black background, so every
// resolved hex is passed through this HSL lightness floor rather than
// hand-picking per-icon overrides.
const MIN_LIGHTNESS = 0.45;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function clampLightness(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l >= MIN_LIGHTNESS) return `#${hex}`;
  const [nr, ng, nb] = hslToRgb(h, s, MIN_LIGHTNESS);
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export function resolveStackIcon(tag: string): ResolvedStackIcon | null {
  const slug = TAG_TO_SLUG[tag.toLowerCase().trim()];
  if (!slug) return null;
  const icon = SLUG_ICON[slug];
  return {
    path: icon.path,
    hex: clampLightness(icon.hex),
    title: icon.title,
  };
}
