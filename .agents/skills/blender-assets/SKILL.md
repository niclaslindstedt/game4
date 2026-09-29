---
name: blender-assets
description: "Use when a game asset is to be MODELLED IN BLENDER off the game's own data — the sleds, the rider, every kind of tree, every bird and animal of the wildlife and the course's marks (the checkpoint and the start arch) today; any other drawn thing when its kind is added — for studio renders, a real-time glTF with LODs, or to find out how good an authored version of something the game builds in code could look. Owns `make blender` (`scripts/blender.mjs` and the KINDS under `scripts/blender/kinds/`, each the JSON the game's data for one is handed as), the Blender shelf (`scripts/blender/lib.py`: the helpers, the studio, the rig, the game-budget export; `static.py`: the role-painted static mesh the wildlife and the marks are built as) and each kind's builder (`scripts/blender/sled.py`, `rider.py`, `tree.py`, `bird.py`, `beast.py`, `gate.py`), the RIG every model carries and the clips baked into it (the game-side contracts `sled-rig.ts` and `rider-rig.ts`), the lab sheet that sets a model beside the game's own (`make sled ARGS=--asset=…`), THE MODELS IN THE GAME (the `VITE_MODEL_SLEDS` / `VITE_MODEL_RIDERS` / `VITE_MODEL_TREES` / `VITE_MODEL_BIRDS` / `VITE_MODEL_BEASTS` / `VITE_MODEL_GATES` build switches, `make models`, `pwa/models-plugin.ts`, `sled-models.ts`, `tree-models.ts`, `bird-models.ts`, `beast-models.ts`, `gate-models.ts` over `model-parts.ts`, the meshopt packer `scripts/lib/glb-pack.mjs`: packed, loaded, dressed, posed in place of the code's drawn parts), the frame a model is stated in and turned back from, the triangle budget and its LODs, installing and running Blender headless on macOS and Linux, reference photographs (local only, never committed, never named), and adding a new kind. Not the game's own builders (`sled-design`, `nature`, `rider`, `tree-shapes.ts`) — though they are what every model is held against."
---

# Blender assets

The game draws its **sleds, rider, trees, birds, animals and the course's
marks from the models made here** — committed in `pwa/models/` by `make
models` — and builds everything else (and, one switch away, every one of
those too) in code (§ "The models in the game"). This skill is the other road, kept open on purpose — the same
things MODELLED in Blender, off the same numbers, so that the question "how
good could it look, and what would it cost?" is answered with a render, a
triangle count and a picture in the game's own lab rather than a guess, and
so that a desktop build could one day ship authored assets without the
models drifting from the physics.

Three rules make that possible, and every step below serves one of them:

1. **A model is built off the game's data, never off numbers of its own.**
   The driver hands Blender the very tables the game's builder reads (a
   sled: `SLEDS` and `SLED_LOOKS`; a tree: its kind's ten rows of
   `TREE_VARIANTS` and each one's `crownAt`) as one JSON file. A modelled sled
   therefore stands on the physics' ski line and belt run to the
   centimetre, and when a trace moves, the model moves with it on the next
   run. A hand-typed dimension in a builder is the drift this rules out.
2. **The lab's outputs are not committed; the game's models are.** Every
   render, `.blend` and LOD lands in the gitignored `previews/blender/`;
   only `make models` publishes — the LOD0 of every sled and the rider and
   every kind of tree (packed), with their sources' stamps, into
   `pwa/models/` — and those are committed.
3. **A model is judged beside the game's own**, in the game's renderer, with
   the game's rider on it — not only in a Blender studio, which flatters
   everything.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons blender-assets --list`. Load
`skill-reflection` at both ends, `lab-tooling` for any change to the driver
or the lab, and the skill that owns the asset's SUBJECT (`sled-design` for a
sled) — its judging rules apply to a model too.

## Where everything lives

| Piece | Role |
| --- | --- |
| `scripts/blender.mjs` | THE DRIVER (`make blender`): loads every KIND under `scripts/blender/kinds/<kind>.mjs` (its ids, the JSON of the game's data for one, its builder, its default), finds Blender, runs each QUALITY, echoes what matters (`BONES`, `CLIPS`, `TRIANGLES`, what was saved, any traceback) and fails on a Python error. A kind's data module is in its own sources alone, so a kind added moves no other stamp |
| `scripts/blender/lib.py` | THE SHELF every builder imports: the scene, `mat`, the geometry (`loft`, `superellipse`, `tube`, `cyl`, `box`, `ellipsoid`, `coil`, `catmull`, `resample`, boolean cutters), THE RIG (`rides`, `bone`, `marker`, `clip`, `morph`), and `finish()` — the rig built and skinned, the clips baked, the studio, the Cycles stills, the join into one skinned mesh, LOD0 and the decimated LODs as glTF |
| `scripts/blender/rider.py` | THE RIDER BUILDER (`KIND=rider`, `ID=rider0…3` a grid slot's kit): one SUIT that bends (a man of the ANSUR II survey's mean measure in a racer's kit, lofted a piece a bone, remeshed into one skin, creased where a joint bends, cut along the hem, yoke, cuff and lap planes before it is coloured, weighted across each joint between the two bones that meet there) and rigid parts on one bone each — the helmet laid on the game's MEASURED shell (`helmetReach` / `helmetPart` sampled on a grid), the boots, the gloves |
| `scripts/blender/tree.py` | THE TREE BUILDER (`KIND=tree`, `ID=<kind>` or `all`): a kind's ten variants off their own rows, each a full tree and a far sketch, one glTF a kind; no rig — the forest instances them (§ "The trees") |
| `scripts/blender/static.py` | THE STATIC SHELF (the wildlife, the marks): `Sheet` (every face a ROLE, every vertex a tone), `loft`, `tube`, `fin`, `blob`, `role_mat`, `publish` (the root's extras, the export, the stills: `three`, `under`, `side`, `front`, `back`, `detail`) |
| `scripts/blender/bird.py`, `beast.py`, `gate.py` | THE WILDLIFE AND THE MARKS: a bird off its roster row, an animal off its row and style, the checkpoint and the arch off `GATE` / `ARCH` (§ "The birds, the animals and the marks") |
| `pwa/src/game/model-parts.ts`, `bird-models.ts`, `beast-models.ts`, `gate-models.ts` | THE STATIC MODELS IN THE GAME: one reader (`readStaticModel`: the parts by mesh name, a role a primitive, the root's extras), `Assembly` (dressed parts into one tagged geometry), and each kind's loader dressing off the game's own styles |
| `pwa/src/game/tree-models.ts`, `scripts/lib/glb-pack.mjs` | THE TREES IN THE GAME: a kind's model read into the unit frame and dressed per map in the region's paint (`treeModel`), and the packer every published tree goes through (quantized, meshopt) |
| `pwa/src/game/rider-rig.ts` | THE RIDER'S CONTRACT: `riderBones(pose)` (every bone's frame off a `RiderPose` — the game's own spans, rolled to face each joint's bend, the head turned as `rider.ts` turns it), `RIDING` (the pose he is bound in), `riderClips()` (every clip SAMPLED off the game's `riderPose` and `stepRiderSpring`), `rigRider` (a loaded model's bones set to a pose, or a clip played) |
| `scripts/blender/sled.py` | THE SLED BUILDER: the cowl, the lamp pods, the screen, the bars, the seat and what rides behind it, the tunnel, the flap, the boards, the belt and its lugs, the rear suspension, the skis, spindles, A-arms and coil-overs — every dimension off the spec and the trace |
| `pwa/src/tools/sled-harness.ts` + `scripts/sled-preview.mjs` | THE ASSET SHEETS (`make sled ARGS=--asset=a.glb,b.glb`): `asset` — the builder's machine in the first row, each model below it, every one ridden by the game's rider seated by `riderSeat`; `rig` — builder and models posed at the same engine moments (steer, each end's bump and droop); `clips` — the first model's clips played across their length (and a `--rider=` model's, him alone); `figure` — a modelled rider beside the game's own on the builder's machine in every pose. A `--rider=` model also rides the models on the asset and rig sheets |
| `pwa/src/game/sled-rig.ts` | THE GAME'S SIDE OF THE RIG: a modelled sled posed off `SledState` exactly as `sled-gear.ts` / `sled-body.ts` pose the builder's (`gearLift`, `BAR_TURN`), every linkage re-laid to its `aim`, and its clips played |
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
   — about half a minute a pass once the kernels are compiled (`ID=all`
   runs every sled in turn, ~20 s each). READ the
   pictures beside the references. Silhouette first (from the side), then
   the three-quarter, then detail.
4. **Then the budget**: `make blender ID=fox ARGS=--quality=game` — the
   parts joined into one skinned mesh on the rig, the clips baked, LOD0
   and two LODs exported, every count printed.
5. **Then the game's lab**: `make sled ARGS="--asset=previews/blender/fox-lod0.glb,previews/blender/fox-lod1.glb --views=side,three,chase --cell=480"`
   → `previews/sled-asset-fox.png`. The chase view is the verdict, as it is
   for the builder's machine (`sled-design`): the rider's back, the tunnel
   and flap, the skis either side, at sixty pixels. Then the rig:
   `--sheet=rig,clips` (with `--views=three,front`) — the model beside the
   builder's machine at the same moments, and every clip played. A linkage
   that leaves its part, a ski that turns the other way, a clip that shows
   another clip's pose are all read off these two sheets.
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

## Modelling craft

What each kind's first renders got wrong and the move that fixed it is a
LESSON of this skill (`npx ogf-skill-lessons blender-assets --list`: the
sled's cage-and-crease craft, the wildlife's keyed sections and fingers)
— read the ones scoped to the builder you are in before the first pass.

## The budget

Measured on the Fox (Blender 5.2): render quality ~52k triangles; the game
quality — fewer segments on every tube and cylinder, the cowl subdivided
once, lugs one piece across the belt, no boolean holes, coils coarser — is
**LOD0 ≈ 16k** (body 9.4k, each ski 1.7k, track 3.0k), **LOD1 ≈ 5.5k**,
**LOD2 ≈ 1.6k**. Across the six classes LOD0 runs 15.4k (the Ibex: no
screen) to 17.7k (the Bison and the Beaver: tall screens, mirrors, what
rides behind the seat); the skis and the track barely move, the body is
the spread. LOD0 is indistinguishable from the render model at any
game range. It is **one skinned mesh** on the rig (37 bones on the Fox),
with the lugs a mesh of their own for their morph (a shape key forbids the
join's modifiers being applied, and the decimation's): two meshes, the
first one draw per material.

## The rig and the clips

A model the game could ride has to move where the game's machine moves,
and by the same numbers, so the rig is the game's posing written into the
model (`lib.py`'s header, `sled.py`'s):

- **Every part rides ONE bone, rigidly** (weight 1): `rides(name)` before
  making the parts. That is how the game draws its own figures
  (`posed-merge.ts`: every part a bone).
- **DRIVERS** are the bones the game sets off the engine: the sled's
  `bars`, `ski_l` / `ski_r` (bone along the spindle), `track`, the
  `wheel_*` axles (their `radius` in the extras). `sled-rig.ts` poses them
  off `gearLift` and `BAR_TURN` — the numbers `sled-gear.ts` poses the
  builder's by, exported from there, and handed to Blender in the JSON so
  the clips run the same travel. Never restate either.
- **LINKAGES** (A-arms, coil-overs, tie rods, rear arms, the rear shock)
  are laid from the chassis to a `marker` on the part they meet, their
  tail ON the marker's head at rest. Rigid (`DAMPED_TRACK`: a shock body
  and its shaft, each aimed at the other's end, so the coil-over
  TELESCOPES) or stretched (`STRETCH_TO`: arms, springs, rods). The target
  is written into the glTF (`extras.aim`, `extras.stretch`) so the game
  re-lays them — constraints do not survive into glTF.
- **The clips** are keyed on the drivers a frame at a time, BAKED visually
  (`nla.bake`) so the linkages' motion is in the file, and each laid on an
  NLA track of its name, exported with `export_animation_mode=NLA_TRACKS`:
  one glTF animation a clip, the lugs' morph weights merged in by the
  track's name. The sled carries `steer`, `front_travel`, `rear_travel`,
  `landing` and `belt_run` (the lugs moved one pitch — two where they are
  staggered — round the loop, `beltRunMetres` on the root, so a game plays
  it at speed ÷ that).
- **Traps met.** An NLA track left unmuted PLAYS under the next clip's
  bake, and every later clip carries the earlier ones' pose — mute each as
  it is laid, unmute at the end, and leave `use_nla` off so the stills are
  at rest. A three.js action set to its full length wraps to frame 0 —
  `LoopOnce` with `clampWhenFinished`. A joined mesh takes its DATA name
  from the active part (it came out `a_arm`); name both. The sides are the
  MODEL's (`_l` is x negative in the trace frame), and a glTF turned to
  face the game puts that at the game's +x — so the lab matches skis to
  the engine's by which side of the machine they stand on, never by name.

**The lower LODs are a blind decimation**, and it shows: up close LOD2 tears
(spikes, a broken stripe). Fine at the range a rival is drawn at; a real
LOD2 is a hand-built low model (the cage unsubdivided, no coils, the belt a
band), which is open work.

## The rider

The game's rider has NO clips: `riderPose` places every joint off the
engine's readings and `rider.ts` lays each part from joint to joint. So a
modelled rider's BONES are those spans (`riderBones`), bound in the riding
pose (`RIDING`), and the game's own pose drives him bone for bone — a
lean, a hang, a landing, a trick pose are the game's arithmetic, not a
second animation. His clips are that arithmetic SAMPLED in Node (a hang
each way, the lean, a jump and its fold on the legs' spring, the three
trick poses blended in and out) and handed to Blender as every bone's
frame at every frame (`clip()` with a `matrix`). Nothing about how he
moves is written in Python.

- **The frame.** He is stated as `(-x, z, y)` of the sled's body frame —
  a turn, not a mirror — so he faces +y like a modelled sled and the lab's
  one half turn sets him on the game's joints exactly. His sides are the
  ENGINE's (`_l` is the pose's index 0), unlike a sled model's.
- **A figure that bends is one mesh weighted across its joints**, where a
  machine's parts are rigid: `weights(ob, fn)` gives a part per-vertex
  weights; `rider.py` shares a vertex between the nearest bone and its
  joint neighbours by how much nearer each is (4 cm apart is half against
  a third). The helmet, boots and gloves stay rigid.
- **Colour on a skinned hull stops on a PLANE**: cut the mesh along it
  (`bmesh.ops.bisect_plane`) before colouring by face, or every colour edge
  is the stair of the faces it was laid in. Colouring by NEAREST BONE makes
  a jagged edge wherever two bones' regions meet — the yoke is "above a
  plane", not "nearest the head".
- **The body is MEASURED, the kit is ADDED.** The flesh round the game's
  bones is the ANSUR II survey's mean man (US Army 2012, 4,082 men: the
  public male file, read locally — every breadth, depth and circumference,
  and each trunk level's height between the hip joint and the neck's base
  laid onto the game's spine); `rider.py`'s `ANSUR` table is those means,
  cited, and nothing else. The kit is `EASE`, metres a side over the body,
  after what a snowmobile racer wears (the racing rules' chest protector
  with shoulder cups, knee and shin guards, leather boots six inches over
  the ankle, gauntlets): a squared padded trunk, capped shoulders, a
  jacket bloused over the hips, baggy pants flared over tall buckled boots.
  Change a garment in `EASE`, never the body.
- **Loft a piece a bone, then REMESH into one skin** (voxel, 6 mm in the
  render, 16 mm and a decimation to budget in the game): a shoulder flows
  into its sleeve and a seat into its thighs, where lofts meeting at a
  joint crease and a skin modifier's hull is a box a section. The remesh
  fills VOLUMES — an open tube (a loft left uncapped) vanishes whole, so
  every piece is capped.
- **Folds are ridges across a bone on the surface's own normal**, on the
  side a joint closes (the crook of the elbow, the back of the knee), all
  round where cloth bunches (a sleeve above the gauntlet, the pants over
  the boot): `FOLDS`, a few millimetres each, is what makes a padded suit
  read as cloth and not rubber.
- **Colour by a plane wherever a bone gives way to another**: the hem,
  the yoke, the cuffs — and the LAPS, square across each thigh, since a
  crouched rider's thighs lie above the hem's plane and "nearest bone"
  leaves a ragged edge in three.js where it looked fine in a still.
- **No sheen on anything exported**: Blender's sheen goes into the glTF as
  a sheen extension three.js draws as a pale bloom (the pants came out
  grey).
- **Budget**: LOD0 ≈ 8.8k triangles (the suit decimated to ~3.2k quads'
  worth, the helmet's grid every fourth of the render's sample and
  single-sided — nothing sees under it — boots, guards and gloves the
  rest), LOD1 3.1k, LOD2 0.9k; render quality ~256k (the 6 mm remesh).

## The trees

`KIND=tree`, `ID=<kind>` (or `all`): ONE glTF a kind, every variant twice —
`v<i>` (the full band) and `v<i>_far`, a HAND-BUILT sketch (three skirts, a
few pads, four whorls, sixteen twigs; a decimation shreds a crown of separate
pieces). `tree.py` reads each form's numbers as `tree-shapes.ts` does and
MODELS them; ~2 s a kind at game quality.

- **The frame.** Metres at `TREE_REFERENCE` (12 m, a 2.88 m crown), z up,
  the lean and the flag to +x. `tree-models.ts` divides crown and height back
  out into the forest's unit frame, the normals through the same squeeze's
  inverse transpose.
- **No colour in the file.** A face is a ROLE (its material's name); a
  vertex's `tone` is a SHADE, a BLEND between the role's two colours and, on
  snow, the LOAD it needs. `treeModel` dresses it per map through
  `kindPaint` and drops the snow the region's load does not reach.
- **Volume normals** on needles and snow (custom normals, out and up); a
  twig's BOTH faces lean out and up — a downward underside turned every bare
  crown black from the saddle.
- **The conifer** is a dark CORE cone (a wood reads solid between the boughs)
  with blunt-tipped, drooping, ridged boughs lofted out of it; pointed tips
  read as a star of shards.
- **Winding.** Blender is z up, so a ring by `(cos a, sin a)` in x, y runs
  anticlockwise from above — the mirror of the code's in x, z. A face order
  ported unchanged faces DOWN: the game culls it (the Cycles still does not),
  so judge in the game's lab.
- **Budget**: full 170–1,670 triangles (`BOUGHS` 48 a conifer, `ARMS` 56 a
  larch), sketches 50–205. In the race: +9% of the frame's triangles boreal,
  +12% alpine, +15% birch (`make profile`, seed 38), draws unchanged.
- **Packed.** `make models` runs each through `scripts/lib/glb-pack.mjs`
  (reordered; positions to 4 mm on the node's scale, normals and tone to 8
  bits; one meshopt view a stream — the JSON was a third of the file at one
  a primitive): ~0.6 MB → 60–180 KB a kind, 2.9 MB the forest.
- **Judged** on `make trees ARGS="--models --from=previews/blender
  --compare --kinds=…"` (the code's row over the model's, triangles under
  each; the whole forest is too tall for one screenshot), then `make build`
  + `screenshots` against a `VITE_MODEL_TREES=0` build.
- **Stamped apart** (`TREE_SOURCES`, `sources.json`'s `trees`; `make models
  SET=trees`) — but `blender.mjs` and `lib.py` are in both lists.

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

**On Linux**: the release tarball (SHA-256 checked), on the PATH or
`BLENDER=`; Cycles falls back to the CPU itself. Models made there differ
from macOS ones only in their floats' last bits.

## The birds, the animals and the marks

`KIND=bird`, `KIND=beast`, `KIND=gate` (`ID=checkpoint`, `start-arch`):
STATIC models on the trees' pattern — no rig, no colour in the file, a face
a ROLE the game paints (`birdRoleColour`, `beastRoleColour`,
`gateRoleColour`), the tone's R a shade — one glTF each, published packed
(`birds/<id>.glb`, `beasts/<id>.glb`, `gates/<id>.glb`), ~2 s a model;
`make models SET=birds` (`beasts`, `gates`) one half.

- **The frame** (`static.py`'s header): Blender x the game's x, z its y,
  −y its z — the exporter's own turn of the game's frame, so the loader
  turns NOTHING and left stays left. A bill and a nose point down −y; a
  pennant streams along +x. (A sled is the other way: its trace is y
  forward and its lab does a half turn.)
- **The shader's tags come off the MESH NAMES**: `body` + `wing` (`aWing`);
  `body`, `head` (all that grazes: `aHead`), `leg_lf` … `leg_rh` (`aLeg` =
  1 + `LEG_PHASE`, `aHip` the root's `hip`), `tail`; the head's pivot on
  the root. The code's own graft flaps, walks and grazes the model, lit
  smooth.
- **The arch is made at ONE reach** (`ARCH.modelReach`) and `archModel`
  stretches it with `remap`: the span to the plan's reach, each leg down to
  its own foot, the foot's hardware moved whole. The banner, the guy lines
  and the dyed line stay the code's.
- **Judge a bird FROM BELOW** (`--views=under`), an animal from the side;
  then `make birds ARGS="--models --from=previews/blender --compare"` and
  `make world` (which loads the committed models). The modelling
  heuristics are the lessons.

## Adding a kind (…)

1. **The data.** A module `scripts/blender/kinds/<kind>.mjs` exporting
   `kind`: `ids()`, and `data(id)` returning the game's OWN tables for one
   (a tree: its kind's variant rows and `crownAt` from `tree-variants.ts`;
   an animal: its row and style from `beast-defs.ts` / `beast-shapes.ts`)
   — imported through `aliasEngine`, never restated — its `builder`, its
   `fallback` id and a `help` line. The driver finds it by its file name.
2. **The builder**, `scripts/blender/<kind>.py`: `from lib import *`, its
   frame stated in its header, `rides()` / `bone()` for the rig, `clip()`
   for what it plays, `finish(name, OUT, SAMPLES, centre, size)` at the end
   — or, for a static kind, `from static import *`, a `Sheet` a part and
   `publish(name, made, OUT, extras=…)`. A helper two kinds need goes into
   `lib.py` or `static.py`. Its sources (the builder, its data module, the
   shelf, the game data it reads) are a list in `pwa/models-plugin.ts` and
   a half of `MODEL_HALVES`, stamped apart in `sources.json`.
3. **The lab.** The kind's own lab owes an asset view like the sled lab's
   (`--asset=`), with the turn back into the game's frame in the lab, not
   in the model, and a rig sheet posing it by the game's own numbers beside
   the builder's (the sled's `rig` sheet and `sled-rig.ts` are the
   pattern).
4. Register nothing new: `make blender KIND=<kind>` is already the target.
   Update this skill's table and the README's `make blender` row.

## The registry

`pwa/src/game/model-registry.ts` is the one list of every kind of object the game draws and whether what the player sees is a Blender model or code — its ids, its code builder (always one: the switch's other side), its Blender builder, committed files and switch when modelled. `docs/models.md` is its table (`make model-registry`), and `tests/model_registry_test.ts` holds the Blender rows to exactly what `modelFiles` packs. **Modelling a kind is a row flipped from `code` to `blender` in the same change that ships its models**; the suite fails until the row, the files and the page agree.

## The models in the game

Every build draws them — local, CI, the site's slots, a release, the
desktop and store apps — unless SWITCHED BACK (`VITE_MODEL_SLEDS=0`,
`VITE_MODEL_RIDERS=0`, `VITE_MODEL_TREES=0`, `VITE_MODEL_BIRDS=0`,
`VITE_MODEL_BEASTS=0`, `VITE_MODEL_GATES=0` in the environment or the root
`.env`; `model-switch.ts`). Every workflow's build step hands on the
repository variables of the same names, so `make ci-models MODELS=off`
switches every CI build back with no commit. `docs/configuration.md` is
the description; what a session needs:

- **Committed, stamped, drift-tested.** `make models` makes every sled and
  `rider0` at game quality (no stills, ~2 min), every tree, bird, animal
  and mark (seconds each), and `scripts/models.mjs` publishes the LOD0s
  into `pwa/models/<id>.glb` / `rider.glb` and the static models packed
  into `trees/`, `birds/`, `beasts/`, `gates/`, with `sources.json`: one
  hash a half (`MODEL_HALVES` in `pwa/models-plugin.ts` — the builders,
  the driver, the kind's data module, and the game data they read).
  `tests/models_test.ts` recomputes each: a change to any source FAILS the
  suite until `make models SET=<half>` is run and `pwa/models/` committed
  with it. CI therefore needs no Blender. Add a file a builder reads to
  its half's list, or its changes go unseen.
- **Packed by the build** (`pwa/models-plugin.ts`, before `appPwa` so the
  worker precaches them; a build whose model is missing FAILS, naming
  `make models`) and **fetched before anything is built** — `loadModels()`
  where the renderer's chunk lands (`use-render-kit.ts`) and where the
  sled card's turntable lands (`sled-picker.tsx`).
- **The code machine is still built and still the machine.** `attachModels`
  hangs the model beside it and COLLAPSES the code's drawn parts out of the
  merged draw (`posed-merge.ts`); the lamps, the glow, the bound, the
  thrown rider and every reader of a `SledModel` go on as they were. The
  machine is posed by `sled-rig.ts`, the rider by `rider-rig.ts` at the
  figure's own pose. "Up" and "side" are the MACHINE's (`rigAsset` reads
  them off the loaded scene's frame), never the lab's floor.
- **Dressed, not repainted by hand.** `dressOf` maps each material's NAME
  (as `sled.py` / `rider.py` name it — `tests/models_test.ts` reads them)
  to the style's colour or to the code machine's own lamp, taillight and
  glass materials, so `setLamps` lights the model's lenses; every other
  material goes through the world's `wrap`. A livery's pattern decals do
  not reach a model (open work). One rider model for every kit.
- **Cost**: a machine's LOD0 ~16k triangles, the rider's ~9k, a bird
  300–600, an animal 550–700, the arch ~3.5k; the lower LODs are packed by
  nothing yet (open work: rivals at range on LOD1).

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
What belongs here: a Blender or glTF trap met, a budget measured on a new
kind, a modelling move that made a class read (or failed to), a kind added.
