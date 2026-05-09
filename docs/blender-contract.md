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

Empty objects whose names start with `anchor.` are read by
`collectAnchors()` ([src/scene/anchors.ts](../src/scene/anchors.ts)) and used
for camera flies and React-panel pinning.

| Empty name              | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `anchor.terminal`       | Central monitor — opens the Trading Terminal panel.    |
| `anchor.imc-prosperity` | IMC Prosperity 3 rack.                                 |
| `anchor.capitol-alpha`  | Capitol Alpha rack.                                    |
| `anchor.linuxbenchhub`  | LinuxBenchHub rack.                                    |
| `anchor.naijatank`      | NaijaTank rack.                                        |
| `anchor.staija`         | STAIJA rack.                                           |
| `anchor.applytok`       | ApplyTok rack.                                         |

The id after the dot must match a `Project.anchor` value in
[src/data/projects.ts](../src/data/projects.ts). When you add a project, add
both a row there and an `anchor.<id>` Empty in Blender.

Place each Empty **just in front of** the surface it represents (about 1.2
units of clearance), so when the camera rig flies to `anchor + offset` it
frames the rack rather than burying itself in geometry.

### Interactive meshes

Meshes named `interactive.<id>` (where `<id>` matches a project id) become
raycaster targets — hovering or clicking them triggers the same fly+panel
behavior as the matching anchor. Use this for the front face of each rack.

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
2. Anchors named `anchor.<id>` and positioned with clearance.
3. Lights moved to a non-exported collection.
4. Bake completed and packed into materials.
5. Scene scale and origin match the placeholder room (use the
   `ServerRoom.tsx` stand-in as a size reference).
6. Triangulate + check tri count in the Statistics overlay (`N` panel →
   Statistics).
