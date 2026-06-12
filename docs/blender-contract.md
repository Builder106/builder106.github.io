# Blender → Three.js export contract

The Three.js code in `src/scene/` consumes a single `.glb` exported from
Blender. The contract below is what makes the React overlay panels and camera
flies "just work" the moment a fresh export is dropped in.

The placeholder geometry in [src/scene/ServerRoom.tsx](../src/scene/ServerRoom.tsx)
already uses these naming conventions, so the wiring is exercised before any
real Blender file exists.

## File location

Drop the export at `public/models/server-room.glb`. Vite serves `public/` at
the root, so it resolves to `/models/server-room.glb` in both dev and prod.

## Coordinate system

- Blender ships Z-up; Three.js / glTF uses Y-up. **Tick "Y Up" in the glTF
  exporter** (it's on by default — leave it on).
- One Blender unit = one Three.js unit. The current placeholder room is
  ~14 units across and ~3 units tall.
- Origin is the centre of the room floor.

## Naming conventions

### Anchors (Empties)

Empty objects whose names start with `anchor_` are read by
`collectAnchors()` ([src/scene/anchors.ts](../src/scene/anchors.ts)) and used
for camera flies and React-panel pinning.

> **Use underscore, not dot.** Three.js's GLTFLoader strips dots from glTF
> node names — it reserves them for animation property paths. So
> `anchor.terminal` would arrive in the browser as `anchorterminal` and
> the prefix match would silently fail. The Rack and Screen meshes follow
> the same rule (`Rack_imc-prosperity`, not `Rack.imc-prosperity`).

| Empty name              | Cluster | Purpose                                              |
| ----------------------- | ------- | ---------------------------------------------------- |
| `anchor_terminal`       | —       | Central monitor — opens the Trading Terminal panel.  |
| `anchor_econos`         | quant   | EconOS rack (back wall, landscape).                  |
| `anchor_ocaml-lob`      | quant   | OCaml LOB rack.                                      |
| `anchor_qforge`         | quant   | qforge rack.                                         |
| `anchor_micromatch`     | SWE     | MicroMatch rack (left wall, landscape).              |
| `anchor_staija`         | SWE     | STAIJA rack.                                         |
| `anchor_studysprint`    | SWE     | StudySprint rack.                                    |
| `anchor_capitol-alpha`  | analyst | CapitolAlpha rack (left wall, landscape).            |
| `anchor_datafest-2026`  | analyst | DataFest 2026 rack.                                  |
| `anchor_linuxbenchhub`  | analyst | LinuxBenchHub rack.                                  |
| `anchor_clearhash`      | security| ClearHash rack (right wall, landscape).              |
| `anchor_halberd`        | security| Halberd rack.                                        |
| `anchor_quarry`         | security| Quarry rack.                                         |
| `anchor_enclave`        | ml      | Enclave rack (front wall, landscape).                |
| `anchor_helm`           | ml      | Helm rack.                                           |
| `anchor_tradetell`      | ml      | TradeTell rack.                                      |

The id after `anchor_` must match a `Project.id` value in
[src/data/projects.ts](../src/data/projects.ts). When you add a project, add
both a row there and an `anchor_<id>` Empty in Blender — or set
`inScene: false` on the project to opt it out of the scene presence check.

#### Security wing — right wall (+X)

The security cluster lives on the **right wall (+X)**, symmetric to the
left-wall (−X) swe/analyst racks. The three assemblies were authored by
mirroring left-wall racks across the room centre (a 180° Z-rotation, baked
into the mesh so normals stay outward), giving each a dedicated wall in the
landscape composition (quant=back, swe+analyst=left, security=right).

| Anchor             | Rack world pos (Blender) | Cluster  | Project   |
| ------------------ | ------------------------ | -------- | --------- |
| `anchor_clearhash` | (6.1, −0.5, 1.3)         | security | ClearHash |
| `anchor_halberd`   | (6.1,  1.0, 1.3)         | security | Halberd   |
| `anchor_quarry`    | (6.1,  2.5, 1.3)         | security | Quarry    |

Each has the usual `Rack_<id>` + `Screen_<id>` + 12× `StatusLED_<id>_r{0,1}_c{0..5}`
meshes; LEDs are recoloured at runtime from the `color` field in projects.ts
(ClearHash `#39ff14`, Halberd `#e0b341`, Quarry `#ff7a18`). Anchors sit 1.4
units toward room centre (X=4.7). The wing is live in code: it's in both
`AISLE_ORDER` copies (portrait), the `slotIndexByKey` `order` tuple +
landscape `waveSlotCount` (=5), and the `security` wave colour `#4cff8f`.

#### AI/ML wing — front wall (−Y in Blender → +Z in Three.js)

The `ml` cluster lives on the **front wall**, opposite the quant back wall.
The three assemblies were authored by point-mirroring the quant back-wall
racks (econos/ocaml-lob/qforge) across room centre — a 180° Z rotation about
the world origin — exactly as the security wing mirrored the left wall. The
mirror preserves each rack's baked UVs, so the relocated racks reuse the
quant bake (`M_Bake_Rack_econos`/`-ocaml-lob`/`-qforge`) and stay consistently
lit without a re-bake. Unlike the other walls, the AI/ML racks are then turned
180° about each rack's own vertical axis so their **screen/LED face points at
the entrance camera (+Z in Three.js)** rather than into the room — the front
wall is the one wall the default vantage views from outside, so facing inward
would hide the screen + brand badge. Their anchors therefore sit on the
entrance side (Y=−7.5 in Blender → z=+7.5 in Three.js), in front of the screen.

| Anchor             | Rack world pos (Blender) | Anchor (Blender)   | Cluster | Project   |
| ------------------ | ------------------------ | ------------------ | ------- | --------- |
| `anchor_enclave`   | (1.5, −6.1, 1.3)         | (1.5, −7.5, 1.3)   | ml      | Enclave   |
| `anchor_helm`      | (0, −6.1, 1.3)           | (0, −7.5, 1.3)     | ml      | Helm      |
| `anchor_tradetell` | (−1.5, −6.1, 1.3)        | (−1.5, −7.5, 1.3)  | ml      | TradeTell |

LEDs recolour at runtime (Enclave `#15c39a`, Helm `#4f8cff`, TradeTell
`#ff4b4b`). The wing is live in code: `AISLE_ORDER` (portrait, 15 racks), the
`slotIndexByKey` `order` tuple + landscape `waveSlotCount` (=5), the `ml` wave
colour `#a06bff`, the `wallNormalFor` / logo-placement front-plane handling
(both treat z≈+7.5 anchors as +Z-facing, like the back wall), and the
`projectCameraTarget` front-wing case (camera approaches from +Z so a click-fly
frames the screen, not its back).

To re-export after editing the security wing: open
`blend/server-room.blend`, edit, then **File → Export → glTF 2.0** to
`public/models/server-room.glb` (GLB, Y-up, apply modifiers, materials with
images packed — cameras/lights are excluded by exporter default). **Enable
Draco mesh compression** under the Geometry → Compression panel (the geometry
is the bulk of the file; Draco cuts it ~57%). The loader points
`useGLTF(url, "/draco/")` at a self-hosted decoder in `public/draco/`, so a
Draco glb is expected — a non-Draco export still loads (DRACOLoader no-ops on
uncompressed primitives) but forfeits the size win.

Place each Empty **just in front of** the surface it represents (about 1.2
units of clearance), so when the camera rig flies to `anchor + offset` it
frames the rack rather than burying itself in geometry.

### Interactive meshes

Meshes named `Rack_<id>` and `Screen_<id>` (where `<id>` matches a
[Project.id](../src/data/projects.ts) value) are recognised by
`resolveClick()` ([src/scene/clickResolver.ts](../src/scene/clickResolver.ts))
and trigger a fly + panel-open for that project. Same underscore-not-dot
rule applies. The central monitor mesh is just `Monitor` (no separator);
clicking `Monitor` or `Desk` opens the central terminal panel.

## Apply transforms before export

Run `Object → Apply → All Transforms` on every mesh before exporting.
Unapplied scale/rotation breaks normal maps and physics-style raycasting in
Three.js.

## Lighting

All scene lighting is **baked into a single combined texture map** during the
Blender step — Three.js does not re-light the scene at runtime. This is what
keeps the render cost near zero in the browser. Bake settings:

- Cycles, GPU, 256 samples, denoise on.
- Bake type: **Combined**.
- Output: a single 2K (2048²) texture per material, packed into the `.glb`.

Once the bake is done, **detach all lights from the export** (or move them to
a dedicated "bake-only" collection that isn't included in the glTF export).
The R3F scene adds three small point lights for live highlights on hovered
elements; baked-in lighting plus runtime lighting will double up otherwise.

## Geometry budget

Target the whole scene at:
- **≤ 80k triangles total** (mobile-safe).
- **≤ 8 materials**.
- **No N-gons**: all faces triangulated or quads. Run
  `Mesh → Clean Up → Tris to Quads` then `Triangulate` on export.

## Export settings

`File → Export → glTF 2.0 (.glb)` with:

- **Format:** glTF Binary (.glb).
- **Include:** Selected Objects unchecked, all visible objects exported.
- **Transform:** Y Up ✓.
- **Geometry:**
  - Apply Modifiers ✓.
  - UVs ✓, Normals ✓, Tangents ✓ (needed for normal maps if any).
  - Vertex Colours ✗ unless you actually use them.
- **Materials:** Export, with Images packed.
- **Animation:** off (we're animating the camera in code, not in Blender).

## Sanity checklist before export

1. All transforms applied.
2. Anchors named `anchor_<id>` and positioned with clearance.
3. Lights moved to a non-exported collection.
4. Bake completed and packed into materials.
5. Scene scale and origin match the placeholder room (use the
   `ServerRoom.tsx` stand-in as a size reference).
6. Triangulate + check tri count in the Statistics overlay (`N` panel →
   Statistics).
