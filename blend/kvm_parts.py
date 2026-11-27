import bpy, bmesh, math, os

OUT = os.path.expanduser("~/Renders/panel-kvm/out")
os.makedirs(OUT, exist_ok=True)
PPM = 6  # pixels per millimetre

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices:
    d.use = True
scene.cycles.device = "GPU"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 92

world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.022, 0.035, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = world

sun = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
sun.data.energy = 2.4
sun.data.angle = math.radians(8)
sun.rotation_euler = (math.radians(-28), math.radians(-22), 0)
scene.collection.objects.link(sun)
rim = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "SUN"))
rim.data.energy = 0.9
rim.data.color = (0.55, 0.9, 1.0)
rim.rotation_euler = (math.radians(35), math.radians(30), 0)
scene.collection.objects.link(rim)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.type = "ORTHO"
cam.location = (0, 0, 200)
cam.data.clip_end = 1000
scene.collection.objects.link(cam)
scene.camera = cam


def mat(name, color, metal, rough, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 1.0
    return m


POWDER = mat("Powder", (0.026, 0.03, 0.06), 0.5, 0.78)
_nt = POWDER.node_tree
_n = _nt.nodes.new("ShaderNodeTexNoise"); _n.inputs["Scale"].default_value = 2.5; _n.inputs["Detail"].default_value = 12
_b = _nt.nodes.new("ShaderNodeBump"); _b.inputs["Strength"].default_value = 0.12; _b.inputs["Distance"].default_value = 0.05
_nt.links.new(_n.outputs["Fac"], _b.inputs["Height"])
_nt.links.new(_b.outputs["Normal"], _nt.nodes["Principled BSDF"].inputs["Normal"])
DARK = mat("Dark", (0.012, 0.013, 0.02), 0.3, 0.8)
STEEL = mat("Steel", (0.55, 0.57, 0.62), 1.0, 0.32)
RUBBER = mat("Rubber", (0.03, 0.032, 0.045), 0.0, 0.55)
ANOD = mat("Anod", (0.06, 0.065, 0.1), 0.85, 0.4)

parts = []


def box(name, sx, sy, sz, loc, material, bevel=0.0, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material)
    if bevel:
        m = o.modifiers.new("bev", "BEVEL")
        m.width = bevel
        m.segments = segs
        m.limit_method = "ANGLE"
        m.harden_normals = True
    return o


def cut(target, cutter):
    m = target.modifiers.new("cut", "BOOLEAN")
    m.object = cutter
    m.operation = "DIFFERENCE"
    cutter.hide_render = True
    cutter.hide_viewport = True


def screw(loc, r=3.2):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16)
    s = bpy.context.active_object
    s.scale.z = 0.35
    s.data.materials.append(STEEL)
    bpy.ops.object.shade_smooth()
    slot = box("slot", r * 1.5, r * 0.28, 2, (loc[0], loc[1], loc[2] + 0.6), DARK)
    slot.rotation_euler.z = math.radians(35)
    return [s, slot]


def catcher(w, h):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -6))
    p = bpy.context.active_object
    p.scale = (w * 3, h * 3, 1)
    p.is_shadow_catcher = True
    return p


def render(name, objs, w, h):
    for o in scene.objects:
        if o.type == "MESH":
            o.hide_render = o not in objs or o.hide_viewport
    cam.data.ortho_scale = max(w, h)
    scene.render.resolution_x = round(w * PPM)
    scene.render.resolution_y = round(h * PPM)
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name, scene.render.resolution_x, scene.render.resolution_y)


U = 44.45

# 1. Rack ear tile: 1U of the mounting flange, three square cage-nut holes.
#    The slab runs past the frame so the tile repeats vertically without seams.
ear = box("ear", 16, U * 3, 2.5, (0, 0, 0), POWDER, bevel=0.6)
holes = []
for y in (-U / 2 + 6.35, -U / 2 + 22.225, -U / 2 + 38.1):
    for k in (-1, 0, 1):
        c = box("hole", 9.5, 9.5, 10, (0, y + k * U, 0), DARK)
        cut(ear, c)
        holes.append(c)
        back = box("cage", 9.4, 9.4, 0.5, (0, y + k * U, -1.6), DARK)
        holes.append(back)
render("ear-tile", [ear] + holes, 16, U)

# 2. Pull handle, front view, standing off a shadow catcher.
handle_bar = box("bar", 7, 36, 6, (0, 0, 2), ANOD, bevel=2.8, segs=6)
posts = [box("post", 9, 6, 4, (0, sy, -1), ANOD, bevel=1.2) for sy in (-15, 15)]
hc = catcher(18, U)
render("handle", [handle_bar, *posts, hc], 18, U)

# 3. Faceplate slab, 1U tall, for a 9-slice with a fill.
face = box("face", 300, U - 1.0, 3, (0, 0, 0), POWDER, bevel=1.0)
render("faceplate", [face], 300, U)

# 4. Screen bezel with corner screws; the opening is cut through.
bz_w, bz_h, bord = 240, 160, 13
bezel = box("bezel", bz_w, bz_h, 4, (0, 0, 0), POWDER, bevel=1.4)
opening = box("open", bz_w - bord * 2, bz_h - bord * 2, 20, (0, 0, 0), DARK)
cut(bezel, opening)
lip = box("lip", bz_w - bord * 2 + 2, bz_h - bord * 2 + 2, 1.5, (0, 0, 1.2), DARK, bevel=0.6)
lipcut = box("lipcut", bz_w - bord * 2 - 1.2, bz_h - bord * 2 - 1.2, 20, (0, 0, 0), DARK)
cut(lip, lipcut)
screws = []
for sx in (-1, 1):
    for sy in (-1, 1):
        screws += screw((sx * (bz_w / 2 - bord / 2), sy * (bz_h / 2 - bord / 2), 2.6))
render("bezel", [bezel, lip, *screws], bz_w, bz_h)

# 5. Piano hinge, tileable horizontally (two knuckles per 20 mm).
knuckles = []
for i in range(-6, 7):
    bpy.ops.mesh.primitive_cylinder_add(radius=2.2, depth=9.2, location=(i * 10 + 5, 0, 0))
    k = bpy.context.active_object
    k.rotation_euler.y = math.radians(90)
    k.data.materials.append(STEEL if i % 2 else ANOD)
    bpy.ops.object.shade_smooth()
    knuckles.append(k)
leaf = box("leaf", 140, 3, 0.8, (0, -2.4, -1.6), POWDER)
render("hinge-tile", knuckles + [leaf], 20, 6)

# 6. KVM port key, rubber cap on a dark well.
well = box("well", 12, 9, 1, (0, 0, -0.5), DARK, bevel=0.8)
cap = box("cap", 10, 7, 2.4, (0, 0, 1.2), RUBBER, bevel=1.0, segs=5)
render("port-key", [well, cap], 12, 9)
cap.location.z = 0.4
render("port-key-down", [well, cap], 12, 9)
