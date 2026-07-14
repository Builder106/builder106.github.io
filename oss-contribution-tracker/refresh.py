#!/usr/bin/env python3
"""Regenerate index.html from live contribution data.

Pulls authored issues/PRs from GitHub (via `gh`) and from Blender's Gitea
instance (via the public REST API), counts non-PR triage/review touches that
GitHub can surface, tallies the manual rows in CONTRIBUTIONS_LOG.md, and writes
a static, self-contained index.html.

Run locally (needs an authenticated `gh` and `curl`), or let the GitHub Action
run it on a schedule.
"""

from __future__ import annotations

import datetime as _dt
import json
import pathlib
import re
import subprocess
import sys

AUTHOR = "Builder106"
TARGET = 3  # issues + PRs wanted per repo
ROOT = pathlib.Path(__file__).resolve().parent
LOG = ROOT / "CONTRIBUTIONS_LOG.md"
LOGOS = ROOT / "assets" / "logos"
# Served page lives under the portfolio's Vite public/ dir, so `vite build`
# copies it straight through to dist/oss-contribution-tracker/ -- keeps the
# live path (yinkavaughan.me/oss-contribution-tracker/) unchanged post-merge.
OUT_DIR = ROOT.parent / "public" / "oss-contribution-tracker"

# key, display name, host, verified brand colour, where the data lives, and
# a vendored logo file (or None). Colors verified 2026-07-13 against primary
# sources: glTF's own spec-repo logo + Simple Icons (#87C540/#86C540 -- both
# cited); Blender's brand guidelines page via two independent citers +
# Simple Icons (#E87D0D); Python's official python.org SVG (two-tone
# #306998/#FFD43B) cross-checked against the widely-used single-accent
# #3776AB; Neovim's own neovim.io logo pack, extracted directly from the
# SVG (#57A143). pwndbg has no dedicated logo/brand guidelines page, but
# does have a distinct wordmark treatment on its README banner (a glitch-
# pixel "PWNDBG>" lockup) -- #8F2BF5 is the dominant color sampled directly
# from that image (see assets/logos/SOURCES.md). It's a wide wordmark, not
# a compact mark like the other four, so it gets its own render path
# (account_block special-cases repo["key"] == "pwndbg") rather than being
# forced into the square icon slot logo_svg()/account_mark() assume.
REPOS = [
    ("gltf", "glTF-Blender-IO", "github", "KhronosGroup/glTF-Blender-IO", "#87C540", "gltf-blender-io.svg"),
    ("blender", "blender/blender", "gitea", "blender/blender", "#E87D0D", "blender.svg"),
    ("cpython", "python/cpython", "github", "python/cpython", "#3776AB", "cpython.svg"),
    ("pwndbg", "pwndbg", "github", "pwndbg/pwndbg", "#8F2BF5", None),
    ("neovim", "neovim/neovim", "github", "neovim/neovim", "#57A143", "neovim.svg"),
]

# non-PR activity buckets. `query` rows are counted from GitHub; `manual` rows
# are tallied from CONTRIBUTIONS_LOG.md by matching (project, tag). The repo
# key ties each bucket back to REPOS so it can reuse that repo's real logo
# mark and color instead of duplicating them here.
MANUAL = [
    ("Blender", "blender", [
        ("Bug triage: repro, mark confirmed", "target 2 / wk", "manual", "triage"),
        ("Patch review on others' PRs", "target 1 / wk", "manual", "review"),
        ("Module meeting attendance", "pipeline-IO / glTF · weekly", "manual", "meeting"),
    ]),
    ("pwndbg", "pwndbg", [
        ("Answer issues / discussions", "target 2 / wk", "query", "pwndbg:comments"),
        ("Patch review on others' PRs", "target 1 / wk", "query", "pwndbg:reviews"),
    ]),
    ("Neovim", "neovim", [
        ("Issue triage: label, repro, dedup", "target 2 / wk", "query", "neovim:comments"),
        ("Answer GitHub Discussions", "target 1 / wk", "query", "neovim:discussions"),
        ("Patch review on others' PRs", "target 1 / wk", "query", "neovim:reviews"),
        ("Discourse / Matrix answers", ":h-documented behavior", "manual", "answer"),
    ]),
    ("cpython", "cpython", [
        ("Discourse: Core Dev / PEPs / Ideas", "discuss.python.org · site-wide", "query", "cpython:discourse"),
        ("Patch review on others' PRs", "target 1 / wk", "query", "cpython:reviews"),
    ]),
    ("glTF-Blender-IO", "gltf", [
        ("Community forum / working group", "khronos.org · gltf", "manual", "community"),
        ("Patch review on others' PRs", "target 1 / wk", "query", "gltf:reviews"),
    ]),
]

_LOGO_CACHE: dict[str, tuple[str, str, str]] = {}


def logo_svg(filename: str | None) -> tuple[str, str, str]:
    """Inline an svg's inner body (no outer <svg> wrapper, no XML prolog),
    its OWN viewBox, and any fill set on the outer <svg> tag itself.

    Source files vary in both respects: Simple Icons files (glTF, Blender,
    Python) set fill="#hex" on the outer <svg>, relying on inheritance down
    to <path> -- stripping that outer tag to build our own wrapper silently
    drops the color and every path renders default black. The official
    Neovim mark instead sets fill per-<path> and has no outer fill, so this
    returns "" for it and the wrapper simply omits the attribute. Also keep
    each file's native viewBox (24x24 Simple Icons vs. 601x736 Neovim) --
    forcing a shared box would badly mis-scale the non-square one."""
    if not filename:
        return "", "0 0 24 24", ""
    if filename not in _LOGO_CACHE:
        raw = (LOGOS / filename).read_text(encoding="utf-8")
        open_tag = re.search(r"<svg[^>]*>", raw)
        tag_str = open_tag.group(0) if open_tag else ""
        vb_match = re.search(r'viewBox="([^"]+)"', tag_str)
        vb = vb_match.group(1) if vb_match else "0 0 24 24"
        fill_match = re.search(r'(?<!-)\bfill="([^"]+)"', tag_str)
        fill = fill_match.group(1) if fill_match else ""
        body = re.search(r"<svg[^>]*>(.*)</svg>", raw, re.S)
        _LOGO_CACHE[filename] = (body.group(1).strip() if body else "", vb, fill)
    return _LOGO_CACHE[filename]


def run(cmd: list[str]) -> str:
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def gh_search(kind: str, extra: list[str]) -> list[dict]:
    fields = "repository,title,state,url,number"
    out = run(["gh", "search", kind, "--author", AUTHOR, "--json", fields,
               "--limit", "100", *extra])
    return json.loads(out or "[]")


def gh_count(kind: str, flag: str) -> dict[str, int]:
    """Count issues/PRs where AUTHOR is commenter / reviewer, per repo."""
    counts: dict[str, int] = {}
    for _key, _name, host, slug, _col, _logo in REPOS:
        if host != "github":
            continue
        out = run(["gh", "search", kind, flag, AUTHOR, "--repo", slug,
                   "--json", "number", "--limit", "100"])
        counts[slug] = len(json.loads(out or "[]"))
    return counts


DISCUSSION_SEARCH = (
    'query($search:String!){ search(query:$search, type: DISCUSSION, first: 1) '
    '{ discussionCount } }'
)


def gh_discussion_count(field: str) -> dict[str, int]:
    """Count GitHub Discussions where AUTHOR is commenter/author, per repo.

    `gh search` only covers issues/PRs, not Discussions -- a separate
    GraphQL type -- so this goes through `gh api graphql` instead. Repos
    with Discussions off (cpython, glTF-Blender-IO) just come back 0
    rather than erroring, so it's safe to call for every GitHub repo."""
    counts: dict[str, int] = {}
    for _key, _name, host, slug, _col, _logo in REPOS:
        if host != "github":
            continue
        out = run(["gh", "api", "graphql", "-f", f"query={DISCUSSION_SEARCH}",
                   "-f", f"search=repo:{slug} {field}:{AUTHOR}"])
        counts[slug] = json.loads(out)["data"]["search"]["discussionCount"]
    return counts


def discourse_post_count(base_url: str, username: str) -> int | None:
    """Public post_count for a Discourse-forum user, or None if the API is
    unreachable or the profile is private -- e.g. discuss.python.org returns
    404 for /summary.json on a hidden profile even though the account is
    real. None means "fall back to the manual log", not "count is zero"."""
    try:
        out = subprocess.run(
            ["curl", "-s", "-w", "\n%{http_code}",
             f"{base_url}/u/{username}/summary.json"],
            capture_output=True, text=True, timeout=15).stdout
    except (subprocess.TimeoutExpired, OSError):
        return None
    body, _, status = out.rpartition("\n")
    if status.strip() != "200":
        return None
    try:
        return json.loads(body)["user_summary"]["post_count"]
    except (KeyError, json.JSONDecodeError, TypeError):
        return None


def gitea(slug: str, kind: str) -> list[dict]:
    url = (f"https://projects.blender.org/api/v1/repos/{slug}/issues"
           f"?type={kind}&state=all&created_by={AUTHOR}&limit=50")
    out = run(["curl", "-s", url])
    return json.loads(out or "[]")


def collect() -> dict:
    """Build the data structure that drives the page."""
    # gh search wants alternating "--repo <slug>" flags; build that flat list.
    repo_flags: list[str] = []
    for _k, _n, host, slug, _c, _l in REPOS:
        if host == "github":
            repo_flags += ["--repo", slug]
    gh_issues = gh_search("issues", repo_flags)
    gh_prs = gh_search("prs", repo_flags)

    def gh_items(rows: list[dict], slug: str) -> list[dict]:
        name = slug.split("/")[-1]
        items = []
        for r in rows:
            if r["repository"]["name"] == name:
                items.append({"n": r["number"], "url": r["url"],
                              "state": r["state"], "title": r["title"]})
        return sorted(items, key=lambda x: x["n"])

    repos = []
    for key, name, host, slug, col, logo in REPOS:
        if host == "github":
            issues = gh_items(gh_issues, slug)
            prs = gh_items(gh_prs, slug)
        else:
            issues = [{"n": i["number"],
                       "url": f"https://projects.blender.org/{slug}/issues/{i['number']}",
                       "state": i["state"], "title": i["title"]}
                      for i in gitea(slug, "issues")]
            prs = [{"n": i["number"],
                    "url": f"https://projects.blender.org/{slug}/pulls/{i['number']}",
                    "state": ("merged" if i.get("pull_request", {}).get("merged")
                              else i["state"]),
                    "title": i["title"]}
                   for i in gitea(slug, "pulls")]
        repos.append({"key": key, "name": name, "host": host, "color": col,
                      "logo": logo, "issues": issues, "prs": prs})

    comments = gh_count("issues", "--commenter")
    reviews = gh_count("prs", "--reviewed-by")
    discussions = gh_discussion_count("commenter")
    tallies = log_tallies()
    misc = other_contributions()
    discourse = {"cpython": discourse_post_count("https://discuss.python.org", AUTHOR)}

    return {
        "as_of": _dt.date.today().isoformat(),
        "author": AUTHOR,
        "repos": repos,
        "gh_comments": comments,
        "gh_reviews": reviews,
        "gh_discussions": discussions,
        "discourse": discourse,
        "log": tallies,
        "misc": misc,
    }


MISC_LIMIT = 10  # most recent one-offs to show; the rest live on the GitHub link


def other_contributions() -> list[dict]:
    """PRs authored outside the GSoC target repos and outside my own repos --
    the rest of the portfolio, with no 3/3 cadence to track against."""
    out = run(["gh", "search", "prs", "--author", AUTHOR, "--json",
               "repository,title,state,url,number,createdAt", "--limit", "100"])
    rows = json.loads(out or "[]")
    target_slugs = {slug.lower() for _k, _n, host, slug, _c, _l in REPOS if host == "github"}
    items = []
    for r in rows:
        owner_repo = r["repository"]["nameWithOwner"]
        if owner_repo.lower().startswith(f"{AUTHOR.lower()}/") or owner_repo.lower() in target_slugs:
            continue
        items.append({"repo": owner_repo, "n": r["number"], "url": r["url"],
                      "state": r["state"], "title": r["title"], "date": r["createdAt"][:10]})
    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:MISC_LIMIT]


def log_tallies() -> dict[str, int]:
    """Count manual rows by 'Project | ... | tag' pattern in the log."""
    if not LOG.exists():
        return {}
    text = LOG.read_text(encoding="utf-8")
    tallies: dict[str, int] = {}
    for line in text.splitlines():
        if not line.startswith("|") or "date" in line.lower() or "---" in line:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        proj, kind = cells[1].lower(), cells[2].lower()
        tallies[f"{proj}:{kind}"] = tallies.get(f"{proj}:{kind}", 0) + 1
    return tallies


# ---------------------------------------------------------------------------
# rendering
# ---------------------------------------------------------------------------

def active_count(items: list[dict]) -> int:
    return sum(1 for i in items if i["state"] == "open")


def resolved_items(items: list[dict]) -> list[dict]:
    return [i for i in items if i["state"] != "open"]


def leader_entry(item: dict) -> str:
    return (f'<a class="entry" href="{item["url"]}" title="{esc(item["title"])}" '
            f'target="_blank" rel="noopener noreferrer">'
            f'<span class="entry__id">#{item["n"]}</span>'
            f'<span class="entry__leader" aria-hidden="true"></span>'
            f'<span class="entry__state">open</span></a>')


def cleared_entry(item: dict) -> str:
    word = "merged" if item["state"] == "merged" else "closed"
    return (f'<a class="entry entry--cleared" href="{item["url"]}" title="{esc(item["title"])}" '
            f'target="_blank" rel="noopener noreferrer">'
            f'<span class="entry__id">#{item["n"]}</span>'
            f'<span class="entry__leader" aria-hidden="true"></span>'
            f'<span class="entry__state">{word}</span></a>')


def misc_row(item: dict) -> str:
    state = item["state"]
    cls = {"merged": "misc__state--merged", "open": "misc__state--open"}.get(state, "misc__state--closed")
    return (f'<a class="misc__row" href="{item["url"]}" title="{esc(item["title"])}" '
            f'target="_blank" rel="noopener noreferrer">'
            f'<div class="misc__row-top">'
            f'<span class="misc__title">{esc(item["title"])}</span>'
            f'</div>'
            f'<div class="misc__row-bottom">'
            f'<span class="misc__repo">{esc(item["repo"])} #{item["n"]}</span>'
            f'<span class="misc__leader" aria-hidden="true"></span>'
            f'<span class="misc__date">{item["date"]}</span>'
            f'<span class="misc__state {cls}">{state}</span>'
            f'</div></a>')


def balance_line(active: int, target: int) -> str:
    fig = f'<span class="bal__fig">{active}&#8202;/&#8202;{target}</span>'
    if active >= target:
        over = "" if active == target else f'<span class="bal__over">+{active - target} over</span>'
        return f'<div class="bal">{fig}<span class="bal__word bal__word--ok">balanced</span>{over}</div>'
    short = target - active
    return (f'<div class="bal">{fig}'
            f'<span class="bal__word bal__word--short">{short} to fill</span></div>')


def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def account_column(items: list[dict], target: int, label: str) -> str:
    active = [i for i in items if i["state"] == "open"]
    resolved = resolved_items(items)
    if active:
        entries = "".join(leader_entry(i) for i in active)
    else:
        entries = '<div class="entry entry--empty">no open entries</div>'
    cleared = ""
    if resolved:
        cleared = ('<div class="cleared"><span class="cleared__label">cleared &middot; repost</span>'
                   + "".join(cleared_entry(i) for i in resolved) + "</div>")
    return (f'<div class="col">'
            f'<div class="col__head">{label}</div>'
            f'<div class="entries">{entries}</div>'
            f'{balance_line(len(active), target)}'
            f'{cleared}</div>')


def account_mark(repo: dict, cls: str) -> str:
    """A logo mark where one is vendored (colors baked into the SVG's own
    fills), else the plain colour tab/dot for repos with no official brand."""
    body, view_box, fill = logo_svg(repo["logo"])
    if body:
        fill_attr = f' fill="{fill}"' if fill else ""
        return (f'<span class="{cls} {cls}--logo" title="{esc(repo["name"])}" aria-hidden="true">'
                f'<svg viewBox="{view_box}"{fill_attr} xmlns="http://www.w3.org/2000/svg">{body}</svg></span>')
    return f'<span class="{cls}" style="background:{repo["color"]}" title="{esc(repo["name"])}"></span>'


def compact_mark(repo: dict, cls: str = "tb__dot") -> str:
    """A dense-row icon (trial balance, supplementary record): the vendored
    logo where one exists, or pwndbg's square favicon in place of its wide
    wordmark, sized to sit inline with running text."""
    if repo["key"] == "pwndbg":
        return (f'<img class="{cls} {cls}--favicon" '
                f'src="assets/logos/pwndbg-favicon.png" alt="" aria-hidden="true">')
    return account_mark(repo, cls)


def account_block(repo: dict, target: int) -> str:
    host = "Gitea" if repo["host"] == "gitea" else "GitHub"
    if repo["key"] == "pwndbg":
        # pwndbg's identity is a wide wordmark lockup, not a compact mark --
        # give it its own shape instead of squeezing it into the square slot.
        mark = ('<img class="account__wordmark" src="assets/logos/pwndbg-wordmark.png" '
                'alt="" aria-hidden="true">')
    else:
        mark = account_mark(repo, "account__tab")
    return (f'''
      <section class="account">
        <div class="account__head">
          {mark}
          <h3 class="account__name">{repo['name']}</h3>
          <span class="account__host">{host}</span>
        </div>
        <div class="account__cols">
          {account_column(repo['issues'], target, 'Issues')}
          {account_column(repo['prs'], target, 'Pull requests')}
        </div>
      </section>''')


def trial_row(repo: dict, target: int) -> str:
    def cell(n: int) -> str:
        cls = "tb__ok" if n >= target else "tb__short"
        return f'<span class="{cls}">{n}&#8202;/&#8202;{target}</span>'
    mark = compact_mark(repo)
    ai, ap = active_count(repo["issues"]), active_count(repo["prs"])
    return (f'<div class="tb__row">'
            f'<span class="tb__acct">{mark}'
            f'{repo["name"]}</span>'
            f'<span class="tb__cell">{cell(ai)}</span>'
            f'<span class="tb__cell">{cell(ap)}</span></div>')


def build_html(data: dict) -> str:
    repos = data["repos"]
    by_key = {r["key"]: r for r in repos}
    order = ["gltf", "blender", "cpython", "pwndbg", "neovim"]

    active_issues = sum(active_count(r["issues"]) for r in repos)
    active_prs = sum(active_count(r["prs"]) for r in repos)
    total_merged = sum(1 for r in repos for i in r["prs"] if i["state"] == "merged")
    cap = TARGET * len(repos)

    trial_rows = "".join(trial_row(by_key[k], TARGET) for k in order)
    accounts = "".join(account_block(by_key[k], TARGET) for k in order)

    # supplementary record: non-PR work, marked verified (queryable) vs self-reported.
    # A prov value of None means "queryable in principle but unavailable right
    # now" (e.g. a private Discourse profile) -- that falls back to the manual
    # log and renders as self-reported rather than a fake permanent zero.
    slug_by_key = {k: slug for k, _n, _h, slug, _c, _l in REPOS}
    prov: dict[str, int | None] = {
        "pwndbg:comments": (data["gh_comments"].get("pwndbg/pwndbg", 0)
                             + data["gh_discussions"].get("pwndbg/pwndbg", 0)),
        "neovim:comments": data["gh_comments"].get("neovim/neovim", 0),
        "neovim:discussions": data["gh_discussions"].get("neovim/neovim", 0),
        "cpython:discourse": data["discourse"].get("cpython"),
        # Blender has no verified equivalent -- Gitea's API has no
        # search-by-reviewer, unlike `gh search prs --reviewed-by` -- so it
        # stays self-reported. The other four are GitHub repos and this data
        # was already being fetched into gh_reviews without ever being used.
        "pwndbg:reviews": data["gh_reviews"].get(slug_by_key["pwndbg"], 0),
        "neovim:reviews": data["gh_reviews"].get(slug_by_key["neovim"], 0),
        "cpython:reviews": data["gh_reviews"].get(slug_by_key["cpython"], 0),
        "gltf:reviews": data["gh_reviews"].get(slug_by_key["gltf"], 0),
    }
    supp_blocks = []
    for proj, repo_key, rows in MANUAL:
        repo = by_key[repo_key]
        lines = []
        for label, meta, source, tag in rows:
            verified_n = prov.get(tag) if source == "query" else None
            if verified_n is not None:
                n = verified_n
                mark, mcls = "●", "audit--verified"
                mtitle = ("verified from discuss.python.org" if tag == "cpython:discourse"
                          else "verified from GitHub")
            else:
                n = data["log"].get(f"{repo_key}:{tag.split(':')[-1]}", 0)
                mark, mcls, mtitle = "○", "audit--self", "self-reported in the log"
            lines.append(
                f'<div class="supp__row">'
                f'<div class="supp__row-top">'
                f'<span class="supp__mark {mcls}" title="{mtitle}">{mark}</span>'
                f'<span class="supp__label">{label}</span>'
                f'</div>'
                f'<div class="supp__row-bottom">'
                f'<span class="supp__leader" aria-hidden="true"></span>'
                f'<span class="supp__meta">{meta}</span>'
                f'<span class="supp__fig">{n}</span>'
                f'</div></div>')
        supp_blocks.append(
            f'<div class="supp__acct">'
            f'<div class="supp__head">{compact_mark(repo)}{proj}</div>'
            f'{"".join(lines)}</div>')
    supplementary = "".join(supp_blocks)

    misc_items = data.get("misc", [])
    misc_rows = ("".join(misc_row(i) for i in misc_items) if misc_items else
                 '<div class="misc__row misc__row--empty">no entries outside the tracked repos yet</div>')

    posted = active_issues + active_prs
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    tmpl = (ROOT / "template.html").read_text(encoding="utf-8")
    return (tmpl
            .replace("/*STYLE*/", css)
            .replace("<!--ASOF-->", data["as_of"])
            .replace("<!--AUTHOR-->", data["author"])
            .replace("<!--TB_POSTED-->", str(posted))
            .replace("<!--TB_CAP-->", str(cap * 2))
            .replace("<!--TB_TOFILL-->", str(max(0, cap * 2 - posted)))
            .replace("<!--TB_ISSUES-->", str(active_issues))
            .replace("<!--TB_PRS-->", str(active_prs))
            .replace("<!--TB_CAPHALF-->", str(cap))
            .replace("<!--TB_MERGED-->", str(total_merged))
            .replace("<!--TRIAL_ROWS-->", trial_rows)
            .replace("<!--ACCOUNTS-->", accounts)
            .replace("<!--SUPPLEMENTARY-->", supplementary)
            .replace("<!--MISC-->", misc_rows))


def main() -> int:
    data = collect()
    (ROOT / "data.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "index.html").write_text(build_html(data), encoding="utf-8")
    ai = sum(active_count(r["issues"]) for r in data["repos"])
    ap = sum(active_count(r["prs"]) for r in data["repos"])
    print(f"refreshed {data['as_of']}: active issues {ai}/{TARGET*5}, active PRs {ap}/{TARGET*5}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
