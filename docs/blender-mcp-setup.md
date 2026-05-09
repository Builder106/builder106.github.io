# Blender MCP setup (official Blender Lab connector)

This project ships an `.mcp.json` that registers the **official Blender Lab
MCP connector** (announced 2026-04-28, hosted at
[blender.org/lab/mcp-server/](https://www.blender.org/lab/mcp-server/), source at
[projects.blender.org/lab/blender_mcp](https://projects.blender.org/lab/blender_mcp)).

This is the connector built and maintained by the Blender Foundation, not the
older community project. The two have similar shapes but the official build is
what the marketplace listing and Anthropic's tutorials point at.

## What's installed where

- **MCP server bundle** — extracted to `~/.local/blender-mcp/bundle`. Started
  on demand via `uv run --directory ~/.local/blender-mcp/bundle blender-mcp`.
- **Blender add-on** — bundled with the release. Loaded inside
  Blender via Edit → Preferences → Add-ons. Opens a local socket the MCP
  server connects to.
- **Claude Code MCP config** — committed to this repo as `.mcp.json`, using
  `${HOME}` so it stays portable.

The MCP server and the add-on talk over a local socket, so nothing leaves
the machine.

## Prerequisites (already verified on this machine)

- macOS with `uv` at `/opt/homebrew/bin/uv` ✓
- Blender 4.5.4 LTS ✓ (4.2+ required by the official connector)
- Claude Code installed and configured ✓

## One-time setup

### 1. Download the official bundle

Open the [Blender Lab MCP Server page](https://www.blender.org/lab/mcp-server/)
and download the latest release for macOS. As of writing, the latest tagged
release is **v0.3.0**
([release page](https://projects.blender.org/lab/blender_mcp/releases)).

You want two things from the release:
- the **server bundle** (a tarball or zip — extract it),
- the **add-on file** (an `.zip` you'll feed to Blender).

Some clients support **`.mcpb` files** for one-click drag-and-drop install;
Claude Code (as of this version) wants the explicit `.mcp.json` shape used
below.

### 2. Place the server bundle

Extract the bundle so its `pyproject.toml` lives at:

```
~/.local/blender-mcp/bundle/pyproject.toml
```

Adjust the path in `.mcp.json` if you put it elsewhere — but keep it under
`$HOME` so the `${HOME}` substitution works.

### 3. Install the official add-on in Blender

1. Launch Blender 4.5.
2. `Edit → Preferences → Add-ons → Install…`
3. Select the official add-on `.zip` from the release.
4. Tick the checkbox to enable it.
5. Press **N** in the 3D Viewport to open the side panel. Find the
   **BlenderMCP** tab.
6. Click **Connect** (or **Start Server**, depending on the release). Leave
   it running.

> If you previously installed the community add-on
> ([ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)),
> disable it first. Both add-ons listen on the same default socket and
> only one can run at a time.

### 4. Restart Claude Code

Claude Code reads `.mcp.json` at session start, not on file change. After
the add-on is running, quit and relaunch Claude Code from this project
directory. The first time, it will ask you to approve the new MCP server —
say yes.

You'll know it worked when tool names like `mcp__blender__*` appear in the
deferred-tools list, and I can call them.

### 5. Sanity-check from the assistant side

Once the server is wired, ask me to do something small first — e.g.
"add a default cube and report its world-space dimensions" — to make sure
the round trip works before we start modeling the server room.

## Troubleshooting

- **`uv: command not found` after restart** — `uv` is at
  `/opt/homebrew/bin/uv`. If Claude Code can't find it on PATH, swap the
  `command` value in `.mcp.json` to the absolute path.
- **`error in 'egg_base' option: '.' does not exist`** — known issue with
  the official Windows installer
  ([anthropics/claude-code#54798](https://github.com/anthropics/claude-code/issues/54798)).
  Doesn't affect macOS, but if it ever lands here, fall back to the
  community connector by setting `command: "uvx"`, `args: ["blender-mcp"]`
  in `.mcp.json` (and installing the community add-on instead).
- **Server starts but tools never appear** — the add-on isn't running. The
  MCP server can spawn, but it has nothing to talk to until Blender's
  socket is up. Toggle the Connect button in Blender and restart the
  Claude Code session.
- **Two clients fighting over the socket** — only one MCP client (Claude
  Code, Claude Desktop, Cursor, …) can hold the connection at a time.
  Close the others.

## What I'll use it for

When the connection is live, the modeling step (Blender side of the
[contract](./blender-contract.md)) becomes:

1. Build the room geometry with `bpy` — racks, desk, monitor, cable trays.
2. Apply the dark-mode + neon material palette and bake lighting into a
   single combined texture per material.
3. Place `anchor.<id>` Empties at the positions defined in
   [src/data/projects.ts](../src/data/projects.ts).
4. Export to `public/models/server-room.glb` so Vite picks it up
   automatically.

The placeholder geometry in [src/scene/ServerRoom.tsx](../src/scene/ServerRoom.tsx)
gets swapped for a `<Gltf>` loader in the same step.
