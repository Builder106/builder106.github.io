# Contributions log

Non-PR work that no API fully captures: bug triage, patch review, module
meetings, and community answers. One row per touch, logged same-day, with a
link so it's checkable later.

`refresh.py` tallies these rows into the dashboard's ○ counters. Keep the table
shape exactly as below. The parser splits on `|` and reads columns 2 (project)
and 3 (type).

The project column uses each repo's short key (matching `REPOS` in
`refresh.py`), not its display name -- `gltf`, not `glTF-Blender-IO`.

Valid `type` values the dashboard counts:

- `blender`: `triage`, `review`, `meeting`
- `neovim`: `answer`
- `cpython`: `discourse` -- only used as a fallback; discuss.python.org posts
  are counted live via its public API when the profile is public. Mine is
  currently private, so this stays manual until that changes.
- `gltf`: `community` -- Khronos' community forum has no public per-user API
  (returns 403 for any `/u/<name>.json` lookup, member or not), so this is
  manual-only for good.

pwndbg issue/discussion answers and Neovim issue-triage comments + GitHub
Discussions answers are counted straight from GitHub (the ● rows), so they
don't need a log entry.

| date | project | type | link | note |
|------|---------|------|------|------|
