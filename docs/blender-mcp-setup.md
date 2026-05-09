# blender-mcp setup

This project ships an `.mcp.json` that registers the community
[blender-mcp](https://github.com/ahujasid/blender-mcp) server with Claude Code.
Once the steps below are done, the assistant can model, texture, and export
Blender scenes for the portfolio directly via `bpy`.

## What's installed where

- **MCP server** — runs as `uvx blender-mcp` (Python). `uvx` is already
  available at `/opt/homebrew/bin/uvx`, so the package is fetched on demand
  the first time the server is launched.
- **Blender add-on** — a `.py` file you load inside Blender's
  Edit → Preferences → Add-ons UI. The add-on opens a WebSocket on
  `localhost:9876` that the MCP server connects to.
- **Claude Code MCP config** — committed to this repo as `.mcp.json`.

The MCP server and the add-on talk over a local socket, so nothing leaves
the machine.

## One-time setup

### 1. Get the Blender add-on

Open the [blender-mcp repo](https://github.com/ahujasid/blender-mcp) and
download `addon.py` from the project root. Save it somewhere stable — the
`tools/blender-mcp/` folder in this repo is a reasonable place if you want
it tracked alongside the project.

### 2. Install it in Blender

1. Launch Blender 4.5+.
2. `Edit → Preferences → Add-ons → Install…`
3. Pick the `addon.py` you just saved.
4. Tick the checkbox next to **Interface: Blender MCP** to enable it.
5. Press **N** in the 3D Viewport to open the side panel. You should see a
   **BlenderMCP** tab.
6. In that tab, click **Connect to Claude / MCP**. The button should flip to
   "Disconnect" once the WebSocket server is up.

Leave Blender open with the connection live whenever you want me to drive it.

### 3. Restart Claude Code

Claude Code reads `.mcp.json` at session start, not on file change. After
the add-on is running, quit and relaunch Claude Code from this project
directory. The first time, it will ask you to approve the new MCP server —
say yes.

You'll know it worked when tool names like `mcp__blender__*` show up in the
deferred-tools list, and I can call them.

### 4. Sanity-check from the assistant side

Once the server is wired, ask me to do something small first — e.g.
"add a cube at origin and report its name" — to make sure the round trip
works before we start modeling the server room.

## Troubleshooting

- **`uvx: command not found` after restart** — `uvx` is at
  `/opt/homebrew/bin/uvx`. If Claude Code can't find it, use the absolute
  path in `.mcp.json`:
  ```json
  { "mcpServers": { "blender": { "command": "/opt/homebrew/bin/uvx", "args": ["blender-mcp"] } } }
  ```
- **Server starts but tools never appear** — the add-on isn't running. The
  MCP server can spawn, but it has nothing to talk to until Blender's
  WebSocket is up. Toggle the Connect button in Blender and restart the
  Claude Code session.
- **Port 9876 already in use** — another Blender instance is running with
  the add-on. Quit the other one or change the port in the add-on settings.

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
