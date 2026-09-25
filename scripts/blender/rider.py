# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE RIDER MODELLED IN BLENDER off the game's own data: his body
# (`BODY`), the pose he is bound in and every bone's frame in it
# (`rider-rig.ts`'s `RIDING` and `riderBones`), a grid slot's kit
# (`SLED_STYLES`), the helmet's MEASURED shell sampled on a grid
# (`rider-helmet.ts`'s `helmetReach` and `helmetPart`), and every clip
# sampled off the game's own `riderPose` — handed in as one JSON file by
# `scripts/blender.mjs --kind=rider`, the driver and the only way this runs.
#
# The frame: the sled's body frame (x right, y up, z forward, the origin
# at the machine's centre of gravity) laid as Blender's (-x, z, y) — a
# turn, not a mirror — so he faces +y as a modelled sled does, and the
# lab's one half turn about y sets both in the game's frame. His sides are
# the ENGINE's (`_l` is the body frame's x negative, the pose's index 0).
#
# He is one SUIT that bends — a skin laid over the joints of the riding
# pose (Blender's skin modifier, subdivided: a padded winter suit is what a
# skinned hull looks like), weighted across each joint between the two
# bones that meet there — and what does not bend rides one bone wholly: the
# helmet (the head), the boots (the boot; the shaft the shin), the gloves
# (the forearm). The bones are the game's spans (`riderBones`), so the
# game's pose drives him bone for bone, and the clips are that pose played.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
STYLE, POSE, FRAMES, HELM = DATA["style"], DATA["rest"]["pose"], DATA["rest"]["bones"], DATA["helmet"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def colour(hexa):
    """A kit's sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
JACKET = mat("jacket", colour(STYLE["jacket"]), rough=0.62)
ACCENT = mat("accent", colour(STYLE.get("accent", STYLE["jacket"])), rough=0.6)
PANTS = mat("pants", colour(STYLE["pants"]), rough=0.8)
GLOVE = mat("glove", colour(0x17191D), rough=0.7)
BOOT = mat("boot", colour(0x121316), rough=0.55, coat=0.2)
SOLE = mat("sole", colour(0x2A2C30), rough=0.9)
HELMET = mat("helmet", colour(STYLE["helmet"]), rough=0.25, coat=1.0)
PEAK = mat("peak", colour(STYLE.get("peak", STYLE["helmet"])), rough=0.3, coat=1.0)
LENS = mat("lens", colour(STYLE["visor"]), metal=0.7, rough=0.08)
STRAP = mat("strap", colour(0x101114), rough=0.7)


# ---------------------------------------------------------------- the RIG
def frame(name):
    f = FRAMES[name]
    return B(f["head"]), B(f["x"]), B(f["y"]), B(f["z"]), f["length"]


for name in FRAMES:
    head, _, y, z, length = frame(name)
    bone(name, head, head + y * length, roll_to=z)

SEGMENTS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4]) for n in FRAMES}
NEAR = {"spine": ["head", "thigh_l", "thigh_r", "upperarm_l", "upperarm_r"], "head": ["spine"]}
for s in "lr":
    NEAR |= {f"thigh_{s}": ["spine", f"shin_{s}"], f"shin_{s}": [f"thigh_{s}", f"boot_{s}"],
             f"boot_{s}": [f"shin_{s}"], f"upperarm_{s}": ["spine", f"forearm_{s}"],
             f"forearm_{s}": [f"upperarm_{s}"]}


def along(co, seg):
    """How far along a segment the point is (0..1), and how far off it, m."""
    a, b = seg
    d = b - a
    t = max(0.0, min(1.0, (co - a).dot(d) / d.length_squared))
    return t, (co - (a + d * t)).length


def nearest(co, among=None):
    return min(among or SEGMENTS, key=lambda n: along(co, SEGMENTS[n])[1])


def suit_weights(co):
    """Across a joint, shared between the bones that meet there by how much
    nearer each is — 4 cm makes the difference between half and a third."""
    b0 = nearest(co, [n for n in SEGMENTS if not n.startswith("boot")])
    d0 = along(co, SEGMENTS[b0])[1]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / 0.04) for n in [b0] + NEAR[b0]}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:3]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


# ---------------------------------------------------------------- the SUIT
P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]

# The skeleton the skin is laid over: a point, its radii across (m) and
# what it joins. The torso is broad and a little flatter front to back; the
# jacket's collar stands up round the helmet's rim; the pants bag at the
# thigh and flare over the boot; the sleeves bunch at the cuff.
pts, radii, edges = [], [], []


def pt(p, r):
    pts.append(p)
    radii.append(r if isinstance(r, tuple) else (r, r))
    return len(pts) - 1


h = pt(hips, (0.18, 0.14))
s1 = pt(hips.lerp(neck, 0.35), (0.2, 0.15))
s2 = pt(hips.lerp(neck, 0.7), (0.22, 0.15))
n = pt(neck, (0.16, 0.13))
c = pt(neck.lerp(head_c, 0.42), (0.085, 0.085))
edges += [(h, s1), (s1, s2), (s2, n), (n, c)]
for i in range(2):
    hip = frame(("thigh_l", "thigh_r")[i])[0]
    j0 = pt(hip, 0.11)
    j1 = pt(hip.lerp(knees[i], 0.5), 0.1)
    j2 = pt(knees[i], 0.085)
    j3 = pt(knees[i].lerp(feet[i], 0.55), 0.075)
    j4 = pt(knees[i].lerp(feet[i], 0.86), 0.085)
    edges += [(h, j0), (j0, j1), (j1, j2), (j2, j3), (j3, j4)]
    a0 = pt(shoulders[i], 0.1)
    a1 = pt(shoulders[i].lerp(elbows[i], 0.5), 0.078)
    a2 = pt(elbows[i], 0.072)
    a3 = pt(elbows[i].lerp(hands[i], 0.45), 0.068)
    a4 = pt(elbows[i].lerp(hands[i], 0.72), 0.072)
    edges += [(n, a0), (a0, a1), (a1, a2), (a2, a3), (a3, a4)]

rides("spine")
me = bpy.data.meshes.new("suit")
me.from_pydata([tuple(p) for p in pts], edges, [])
suit = link(bpy.data.objects.new("suit", me))
skin = suit.modifiers.new("skin", "SKIN")
skin.use_smooth_shade = True
for i, r in enumerate(radii):
    sv = me.skin_vertices[0].data[i]
    sv.radius = r
    sv.use_root = i == h
subd = suit.modifiers.new("smooth", "SUBSURF")
subd.levels = subd.render_levels = 1 if GAME else 2
# A skin's hull is a box a section; smoothed, the jacket rounds over the
# shoulders and the back instead of reading as a crate from behind.
rounder = suit.modifiers.new("round", "SMOOTH")
rounder.factor, rounder.iterations = 0.5, 3 if GAME else 6
bpy.context.view_layer.objects.active = suit
for o in bpy.context.view_layer.objects:
    o.select_set(o is suit)
bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
for m in (JACKET, ACCENT, PANTS):
    suit.data.materials.append(m)

# Where one colour meets the next is a PLANE, and the suit is cut along
# each before it is coloured, so every colour stops on a clean line rather
# than on the stair of the faces it was laid in: the jacket's hem square
# to the spine over the hips, the yoke under the collar, the cuffs square
# to each forearm.
UP = (neck - hips).normalized()
HEM = (hips + UP * 0.07, UP)
YOKE = (neck - UP * 0.09, UP)
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.8,
          frame(f"forearm_{s}")[2]) for s in "lr"]
bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in [HEM, YOKE] + CUFFS:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def cloth_of(co):
    """What the suit is where: the pants below the jacket's hem, the
    jacket's yoke and collar in the kit's second colour, and its cuffs."""
    b = nearest(co)
    if b.startswith(("shin", "boot")) or (b.startswith("thigh") or b == "spine") and not above(co, HEM):
        return 2
    if b in ("head", "spine") or b.startswith("upperarm"):
        return 1 if above(co, YOKE) else 0
    if b.startswith("forearm") and above(co, CUFFS["lr".index(b[-1])]):
        return 1
    return 0


suit.data.polygons.foreach_set("material_index", [cloth_of(p.center) for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)

# ---------------------------------------------------------------- the HELMET
# The measured shell (`helmetReach`, sampled round from dead behind and up
# from the chin), in the head's frame tipped nose-down as it is worn and
# sat up on the head (`HELMET_TILT`, `HELMET_SIT`); cut where the game's is
# cut (the neck), the goggles' lens in the port, the cap in the peak's
# colour and the goggle strap round the back at the port's height.
hc, hx, hy, hz, _ = frame("head")
tilt = HELM["tilt"]
STEP = 3 if GAME else 1
NA, NE = HELM["around"] // STEP, HELM["up"] // STEP


def worn(a, e, r):
    x, y, z = math.sin(a) * math.cos(e) * r, math.sin(e) * r, math.cos(a) * math.cos(e) * r
    y, z = y * math.cos(tilt) - z * math.sin(tilt), y * math.sin(tilt) + z * math.cos(tilt)
    return hc + hy * HELM["sit"] + hx * x + hy * y + hz * z


def ang(i, j):
    return -math.pi + 2 * math.pi * i / NA, -math.pi / 2 + math.pi * j / NE


rides("head")
def part_at(i, j):
    """What the shell is in cell (i, j) of this grid: the sampled cell at its middle."""
    return HELM["part"][j * STEP + STEP // 2][i * STEP + STEP // 2]


port_e = [ang(0, j + 0.5)[1] for j in range(NE) for i in range(NA) if part_at(i, j) == "port"]
strap_e = sum(port_e) / len(port_e) if port_e else 0.1
verts = [worn(*ang(i, j), HELM["reach"][j * STEP][i * STEP]) for j in range(NE + 1) for i in range(NA)]
faces, fm = [], []
for j in range(NE):
    for i in range(NA):
        part = part_at(i, j)
        if part == "neck":
            continue
        a, e = ang(i + 0.5, j + 0.5)
        if part == "port":
            m = 3
        elif part == "cap":
            m = 1
        elif abs(e - strap_e) < 0.07 and abs(a) > 1.9:
            m = 2
        else:
            m = 0
        i1 = (i + 1) % NA
        faces.append([j * NA + i, (j + 1) * NA + i, (j + 1) * NA + i1, j * NA + i1])
        fm.append(m)
shell = mesh_obj("helmet", verts, faces, [HELMET, PEAK, STRAP, LENS], fm)
if not GAME:     # a rim to the neck's opening; the game never sees under it
    shell.modifiers.new("thick", "SOLIDIFY").thickness = -0.012

# ---------------------------------------------------------------- BOOTS and GLOVES
for i, s in enumerate("lr"):
    f, bx, by, bz, _ = frame(f"boot_{s}")
    turn = Matrix((bx, by, bz)).transposed().to_euler()
    rides(f"boot_{s}")
    box("sole", f + by * 0.045 + bz * -0.045, (0.13, 0.31, 0.03), SOLE, rot=turn, bevel=0.008)
    ellipsoid("boot_foot", f + by * 0.055 + bz * -0.005, (0.068, 0.155, 0.058), BOOT, rot=turn)
    ellipsoid("boot_toe", f + by * 0.16 + bz * -0.02, (0.06, 0.05, 0.04), BOOT, rot=turn)
    rides(f"shin_{s}")
    up_shin = (knees[i] - feet[i]).normalized()
    cyl("boot_shaft", f + bz * -0.02, f + up_shin * 0.24, 0.072, BOOT, r2=0.08)
    rides(f"forearm_{s}")
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    turn = Matrix((fx, fy, fz)).transposed().to_euler()
    cyl("gauntlet", e + fy * (fl * 0.6), e + fy * (fl * 0.86), 0.085, GLOVE, r2=0.058)
    ellipsoid("fist", e + fy * (fl * 0.97), (0.05, 0.062, 0.048), GLOVE, rot=turn)


# ---------------------------------------------------------------- the CLIPS
# Every clip is the game's pose sampled: each frame every bone's frame,
# set as its matrix and keyed.
def keyed(frames):
    def at(t):
        f = frames[min(len(frames) - 1, round(t * lib.FPS))]
        out = {}
        for name, fr in f.items():
            head, x, y, z = B(fr["head"]), B(fr["x"]), B(fr["y"]), B(fr["z"])
            m = Matrix((x, y, z)).transposed().to_4x4()
            m.translation = head
            out[name] = {"matrix": m}
        return out
    return at


for c in DATA["clips"]:
    clip(c["name"], c["seconds"], keyed(c["frames"]))

# ---------------------------------------------------------------- the STUDIO
floor = min(f.z for f in feet) - 0.06
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, hips.y + 0.1, floor + 0.55), size=3.0, floor=floor, extras={"frame": "body"})
