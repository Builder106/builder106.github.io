# OSS Contribution Tracker

A single page that quantifies my open-source work toward Google Summer of Code
2027: a standing target of open issues and pull requests per target repository.
The public page shows the trial balance and repository accounts. Supplementary
activity and other contributions remain in the data snapshot for monitoring.

Lives inside [`builder106.github.io`](../) as a self-contained subproject:
it generates its own static page, which Vite copies straight through to
`dist/oss-contribution-tracker/` on every portfolio build.

**Live:** <https://yinkavaughan.me/oss-contribution-tracker/>

## Data sources

The refresh script collects two types of contribution data:

- **● Verifiable.** Currently-open issues and PRs, plus the triage and review

  touches GitHub can surface. Pulled live from GitHub with `gh` and from
  Blender's Gitea instance through its public REST API. Nothing here is
  hand-entered.

- **○ Self-logged.** Bug triage, patch review, module-meeting attendance, and

  forum answers that no API captures. Each one is an evidence-linked row in
  [`CONTRIBUTIONS_LOG.md`](CONTRIBUTIONS_LOG.md).

The page displays authored issues and pull requests. The snapshot also keeps
supplementary activity for monitoring.

Target repos: `KhronosGroup/glTF-Blender-IO`, `blender/blender` (Gitea),
`python/cpython`, `fury-gl/fury`, `neovim/neovim`. Goal: keep 3 issues + 3 PRs
open per repo at all times. Only open items count toward the 3/3; a merged or
closed one drops out of the active count and shows up in a "resolved, needs
replacing" list on its card instead of quietly still counting.

## How it updates

`refresh.py` runs every query, tallies the log, and regenerates the page from
`template.html`+`style.css`into`../public/oss-contribution-tracker/index.html`
-- Vite's `public/`dir is copied verbatim into`dist/` on build, so the
portfolio's own deploy workflow picks it up without any extra wiring. The
portfolio's `.github/workflows/deploy.yml`runs`refresh.py` before every
build (on push, on a daily schedule, or via manual dispatch), commits the refreshed `data.json`,
and deploys.

### Triggering a refresh

1. **Web UI**: Click the **Run Refresh** button in the masthead stamp on [yinkavaughan.me/oss-contribution-tracker/](https://yinkavaughan.me/oss-contribution-tracker/) to open the dispatch modal (supports direct link to GitHub Actions, in-browser API dispatch via GitHub token, or CLI snippet).
2. **GitHub Actions UI**: Go to [Actions &rarr; deploy workflow](https://github.com/Builder106/Builder106.github.io/actions/workflows/deploy.yml) and click **Run workflow**.
3. **GitHub CLI**: Run `gh workflow run deploy.yml --repo Builder106/Builder106.github.io`.
4. **Local Execution**:

```sh
python3 oss-contribution-tracker/refresh.py     # needs an authenticated gh + curl, run from the portfolio repo root
```

## Activity monitor

The activity monitor was retired on 2026-10-27. Its last saved state remains
in `monitor_state.json` for reference. Ledger data refresh and page deployment
continue through `deploy.yml`.

## Logging a non-PR touch

Add a row to `CONTRIBUTIONS_LOG.md` the same day it happens:

```text
| 2026-07-11 | Blender | triage | projects.blender.org/blender/blender/issues/12345 | added Windows repro, marked confirmed |
```

The next `refresh.py` run rolls it into the ○ counters.

## Files

| File | Role |
| ------ | ------ |
| `refresh.py` | Queries data, tallies the log, writes`../public/oss-contribution-tracker/index.html`+`data.json` |
| `template.html` | Page skeleton with injection markers |
| `style.css` | Inlined into the generated page |
| `CONTRIBUTIONS_LOG.md` | Source of the self-logged ○ rows |
| `data.json` | Last snapshot used to render the ledger page |
| `monitor_state.json` | Archived last-seen activity state from the retired monitor |

The GitHub Actions workflow for refresh and deployment lives at the portfolio
repo root: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
