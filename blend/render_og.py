"""Headless Blender render for the social-preview image.

Renders the existing server-room.blend from its FinalCamera (or the
default Camera if not present) at 1200x630, using Eevee for speed.

Usage (from repo root):

    /Applications/Blender.app/Contents/MacOS/Blender \
        -b blend/server-room.blend -P blend/render_og.py
"""

from pathlib import Path

import bpy

scene = bpy.context.scene

# Output: public/og-card.png at the canonical OG card resolution.
repo_root = Path(__file__).resolve().parent.parent
out_path = repo_root / "public" / "og-card.png"

scene.render.resolution_x = 1200
scene.render.resolution_y = 630
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = str(out_path)

# Pick the camera. Prefer "FinalCamera" if it exists, otherwise fall
# back to "Camera".
cam = bpy.data.objects.get("FinalCamera") or bpy.data.objects.get("Camera")
if cam is None:
    raise RuntimeError("No FinalCamera or Camera object in scene")
scene.camera = cam

# Eevee for speed — the OG card just needs to be representative, not
# pixel-perfect. Cycles would take 10x longer and the difference at
# 1200x630 isn't visible.
engine_options = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engine_options else "BLENDER_EEVEE"

# Bump samples for a clean image.
eevee = scene.eevee
if hasattr(eevee, "taa_render_samples"):
    eevee.taa_render_samples = 64

bpy.ops.render.render(write_still=True)
print(f"[render_og] wrote {out_path}")
