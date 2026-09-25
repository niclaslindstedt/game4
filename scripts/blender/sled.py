# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# A SLED MODELLED IN BLENDER off the game's own data: the spec
# (engine/game/defs/sled.ts) and its class's traced look
# (pwa/src/game/sled-looks.ts), handed in as one JSON file by
# `scripts/blender.mjs --kind=sled` — the driver, and the only way this runs.
#
# The frame is the TRACE's: Blender x to the right, y forward from the
# tunnel's end (the trace's z), z up from the snow (the trace's y). glTF
# turns that to y up and forward on -z; the sled lab's asset sheet turns it
# back and sets it on the spec with `lookFrame`, as the builder sets a trace.
# THE RIG (lib.py's): the DRIVERS are what the game poses off the engine's
# readings as it poses its own machine (`sled-gear.ts`, `sled-body.ts`) —
# `bars` (turned about the post), `ski_l` / `ski_r` (lifted by their
# compression, turned about the spindle), `track` (lifted by the rear's) and
# the wheels (turned as the belt runs); every A-arm, coil-over, tie rod and
# rear arm is a LINKAGE laid from the chassis to its marker on the part it
# meets. `_l` is the rider's left in THIS frame (x negative). The clips run
# the game's own travel and turn (`TRAVEL`, `BAR_TURN`, handed in as `gear`)
# and the spec's lock; `belt_run` moves the lugs one pitch round the belt a
# second (the root's `beltRunMetres`), so a game plays it at speed / that.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
SPEC, LOOK, GEAR = DATA["spec"], DATA["look"], DATA["gear"]

# ---------------------------------------------------------------- materials
PAINT = mat("paint", (0.62, 0.02, 0.015), rough=0.28, coat=1.0)
BLACK = mat("black_plastic", (0.018, 0.018, 0.02), rough=0.45, coat=0.3)
MATTE = mat("matte_black", (0.01, 0.01, 0.011), rough=0.8)
WHITE = mat("white", (0.85, 0.86, 0.88), rough=0.3, coat=1.0)
ALU = mat("aluminium", (0.82, 0.82, 0.84), metal=1.0, rough=0.28)
TUNNEL = mat("tunnel", (0.1, 0.1, 0.11), metal=0.85, rough=0.42)
RUBBER = mat("rubber", (0.012, 0.012, 0.013), rough=0.85)
SEAT_MAT = mat("seat", (0.025, 0.025, 0.03), rough=0.6, sheen=0.4)
GLASS = mat("screen", (0.25, 0.28, 0.3), rough=0.03, glass=True)
LAMP = mat("lamp", (0.9, 0.9, 0.95), rough=0.05, emit=(0.9, 0.95, 1.0), emit_str=25.0)
TAIL = mat("taillight", (0.5, 0.0, 0.0), rough=0.2, emit=(1.0, 0.02, 0.01), emit_str=4.0)
STEEL = mat("steel", (0.55, 0.55, 0.57), metal=1.0, rough=0.2)
SPRING = mat("spring", (0.85, 0.72, 0.02), metal=0.3, rough=0.3, coat=0.5)
GAUGE = mat("gauge", (0.02, 0.03, 0.05), rough=0.1, emit=(0.2, 0.5, 0.9), emit_str=1.5)

# ---------------------------------------------------------------- the TRACE
def P(p):
    return float(p[0]), float(p[1])

def by_z(points):
    return sorted((P(p) for p in points), key=lambda p: p[0])

L = LOOK
TW = L["tunnelWidth"] / 2
STANCE = SPEC["skiStance"]

# ---------------------------------------------------------------- the COWL
# The traced outline runs from the nose over the hood to the dash, down the
# side panel and forward along the belly: split at its rearmost point into
# the top and the belly. The belly keeps its cutout over the front
# suspension, so the spindles and arms stand in the open under it.
hood = [P(p) for p in L["hood"]]
rear_i = min(range(len(hood)), key=lambda i: (hood[i][0], hood[i][1]))
HOOD_TOP = by_z(hood[: rear_i + 1])
HOOD_BOT = by_z(hood[rear_i:])
Z0 = max(HOOD_TOP[0][0], HOOD_BOT[0][0])
Z1 = min(HOOD_TOP[-1][0], HOOD_BOT[-1][0]) - 0.002
LEN = Z1 - Z0

def hood_w(z):
    """The cowl's half width: the class's hood width at the dash, a V in plan to the nose."""
    t = (z - Z0) / LEN
    half, tip = L["hoodWidth"] / 2, L["noseWidth"] * 0.3
    w = half - (half - tip) * t ** 1.5
    return w * (1 - 0.3 * max(0.0, (t - 0.9) / 0.1) ** 2)

# The cross-section as a CAGE: half a section from the belly's centre round
# to the crown (x a share of the half width, v of the half height), mirrored.
# The SHOULDER is creased, so the subdivision keeps a hard character line
# down each flank; the paint stops at it and a stripe rides just above it.
KEYS = [(0.0, -1.0), (0.55, -1.0), (0.86, -0.9), (1.0, -0.5), (1.0, 0.0), (0.985, 0.09),
        (0.93, 0.35), (0.72, 0.74), (0.36, 0.88), (0.0, 1.0)]
SHOULDER, UPPER, BROW = 4, 6, 7
HALF = len(KEYS)
RING = KEYS + [(-x, v) for x, v in reversed(KEYS[1:-1])]
M = len(RING)

def section(z):
    top, bot = interp(HOOD_TOP, z), interp(HOOD_BOT, z)
    w, mid, h = hood_w(z), (top + bot) / 2, (top - bot) / 2
    t = (z - Z0) / LEN
    pts = []
    for x, v in RING:
        crown = 1 - 0.42 * max(v, 0) * t ** 1.3   # the nose narrows to a ridge over the top
        pts.append(Vector((x * w * crown, z, mid + v * h)))
    return pts

def cowl_face(j):
    k = j if j < HALF - 1 else M - 1 - j      # the left half's bands onto the right's
    return 1 if k < SHOULDER else (2 if k == SHOULDER else 0)

STATIONS = [Z0 + LEN * (1 - (1 - i / 17) ** 1.5) for i in range(18)]
cage = [section(z) for z in STATIONS]
verts = [v for r in cage for v in r]
faces, fm = [], []
for i in range(len(cage) - 1):
    a, b = i * M, (i + 1) * M
    for j in range(M):
        faces.append([a + j, a + (j + 1) % M, b + (j + 1) % M, b + j])
        fm.append(cowl_face(j))
for ring_i in (0, len(cage) - 1):
    base = ring_i * M
    c = sum((verts[base + j] for j in range(M)), Vector()) / M
    ci = len(verts)
    verts.append(c)
    for j in range(M):
        faces.append([base + j, base + (j + 1) % M, ci])
        fm.append(cowl_face(j) if ring_i else 1)
cowl = mesh_obj("cowl", verts, faces, [PAINT, BLACK, WHITE], fm)
bm = bmesh.new()
bm.from_mesh(cowl.data)
crease = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
for e in bm.edges:
    ia, ib = sorted(v.index for v in e.verts)
    if ib - ia == M and ib < len(cage) * M:
        k = ia % M
        k = k if k < HALF else M - k
        e[crease] = {SHOULDER: 1.0, BROW: 0.7, HALF - 1: 0.6}.get(k, 0.0)
bm.to_mesh(cowl.data)
bm.free()
sub = cowl.modifiers.new("smooth", "SUBSURF")
sub.levels = 1 if GAME else 2
sub.render_levels = 1 if GAME else 3

# The lamps: a housing on each upper shoulder that rises out of the hood and
# grows taller toward the nose, ending in a lens that faces forward, proud of
# the cowl — a pod, not a decal (a lens shrinkwrapped onto the hood reads as
# sunk into it).
LAMP_Z = [Z1 - LEN * f for f in (0.338, 0.246, 0.172, 0.116, 0.079, 0.056)]
for sx in (-1, 1):
    rings = []
    for i, z in enumerate(LAMP_Z):
        u = i / (len(LAMP_Z) - 1)
        a, b = (Vector((sx * abs(q.x), q.y, q.z)) for q in (section(z)[UPPER], section(z)[BROW]))
        n = Vector((sx, 0.0, 0.7)).normalized()
        lift = n * (0.008 + 0.05 * u ** 1.3) + Vector((0, 0.012 * u, 0))
        inset = -n * 0.015
        rings.append([a + inset, b + inset, b + lift + Vector((-sx * 0.006, 0, 0.004)), a + lift])
    pod = loft("lamp_pod", rings, [MATTE, LAMP], smooth=False,
               face_mat=lambda c: 1 if c.y > LAMP_Z[-1] - 0.002 else 0)
    bev = pod.modifiers.new("bevel", "BEVEL")
    bev.width = 0.004
    bev.segments = 1

# The intake under the nose, and slats in the lower flank's vent.
zi = Z1 - 0.03 * LEN
box("intake", (0, zi, interp(HOOD_BOT, zi) + 0.01), (L["noseWidth"] * 0.5, 0.02, 0.06), MATTE,
    rot=(math.radians(-40), 0, 0), bevel=0.006)
for sx in (-1, 1):
    for i in range(4):
        z = Z0 + LEN * (0.275 + 0.05 * i)
        c = section(z)[3].lerp(section(z)[SHOULDER], 0.55)
        box("vent_slat", (sx * (abs(c.x) + 0.004), z, c.z), (0.008, 0.03, 0.12), MATTE,
            rot=(math.radians(-25), 0, 0), bevel=0.002)

# The bumper: a loop round the nose.
bw, zb = L["bumperWidth"] / 2, Z1 - 0.1
yb = interp(HOOD_BOT, zb) - 0.01
tube("bumper", [(-bw * 0.84, zb, yb), (-bw * 0.94, Z1 + 0.014, yb + 0.03), (-bw * 0.52, Z1 + 0.1, yb + 0.055),
                (bw * 0.52, Z1 + 0.1, yb + 0.055), (bw * 0.94, Z1 + 0.014, yb + 0.03), (bw * 0.84, zb, yb)],
     0.013, ALU, smooth_n=6)

def cowl_top(x, z):
    """The cowl cage's upper surface at (x, z): the section's crown half read across."""
    ring = section(z)[SHOULDER:HALF]              # the flank's shoulder in to the crown
    xs = [(abs(q.x), q.z) for q in reversed(ring)]
    return interp(xs, min(abs(x), xs[-1][0]))

# The windscreen (none on a mountain or a race sled), off its four traced
# corners: the front edge from the base up to the top, the side edge from
# the foot up to the back. Across it the glass wraps from the front edge on
# the centreline round to the side edge at each end, and its lower edge sits
# on the cowl — a touring screen's tall wings reach back past the bars.
scr = L.get("screen")
if scr:
    base, top, foot, back = (Vector(P(scr[k])) for k in ("base", "top", "foot", "back"))
    hw = scr["width"] / 2
    across = [-1 + 2 * j / 16 for j in range(17)]
    seat_dy = {}
    for sgn in across:
        z, y = base.lerp(foot, sgn * sgn)
        seat_dy[sgn] = cowl_top(sgn * hw, z) - 0.006 - y
    rows = []
    for i in range(9):
        u = i / 8
        front, side = base.lerp(top, u), foot.lerp(back, u)
        row = []
        for sgn in across:
            z, y = front.lerp(side, sgn * sgn)
            row.append(Vector((sgn * hw * (1 - 0.06 * u), z, y + seat_dy[sgn] * (1 - u) + 0.012 * u * (1 - sgn * sgn))))
        rows.append(row)
    wind = loft("windscreen", rows, [GLASS], closed=False, cap=False)
    wind.modifiers.new("thick", "SOLIDIFY").thickness = 0.005
    tube("screen_trim", rows[0], 0.006, MATTE)
    tube("screen_edge", [r[0] for r in rows] + rows[-1][1:-1] + [r[-1] for r in reversed(rows)], 0.004, MATTE)

# The mirrors (a touring or a work sled's, traced): a stalk off the screen's
# side up to a housing with its glass facing back.
if L.get("mirror"):
    (m0z, m0y), (m1z, m1y) = (P(p) for p in L["mirror"])
    x = (scr["width"] / 2 if scr else 0.3) + 0.06
    for sx in (-1, 1):
        tube("mirror_stalk", [(sx * (x - 0.07), m1z, m1y), (sx * x, (m0z + m1z) / 2, m0y - 0.03), (sx * x, m0z, m0y)],
             0.008, MATTE, smooth_n=3)
        ellipsoid("mirror", (sx * (x + 0.02), m0z, m0y + 0.02), (0.06, 0.02, 0.04), BLACK)
        box("mirror_glass", (sx * (x + 0.02), m0z - 0.018, m0y + 0.02), (0.1, 0.004, 0.065), ALU, bevel=0.002)

# A race sled's number plates: one on each upper flank of the cowl and one
# on the nose ahead of the lamps — patches laid on the cage, so a plate
# follows the panel's curve rather than cutting through it.
def ring_at(z, t):
    """The cage's section at z, a fractional index t along the right half."""
    sec, i = section(z), min(int(t), HALF - 2)
    q = sec[i].lerp(sec[i + 1], t - i)
    return Vector((abs(q.x), q.y, q.z))

def patch(name, grid, m):
    p = loft(name, grid, [m], closed=False, cap=False)
    p.modifiers.new("thick", "SOLIDIFY").thickness = 0.004

if L.get("plates"):
    zp = Z0 + LEN * 0.4
    for sx in (-1, 1):
        grid = []
        for i in range(7):
            z = zp - 0.15 + 0.3 * i / 6
            row = [ring_at(z, 4.25 + 1.5 * j / 6) + Vector((0.008, 0, 0.002)) for j in range(7)]
            grid.append([Vector((sx * q.x, q.y, q.z)) for q in row])
        patch("race_plate", grid, WHITE)
    zn = Z1 - LEN * 0.2
    patch("race_plate_nose", [[Vector((x, z, cowl_top(x, z) + 0.006)) for x in (-0.12 + 0.24 * j / 8 for j in range(9))]
                              for z in (zn - 0.08 + 0.16 * i / 6 for i in range(7))], WHITE)

# ---------------------------------------------------------------- the BARS
gz, gy = P(L["grip"])
pz, py = P(L["post"])
hb = L["barWidth"] / 2
zd = pz + 0.23
box("dash", (0, zd, interp(HOOD_TOP, zd) + 0.002), (0.26, 0.10, 0.05), BLACK, rot=(math.radians(-18), 0, 0))
box("gauge", (0, zd - 0.005, interp(HOOD_TOP, zd) + 0.03), (0.13, 0.07, 0.006), GAUGE,
    rot=(math.radians(-38), 0, 0), bevel=0.002)
rz, ry = gz + 0.023, gy - 0.045
rides(bone("bars", (0, pz, py), (0, rz, ry)))
tube("post", [(0, pz, py), (0, (pz + rz) / 2, (py + ry) / 2 - 0.01), (0, rz, ry)], 0.017, ALU)
cyl("post_cover", (0, pz + 0.004, py - 0.04), (0, rz + 0.007, ry - 0.03), 0.042, BLACK, r2=0.028)
box("riser", (0, rz, ry + 0.008), (0.08, 0.05, 0.035), BLACK)
bar = [(s * hb, gz - 0.017 + dz, gy + dy) for s, dz, dy in
       ((-1, 0, 0), (-0.757, 0.013, -0.005), (-0.46, 0.035, -0.027), (0, 0.045, -0.035),
        (0.46, 0.035, -0.027), (0.757, 0.013, -0.005), (1, 0, 0))]
tube("handlebar", bar, 0.011, ALU, smooth_n=6)
if L.get("handle"):
    # A mountain sled's loop over the bar's middle, to haul it about by.
    hw, hh = L["handle"]["width"] / 2, L["handle"]["height"]
    tube("mountain_handle", [(-hw, gz + 0.02, gy - 0.03), (-hw * 0.8, gz + 0.03, gy - 0.03 + hh),
                             (hw * 0.8, gz + 0.03, gy - 0.03 + hh), (hw, gz + 0.02, gy - 0.03)], 0.011, ALU, smooth_n=4)
tube("bar_brace", [(-hb * 0.38, gz + 0.023, gy - 0.022), (hb * 0.38, gz + 0.023, gy - 0.022)], 0.009, ALU)
for sx in (-1, 1):
    end = Vector((sx * hb, gz - 0.017, gy))
    cyl("grip", (sx * hb * 0.716, gz - 0.004, gy - 0.005), end + Vector((sx * 0.005, 0, 0)), 0.018, RUBBER)
    cyl("bar_end", end + Vector((sx * 0.005, 0, 0)), end + Vector((sx * 0.02, 0, 0)), 0.02, ALU)
    # The hand guard: a curved band from the bar end round in front of the knuckles.
    path = catmull([end + Vector((sx * 0.02, 0, 0)), end + Vector((sx * 0.03, 0.06, 0.003)),
                    end + Vector((-sx * 0.04, 0.09, 0.003)), end + Vector((-sx * 0.12, 0.07, -0.005))], n=6)
    band = [[p + Vector((0, -0.01 * (dz > 0), dz)) for p in path] for dz in (-0.028, 0.0, 0.034)]
    g = loft("handguard", [list(r) for r in zip(*band)], [PAINT], closed=False, cap=False)
    g.modifiers.new("thick", "SOLIDIFY").thickness = 0.005
    box("lever", (sx * hb * 0.81, gz + 0.028, gy - 0.012), (0.09, 0.012, 0.012), BLACK,
        rot=(0, 0, -sx * math.radians(12)), bevel=0.002)

# ---------------------------------------------------------------- SEAT and what rides behind it
rides("body")
SEAT = by_z(L["seat"])
SEAT_Z0, SEAT_Z1, SEAT_BASE = SEAT[0][0], SEAT[-1][0], L["seatBase"]
rings = []
for i in range(31):
    z = SEAT_Z0 + (SEAT_Z1 - SEAT_Z0) * i / 30
    top = interp(SEAT, z)
    hw = TW * (0.98 - 0.17 * i / 30)
    sec = superellipse(0, 0, hw, (top - SEAT_BASE) / 2, 4.0, 20 if GAME else 40, taper_top=0.18)
    rings.append([Vector((x, z, (top + SEAT_BASE) / 2 + v)) for x, v in sec])
seat = loft("seat", rings, [SEAT_MAT])
if not GAME:
    seat.modifiers.new("smooth", "SUBSURF").levels = 1

def pack(name, outline, m, half_width):
    """A box-shaped load off a traced outline: its run, its floor and its top line."""
    pts = [P(p) for p in outline]
    z0, z1 = min(p[0] for p in pts), max(p[0] for p in pts)
    base = min(p[1] for p in pts)
    tops = sorted(pts, key=lambda p: -p[1])[:2]
    top_line = by_z(tops) if tops[0][0] != tops[1][0] else [(z0, tops[0][1]), (z1, tops[0][1])]
    rings = []
    for i in range(17):
        z = z0 + (z1 - z0) * i / 16
        top = interp(top_line, z)
        sec = superellipse(0, 0, half_width, (top - base) / 2, 5.0, 20 if GAME else 40, taper_top=0.15)
        rings.append([Vector((x, z, (top + base) / 2 + v)) for x, v in sec])
    return loft(name, rings, [m])

for key, m in (("tailbox", BLACK), ("cargo", BLACK), ("luggage", PAINT)):
    if L.get(key):
        pack(key, L[key], m, TW * 0.95)
if L.get("backrest"):
    pack("backrest", L["backrest"], SEAT_MAT, TW * 0.7)
for key in ("rack", "grabHandle"):
    if L.get(key):
        for sx in (-1, 1):
            tube(key, [(sx * TW, *P(p)) for p in L[key]], 0.011, ALU, smooth_n=3)

# ---------------------------------------------------------------- TUNNEL
TUN_TOP = [P(p) for p in L["tunnelTop"]] + [(Z0 + 0.06, SEAT_BASE - 0.04)]
TUN_BOT = by_z([P(p) for p in L["tunnelBottom"]] + [(Z0 + 0.06, interp(HOOD_BOT, Z0) + 0.01)])
outline = TUN_TOP + TUN_BOT[::-1]
if TUN_TOP[0][0] > 1e-3:
    outline.append((0.0, TUN_TOP[0][1] - 0.09))
tail_end = L["tunnelTop"][-1][0]
for sx in (-1, 1):
    n = len(outline)
    verts = [Vector((sx * TW, z, y)) for z, y in outline] + [Vector((sx * (TW + 0.004), z, y)) for z, y in outline]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    plate = mesh_obj("tunnel_side", verts, faces, [TUNNEL], smooth=False)
    if not GAME:
        holes = bpy.data.collections.new("tunnel_holes")
        cutters.children.link(holes)
        for f in (0.36, 0.53, 0.70, 0.87):
            # Lightening holes where the plate is deep enough to keep a rim
            # round one: a touring tunnel is a few centimetres at the tail,
            # and a hole through its edge leaves the boolean nothing whole.
            z = tail_end * f
            lo, hi = interp(TUN_BOT, z), interp(TUN_TOP, z)
            if hi - lo < 0.11:
                continue
            y = (lo + hi) / 2
            c = cutter_cyl((sx * (TW - 0.06), z, y), (sx * (TW + 0.07), z, y), 0.032)
            cutters.objects.unlink(c)
            holes.objects.link(c)
        boolean(plate, holes)
deck = [[Vector((-TW - 0.004, z, y)), Vector((TW + 0.004, z, y))] for z, y in TUN_TOP]
loft("tunnel_deck", deck, [TUNNEL], closed=False, cap=False, smooth=False).modifiers.new(
    "thick", "SOLIDIFY").thickness = 0.004

# The taillights (traced) and the rear grab bar.
t0, t1 = (P(p) for p in L["taillight"])
for sx in (-1, 1):
    tube("taillight", [(sx * (TW + 0.006), *t0), (sx * (TW + 0.006), *t1)], 0.008, TAIL)
ty = TUN_TOP[0][1]
box("taillight_rear", (0, -0.005, ty - 0.014), (TW * 0.95, 0.012, 0.03), TAIL, rot=(math.radians(-12), 0, 0))
tube("rear_bumper", [(-TW - 0.01, 0.22, ty - 0.03), (-TW - 0.02, 0.04, ty + 0.01), (-TW * 0.7, -0.02, ty + 0.03),
                     (TW * 0.7, -0.02, ty + 0.03), (TW + 0.02, 0.04, ty + 0.01), (TW + 0.01, 0.22, ty - 0.03)],
     0.012, ALU, smooth_n=5)

# The snow flap (traced): rubber.
if L.get("flap"):
    # Hung off the tunnel's tail: where the trace starts below the deck (a
    # touring tunnel is a few centimetres deep there), it is carried up to it.
    fl = [P(p) for p in L["flap"]]
    deck_y = interp(TUN_TOP, max(fl[0][0], 0.0)) - 0.01
    if fl[0][1] < deck_y - 0.02:
        fl.insert(0, (fl[0][0], deck_y))
    line = catmull([Vector(p) for p in fl], n=6)
    f = loft("snow_flap", [[Vector((sx * (TW + 0.01), p.x, p.y)) for sx in (-1, 1)] for p in line],
             [RUBBER], closed=False, cap=False)
    f.modifiers.new("thick", "SOLIDIFY").thickness = 0.008

# The running boards: open with traction holes, or solid, and a raised outer lip.
bz0, bz1 = L["boards"]["from"], L["boards"]["to"]
by = interp(TUN_BOT, (bz0 + bz1) / 2)
for sx in (-1, 1):
    b = box("running_board", (sx * (TW + 0.125), (bz0 + bz1) / 2, by), (0.25, bz1 - bz0, 0.012), TUNNEL, bevel=0.003)
    if L["boards"]["open"] and not GAME:
        holes = bpy.data.collections.new("board_holes")
        cutters.children.link(holes)
        for i in range(6):
            for j in range(2):
                z = bz0 + 0.07 + i * (bz1 - bz0 - 0.14) / 5
                x = sx * (TW + 0.08 + 0.09 * j)
                c = cutter_cyl((x, z, by - 0.05), (x, z, by + 0.05), 0.022)
                cutters.objects.unlink(c)
                holes.objects.link(c)
        boolean(b, holes)
    xo = sx * (TW + 0.25)
    tube("board_lip", [(xo, bz0, by + 0.005), (xo + sx * 0.005, bz0 + 0.1, by + 0.03),
                       (xo + sx * 0.005, bz1 - 0.1, by + 0.03), (xo, bz1, by + 0.005)], 0.01, ALU, smooth_n=4)
    tube("toe_hold", [(sx * TW, bz1 - 0.04, by + 0.115), (sx * (TW + 0.09), bz1 - 0.02, by + 0.105),
                      (sx * (TW + 0.13), bz1 - 0.005, by + 0.065)], 0.009, ALU, smooth_n=4)

# ---------------------------------------------------------------- the TRACK
# The belt as a loop over the traced idler and drive, its run on the snow
# standing on its lugs, climbing the traced upper run back to the idler.
LUG = SPEC["lugHeight"]
HW, TH = SPEC["treadWidth"] / 2, 0.011
(iz, _), ir = P(L["idler"]["at"]), L["idler"]["radius"]
(sz, sy), sr = P(L["sprocket"]["at"]), L["sprocket"]["radius"]
c1 = L["contact"][1]
bY = LUG + 0.016
iy = bY + ir + TH
rides(bone("track", (0, (iz + c1) / 2, bY), (0, (iz + c1) / 2, bY + 0.2)))
up = [P(p) for p in L["trackUp"]]
around = [(iz + (ir + TH) * math.cos(math.radians(a)), iy + (ir + TH) * math.sin(math.radians(a)))
          for a in (100, 150, 195, 240)]
BELT = ([(iz, bY), ((iz + c1) / 2, bY), (c1 - 0.2, bY), (c1 - 0.07, bY + 0.015), (c1 + 0.03, bY + 0.07),
         (sz + sr * 0.4, sy - sr * 0.95), (sz + sr + 0.01, sy + 0.005), (sz + sr * 0.6, sy + sr * 0.9),
         (sz - 0.02, sy + sr + 0.03), ((sz + up[-1][0]) / 2, max(sy + sr, up[-1][1]) + 0.02)]
        + up[::-1] + around)
loop = catmull([Vector((0, z, y)) for z, y in BELT], closed=True, n=10)
path, belt_len = resample(loop, 0.035 if GAME else 0.012)
N = len(path)

def frame_at(i):
    t = (path[(i + 1) % N] - path[i - 1]).normalized()
    return t, Vector((0, t.z, -t.y))     # outward, the loop run nose-up at the front

belt_rings = []
for i in range(N):
    t, o = frame_at(i)
    p = path[i]
    belt_rings.append([p + o * TH + Vector((-HW, 0, 0)), p + o * TH + Vector((HW, 0, 0)),
                       p - o * TH + Vector((HW, 0, 0)), p - o * TH + Vector((-HW, 0, 0))])
loft("belt", belt_rings + [belt_rings[0]], [RUBBER], closed=True, cap=False, smooth=False)

# Each lug is laid twice: where it stands, and where the lug a STEP behind
# it along the loop stands — the belt run's morph, so a clip that runs the
# key 0 → 1 moves every lug on round the loop and ends where it began (a
# step is two lugs where they are staggered, so a lug lands on its own kind).
lugs_v, lugs_f, lugs_run = [], [], []
count = int(belt_len / 0.0762)            # a 3-inch pitch
STEP = 1 if GAME else 2
count -= count % STEP
for k in range(count):
    st = 0.02 if k % 2 else -0.02
    spans = ((-HW + 0.01, HW - 0.01),) if GAME else (
        (-HW + 0.01, -0.07 + st), (-0.05 + st, 0.05 + st), (0.07 + st, HW - 0.01))
    for x0, x1 in spans:
        base = len(lugs_v)
        for kk, out in ((k, lugs_v), ((k - STEP) % count, lugs_run)):
            i = int(kk * N / count)
            t, o = frame_at(i)
            p = path[i] + o * TH
            for dx, dt, dh in ((x0, -0.012, 0), (x1, -0.012, 0), (x1, 0.012, 0), (x0, 0.012, 0),
                               (x0, -0.006, LUG), (x1, -0.006, LUG), (x1, 0.004, LUG), (x0, 0.004, LUG)):
                out.append(p + Vector((dx, 0, 0)) + t * dt + o * dh)
        lugs_f += [[base + a for a in f] for f in
                   ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0))]
morph(mesh_obj("lugs", lugs_v, lugs_f, [RUBBER], smooth=False), "run", lugs_run)
RUN_METRES = STEP * belt_len / count

# The rails, the idler and bogie wheels, the rear suspension's arms and shock.
wy = bY + TH + 0.06
span = c1 - 0.2 - iz
nb = max(2, round(span / 0.35))
WHEELS = [(iz, iy, ir)] + [(iz + span * k / nb, wy, 0.06) for k in range(1, nb + 1)]
for w, (z, y, r) in enumerate(WHEELS):    # a pair on one axle, turning about x
    rides(bone(f"wheel_{w}", (-HW, z, y), (HW, z, y), "track", extras={"radius": r}))
    for sx in (-1, 1):
        x = sx * (HW - 0.035)
        cyl("wheel", (x - sx * 0.02, z, y), (x + sx * 0.02, z, y), r, BLACK, seg=32)
        cyl("hub", (x + sx * 0.019, z, y), (x + sx * 0.024, z, y), r * 0.55, ALU, seg=24)
rides("track")
cyl("idler_axle", (-HW, iz, iy), (HW, iz, iy), 0.015, STEEL)
zr = iz + 0.54
for sx in (-1, 1):
    side = "l" if sx < 0 else "r"
    rides("track")
    tube("rail", [(sx * 0.11, iz + 0.04, bY + 0.035), (sx * 0.11, c1 - 0.1, bY + 0.035),
                  (sx * 0.11, c1, bY + 0.06), (sx * 0.11, c1 + 0.08, bY + 0.13)], 0.016, TUNNEL, smooth_n=4)
    # The arms from the rails up to the tunnel: laid from the tunnel down.
    for arm, foot, head in (("front", (sx * 0.12, c1 - 0.05, bY + 0.07),
                             (sx * 0.14, c1 + 0.13, interp(TUN_BOT, c1 + 0.13) - 0.03)),
                            ("rear", (sx * 0.12, iz + 0.29, bY + 0.06), (sx * 0.15, zr, interp(TUN_BOT, zr) + 0.04))):
        target = marker(f"{arm}_foot_{side}", foot, "track")
        rides(bone(f"{arm}_arm_{side}", head, foot, aim=target, stretch=True))
        tube(f"{arm}_arm", [foot, head], 0.018, TUNNEL)
zs = iz + 0.86
sa, sb = Vector((0, iz + 0.36, bY + 0.07)), Vector((0, zs, interp(TUN_BOT, zs) - 0.01))
rides(bone("rear_shock", sb, sa, aim=marker("rear_shock_foot", sa, "track"), stretch=True))
cyl("rear_shock", sa, sb, 0.024, BLACK)
coil("rear_spring", sa.lerp(sb, 0.12), sa.lerp(sb, 0.8), 0.04, 0.007, 7, SPRING)

# ---------------------------------------------------------------- FRONT END and SKIS
SKI = [P(p) for p in L["ski"]]
ski_line = catmull([Vector((0, z, y)) for z, y in SKI], n=8)
k = SPEC["skiWidth"] / 0.15
ski_sec = [(x * k, y) for x, y in ((-0.075, 0.004), (-0.075, 0.024), (-0.062, 0.038), (-0.02, 0.043),
                                   (0.02, 0.043), (0.062, 0.038), (0.075, 0.024), (0.075, 0.004),
                                   (0.022, 0.0), (0.012, -0.014), (-0.012, -0.014), (-0.022, 0.0))]
tipz, tipy = SKI[-1]
(s0z, s0y), (s1z, s1y) = (P(p) for p in L["spindle"])
for sx in (-1, 1):
    side = "l" if sx < 0 else "r"
    X = sx * STANCE / 2
    bot, top = Vector((X, s0z, s0y - 0.045)), Vector((X - sx * 0.02, s1z, s1y + 0.013))
    SKI_BONE = rides(bone(f"ski_{side}", bot, top))
    rings = []
    for i, p in enumerate(ski_line):
        t = (ski_line[min(i + 1, len(ski_line) - 1)] - ski_line[max(i - 1, 0)]).normalized()
        n = Vector((0, -t.z, t.y))
        rings.append([Vector((X + x, p.y, p.z)) + n * y for x, y in ski_sec])
    loft("ski", rings, [BLACK])
    for lx in (-0.055 * k, 0.055 * k):   # the angular loop: back along the ski, up, and down to the tip
        tube("ski_loop", [(X + lx, tipz - 0.284, SKI[2][1] + 0.037), (X + lx * 1.1, tipz - 0.124, tipy + 0.07),
                          (X + lx, tipz - 0.014, tipy + 0.09), (X + lx * 0.9, tipz + 0.006, tipy + 0.02)], 0.011, BLACK)
    tube("ski_loop_bar", [(X - 0.06 * k, tipz - 0.014, tipy + 0.09), (X + 0.06 * k, tipz - 0.014, tipy + 0.09)],
         0.011, BLACK)
    tube("carbide", [(X, SKI[1][0] + 0.1, 0.0), (X, SKI[2][0] - 0.04, -0.001)], 0.006, STEEL)
    box("ski_saddle", (X, s0z, 0.075), (0.05, 0.12, 0.06), ALU)
    # The spindle (traced), the upper and lower A-arms, a coil-over and a tie
    # rod — every one laid from the chassis to its marker on the ski.
    cyl("spindle", bot, top, 0.022, TUNNEL)
    for arm, fz, rz, y_in, end in (("up", s0z + 0.094, s0z - 0.186, top.z, top + Vector((-sx * 0.01, 0, -0.01))),
                                   ("lo", s0z + 0.114, s0z - 0.206, bot.z + 0.12, bot + Vector((-sx * 0.01, 0, 0.07)))):
        ball = marker(f"ball_{arm}_{side}", end, SKI_BONE)
        rides(bone(f"a_arm_{arm}_{side}", (sx * 0.16, (fz + rz) / 2, y_in), end, aim=ball, stretch=True))
        tube("a_arm", [(sx * 0.16, fz, y_in), tuple(end), (sx * 0.16, rz, y_in)], 0.013, PAINT)
        cyl("pivot", (sx * 0.16, fz - 0.03, y_in), (sx * 0.16, rz + 0.03, y_in), 0.018, TUNNEL)
    sa = Vector((X - sx * 0.07, s0z - 0.026, bot.z + 0.09))
    sb = Vector((sx * 0.21, s0z - 0.126, interp(HOOD_BOT, s0z - 0.126) + 0.2))
    # The coil-over TELESCOPES: the body turns on the chassis to point at the
    # shaft's foot, the shaft turns on the ski to point at the body's top,
    # and the spring between them stretches.
    shock, shaft = f"shock_{side}", f"shaft_{side}"
    rides(bone(shock, sb, sa, aim=shaft))
    cyl("shock_body", sb, sa.lerp(sb, 0.45), 0.024, BLACK)
    cyl("shock_reservoir", sb + Vector((sx * 0.035, 0.02, -0.03)), sb.lerp(sa, 0.3) + Vector((sx * 0.035, 0.02, 0)),
        0.017, ALU)
    rides(bone(shaft, sa, sb, SKI_BONE, aim=shock))
    cyl("shock_shaft", sa, sa.lerp(sb, 0.5), 0.009, STEEL)
    rides(bone(f"spring_{side}", sb, sa, aim=shaft, stretch=True))
    coil("front_spring", sa.lerp(sb, 0.08), sa.lerp(sb, 0.72), 0.036, 0.0065, 6, SPRING)
    yt = (bot.z + top.z) / 2 + 0.04
    rod_in, rod_out = (sx * 0.08, top.y - 0.05, yt), (X - sx * 0.05, top.y - 0.024, yt - 0.01)
    rides(bone(f"tie_rod_{side}", rod_in, rod_out, aim=marker(f"steer_arm_{side}", rod_out, SKI_BONE), stretch=True))
    tube("tie_rod", [rod_in, rod_out], 0.008, STEEL)
    rides("body")
    tube("sway_bar", [(sx * 0.16, top.y + 0.006, yt - 0.02), (sx * 0.30, top.y + 0.026, yt - 0.02)], 0.009, TUNNEL)
rides("body")


# ---------------------------------------------------------------- the CLIPS
# The game's own travel and bar turn, and the spec's lock. A turn is to the
# rider's right first: the nose toward +x, a negative turn about the up axis.
(S_LO, S_HI), (T_LO, T_HI) = GEAR["travel"]["ski"], GEAR["travel"]["tread"]
SKIS = ("ski_l", "ski_r")

def ease(a, b, u):
    u = max(0.0, min(1.0, u))
    return a + (b - a) * u * u * (3 - 2 * u)

def through(t, T, lo, hi):
    """Rest, up to the bump, back, down to the droop and back, over T s."""
    q = min(4 * t / T, 3.9999)
    stops = (0.0, hi, 0.0, lo, 0.0)
    return ease(stops[int(q)], stops[int(q) + 1], q - int(q))

def land(t, lo, hi):
    """Hanging at the droop in the air, a landing driven to the bump, and
    the spring's ring-down to rest."""
    if t < 0.3:
        return lo
    if t < 0.42:
        return ease(lo, hi, (t - 0.3) / 0.12)
    u = t - 0.42
    return hi * math.exp(-4.5 * u) * math.cos(2 * math.pi * 1.6 * u)

clip("steer", 2.0, lambda t: {"bars": {"turn": -GEAR["barTurn"] * math.sin(math.pi * t)},
                              **{s: {"turn": -SPEC["skiLock"] * math.sin(math.pi * t)} for s in SKIS}})
clip("front_travel", 2.0, lambda t: {s: {"lift": through(t, 2.0, S_LO, S_HI)} for s in SKIS})
clip("rear_travel", 2.0, lambda t: {"track": {"lift": through(t, 2.0, T_LO, T_HI)}})
clip("landing", 1.6, lambda t: {**{s: {"lift": land(t, S_LO, S_HI)} for s in SKIS},
                                "track": {"lift": land(t - 0.03, T_LO, T_HI)}})
# The belt runs back along the snow, so each wheel on it rolls forward: a
# negative turn about +x.
clip("belt_run", 1.0, lambda t: {"morph": {"lugs": t},
                                 **{f"wheel_{w}": {"turn": -t * RUN_METRES / r} for w, (_, _, r) in enumerate(WHEELS)}})

# ---------------------------------------------------------------- the STUDIO
# The cameras aim at the machine's middle, from the tunnel's end to the ski tips.
finish(SPEC["id"], OUT, SAMPLES, centre=(0, tipz / 2, 0.45), size=tipz,
       extras={"beltRunMetres": RUN_METRES, "frame": "trace"})
