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
# SVG (#57A143). FURY uses its official documentation logo.
REPOS = [
    ("gltf", "glTF-Blender-IO", "github", "KhronosGroup/glTF-Blender-IO", "#87C540", "gltf-blender-io.svg", 3),
    ("blender", "blender/blender", "gitea", "blender/blender", "#E87D0D", "blender.svg", 3),
    ("cpython", "python/cpython", "github", "python/cpython", "#3776AB", "cpython.svg", 3),
    ("fury", "FURY", "github", "fury-gl/fury", "#ffcc00", "fury.svg", 3),
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
    ("FURY", "fury", [
        ("Answer issues / discussions", "target 1 / wk", "query", "fury:comments"),
        ("Patch review on others' PRs", "target 1 / wk", "query", "fury:reviews"),
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


def item_row(item: dict) -> str:
    state = item["state"]
    return (f'<li class="item item--{state}">'
            f'<a href="{item["url"]}" target="_blank" rel="noopener noreferrer">'
            f'<span class="item__n">#{item["n"]}</span>'
            f'<span class="item__title">{esc(item["title"])}</span></a>'
            + (f'<span class="item__state">{state}</span>' if state != "open" else "")
            + '</li>')


def count_label(active: int, target: int) -> str:
    cls = "count" if active >= target else "count count--short"
    return f'<span class="{cls}">{active} of {target}</span>'


def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def account_column(items: list[dict], target: int, label: str) -> str:
    active = [i for i in items if i["state"] == "open"]
    resolved = resolved_items(items)
    if active:
        entries = '<ul class="items">' + "".join(item_row(i) for i in active) + "</ul>"
    else:
        entries = '<p class="none">Nothing open.</p>'
    done = ""
    if resolved:
        done = (f'<details class="done"><summary>{len(resolved)} merged or closed</summary>'
                '<ul class="items">' + "".join(item_row(i) for i in resolved) + "</ul></details>")
    return (f'<div class="col">'
            f'<h4 class="col__head">{label} {count_label(len(active), target)}</h4>'
            f'{entries}{done}</div>')


def account_mark(repo: dict, cls: str) -> str:
    """The vendored logo with its own fills, or nothing for repos without one."""
    body, view_box, fill = logo_svg(repo["logo"])
    if not body:
        return ""
    fill_attr = f' fill="{fill}"' if fill else ""
    return (f'<span class="{cls}" aria-hidden="true">'
            f'<svg viewBox="{view_box}"{fill_attr} xmlns="http://www.w3.org/2000/svg">{body}</svg></span>')


HOSTS = {"github": "GitHub", "gitea": "projects.blender.org", "gitlab": "GitLab"}


def account_block(repo: dict, target: int) -> str:
    pause_notice = ""
    if "paused_until" in repo:
        from datetime import datetime
        pause_date = datetime.strptime(repo["paused_until"], "%Y-%m-%d")
        pause_notice = f'<p class="pause">Paused until {pause_date.strftime("%B %-d")}.</p>'

    return (f'''
      <section class="project" id="{repo['key']}">
        <h3 class="project__name">{account_mark(repo, "logo")}{repo['name']}
          <span class="project__host">on {HOSTS.get(repo["host"], repo["host"])}</span></h3>
        {pause_notice}
        <div class="project__cols">
          {account_column(repo['issues'], target, 'Issues')}
          {account_column(repo['prs'], target, 'Pull requests')}
        </div>
      </section>''')


def summary_row(repo: dict, target: int) -> str:
    ai, ap = active_count(repo["issues"]), active_count(repo["prs"])
    return (f'<tr><th scope="row"><a href="#{repo["key"]}">{account_mark(repo, "logo")}{repo["name"]}</a></th>'
            f'<td>{count_label(ai, target)}</td><td>{count_label(ap, target)}</td></tr>')

def build_html(data: dict) -> str:
    repos = data["repos"]
    by_key = {r["key"]: r for r in repos}
    order = ["gltf", "blender", "cpython", "fury", "neovim", "gitlab-cli", "gitlab", "gitlab-runner"]

    active_issues = sum(active_count(r["issues"]) for r in repos)
    active_prs = sum(active_count(r["prs"]) for r in repos)
    total_merged = sum(1 for r in repos for i in r["prs"] if i["state"] == "merged")
    cap = sum(r["target"] for r in repos)

    trial_rows = "".join(summary_row(by_key[k], by_key[k]["target"]) for k in order)
    accounts = "".join(account_block(by_key[k], by_key[k]["target"]) for k in order)

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
            .replace("<!--ACCOUNTS-->", accounts))


def main() -> int:
    data = collect()

    # Preserve paused_until fields from previous data
    try:
        old_data = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
        old_by_key = {r["key"]: r for r in old_data.get("repos", [])}
        for repo in data["repos"]:
            if repo["key"] in old_by_key and "paused_until" in old_by_key[repo["key"]]:
                repo["paused_until"] = old_by_key[repo["key"]]["paused_until"]
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    (ROOT / "data.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    import shutil
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "index.html").write_text(build_html(data), encoding="utf-8")
    for f in ["favicon.svg", "apple-touch-icon.png", "favicon.ico"]:
        if (ROOT / f).exists():
            shutil.copy(ROOT / f, OUT_DIR / f)
    ai = sum(active_count(r["issues"]) for r in data["repos"])
    ap = sum(active_count(r["prs"]) for r in data["repos"])
    total_cap = sum(r["target"] for r in data["repos"])
    print(f"refreshed {data['as_of']}: active issues {ai}/{total_cap}, active PRs {ap}/{total_cap}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
