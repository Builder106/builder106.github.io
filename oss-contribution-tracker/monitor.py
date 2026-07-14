#!/usr/bin/env python3
"""Check every tracked issue/PR in data.json for new comments or a state
change since the last run -- not just the GSoC target repos, but the `misc`
("Other Contributions") list too. A GitHub Actions runner's default token
can read any public repo's issues/comments, so unlike the CCR cloud routine
(which is locked to a fixed set of pre-declared source repos and can't reach
an open-ended, ever-changing repo list) this covers the whole page.

Writes monitor_state.json as the diff baseline. When there's genuine new
activity, posts to a single rolling GitHub issue on this repo (opens it if
none is open, otherwise adds a comment) so watching the repo is enough to
get notified -- no separate notification channel to wire up.

Run locally (needs an authenticated `gh`), or let
.github/workflows/monitor.yml run it on a schedule.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "data.json"
STATE = ROOT / "monitor_state.json"
REPO = "Builder106/builder106.github.io"
DIGEST_TITLE = "OSS Ledger activity monitor"


def run(cmd: list[str]) -> str:
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def gh_json(args: list[str]):
    out = run(["gh", *args])
    return json.loads(out) if out.strip() else None


def tracked_urls() -> list[str]:
    """Every GitHub-hosted issue/PR worth watching: repos[].issues/prs
    (skipping Gitea-hosted Blender) plus the misc list."""
    data = json.loads(DATA.read_text(encoding="utf-8"))
    urls = []
    for repo in data["repos"]:
        if repo["host"] not in ("github", "gitlab"):
            continue
        urls += [i["url"] for i in repo["issues"]] + [p["url"] for p in repo["prs"]]
    urls += [i["url"] for i in data.get("misc", [])]
    return urls


def snapshot_gitlab(url: str) -> dict | None:
    try:
        parts = url.split("gitlab.com/")[1].split("/-/")
        project_path = urllib.parse.quote(parts[0], safe='')
        kind, number = parts[1].split("/")[:2]
        
        cmd = ["curl", "-s"]
        if "GITLAB_TOKEN" in os.environ:
            cmd += ["-H", f"PRIVATE-TOKEN: {os.environ['GITLAB_TOKEN']}"]
            
        meta_url = f"https://gitlab.com/api/v4/projects/{project_path}/{kind}/{number}"
        meta_out = run(cmd + [meta_url])
        meta = json.loads(meta_out) if meta_out.strip() else {}
        if meta.get("message") == "404 Project Not Found" or "id" not in meta:
            return None
            
        notes_url = f"https://gitlab.com/api/v4/projects/{project_path}/{kind}/{number}/notes?sort=asc"
        notes_out = run(cmd + [notes_url])
        all_notes = json.loads(notes_out) if notes_out.strip() else []
        
        comments = []
        if isinstance(all_notes, list):
            for n in all_notes:
                if not n.get("system"):
                    comments.append({
                        "author": n["author"]["username"],
                        "created_at": n["created_at"],
                        "body": n["body"]
                    })
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError, IndexError):
        return None
        
    state = "merged" if meta.get("state") == "merged" else meta.get("state", "unknown")
    if state == "opened":
        state = "open"
        
    last = comments[-1] if comments else None
    last_comment = None
    if last is not None:
        body_lines = (last["body"] or "").strip().splitlines()
        last_comment = {
            "author": last["author"],
            "created_at": last["created_at"],
            "first_line": body_lines[0][:120] if body_lines else "(no text)",
        }
    return {"url": url, "state": state, "comments": len(comments), "last_comment": last_comment}


def snapshot(url: str) -> dict | None:
    """Current state, comment count, and last comment for one issue or PR."""
    if "gitlab.com" in url:
        return snapshot_gitlab(url)
    owner, repo, kind, number = url.rstrip("/").split("/")[-4:]
    endpoint = "pulls" if kind == "pull" else "issues"
    try:
        meta = gh_json(["api", f"repos/{owner}/{repo}/{endpoint}/{number}"])
        comments = gh_json([
            "api", f"repos/{owner}/{repo}/issues/{number}/comments",
            "--jq", "[.[] | {author: .user.login, created_at, body}]",
        ]) or []
    except subprocess.CalledProcessError:
        return None
    state = "merged" if endpoint == "pulls" and meta.get("merged") else meta.get("state", "unknown")
    last = comments[-1] if comments else None
    last_comment = None
    if last is not None:
        body_lines = (last["body"] or "").strip().splitlines()
        last_comment = {
            "author": last["author"],
            "created_at": last["created_at"],
            "first_line": body_lines[0][:120] if body_lines else "(no text)",
        }
    return {"url": url, "state": state, "comments": len(comments), "last_comment": last_comment}


def diff_lines(prev: dict | None, cur: dict) -> list[str]:
    if prev is None:
        return []  # first time seeing this item -- baseline, not news
    lines = []
    if cur["state"] != prev.get("state"):
        lines.append(f"- **{cur['url']}** state changed: {prev.get('state')} -> {cur['state']}")
    if cur["comments"] > prev.get("comments", 0) and cur["last_comment"]:
        lc = cur["last_comment"]
        lines.append(f"- **{cur['url']}** new comment from {lc['author']}: \"{lc['first_line']}\"")
    return lines


def find_open_digest_issue() -> int | None:
    issues = gh_json([
        "issue", "list", "--repo", REPO, "--state", "open",
        "--search", f'"{DIGEST_TITLE}" in:title', "--json", "number,title",
    ]) or []
    return next((i["number"] for i in issues if i["title"] == DIGEST_TITLE), None)


def post_digest(body: str) -> None:
    num = find_open_digest_issue()
    if num is None:
        run(["gh", "issue", "create", "--repo", REPO, "--title", DIGEST_TITLE, "--body", body])
    else:
        run(["gh", "issue", "comment", str(num), "--repo", REPO, "--body", body])


def main() -> int:
    prev_state: dict[str, dict] = (
        json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    )
    new_state: dict[str, dict] = {}
    all_lines: list[str] = []
    unreachable: list[str] = []

    for url in tracked_urls():
        cur = snapshot(url)
        if cur is None:
            unreachable.append(url)
            continue
        all_lines += diff_lines(prev_state.get(url), cur)
        new_state[url] = cur

    STATE.write_text(json.dumps(new_state, indent=2) + "\n", encoding="utf-8")

    if not prev_state:
        print("first run: baseline established, nothing to report")
        return 0
    if not all_lines:
        print("no new activity")
        return 0

    body = "\n".join(all_lines)
    if unreachable:
        body += "\n\n---\ncouldn't fetch: " + ", ".join(unreachable)
    post_digest(body)
    print(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
