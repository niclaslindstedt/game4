---
name: blender-assets
description: "Use when a game asset is to be MODELLED IN BLENDER off the game's own data — a sled today; a tree, an animal, the rider or any other drawn thing when its kind is added — for studio renders, a real-time glTF with LODs, or to find out how good an authored version of something the game builds in code could look. Owns `make blender` (`scripts/blender.mjs`, the registry of KINDS and the JSON each is handed), the Blender shelf (`scripts/blender/lib.py`: the helpers, the studio, the game-budget export) and each kind's builder (`scripts/blender/sled.py`), the lab sheet that sets a model beside the game's own (`make sled ARGS=--asset=…`), the frame a model is stated in and turned back from, the triangle budget and its LODs, installing and running Blender headless on macOS, reference photographs (local only, never committed, never named), and adding a new kind. Not the game's own builders (`sled-design`, `nature`, `rider`) — though they are what every model is held against."
---

# Blender assets

The game ships **no asset files**: every sled, tree, animal and the rider is
built in code. This skill is the other road, kept open on purpose — the same
things MODELLED in Blender, off the same numbers, so that the question "how
good could it look, and what would it cost?" is answered with a render, a
triangle count and a picture in the game's own lab rather than a guess, and
so that a desktop build could one day ship authored assets without the
models drifting from the physics.

Three rules make that possible, and every step below serves one of them:

1. **A model is built off the game's data, never off numbers of its own.**
   The driver hands Blender the very tables the game's builder reads (a
   sled: `SLEDS` and `SLED_LOOKS`) as one JSON file. A modelled sled
   therefore stands on the physics' ski line and belt run to the
   centimetre, and when a trace moves, the model moves with it on the next
   run. A hand-typed dimension in a builder is the drift this rules out.
2. **Nothing it makes is committed.** Every output lands in the gitignored
   `previews/blender/`. Shipping a model is a DECISION (below), not a side
   effect of running the lab.
3. **A model is judged beside the game's own**, in the game's renderer, with
   the game's rider on it — not only in a Blender studio, which flatters
   everything.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs blender-assets --list`. Load
`skill-reflection` at both ends, `lab-tooling` for any change to the driver
or the lab, and the skill that owns the asset's SUBJECT (`sled-design` for a
sled) — its judging rules apply to a model too.

## Where everything lives

| Piece | Role |
| --- | --- |
| `scripts/blender.mjs` | THE DRIVER (`make blender`): `KINDS` (per kind: its ids, the JSON of the game's data for one, its builder, its default), finds Blender, runs each QUALITY, echoes what matters (`GROUPS`, `TRIANGLES`, what was saved, any traceback) and fails on a Python error |
| `scripts/blender/lib.py` | THE SHELF every builder imports: the scene, `mat`, the geometry (`loft`, `superellipse`, `tube`, `cyl`, `box`, `ellipsoid`, `coil`, `catmull`, `resample`, boolean cutters), `group()`, and `finish()` — the studio, the Cycles stills, the join by group, LOD0 and the decimated LODs as glTF |
| `scripts/blender/sled.py` | THE SLED BUILDER: the cowl, the lamp pods, the screen, the bars, the seat and what rides behind it, the tunnel, the flap, the boards, the belt and its lugs, the rear suspension, the skis, spindles, A-arms and coil-overs — every dimension off the spec and the trace |
| `pwa/src/tools/sled-harness.ts` + `scripts/sled-preview.mjs` | THE ASSET SHEET (`make sled ARGS=--asset=a.glb,b.glb`): the builder's machine in the first row, each model below it, every one ridden by the game's rider seated by `riderSeat` |
| `previews/blender/` | Everything made: `<id>.json` (what Blender was handed), `<id>-render-<view>.png`, `<id>-game-*.png`, `<id>-lod{0,1,2}.glb`, `<id>-{render,game}.blend` |

## The loop

1. **Look at what the game draws first**: `make sled ARGS="--sheet=machines
   --views=side,three --cell=640"` (or the subject's own lab). That is the
   bar a model has to clear.
2. **Get references — locally.** A clean studio side profile of a real
   machine of the class, and a three-quarter view (a free-licensed one from
   a public media archive is good). They go in the session's scratchpad
   ONLY: never under the tree, never in an artifact, never named — not the
   maker, not the model, not in a file name. Refer to them as "a
   crossover's studio side profile". (`AGENTS.md`: NAME NO REAL PRODUCT.)
3. **Iterate fast in render quality**, one or two views, few samples:
   `make blender ID=fox ARGS="--quality=render --views=three,side --samples=24"`
   — about half a minute a pass once the kernels are compiled. READ the
   pictures beside the references. Silhouette first (from the side), then
   the three-quarter, then detail.
4. **Then the budget**: `make blender ID=fox ARGS=--quality=game` — the
   parts joined by group, LOD0 and two LODs exported, every count printed.
5. **Then the game's lab**: `make sled ARGS="--asset=previews/blender/fox-lod0.glb,previews/blender/fox-lod1.glb --views=side,three,chase --cell=480"`
   → `previews/sled-asset-fox.png`. The chase view is the verdict, as it is
   for the builder's machine (`sled-design`): the rider's back, the tunnel
   and flap, the skis either side, at sixty pixels.
6. **Report** before and after with the pictures and the triangle table.

## The frame

A builder states its asset in the frame the game's data is in, and nothing
else. A sled is modelled in the **trace's** frame: Blender x to the rider's
right, y forward from the tunnel's end (the trace's z), z up from the snow
(the trace's y). glTF export turns Blender's z-up to y-up with forward on
**-z**. The lab turns it back — a half turn about y, then the trace set on
the spec exactly as `lookFrame` sets it (`z(0)` as the offset, `stretch` on
z), the body frame's origin at the CoG height — and seats the game's rider
with `riderSeat(spec)`, the same function the builder seats him with. A new
kind states its frame in its builder's header and its lab does the turn;
never bake a turn into a model.

## Modelling craft (what the sled taught)

- **Panels are a CAGE under a subdivision surface, with creases.** A
  cross-section of a dozen keyed points (belly, lower corner, flank,
  SHOULDER, upper flank, brow, crown) lofted through ~18 stations,
  subdivided, with the shoulder creased hard (`crease_edge` 1.0), the brow
  softer and the crown ridge softer still. That is what makes a cowl read
  as moulded panels with a character line rather than a pod or a capsule —
  and the cage is the low-poly base the game budget subdivides once.
- **Paint follows the cage's bands**, assigned per cage FACE (below the
  shoulder black, the band above it a stripe, the rest paint), so every
  colour edge runs along a crease after subdivision. Colouring a fine mesh
  face by face by its centroid stair-steps; a shader mask is clean in
  Cycles but does not survive into glTF.
- **What must stand proud is a VOLUME.** Lamps shrinkwrapped onto the cowl
  read as sunk into it at any offset; a housing that rises out of the
  shoulder and grows toward the nose, ending in a forward lens, pops.
- **Read the class off the references, not off memory.** What moved the
  sled from "vintage" to "current": the belly raised over the front
  suspension (the trace already had the cutout — do not smooth it away),
  a V-shaped nose in plan with a ridge, the lamps high on the shoulders
  just ahead of the screen, angular ski loops reaching back along the ski.
- **Every part is data-driven or class-proportional.** Where the trace says
  nothing (a bumper's loop, a lever), place it off something it does say
  (the nose, the grip) — so the same builder models all six classes; the
  mountain sled got its bar handle and no screen, the touring machine its
  backrest, grab handles and luggage, with no class-specific code.

## The budget

Measured on the Fox (Blender 5.2): render quality ~52k triangles; the game
quality — fewer segments on every tube and cylinder, the cowl subdivided
once, lugs one piece across the belt, no boolean holes, coils coarser — is
**LOD0 ≈ 16k** (body 9.4k, each ski 1.7k, track 3.0k), **LOD1 ≈ 5.5k**,
**LOD2 ≈ 1.6k**. LOD0 is indistinguishable from the render model at any
game range. The groups are **the parts that move on their own** (the body,
each ski with its spindle and arms, the track): the game poses each ski off
its own compression, so a model joined into one mesh could not be ridden.

**The lower LODs are a blind decimation**, and it shows: up close LOD2 tears
(spikes, a broken stripe). Fine at the range a rival is drawn at; a real
LOD2 is a hand-built low model (the cage unsubdivided, no coils, the belt a
band), which is open work.

## Blender, headless, on macOS

- **Installing.** The Homebrew cask can crawl (tens of KB/s); ranged
  parallel `curl` from the release server is far faster — then CHECK THE
  SHA-256 against the release's checksum file (a range can come back short
  and silently). Copy the app out of the DMG with `ditto`, not `cp -R`.
- **The hang.** An app copied without its files' times carries stale
  bytecode; Python's first import tries to rewrite it inside the signed
  bundle, macOS's app protection holds the write, and Blender sits at 0 %
  CPU for ever with nothing in its log. The driver runs Blender with
  `PYTHONDONTWRITEBYTECODE=1` AND `--python-use-system-env` (without the
  flag Blender ignores the variable). `sample <pid>` showing `os_open`
  under Python's init is the tell.
- **A Python error exits 0** unless Blender is given `--python-exit-code 1`;
  the driver passes it.
- **Cycles on Metal** works headless; the first render compiles kernels for
  ~3 minutes, then a 1280×720 still at 32 samples is seconds.
- **API traps (5.x):** `use_nodes` is deprecated (set it in a `try`);
  Principled inputs are `Coat Weight`, `Transmission Weight`, `Emission
  Color`; the RGBA Mix node's colours are inputs 6 and 7 and its result
  output 2; a Math node's `MULTIPLY_ADD` third input defaults to 0.5, not 0;
  creases are the `crease_edge` float attribute; `bmesh.ops.create_cone`
  takes `radius1`/`radius2`; curve objects must be converted to meshes
  before a join or an export.

## Adding a kind (trees, animals, the rider, …)

1. **The data.** A row in `KINDS` in `scripts/blender.mjs`: `ids()`, and
   `data(id)` returning the game's OWN tables for one (a tree: its kind's
   variant rows and `crownAt` from `tree-variants.ts`; an animal: its row
   and shape from `beast-defs.ts` / `beast-shapes.ts`; the rider: `BODY`
   and `MOUNTS` from `rider-pose.ts`) — imported through `aliasEngine`,
   never restated.
2. **The builder**, `scripts/blender/<kind>.py`: `from lib import *`, its
   frame stated in its header, `group()` for each part that moves on its
   own, `finish(name, OUT, SAMPLES, centre, size)` at the end. A helper two
   kinds need goes into `lib.py`.
3. **The lab.** The kind's own lab owes an asset view like the sled lab's
   (`--asset=`), with the turn back into the game's frame in the lab, not
   in the model. A kind with a skeleton (the rider, the animals) needs its
   bones exported and posed by the game's own pose — `posed-merge.ts`
   already draws the sled as rigid bones; a skinned figure is new ground.
4. Register nothing new: `make blender KIND=<kind>` is already the target.
   Update this skill's table and the README's `make blender` row.

## Shipping a model (a decision, not a step)

Loading authored assets breaks a hard rule of this tree (§ "the game ships
no asset files") and moves a spec verdict, so it is the user's call and a
PR of its own: the scope (a desktop build only, say, with the code-built
machines kept for the web), a row in `docs/spec-conformance.md`, and the
renderer's side — every world material goes through the haze wrap
(`hazeMaterial`), so a loaded model's materials must be passed through the
same wrap, and the machine must still be ONE draw (`posed-merge.ts`) with
its parts as bones. Until that PR, a model lives in `previews/`.

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
What belongs here: a Blender or glTF trap met, a budget measured on a new
kind, a modelling move that made a class read (or failed to), a kind added.
