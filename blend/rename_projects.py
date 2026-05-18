"""Rename every project-tagged object in the scene from the old
placeholder IDs to the new real-project IDs, then re-export the .glb.

Mapping (back wall = quant cluster, left wall = products cluster):
    imc-prosperity  -> econos
    capitol-alpha   -> ocaml-lob
    linuxbenchhub   -> qforge
    naijatank       -> micromatch
    staija          -> staija            (unchanged)
    applytok        -> studysprint

Affects: Rack_<id>, Screen_<id>_mesh, anchor_<id>, StatusLED_<id>_*.
The Bake_Rack_<id> baked-GI textures and M_Bake_Rack_<id> materials are
also renamed so the bake-target wiring still points at the right images.

Usage (from repo root):

    /Applications/Blender.app/Contents/MacOS/Blender \
        -b blend/server-room.blend -P blend/rename_projects.py
"""

from pathlib import Path

import bpy

RENAMES = {
    "imc-prosperity": "econos",
    "capitol-alpha":  "ocaml-lob",
    "linuxbenchhub":  "qforge",
    "naijatank":      "micromatch",
    "applytok":       "studysprint",
    # staija stays the same.
}


def rename_with_log(old_name: str, new_name: str, kind: str):
    """Rename a Blender data-block by name. No-op + log if missing."""
    if old_name == new_name:
        return
    coll = getattr(bpy.data, kind)
    obj = coll.get(old_name)
    if obj is None:
        print(f"[rename] {kind}.{old_name} -> {new_name}  SKIP (not found)")
        return
    if coll.get(new_name) is not None:
        print(f"[rename] {kind}.{old_name} -> {new_name}  SKIP (target exists)")
        return
    obj.name = new_name
    print(f"[rename] {kind}.{old_name} -> {new_name}  OK")


for old_id, new_id in RENAMES.items():
    # Object renames.
    rename_with_log(f"Rack_{old_id}",   f"Rack_{new_id}",   "objects")
    rename_with_log(f"Screen_{old_id}", f"Screen_{new_id}", "objects")
    rename_with_log(f"anchor_{old_id}", f"anchor_{new_id}", "objects")

    # Status LED dots: 2 rows x 6 cols per rack.
    for r in range(2):
        for c in range(6):
            rename_with_log(
                f"StatusLED_{old_id}_r{r}_c{c}",
                f"StatusLED_{new_id}_r{r}_c{c}",
                "objects",
            )

    # Mesh datablock for the Screen (Blender names it "Screen_<id>_mesh").
    rename_with_log(f"Screen_{old_id}_mesh", f"Screen_{new_id}_mesh", "meshes")

    # Bake target image + cloned material.
    rename_with_log(f"Bake_Rack_{old_id}",   f"Bake_Rack_{new_id}",   "images")
    rename_with_log(f"M_Bake_Rack_{old_id}", f"M_Bake_Rack_{new_id}", "materials")


# Re-export. Same flags as the original export to keep the pipeline
# byte-for-byte comparable.
repo = Path(__file__).resolve().parent.parent
target = repo / "public" / "models" / "server-room.glb"

bpy.ops.export_scene.gltf(
    filepath=str(target),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_extras=True,
    use_renderable=True,
    export_materials="EXPORT",
    export_image_format="JPEG",
    export_jpeg_quality=88,
    export_keep_originals=False,
)
bpy.ops.wm.save_mainfile()
print(f"[rename] exported {target} ({target.stat().st_size // 1024} KB)")
