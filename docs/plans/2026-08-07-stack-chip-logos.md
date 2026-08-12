# Stack Chip Logos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add brand-colored framework/language logos to the "stack" chips in the rack modal (`ProjectCard.tsx`), with a neutral fallback glyph for tags that have no matching logo.

**Architecture:** A pure-data lookup module (`stackIcons.ts`) maps each of the 55 distinct stack tags in `projects.ts` to a `simple-icons` icon (individually imported, tree-shaken) or `null`. A `StackChip` component consumes that lookup and renders either the brand-colored SVG + text or the fallback glyph + text. `ProjectCard.tsx` swaps its plain `<span>` chip loop for `<StackChip>`.

**Tech Stack:** React 19, TypeScript, `simple-icons` (new dependency), Vitest.

## Global Constraints

- Import icons individually by name (`import { siReact } from 'simple-icons'`) — never `import * as`. `simple-icons` has `sideEffects: false` so Rollup/Vite tree-shakes unused named exports; a wildcard import risks disabling that.
- Every tag in `projects.ts` must resolve to either a real icon or the documented fallback — no silent blank/undefined case.
- Icon SVGs are decorative: every `<svg>` gets `aria-hidden="true"`.
- No changes to `Project` type or `projects.ts` — icons resolve purely from the existing `stack: string[]` at render time.
- Chip layout (padding, border, background, left accent) in `Panel.css` is unchanged; only new rules are added for icon sizing.

---

### Task 1: Install `simple-icons` and create the icon lookup module

**Files:**

- Modify: `package.json` (add `simple-icons` dependency)
- Create: `src/data/stackIcons.ts`
- Test: `src/data/stackIcons.test.ts`

**Interfaces:**

- Produces: `resolveStackIcon(tag: string): ResolvedStackIcon | null` and `export interface ResolvedStackIcon { path: string; hex: string; title: string }` — consumed by Task 2's `StackChip`.

- [ ] **Step 1: Add the dependency without creating `node_modules` on the Mac**

Per this machine's rule that installs/builds only happen on the `ampere-dev` VM, use `--package-lock-only` so `package.json` and `package-lock.json` are updated but no local `node_modules` is written:

Run: `npm install --package-lock-only simple-icons@16.28.0`
Expected: `package.json` gains a `"simple-icons": "^16.28.0"` dependency entry and `package-lock.json` gains the matching resolved entry. No `node_modules/` directory appears in the repo.

- [ ] **Step 2: Write the failing test**

Create `src/data/stackIcons.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { projects } from "./projects";
import { resolveStackIcon } from "./stackIcons";

describe("resolveStackIcon", () => {
  it("resolves every distinct stack tag used in projects.ts to an icon or documented fallback", () => {
    const allTags = new Set(projects.flatMap((p) => p.stack));
    allTags.forEach((tag) => {
      const result = resolveStackIcon(tag);
      // null is the documented "no icon" case (StackChip renders the
      // fallback glyph for it) — anything else must be a well-formed icon.
      if (result !== null) {
        expect(result.path.length).toBeGreaterThan(0);
        expect(result.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(result.title.length).toBeGreaterThan(0);
      }
    });
  });

  it("resolves known aliases to the same icon as their base tag", () => {
    expect(resolveStackIcon("React 19")?.title).toBe(resolveStackIcon("React")?.title);
    expect(resolveStackIcon("Vue 3")?.title).toBe("Vue.js");
    expect(resolveStackIcon("Next.js 16")?.title).toBe(resolveStackIcon("Next.js")?.title);
  });

  it("returns null for tags with no matching icon", () => {
    expect(resolveStackIcon("AI SDK 5")).toBeNull();
    expect(resolveStackIcon("vector search")).toBeNull();
    expect(resolveStackIcon("Playwright")).toBeNull();
  });

  it("clamps near-black brand colors so they stay visible on a dark chip", () => {
    // Next.js's canonical brand hex is #000000 — unreadable on the
    // chip's near-black background. Resolved hex must be lightened.
    const nextjs = resolveStackIcon("Next.js");
    expect(nextjs?.hex).not.toBe("#000000");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `verify-on-vm "$(pwd)" "npx vitest run src/data/stackIcons.test.ts"`
Expected: FAIL — `Cannot find module './stackIcons'`

- [ ] **Step 4: Write `src/data/stackIcons.ts`**

```typescript
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
} from "simple-icons";

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
  appwrite: "appwrite",
  bun: "bun",
  c99: "c",
  "deno 2": "deno",
  docker: "docker",
  duckdb: "duckdb",
  fastapi: "fastapi",
  firebase: "firebase",
  "gemini 3.1 flash lite": "googlegemini",
  "github actions": "githubactions",
  go: "go",
  jupyter: "jupyter",
  mcp: "modelcontextprotocol",
  "next.js": "nextdotjs",
  "next.js 16": "nextdotjs",
  node: "nodedotjs",
  ocaml: "ocaml",
  ollama: "ollama",
  pandas: "pandas",
  python: "python",
  r: "r",
  react: "react",
  "react 19": "react",
  "ruby on rails": "rubyonrails",
  rust: "rust",
  scipy: "scipy",
  solidity: "solidity",
  streamlit: "streamlit",
  supabase: "supabase",
  sveltekit: "svelte",
  tailwind: "tailwindcss",
  typescript: "typescript",
  vite: "vite",
  "vue 3": "vuedotjs",
  webassembly: "webassembly",
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
  return n.toString(16).padStart(2, "0");
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `verify-on-vm "$(pwd)" "npx vitest run src/data/stackIcons.test.ts"`
Expected: PASS (4 tests)

- [ ] **Step 6: Typecheck**

Run: `verify-on-vm "$(pwd)" "npx tsc --noEmit"`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/data/stackIcons.ts src/data/stackIcons.test.ts
git commit -m "feat: add stack tag to logo icon lookup"
```

---

### Task 2: Fallback glyph + `StackChip` component

**Files:**

- Create: `src/components/panels/StackChip.tsx`
- Modify: `src/components/panels/Panel.css` (append icon-sizing rules)

**Interfaces:**

- Consumes: `resolveStackIcon(tag: string): ResolvedStackIcon | null` from Task 1.
- Produces: `<StackChip tag={string} />` — a single chip, used by Task 3 in `ProjectCard.tsx`'s stack loop.

- [ ] **Step 1: Write `src/components/panels/StackChip.tsx`**

```typescript
import { resolveStackIcon } from "@/data/stackIcons";

interface StackChipProps {
  tag: string;
}

// Heroicons v1 solid "tag" glyph (MIT) — used for stack tags with no
// matching brand logo (e.g. "AI SDK 5", "vector search"). Rendered in
// the chip's existing muted text color, not a brand color, since
// there's no brand to represent.
const FALLBACK_ICON_PATH =
  "M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z";

export function StackChip({ tag }: StackChipProps) {
  const icon = resolveStackIcon(tag);
  return (
    <span className="project-card__chip">
      {icon ? (
        <svg
          className="project-card__chip-icon"
          viewBox="0 0 24 24"
          fill={icon.hex}
          aria-hidden="true"
        >
          <path d={icon.path} />
        </svg>
      ) : (
        <svg
          className="project-card__chip-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d={FALLBACK_ICON_PATH} />
        </svg>
      )}
      {tag}
    </span>
  );
}
```

- [ ] **Step 2: Add icon sizing to `Panel.css`**

Append after the existing `.project-card__chip` rule (around line 1005 in `src/components/panels/Panel.css`, right after the closing brace of `.project-card__chip`):

```css
.project-card__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.project-card__chip-icon {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}
```

(`display: inline-flex`, `align-items`, and `gap` are new declarations added to the existing `.project-card__chip` rule — do not duplicate the selector; merge these three lines into the block that already sets `font-family`, `font-size`, etc.)

- [ ] **Step 3: Typecheck**

Run: `verify-on-vm "$(pwd)" "npx tsc --noEmit"`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/StackChip.tsx src/components/panels/Panel.css
git commit -m "feat: add StackChip component with brand-logo and fallback glyph rendering"
```

---

### Task 3: Wire `StackChip` into `ProjectCard`

**Files:**

- Modify: `src/components/panels/ProjectCard.tsx:145-152`
- Test: `src/components/panels/ProjectCard.test.tsx` (create if it doesn't already exist — check first)

**Interfaces:**

- Consumes: `<StackChip tag={string} />` from Task 2.

- [ ] **Step 1: Check for an existing ProjectCard test file**

Run: `ls src/components/panels/ProjectCard.test.tsx 2>/dev/null || echo "none"`

If a test file exists, read it to match its existing render/setup pattern before writing Step 2's test. If none exists, Step 2 creates one from scratch using `@testing-library/react` (already a devDependency — confirm with `grep testing-library package.json`; if absent, use React's `react-dom/client` + `document.body` directly instead of pulling in a new dependency).

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";
import { projects } from "@/data/projects";

describe("ProjectCard stack chips", () => {
  it("renders an icon for every stack chip, including tags with no brand logo", () => {
    const project = projects.find((p) => p.stack.includes("Playwright"))!;
    render(<ProjectCard project={project} onClose={() => {}} onNavigate={() => {}} />);
    project.stack.forEach((tag) => {
      const chip = screen.getByText(tag);
      expect(chip.querySelector("svg")).not.toBeNull();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `verify-on-vm "$(pwd)" "npx vitest run src/components/panels/ProjectCard.test.tsx"`
Expected: FAIL — chip text is still a plain `<span>{tag}</span>` with no `<svg>` child

- [ ] **Step 4: Update `ProjectCard.tsx`**

Replace lines 145-152:

```typescript
          <section className="panel__section">
            <div className="panel__section-label">stack</div>
            <div className="project-card__chips">
              {project.stack.map((tag) => (
                <span key={tag} className="project-card__chip">{tag}</span>
              ))}
            </div>
          </section>
```

with:

```typescript
          <section className="panel__section">
            <div className="panel__section-label">stack</div>
            <div className="project-card__chips">
              {project.stack.map((tag) => (
                <StackChip key={tag} tag={tag} />
              ))}
            </div>
          </section>
```

And add the import at the top of the file, next to the other panel imports:

```typescript
import { PanelShell } from "./PanelShell";
import { StackChip } from "./StackChip";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `verify-on-vm "$(pwd)" "npx vitest run src/components/panels/ProjectCard.test.tsx"`
Expected: PASS

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `verify-on-vm "$(pwd)" "npx vitest run && npx tsc --noEmit"`
Expected: all tests pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/ProjectCard.tsx src/components/panels/ProjectCard.test.tsx
git commit -m "feat: render stack chip logos in the rack modal"
```

---

### Task 4: Visual verification

**Files:** none (verification only)

- [ ] **Step 1: Build and run the dev server on ampere-dev**

Run: `/Users/yinkavaughan/bin/verify-on-vm "$(pwd)" "npm run build"`
Expected: build succeeds with no new warnings

- [ ] **Step 2: Start the dev server via `dev-on-vm` and open the tunnel**

Run: `dev-on-vm "$(pwd)"`
Then open the tunneled URL and click through several racks whose stacks mix icon and fallback tags — at minimum `halberd` (Go, WebAssembly, Next.js, JSON-RPC, MCP: exercises fallback for JSON-RPC and the lightness clamp for Next.js/MCP) and `capitol-alpha` (Python, Playwright, pdfplumber, pandas, scipy, Jupyter: exercises the fallback glyph for Playwright/pdfplumber and the pandas lightness clamp).

- [ ] **Step 3: Confirm in the browser**

Check: every chip has a small icon before its text; brand icons show recognizable brand colors; near-black brand icons (Next.js, Rust, Bun, Deno, Ollama, MCP) render as a visible gray, not invisible-on-dark; fallback tags show the generic tag glyph in the same muted color as the chip text; no layout shift or misalignment between icon and text.

- [ ] **Step 4: Report back**

Summarize what was checked and any visual issues found. If issues are found, fix and re-verify before considering this plan complete — do not report the feature as done based on the test suite alone.

---

## Self-Review Notes

- **Spec coverage:** Simple Icons import (Task 1), alias table (Task 1's `TAG_TO_SLUG`), contrast clamping (Task 1's `clampLightness`), fallback glyph (Task 2), accessibility `aria-hidden` (Task 2), chip wiring (Task 3), and manual visual verification (Task 4) are all covered.
- **Type consistency:** `ResolvedStackIcon` (Task 1) is the only cross-task type; `StackChip` (Task 2) imports and consumes it by calling `resolveStackIcon`, never redefining its shape. `resolveStackIcon`'s name and signature are identical everywhere they're referenced.
- **No placeholders:** every step ships real, complete code — the icon map, alias table, and HSL clamp math are fully written out, not sketched.
