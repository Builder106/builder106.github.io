# OSS Contribution Tracker

A single page that quantifies my open-source work toward Google Summer of Code
2027: a standing target of 3 open issues + 3 open PRs across five target repos,
plus the triage, review, and community work that never shows up in a merge count.

Lives inside [`builder106.github.io`](../) as a self-contained subproject:
it generates its own static page, which Vite copies straight through to
`dist/oss-contribution-tracker/` on every portfolio build.

**Live:** https://yinkavaughan.me/oss-contribution-tracker/

## What it counts

The page splits contributions into two halves, marked by how each number is
sourced:

- **● Verifiable.** Currently-open issues and PRs, plus the triage and review
  touches GitHub can surface. Pulled live from GitHub with `gh` and from
  Blender's Gitea instance through its public REST API. Nothing here is
  hand-entered.
- **○ Self-logged.** Bug triage, patch review, module-meeting attendance, and
  forum answers that no API captures. Each one is an evidence-linked row in
  [`CONTRIBUTIONS_LOG.md`](CONTRIBUTIONS_LOG.md).

The verifiable half leads; the self-logged half is labelled as such.

Target repos: `KhronosGroup/glTF-Blender-IO`, `blender/blender` (Gitea),
`python/cpython`, `pwndbg/pwndbg`, `neovim/neovim`. Goal: keep 3 issues + 3 PRs
open per repo at all times. Only open items count toward the 3/3; a merged or
closed one drops out of the active count and shows up in a "resolved, needs
replacing" list on its card instead of quietly still counting.

## How it updates

`refresh.py` runs every query, tallies the log, and regenerates the page from
`template.html` + `style.css` into `../public/oss-contribution-tracker/index.html`
-- Vite's `public/` dir is copied verbatim into `dist/` on build, so the
portfolio's own deploy workflow picks it up without any extra wiring. The
portfolio's `.github/workflows/deploy.yml` runs `refresh.py` before every
build (on push, and on a daily schedule), commits the refreshed `data.json`,
and deploys.

```sh
python3 oss-contribution-tracker/refresh.py     # needs an authenticated gh + curl, run from the portfolio repo root
```

## Monitoring for new activity

`monitor.py` checks every tracked issue/PR in `data.json` -- the five target
repos plus the "Other Contributions" list -- for new comments or a state
change since the last check, and posts a digest to a rolling GitHub issue on
`builder106.github.io` when there's something to report (silent otherwise).
It runs every 4 hours via the portfolio's `.github/workflows/monitor.yml`,
using the same default Actions token `refresh.py` already relies on, which is
why it can reach repos outside this one without any extra setup: unlike a
scoped session, a public repo's issues/comments are just a normal
authenticated API read.

```sh
python3 oss-contribution-tracker/monitor.py     # needs an authenticated gh, run from the portfolio repo root
```

## Logging a non-PR touch

Add a row to `CONTRIBUTIONS_LOG.md` the same day it happens:

```text
| 2026-07-11 | Blender | triage | projects.blender.org/blender/blender/issues/12345 | added Windows repro, marked confirmed |
```

The next `refresh.py` run rolls it into the ○ counters.

## Files

| File | Role |
|------|------|
| `refresh.py` | Queries data, tallies the log, writes `../public/oss-contribution-tracker/index.html` + `data.json` |
| `template.html` | Page skeleton with injection markers |
| `style.css` | Inlined into the generated page |
| `CONTRIBUTIONS_LOG.md` | Source of the self-logged ○ rows |
| `data.json` | Last snapshot; also what `monitor.py` reads to know what to track |
| `monitor.py` | Checks tracked issues/PRs for new comments/state, writes `monitor_state.json`, posts a digest issue on new activity |
| `monitor_state.json` | Last-seen comment count/state per tracked item, for diffing over time |

The two GitHub Actions workflows that drive this (refresh-on-push/schedule
and the 4-hourly monitor) live at the portfolio repo root:
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) and
[`.github/workflows/monitor.yml`](../.github/workflows/monitor.yml).
