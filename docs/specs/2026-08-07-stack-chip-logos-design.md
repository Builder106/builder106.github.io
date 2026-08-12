# Stack chip logos — design

Rack modals (`ProjectCard.tsx`) render each project's tech stack as plain-text
chips. This adds a small brand-colored logo to each chip, sourced from
`simple-icons`, with a neutral fallback glyph for tags that have no matching
icon (about a third of the ~55 distinct tags in `projects.ts` — things like
"AI SDK 5", "JSON-RPC", "vector search").

## Files

- `src/data/stackIcons.ts`(new) — tag →`{ path, hex }` lookup, alias table,

  fallback glyph path. Pure data/lookup module, no React.

- `src/components/panels/ProjectCard.tsx`— swap the plain`<span>` chip loop

  for a `<StackChip>` component.

- `src/components/panels/Panel.css`— add`.project-card__chip-icon` sizing;

  existing chip padding/border/background rules are untouched.

- `src/data/stackIcons.test.ts` (new) — asserts every distinct stack tag

  currently in `projects.ts` resolves to a real icon or the documented
  fallback, so a future typo'd tag doesn't silently render blank.

## Icon resolution

`simple-icons` ships 3000+ icons; only the ~35 actually used are imported
individually (`simple-icons/icons/react`, `simple-icons/icons/vuedotjs`,
etc.) so nothing unused reaches the bundle — this is a Vite/R3F site that
already had a same-day perf pass on the Matrix renderer, so bundle weight is
a live concern, not a hypothetical one.

Lookup key normalization: lowercase, strip a trailing version-number token
(`Vue 3`→`vue`, `React 19`→`react`, `Next.js 16`→`next.js`). An
explicit alias table then maps normalized names that don't match a
Simple Icons slug directly — `next.js`→`nextdotjs`, `ruby on rails` →
`rubyonrails`, `github actions`→`githubactions`. Tags with no entry in
either the direct-match set or the alias table fall back to the generic
glyph.

## Contrast handling

Simple Icons ships one canonical brand hex per icon, and a few are near-black
(`Next.js`is`#000000`) or otherwise too close to the chip's dark background
to read. Rather than hand-picking overrides per icon, `stackIcons.ts` runs
each brand hex through a lightness check (HSL) at build/lookup time and, if
under a floor threshold, substitutes a lightened version of the same hue
instead of the raw brand color. This is automatic and needs no per-icon
maintenance as new tags are added.

## Fallback glyph

Tags with no icon render a small neutral tag/code glyph (`</>`-style path) in
the chip's existing muted text color — no brand tint, since there's no brand
to represent. Chip layout (padding, border, spacing) is identical whether a
chip has a real logo or the fallback, so nothing shifts.

## Accessibility

The icon is decorative — the chip's text label is already the accessible
name. Every chip SVG gets `aria-hidden="true"` so screen readers read the
existing text content once, not the icon plus text.

## Data flow

No changes to `Project`or`projects.ts`. Icons resolve purely from the
existing `project.stack` strings at render time via the lookup map in
`stackIcons.ts`.

## Testing

- `stackIcons.test.ts`: every stack tag in `projects.ts` maps to a known icon

  or the documented fallback — no silent unmatched case.

- Existing `projects.test.ts` is unaffected (data shape unchanged).
- Manual visual check via `verify-on-vm` dev server / tunnel before calling

  this done — this is a rendering change, typecheck and unit tests don't
  prove the chips actually look right.
