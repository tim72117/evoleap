"""Robot-in-office 3D scene, built purely from Python (bpy). Blender 4.5.
Run:  blender -b --python build_scene.py -- --engine cycles --preset preview --cam main --out r1
Args after '--' override the defaults below.
"""
import bpy, math, sys, os, time, random
import numpy as np
from mathutils import Vector, Euler

# ------------------------------------------------------------------ parameters
ENGINE = "cycles"        # cycles | eevee
PRESET = "preview"       # preview (960x540, low samples) | final (1920x1080)
CAM = "main"             # main | close
DEVICE = "cpu"           # cpu | hip (Cycles only)
OUT = "render"
SAMPLES = {"preview": 48, "final": 400}
RES = {"preview": (960, 540), "final": (1920, 1080)}
CAMERAS = {
    #        location,              look-at target,       lens, f-stop
    "main":  ((0.8, -2.3, 1.34), (0.02, 0.6, 1.12), 35, 2.2),
    "close": ((0.28, -1.05, 1.22), (0.0, 0.25, 0.92),  35, 4.5),
}
FOCUS = {"main": (0.0, 0.26, 0.80), "close": (0.12, 0.05, 0.92)}   # hands / keyboard

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for i, a in enumerate(argv):
    if a == "--engine": ENGINE = argv[i + 1]
    if a == "--preset": PRESET = argv[i + 1]
    if a == "--cam": CAM = argv[i + 1]
    if a == "--out": OUT = argv[i + 1]
    if a == "--device": DEVICE = argv[i + 1]
    if a == "--samples": SAMPLES[PRESET] = int(argv[i + 1])
HERE = os.path.dirname(os.path.abspath(__file__))
RENDERS = os.path.join(HERE, "renders")
os.makedirs(RENDERS, exist_ok=True)
random.seed(7)

# ------------------------------------------------------------------ helpers
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def mat(name, base=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, coat=0.0, coat_rough=0.03,
        emit=None, emit_str=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Specular IOR Level"].default_value = spec
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_str
    return m

def holo_mat(name, color, strength, alpha):
    """transparent + emission mix: works in both Cycles and EEVEE"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*color, 1); em.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mx = nt.nodes.new("ShaderNodeMixShader"); mx.inputs["Fac"].default_value = alpha
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    return m

def smooth(o):
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons)); o.data.update()

def put(o, m, parent=None):
    if m: o.data.materials.append(m)
    if parent: o.parent = parent
    return o

def ell(name, loc, scale, m, rot=(0, 0, 0), seg=40, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = scale; smooth(o); return put(o, m, parent)

def box(name, loc, size, m, bevel=0.01, rot=(0, 0, 0), parent=None, seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        bv = o.modifiers.new("bv", "BEVEL"); bv.width = bevel; bv.segments = seg; bv.harden_normals = True
    smooth(o); return put(o, m, parent)

def cyl(name, loc, r, h, m, rot=(0, 0, 0), seg=32, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; smooth(o); return put(o, m, parent)

def torus(name, loc, R, r, m, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=48, minor_segments=12, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; smooth(o); return put(o, m, parent)

def limb(name, p1, p2, r, m, stretch=1.0, parent=None):
    """tapered capsule-ish limb = ellipsoid aligned between p1 and p2"""
    p1, p2 = Vector(p1), Vector(p2); d = p2 - p1; L = d.length
    o = ell(name, (p1 + p2) / 2, (r, r, L / 2 * stretch), m, parent=parent)
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler(); return o

# ------------------------------------------------------------------ materials
WHITE = mat("white_plastic", (0.92, 0.93, 0.95), 0.16, coat=1.0, coat_rough=0.02)
METAL = mat("brushed_metal", (0.55, 0.57, 0.6), 0.32, metal=1.0)
DARK = mat("dark_joint", (0.04, 0.045, 0.055), 0.35, metal=0.6)
VISOR = mat("visor", (0.005, 0.008, 0.015), 0.04, coat=1.0, coat_rough=0.0, spec=0.8)
EYE = mat("eye", (0.2, 0.6, 1), 0.3, emit=(0.25, 0.65, 1.0), emit_str=25)
EAR = mat("ear_light", (0.2, 0.6, 1), 0.3, emit=(0.2, 0.55, 1.0), emit_str=12)
DESK = mat("desk_white", (0.95, 0.95, 0.96), 0.12, coat=0.6, coat_rough=0.05)
FLOOR = mat("floor", (0.42, 0.40, 0.38), 0.28, coat=0.3, coat_rough=0.15)
WALL = mat("wall", (0.9, 0.9, 0.88), 0.9)
FRAME = mat("window_frame", (0.05, 0.05, 0.06), 0.4, metal=0.5)
FABRIC = mat("chair_fabric", (0.045, 0.05, 0.06), 0.85)
KEYBASE = mat("kb_base", (0.82, 0.83, 0.85), 0.35)
KEYS = mat("kb_keys", (0.93, 0.94, 0.96), 0.4)
MUG = mat("mug", (0.9, 0.45, 0.2), 0.12, coat=1.0)
COFFEE = mat("coffee", (0.05, 0.025, 0.012), 0.1)
PAPER = mat("paper", (0.95, 0.94, 0.9), 0.9)
COVER = mat("notebook_cover", (0.12, 0.22, 0.4), 0.55)
LEAF = mat("leaf", (0.06, 0.22, 0.07), 0.45)
POT = mat("pot", (0.85, 0.82, 0.76), 0.7)
SCREEN_BEZEL = mat("bezel", (0.02, 0.02, 0.025), 0.3)
H_CYAN = (0.1, 0.8, 1.0)
HOLO = holo_mat("holo_glass", H_CYAN, 2.0, 0.10)
HOLO_LINE = mat("holo_line", (0.2, 0.85, 1), 0.5, emit=H_CYAN, emit_str=6)
CODE_A = mat("code_a", (0.5, 0.9, 1), 0.5, emit=(0.4, 0.9, 1.0), emit_str=6)
CODE_B = mat("code_b", (0.9, 0.5, 1), 0.5, emit=(0.9, 0.45, 1.0), emit_str=5)
CODE_C = mat("code_c", (1, 0.8, 0.3), 0.5, emit=(1.0, 0.75, 0.25), emit_str=5)
CODE_D = mat("code_d", (0.7, 1, 0.7), 0.5, emit=(0.5, 1.0, 0.6), emit_str=5)

# ------------------------------------------------------------------ room
box("floor", (0, 0, -0.025), (9, 12, 0.05), FLOOR, bevel=0)
box("ceiling", (0, 0, 3.05), (9, 12, 0.1), WALL, bevel=0)
box("back_wall", (0, 3.3, 1.5), (9, 0.1, 3), WALL, bevel=0)
box("right_wall", (3.6, 0, 1.5), (0.1, 12, 3), WALL, bevel=0)
# left wall with window opening (y 0.3..3.25, z 0.55..2.75)
WX = -2.3
box("lw_bot", (WX, 0, 0.275), (0.12, 12, 0.55), WALL, bevel=0)
box("lw_top", (WX, 0, 2.9), (0.12, 12, 0.3), WALL, bevel=0)
box("lw_front", (WX, -2.9, 1.5), (0.12, 6.2, 3), WALL, bevel=0)
box("lw_back", (WX, 3.28, 1.5), (0.12, 0.1, 3), WALL, bevel=0)
for y in (0.3, 3.25):
    box("fr_v", (WX, y, 1.65), (0.16, 0.07, 2.2), FRAME, 0.01)
for y in (1.28, 2.26):
    box("mullion", (WX, y, 1.65), (0.1, 0.05, 2.2), FRAME, 0.01)
for z in (0.55, 2.75):
    box("fr_h", (WX, 1.78, z), (0.16, 3.0, 0.07), FRAME, 0.01)
box("fr_h2", (WX, 1.78, 1.7), (0.1, 3.0, 0.04), FRAME, 0.01)

# city backdrop (numpy generated skyline, blurred by DOF)
def make_city():
    W, H = 2048, 512
    a = np.zeros((H, W, 4), np.float32); a[..., 3] = 1
    t = np.linspace(0, 1, H)[:, None, None]            # row 0 = bottom
    a[..., :3] = np.array([0.78, 0.88, 1.0]) * (1 - t) + np.array([0.95, 0.97, 1.0]) * t
    rng = np.random.default_rng(3)
    for hmax, col in [(0.45, (0.72, 0.8, 0.9)), (0.33, (0.55, 0.64, 0.76)), (0.22, (0.38, 0.46, 0.58))]:
        x = 0
        while x < W:
            w = int(rng.integers(50, 150)); h = int(H * rng.uniform(0.08, hmax))
            c = np.array(col) * rng.uniform(0.9, 1.1)
            a[:h, x:x + w, :3] = c
            for wy in range(8, h - 6, 14):          # window grid
                for wx in range(x + 6, x + w - 6, 12):
                    if rng.random() < 0.8:
                        a[wy:wy + 6, wx:wx + 7, :3] = c * rng.uniform(1.05, 1.25) + 0.05
            x += w + int(rng.integers(0, 14))
    img = bpy.data.images.new("city", W, H, alpha=False); img.pixels.foreach_set(np.clip(a, 0, 1).ravel()); img.pack()
    return img
cm = bpy.data.materials.new("city"); cm.use_nodes = True
nt = cm.node_tree; nt.nodes.clear()
tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = make_city()
em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 1.1
o = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(tx.outputs[0], em.inputs["Color"]); nt.links.new(em.outputs[0], o.inputs[0])
bpy.ops.mesh.primitive_plane_add(size=1, location=(-30, 1.8, 4.5), rotation=(math.pi / 2, 0, -math.pi / 2))
city = bpy.context.object; city.name = "city"; city.scale = (70, 12, 1); city.data.materials.append(cm)
city.visible_shadow = False

# ------------------------------------------------------------------ desk, chair
DESK_Y0, DESK_Y1 = -0.35, 0.45
box("desk_top", (0, (DESK_Y0 + DESK_Y1) / 2, 0.735), (2.0, DESK_Y1 - DESK_Y0, 0.04), DESK, 0.012)
for sx in (-0.95, 0.95):
    box("desk_leg", (sx, 0.05, 0.36), (0.05, 0.7, 0.72), DESK, 0.01)
box("desk_back", (0, 0.4, 0.45), (1.9, 0.02, 0.5), DESK, 0.005)
# chair
cy = 0.78
box("seat", (0, cy, 0.46), (0.52, 0.5, 0.08), FABRIC, 0.03, seg=4)
box("backrest", (0, cy + 0.27, 0.92), (0.48, 0.07, 0.6), FABRIC, 0.03, rot=(-0.1, 0, 0), seg=4)
box("back_frame", (0, cy + 0.31, 0.92), (0.5, 0.02, 0.62), METAL, 0.01, rot=(-0.1, 0, 0))
cyl("gas_lift", (0, cy, 0.25), 0.03, 0.4, METAL)
for k in range(5):
    a = k * 2 * math.pi / 5 + 0.3
    c = Vector((math.cos(a), math.sin(a), 0)) * 0.2
    box("star_leg", (c.x, cy + c.y, 0.07), (0.4, 0.045, 0.035), DARK, 0.01, rot=(0, 0, a))
    ell("caster", (math.cos(a) * 0.36, cy + math.sin(a) * 0.36, 0.04), (0.035, 0.035, 0.035), DARK)

# ------------------------------------------------------------------ robot
HEAD = Vector((0.0, 0.76, 1.50))
for s in (-1, 1):   # legs
    hip = (s * 0.11, 0.78, 0.56); knee = (s * 0.12, 0.34, 0.55); ankle = (s * 0.12, 0.30, 0.12)
    limb("thigh", hip, knee, 0.075, WHITE); ell("knee", knee, (0.06,) * 3, DARK)
    limb("shin", knee, ankle, 0.062, WHITE); ell("ankle", ankle, (0.045,) * 3, METAL)
    ell("foot", (s * 0.12, 0.24, 0.07), (0.055, 0.12, 0.05), WHITE)
ell("pelvis", (0, 0.78, 0.62), (0.2, 0.15, 0.1), WHITE)
ell("waist", (0, 0.78, 0.72), (0.14, 0.11, 0.06), DARK)
ell("torso", (0, 0.78, 0.98), (0.19, 0.13, 0.26), WHITE)
ell("chest_panel", (0, 0.665, 1.03), (0.12, 0.03, 0.12), DARK)
ell("chest_core", (0, 0.645, 1.03), (0.04, 0.012, 0.04), EYE)
ell("chest_ring", (0, 0.652, 1.03), (0.075, 0.012, 0.075), METAL)
for i, z in enumerate((1.21, 1.245, 1.28)):   # segmented neck
    ell(f"neck{i}", (0, 0.77, z), (0.05 - i * 0.003, 0.05 - i * 0.003, 0.022), DARK if i % 2 == 0 else METAL)
# head (slight yaw toward the camera side)
yaw = math.radians(-14)
head_rot = (math.radians(4), 0, yaw)
def head_pt(x, y, z):   # head-local -> world
    v = Vector((x, y, z)); v.rotate(Euler((0, 0, yaw))); return HEAD + v
ell("head", HEAD, (0.155, 0.14, 0.158), WHITE, rot=head_rot)
ell("visor", head_pt(0, -0.055, 0.0), (0.126, 0.1, 0.105), VISOR, rot=head_rot)
for s in (-1, 1):
    ell("eye", head_pt(s * 0.047, -0.15, 0.012), (0.024, 0.01, 0.014), EYE, rot=head_rot)
    cyl("ear_disc", head_pt(s * 0.153, 0.0, 0.0), 0.04, 0.02, METAL, rot=(0, math.pi / 2, yaw))
    cyl("ear_light", head_pt(s * 0.164, 0.0, 0.0), 0.027, 0.014, EAR, rot=(0, math.pi / 2, yaw))
ell("head_crown", head_pt(0, 0.0, 0.14), (0.05, 0.05, 0.012), METAL, rot=head_rot)
for s in (-1, 1):   # arms + hands
    sh = (s * 0.27, 0.78, 1.14); el = (s * 0.33, 0.66, 0.86); wr = (s * 0.13, 0.40, 0.855)
    ell("shoulder_pad", (s * 0.255, 0.78, 1.17), (0.085, 0.085, 0.075), WHITE)
    ell("shoulder_joint", sh, (0.062,) * 3, DARK)
    limb("upper_arm", sh, el, 0.052, WHITE, 1.05); ell("elbow", el, (0.048,) * 3, METAL)
    limb("forearm", el, wr, 0.045, WHITE, 1.05)
    ell("wrist", wr, (0.036,) * 3, DARK)
    ell("cuff", Vector(wr) + Vector((0, 0.015, 0)), (0.042, 0.03, 0.042), METAL)
    palm = Vector((wr[0], 0.355, 0.84))
    box("palm", palm, (0.075, 0.07, 0.03), WHITE, 0.012, rot=(math.radians(12), 0, 0))
    for f in range(4):
        fx = wr[0] + (f - 1.5) * 0.019
        press = random.choice((0, 0.004))
        k0 = Vector((fx, 0.318, 0.845)); k1 = Vector((fx, 0.285, 0.82)); k2 = Vector((fx, 0.255, 0.798 - press)); k3 = Vector((fx, 0.235, 0.788 - press))
        ell("kn", k0, (0.011,) * 3, DARK)
        limb("f1", k0, k1, 0.0085, WHITE); ell("j", k1, (0.0092,) * 3, METAL)
        limb("f2", k1, k2, 0.0078, WHITE); ell("j", k2, (0.0085,) * 3, METAL)
        limb("f3", k2, k3, 0.0072, WHITE)
    t0 = Vector((wr[0] - s * 0.04, 0.37, 0.84)); t1 = Vector((wr[0] - s * 0.052, 0.335, 0.82)); t2 = Vector((wr[0] - s * 0.05, 0.305, 0.812))
    ell("tb", t0, (0.013,) * 3, DARK); limb("th1", t0, t1, 0.0105, WHITE); limb("th2", t1, t2, 0.0095, WHITE)

# ------------------------------------------------------------------ desk props
kb = Vector((0, 0.19, 0.765))
box("keyboard", kb, (0.46, 0.15, 0.016), KEYBASE, 0.006)
for r_ in range(5):
    for c_ in range(14):
        box("key", (kb.x - 0.2 + c_ * 0.0305, kb.y + 0.054 - r_ * 0.027, 0.775), (0.026, 0.023, 0.009), KEYS, 0.004, seg=2)
# monitor (right of robot, angled toward it and the camera)
mon = bpy.data.objects.new("monitor_root", None); bpy.context.collection.objects.link(mon)
mon.location = (1.0, 0.1, 0.0); mon.rotation_euler = (0, 0, math.radians(-32))
box("mon_base", (0, 0, 0.77), (0.28, 0.2, 0.02), DARK, 0.008, parent=mon)
box("mon_neck", (0, 0.04, 0.95), (0.05, 0.03, 0.34), DARK, 0.008, parent=mon)
box("mon_body", (0, 0.0, 1.17), (0.72, 0.03, 0.43), SCREEN_BEZEL, 0.012, parent=mon)
def make_screen():
    W, H = 1024, 600
    a = np.zeros((H, W, 4), np.float32); a[..., 3] = 1; a[..., :3] = (0.02, 0.05, 0.09)
    def rect(x0, y0, x1, y1, c): a[y0:y1, x0:x1, :3] = c
    rng = np.random.default_rng(5)
    rect(0, 0, W, 60, (0.05, 0.12, 0.2))
    for i in range(5): rect(30 + i * 90, 14, 100 + i * 90, 44, (0.2, 0.55, 0.8))
    for k in range(3): rect(30 + k * 330, 80, 330 + k * 330, 270, (0.06, 0.14, 0.24))
    for k in range(3):
        for b in range(10):
            h = int(rng.uniform(30, 150)); rect(50 + k * 330 + b * 26, 100, 70 + k * 330 + b * 26, 100 + h, (0.25, 0.75, 1.0) if b % 3 else (0.6, 0.5, 1.0))
    rect(30, 300, 660, 560, (0.05, 0.12, 0.2))
    xs = np.arange(60, 640); ys = (430 + 70 * np.sin(xs / 40.0) + 30 * np.sin(xs / 13.0)).astype(int)
    for x, y in zip(xs, ys): a[y - 3:y + 3, x, :3] = (0.2, 0.95, 0.8)
    rect(690, 300, 990, 560, (0.05, 0.12, 0.2))
    for i in range(7): rect(710, 320 + i * 34, 710 + int(rng.uniform(80, 260)), 338 + i * 34, (0.3, 0.7, 1.0))
    img = bpy.data.images.new("screen", W, H, alpha=False); img.pixels.foreach_set(np.clip(a, 0, 1).ravel()); img.pack(); return img
sm = bpy.data.materials.new("screen"); sm.use_nodes = True; nt = sm.node_tree; nt.nodes.clear()
tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = make_screen()
em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 1.6
oo = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(tx.outputs[0], em.inputs["Color"]); nt.links.new(em.outputs[0], oo.inputs[0])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.0165, 1.17), rotation=(math.pi / 2, 0, 0))
scr = bpy.context.object; scr.name = "screen"; scr.scale = (0.68, 0.39, 1); scr.data.materials.append(sm); scr.parent = mon
# mug, notebook, pen
cyl("mug", (-0.62, 0.0, 0.8), 0.045, 0.1, MUG, seg=48); cyl("coffee", (-0.62, 0.0, 0.845), 0.04, 0.004, COFFEE, seg=48)
torus("mug_handle", (-0.62 + 0.05, 0.0, 0.8), 0.026, 0.007, MUG, rot=(math.pi / 2, 0, 0))
box("notebook", (-0.42, 0.14, 0.77), (0.2, 0.28, 0.02), COVER, 0.006, rot=(0, 0, math.radians(14)))
box("notebook_pages", (-0.42, 0.14, 0.785), (0.185, 0.265, 0.012), PAPER, 0.002, rot=(0, 0, math.radians(14)))
cyl("pen", (-0.3, 0.02, 0.775), 0.005, 0.15, DARK, rot=(math.pi / 2, 0, math.radians(30)))
# plant in the foreground (defocused by DOF); skipped in the close-up
PX, PY = 0.3, -1.3
if CAM == "main":
  cyl("pot", (PX, PY, 0.22), 0.17, 0.44, POT)
  cyl("soil", (PX, PY, 0.44), 0.155, 0.02, DARK)
for k in range(16 if CAM == "main" else 0):
    a = k * 2.4 + random.uniform(-0.2, 0.2); tilt = random.uniform(0.35, 1.0); L = random.uniform(0.45, 0.8)
    base = Vector((PX, PY, 0.45)); d = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
    lf = ell("leaf", base + d * L / 2, (0.05, 0.008, L / 2), LEAF)
    lf.rotation_euler = d.to_track_quat("Z", "Y").to_euler()

# ------------------------------------------------------------------ holograms
def panel(name, loc, rot, w, h):
    root = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(root)
    root.location = loc; root.rotation_euler = rot
    bpy.ops.mesh.primitive_plane_add(size=1); p = bpy.context.object; p.name = name + "_glass"; p.scale = (w, h, 1)
    p.rotation_euler = (math.pi / 2, 0, 0); p.data.materials.append(HOLO); p.parent = root
    t = 0.004
    for (x, z, sx, sz) in ((0, h / 2, w, t), (0, -h / 2, w, t), (-w / 2, 0, t, h), (w / 2, 0, t, h)):
        box(name + "_edge", (x, 0, z), (sx, 0.002, sz), HOLO_LINE, 0, parent=root)
    return root

def text(body, loc, size, m, parent):
    bpy.ops.object.text_add(location=loc, rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = body; t.data.size = size; t.data.extrude = 0.0006
    t.data.align_x = "LEFT"; t.data.materials.append(m); t.parent = parent; return t

CODE = [
    ("def run_agent(task):", "B"), ("    plan = llm.plan(task)", "A"), ("    for step in plan.steps:", "B"),
    ("        result = tools.call(step)", "A"), ("        if result.ok:", "C"), ("            memory.save(result)", "A"),
    ("        else:  retry(step, 3)", "C"), ("    report = summarize(memory)", "A"), ("    return report", "B"), ("", ""),
    ("async function deploy() {", "B"), ("  const build = await ship()", "D"), ("  console.log(build.url)", "A"),
    ("  return status === 200", "D"), ("}", "B"),
]
holo = panel("holo_main", (0.30, -0.10, 1.08), (math.radians(-12), 0, math.radians(-10)), 0.64, 0.36)
cmap = {"A": CODE_A, "B": CODE_B, "C": CODE_C, "D": CODE_D}
for i, (ln, c) in enumerate(CODE):
    if ln: text(ln, (-0.28, 0.003, 0.15 - i * 0.0215), 0.0185, cmap[c], holo)
for i in range(len(CODE)):
    text(str(i + 1), (-0.305, 0.003, 0.15 - i * 0.0215), 0.012, HOLO_LINE, holo)
# side chart 1: bars + trend line
h2 = panel("holo_chart1", (0.98, 0.28, 1.58), (0, 0, math.radians(-30)), 0.34, 0.22)
for i, v in enumerate((0.3, 0.5, 0.4, 0.75, 0.6, 0.9)):
    box("bar", (-0.13 + i * 0.052, 0.002, -0.09 + v * 0.07), (0.028, 0.002, v * 0.14), HOLO_LINE, 0, parent=h2)
cv = bpy.data.curves.new("trend", "CURVE"); cv.dimensions = "3D"; cv.bevel_depth = 0.0025
sp = cv.splines.new("POLY"); sp.points.add(5)
for i, v in enumerate((0.35, 0.55, 0.45, 0.8, 0.7, 0.95)): sp.points[i].co = (-0.13 + i * 0.052, 0.004, -0.04 + v * 0.1, 1)
cvo = bpy.data.objects.new("trend", cv); bpy.context.collection.objects.link(cvo); cvo.data.materials.append(CODE_D); cvo.parent = h2
# side chart 2: donut + legend
h3 = panel("holo_chart2", (-0.95, 0.55, 1.45), (0, 0, math.radians(28)), 0.3, 0.26)
torus("ring1", (-0.05, 0.003, 0.0), 0.075, 0.007, HOLO_LINE, rot=(math.pi / 2, 0, 0), parent=h3)
torus("ring2", (-0.05, 0.003, 0.0), 0.05, 0.005, CODE_B, rot=(math.pi / 2, 0, 0), parent=h3)
for i in range(4): box("leg", (0.09, 0.002, 0.07 - i * 0.04), (0.07 - i * 0.012, 0.002, 0.012), CODE_A if i % 2 else HOLO_LINE, 0, parent=h3)

# ------------------------------------------------------------------ lights / world
w = bpy.data.worlds.new("w"); scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.65, 0.78, 1.0, 1); bg.inputs[1].default_value = 0.15
d = Vector((1, 0.28, -0.5)).normalized()
bpy.ops.object.light_add(type="SUN", location=(-6, 0, 5)); sun = bpy.context.object
sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); sun.data.energy = 3.0; sun.data.angle = math.radians(1.2); sun.data.color = (1.0, 0.95, 0.88)
bpy.ops.object.light_add(type="AREA", location=(WX - 0.3, 1.8, 1.65)); wl = bpy.context.object
wl.data.shape = "RECTANGLE"; wl.data.size = 3.0; wl.data.size_y = 2.1; wl.data.energy = 250; wl.data.color = (0.85, 0.92, 1.0)
wl.rotation_euler = (0, math.radians(-90), 0)      # faces +X, into the room
bpy.ops.object.light_add(type="AREA", location=(1.8, -2.2, 2.5)); fl = bpy.context.object   # soft fill from the camera side
fl.data.size = 3; fl.data.energy = 120; fl.data.color = (1, 0.96, 0.92)
fl.rotation_euler = (math.radians(55), 0, math.radians(20))
bpy.ops.object.light_add(type="POINT", location=(0.3, -0.35, 1.0)); hl = bpy.context.object  # cyan glow from hologram
hl.data.energy = 25; hl.data.color = (0.3, 0.8, 1.0); hl.data.shadow_soft_size = 0.2
bpy.ops.object.light_add(type="AREA", location=(-0.4, 2.8, 2.6)); rl = bpy.context.object   # rim from behind
rl.data.size = 1.5; rl.data.energy = 60; rl.rotation_euler = (math.radians(-50), 0, 0)

for _o in (sun, wl, fl, hl, rl): _o.visible_camera = False
# ------------------------------------------------------------------ camera
loc, tgt, lens, fstop = CAMERAS[CAM]
cam = bpy.data.cameras.new("cam"); co = bpy.data.objects.new("cam", cam); bpy.context.collection.objects.link(co)
co.location = loc; cam.lens = lens; scene.camera = co
tgt_e = bpy.data.objects.new("tgt", None); bpy.context.collection.objects.link(tgt_e); tgt_e.location = tgt
tc = co.constraints.new("TRACK_TO"); tc.target = tgt_e; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
foc = bpy.data.objects.new("focus", None); bpy.context.collection.objects.link(foc); foc.location = FOCUS[CAM]
cam.dof.use_dof = True; cam.dof.focus_object = foc; cam.dof.aperture_fstop = fstop

# ------------------------------------------------------------------ render settings
r = scene.render; r.resolution_x, r.resolution_y = RES[PRESET]; r.resolution_percentage = 100
r.image_settings.file_format = "PNG"; r.image_settings.color_depth = "8"
scene.view_settings.view_transform = "AgX"; scene.view_settings.exposure = -0.4
try: scene.view_settings.look = "AgX - Medium High Contrast"
except Exception: pass
if ENGINE == "cycles":
    r.engine = "CYCLES"; c = scene.cycles; c.samples = SAMPLES[PRESET]; c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"; c.max_bounces = 6; c.diffuse_bounces = 3; c.glossy_bounces = 4
    c.transparent_max_bounces = 8; c.sample_clamp_indirect = 8; c.caustics_reflective = False; c.caustics_refractive = False
    if DEVICE == "hip":
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = "HIP"; pr.refresh_devices()
        for dv in pr.devices: dv.use = dv.type == "HIP"
        c.device = "GPU"
else:
    r.engine = "BLENDER_EEVEE_NEXT"; e = scene.eevee; e.taa_render_samples = SAMPLES[PRESET]
    e.use_raytracing = True; e.use_shadows = True
# compositor: soft bloom / glare for the glowing parts
scene.use_nodes = True; ct = scene.node_tree; ct.nodes.clear()
rl_n = ct.nodes.new("CompositorNodeRLayers"); gl = ct.nodes.new("CompositorNodeGlare"); cp = ct.nodes.new("CompositorNodeComposite")
gl.glare_type = "FOG_GLOW"; gl.threshold = 1.2; gl.quality = "HIGH"; gl.size = 7; gl.mix = -0.5
ct.links.new(rl_n.outputs["Image"], gl.inputs["Image"]); ct.links.new(gl.outputs["Image"], cp.inputs["Image"])

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RENDERS, "robot-office.blend"))
r.filepath = os.path.join(RENDERS, f"{OUT}.png")
t0 = time.time(); bpy.ops.render.render(write_still=True)
print(f"RENDER_DONE engine={ENGINE} preset={PRESET} cam={CAM} samples={SAMPLES[PRESET]} seconds={time.time()-t0:.1f}")
