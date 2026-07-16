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
import os
import pathlib
import re
import subprocess
import sys
import urllib.parse

AUTHOR = "Builder106"
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
    ("gltf", "glTF-Blender-IO", "github", "KhronosGroup/glTF-Blender-IO", "#87C540", "gltf-blender-io.svg", 3),
    ("blender", "blender/blender", "gitea", "blender/blender", "#E87D0D", "blender.svg", 3),
    ("cpython", "python/cpython", "github", "python/cpython", "#3776AB", "cpython.svg", 3),
    ("pwndbg", "pwndbg", "github", "pwndbg/pwndbg", "#8F2BF5", None, 3),
    ("neovim", "neovim/neovim", "github", "neovim/neovim", "#57A143", "neovim.svg", 3),
    ("gitlab-cli", "gitlab-org/cli", "gitlab", "gitlab-org/cli", "#FC6D26", "gitlab.svg", 1),
    ("gitlab", "gitlab-org/gitlab", "gitlab", "gitlab-org/gitlab", "#FC6D26", "gitlab.svg", 1),
    ("gitlab-runner", "gitlab-org/gitlab-runner", "gitlab", "gitlab-org/gitlab-runner", "#FC6D26", "gitlab.svg", 1),
]

# non-PR activity buckets. `query` rows are counted from GitHub; `manual` rows
# are tallied from CONTRIBUTIONS_LOG.md by matching (project, tag). The repo
# key ties each bucket back to REPOS so it can reuse that repo's real logo
# mark and color instead of duplicating them here.
MANUAL = [
    ("Blender", "blender", [
        ("Bug triage: repro, mark confirmed", "target 1 / wk", "manual", "triage"),
        ("Patch review on others' PRs", "target 1 / wk", "manual", "review"),
        ("Module meeting attendance", "pipeline-IO / glTF · weekly", "manual", "meeting"),
    ]),
    ("pwndbg", "pwndbg", [
        ("Answer issues / discussions", "target 1 / wk", "query", "pwndbg:comments"),
        ("Patch review on others' PRs", "target 1 / wk", "query", "pwndbg:reviews"),
    ]),
    ("Neovim", "neovim", [
        ("Issue triage: label, repro, dedup", "target 1 / wk", "query", "neovim:comments"),
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


def gh_supp(kind: str, flag: str) -> dict[str, list[dict]]:
    """Items where AUTHOR is commenter / reviewer, per repo."""
    items: dict[str, list[dict]] = {}
    for _key, _name, host, slug, _col, _logo, _target in REPOS:
        if host != "github":
            continue
        out = run(["gh", "search", kind, flag, AUTHOR, "--repo", slug,
                   "--json", "url,title,updatedAt", "--limit", "100", "--", f"-author:{AUTHOR}"])
        parsed = json.loads(out or "[]")
        formatted = []
        for p in parsed:
            formatted.append({
                "url": p["url"],
                "title": p["title"],
                "date": p["updatedAt"][:10]
            })
        items[slug] = formatted
    return items


DISCUSSION_SEARCH = (
    'query($search:String!){ search(query:$search, type: DISCUSSION, first: 50) '
    '{ nodes { ... on Discussion { title url updatedAt } } } }'
)


def gh_discussion_supp(field: str) -> dict[str, list[dict]]:
    """GitHub Discussions where AUTHOR is commenter/author, per repo."""
    items: dict[str, list[dict]] = {}
    for _key, _name, host, slug, _col, _logo, _target in REPOS:
        if host != "github":
            continue
        out = run(["gh", "api", "graphql", "-f", f"query={DISCUSSION_SEARCH}",
                   "-f", f"search=repo:{slug} {field}:{AUTHOR} -author:{AUTHOR}"])
        nodes = json.loads(out)["data"]["search"]["nodes"]
        formatted = []
        for n in nodes:
            formatted.append({
                "url": n["url"],
                "title": n["title"],
                "date": n["updatedAt"][:10]
            })
        items[slug] = formatted
    return items


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


def gitlab_items(slug: str, kind: str) -> list[dict]:
    encoded_slug = urllib.parse.quote(slug, safe='')
    url = f"https://gitlab.com/api/v4/projects/{encoded_slug}/{kind}?author_username={AUTHOR}&state=all"
    cmd = ["curl", "-s"]
    if "GITLAB_TOKEN" in os.environ:
        cmd += ["-H", f"PRIVATE-TOKEN: {os.environ['GITLAB_TOKEN']}"]
    cmd.append(url)
    out = run(cmd)
    try:
        return json.loads(out or "[]")
    except json.JSONDecodeError:
        return []


def collect() -> dict:
    """Build the data structure that drives the page."""
    # gh search wants alternating "--repo <slug>" flags; build that flat list.
    repo_flags: list[str] = []
    for _k, _n, host, slug, _c, _l, _t in REPOS:
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
    for key, name, host, slug, col, logo, target in REPOS:
        if host == "github":
            issues = gh_items(gh_issues, slug)
            prs = gh_items(gh_prs, slug)
        elif host == "gitea":
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
        elif host == "gitlab":
            issues = [{"n": i["iid"],
                       "url": i["web_url"],
                       "state": "open" if i["state"] == "opened" else i["state"],
                       "title": i["title"]}
                      for i in gitlab_items(slug, "issues")]
            prs = [{"n": i["iid"],
                    "url": i["web_url"],
                    "state": "open" if i["state"] == "opened" else i["state"],
                    "title": i["title"]}
                   for i in gitlab_items(slug, "merge_requests")]
        repos.append({"key": key, "name": name, "host": host, "color": col,
                      "logo": logo, "target": target, "issues": issues, "prs": prs})

    comments = gh_supp("issues", "--commenter")
    reviews = gh_supp("prs", "--reviewed-by")
    discussions = gh_discussion_supp("commenter")
    tallies = log_items()
    misc = other_contributions()
    discourse = {"cpython": discourse_post_count("https://discuss.python.org", AUTHOR)}
    
    today = _dt.date.today()
    week_start = (today - _dt.timedelta(days=today.weekday())).isoformat()

    return {
        "as_of": today.isoformat(),
        "week_start": week_start,
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
    target_slugs = {slug.lower() for _k, _n, host, slug, _c, _l, _t in REPOS if host == "github"}
    items = []
    for r in rows:
        owner_repo = r["repository"]["nameWithOwner"]
        if owner_repo.lower().startswith(f"{AUTHOR.lower()}/") or owner_repo.lower() in target_slugs:
            continue
        if r["state"].lower() == "closed":
            continue
        items.append({"repo": owner_repo, "n": r["number"], "url": r["url"],
                      "state": r["state"].lower(), "title": r["title"], "date": r["createdAt"][:10]})
    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:MISC_LIMIT]


def log_items() -> dict[str, list[dict]]:
    """Get manual rows by 'Project | ... | tag' pattern in the log."""
    if not LOG.exists():
        return {}
    text = LOG.read_text(encoding="utf-8")
    items: dict[str, list[dict]] = {}
    for line in text.splitlines():
        if not line.startswith("|") or "date" in line.lower() or "---" in line:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 5:
            continue
        date = cells[0]
        proj, kind = cells[1].lower(), cells[2].lower()
        link = cells[3]
        note = cells[4]
        
        key = f"{proj}:{kind}"
        if key not in items:
            items[key] = []
        items[key].append({
            "url": link,
            "title": note,
            "date": date
        })
    return items


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


PWNDBG_FAVICON_B64 = "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"

def compact_mark(repo: dict, cls: str = "tb__dot") -> str:
    """A dense-row icon (trial balance, supplementary record): the vendored
    logo where one exists, or pwndbg's square favicon in place of its wide
    wordmark, sized to sit inline with running text."""
    if repo["key"] == "pwndbg":
        return (f'<img class="{cls} {cls}--favicon" '
                f'src="data:image/x-icon;base64,{PWNDBG_FAVICON_B64}" alt="" aria-hidden="true">')
    return account_mark(repo, cls)


def account_block(repo: dict, target: int) -> str:
    host = "Gitea" if repo["host"] == "gitea" else "GitHub"
    if repo["key"] == "pwndbg":
        mark = (f'<img class="account__tab account__tab--logo" '
                f'src="data:image/x-icon;base64,{PWNDBG_FAVICON_B64}" alt="" aria-hidden="true">')
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

def supp_item_link(item: dict) -> str:
    return (f'<a class="supp-item" href="{item["url"]}" title="{esc(item["title"])}" target="_blank" rel="noopener noreferrer">'
            f'<span class="supp-item__date">{item["date"][5:]}</span> '
            f'<span class="supp-item__title">{esc(item["title"])}</span></a>')


def supp_items_html(items: list[dict]) -> str:
    if not items:
        return ""
    items.sort(key=lambda x: x["date"], reverse=True)
    links = "".join(f'<li>{supp_item_link(i)}</li>' for i in items)
    return f'<ul class="supp-items">{links}</ul>'


def build_html(data: dict) -> str:
    repos = data["repos"]
    by_key = {r["key"]: r for r in repos}
    order = ["gltf", "blender", "cpython", "pwndbg", "neovim", "gitlab-cli", "gitlab", "gitlab-runner"]

    active_issues = sum(active_count(r["issues"]) for r in repos)
    active_prs = sum(active_count(r["prs"]) for r in repos)
    total_merged = sum(1 for r in repos for i in r["prs"] if i["state"] == "merged")
    cap = sum(r["target"] for r in repos)

    trial_rows = "".join(trial_row(by_key[k], by_key[k]["target"]) for k in order)
    accounts = "".join(account_block(by_key[k], by_key[k]["target"]) for k in order)

    # supplementary record: non-PR work, marked verified (queryable) vs self-reported.
    # A prov value of None means "queryable in principle but unavailable right
    # now" (e.g. a private Discourse profile) -- that falls back to the manual
    # log and renders as self-reported rather than a fake permanent zero.
    slug_by_key = {k: slug for k, _n, _h, slug, _c, _l, _t in REPOS}
    prov: dict[str, list[dict] | None] = {
        "pwndbg:comments": (data["gh_comments"].get("pwndbg/pwndbg", [])
                             + data["gh_discussions"].get("pwndbg/pwndbg", [])),
        "neovim:comments": data["gh_comments"].get("neovim/neovim", []),
        "neovim:discussions": data["gh_discussions"].get("neovim/neovim", []),
        "cpython:discourse": None,  # Always fallback to log for links
        "pwndbg:reviews": data["gh_reviews"].get(slug_by_key["pwndbg"], []),
        "neovim:reviews": data["gh_reviews"].get(slug_by_key["neovim"], []),
        "cpython:reviews": data["gh_reviews"].get(slug_by_key["cpython"], []),
        "gltf:reviews": data["gh_reviews"].get(slug_by_key["gltf"], []),
    }
    supp_blocks = []
    global_backlog = []
    for proj, repo_key, rows in MANUAL:
        repo = by_key[repo_key]
        lines = []
        for label, meta, source, tag in rows:
            verified_items = prov.get(tag) if source == "query" else None
            if verified_items is not None:
                n_items = verified_items
                mark, mcls = "●", "audit--verified"
                mtitle = ("verified from discuss.python.org" if tag == "cpython:discourse"
                          else "verified from GitHub")
            else:
                n_items = data["log"].get(f"{repo_key}:{tag.split(':')[-1]}", [])
                mark, mcls, mtitle = "○", "audit--self", "self-reported in the log"
            
            this_week_items = [i for i in n_items if i["date"] >= data["week_start"]]
            for i in n_items:
                if i["date"] < data["week_start"]:
                    b_item = i.copy()
                    b_item["repo_key"] = repo["key"]
                    b_item["category"] = label
                    global_backlog.append(b_item)

            n = len(this_week_items)
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
                f'</div>'
                f'{supp_items_html(this_week_items)}'
                f'</div>')
        supp_blocks.append(
            f'<div class="supp__acct">'
            f'<div class="supp__head">{compact_mark(repo)}{proj}</div>'
            f'{"".join(lines)}</div>')
    supplementary = "".join(supp_blocks)
    
    global_backlog.sort(key=lambda x: x["date"], reverse=True)
    backlog_rows = []
    for item in global_backlog:
        repo = by_key[item["repo_key"]]
        mark = compact_mark(repo, "misc__dot")
        backlog_rows.append(
            f'<a class="misc__row" href="{item["url"]}" title="{esc(item["title"])}" target="_blank" rel="noopener noreferrer">'
            f'<div class="misc__row-top">'
            f'<span class="misc__title">{esc(item["title"])}</span>'
            f'</div>'
            f'<div class="misc__row-bottom">'
            f'<span class="misc__repo">{mark} {repo["name"]} &middot; {item["category"]}</span>'
            f'<span class="misc__leader" aria-hidden="true"></span>'
            f'<span class="misc__date">{item["date"]}</span>'
            f'</div></a>'
        )
    backlog_html = "".join(backlog_rows) if backlog_rows else '<div class="misc__row misc__row--empty">no past supplementary work</div>'

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
            .replace("<!--BACKLOG-->", backlog_html)
            .replace("<!--MISC-->", misc_rows))


def main() -> int:
    data = collect()
    (ROOT / "data.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "index.html").write_text(build_html(data), encoding="utf-8")
    ai = sum(active_count(r["issues"]) for r in data["repos"])
    ap = sum(active_count(r["prs"]) for r in data["repos"])
    total_cap = sum(r["target"] for r in data["repos"])
    print(f"refreshed {data['as_of']}: active issues {ai}/{total_cap}, active PRs {ap}/{total_cap}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
