# Contributing

This is a personal portfolio, so the goal isn't to collect feature contributions — it's mine, and the project copy reflects my work. That said, PRs are welcome for the things below, and the project is structured to be readable by anyone who wants to learn from it or fork it as a starting point for their own portfolio.

## Dev setup

```bash
git clone https://github.com/Builder106/builder106.github.io.git
cd builder106.github.io
npm install
npm run dev
```

Requires Node 20+ (matches the CI matrix in `.github/workflows/deploy.yml`).

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Refresh repo stats, type-check, build to `dist/` |
| `npm run typecheck` | `tsc -b --noEmit` — same check CI runs |
| `npm run preview` | Serve the production build locally |
| `npm run refresh-stats` | Pull fresh GitHub stats (needs `GH_TOKEN` env var) |

## Project shape

- [src/components/Scene.tsx](src/components/Scene.tsx) — root R3F scene; loads the glTF, instantiates racks, registers anchors.
- [src/scene/](src/scene/) — pure scene logic: anchor resolution, camera rig math, click resolver, custom shaders.
- [src/components/panels/](src/components/panels/) — lazy-loaded UI overlays (trading terminal, project card, contact ping).
- [src/data/projects.ts](src/data/projects.ts) — single source of truth for what shows up on each rack.
- [blend/](blend/) — Blender source files. The runtime contract for naming Empties is documented in [docs/blender-contract.md](docs/blender-contract.md).
- [scripts/fetch-repo-stats.mjs](scripts/fetch-repo-stats.mjs) — prebuild hook that bakes live GitHub stats into the trading terminal.

## Project-specific guardrails

- **Performance budget**: the scene must boot in under ~2 seconds on a mid-tier laptop. Adding heavyweight assets (large textures, uncompressed meshes) is the easiest way to blow that budget — measure with the Network and Performance panels before merging.
- **Don't break the glTF contract**: every project listed in `src/data/projects.ts` requires a matching `anchor_<id>` Empty in the Blender scene. Renaming an `id` without updating the Blender file (or vice versa) will silently break that rack's camera focus.
- **Hover/focus states are intentional**: the harder spotlight + deeper dim on non-hovered racks is a deliberate UX choice, not a placeholder. Don't soften it in the name of "subtle."
- **Mobile is a fallback, not the target**: the canvas downgrades gracefully on small screens, but the design target is a desktop browser with a pointer. Don't refactor the scene for mobile-first.

## What's welcome

- Bug fixes (broken links, accessibility regressions, runtime errors).
- Performance improvements with before/after numbers.
- Better glTF compression or loading strategies.
- Compatibility fixes (browser quirks, color-profile issues, screen reader gaps).
- Documentation improvements — especially the Blender contract.

## What's out of scope

- Adding new projects or rewriting project copy — that content is mine.
- Changing the brand identity (color palette, typography, the `<OV />` mark, the cyan/magenta neon).
- Migrating off React Three Fiber or Three.js. The whole point of this repo is the R3F integration.
- Adding analytics, ads, or any data collection.
- Replacing the GitHub Pages deploy with another host.
- Adding a CMS or pulling project data from an external API at runtime — the prebuild step is the boundary.

## Commit conventions

Imperative mood, present tense, capitalized first word, no trailing period. Match the style in `git log`:

```
Cables: messy noise-driven paths instead of ruler-straight lines
Hover: harder spotlight, deeper dim on the non-hovered rest
Fix paths configuration in tsconfig to ensure correct module resolution
```

If a commit touches one subsystem (cables, hover, paths), lead with that subsystem and a colon, then the change. Otherwise just describe the change. Keep the subject under ~72 characters.

Never add a `Co-Authored-By: Claude` trailer (or any AI-tool attribution). Commits are attributed to the human author.

## PR process

1. Open an issue first for anything beyond a small bug fix — it saves both of us a wasted PR if it's out of scope.
2. Run `npm run typecheck` and `npm run build` locally before pushing. CI runs the same checks; failing them just delays review.
3. Keep PRs focused on one change. A perf fix + a refactor + a new feature in one PR is three PRs.
4. If a change affects the Blender scene, attach a before/after screenshot.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
