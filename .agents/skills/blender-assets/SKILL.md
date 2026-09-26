---
name: blender-assets
description: "Use when a game asset is to be MODELLED IN BLENDER off the game's own data — the sleds and the rider today; a tree, an animal or any other drawn thing when its kind is added — for studio renders, a real-time glTF with LODs, or to find out how good an authored version of something the game builds in code could look. Owns `make blender` (`scripts/blender.mjs`, the registry of KINDS and the JSON each is handed), the Blender shelf (`scripts/blender/lib.py`: the helpers, the studio, the game-budget export) and each kind's builder (`scripts/blender/sled.py`, `rider.py`), the RIG every model carries and the clips baked into it (the game-side contracts `sled-rig.ts` and `rider-rig.ts`), the lab sheet that sets a model beside the game's own (`make sled ARGS=--asset=…`), THE MODELS IN THE GAME (the `VITE_MODEL_SLEDS` / `VITE_MODEL_RIDERS` build switches, `make models`, `pwa/models-plugin.ts`, `sled-models.ts`: packed, loaded, dressed, posed in place of the code's drawn parts), the frame a model is stated in and turned back from, the triangle budget and its LODs, installing and running Blender headless on macOS, reference photographs (local only, never committed, never named), and adding a new kind. Not the game's own builders (`sled-design`, `nature`, `rider`) — though they are what every model is held against."
---

# Blender assets

The game ships **no asset files** by default: every sled, tree, animal and
the rider is built in code — and a build that asks (`VITE_MODEL_SLEDS=1`,
`VITE_MODEL_RIDERS=1`) draws the machines and the rider modelled here
instead (§ "The models in the game"). This skill is the other road, kept open on purpose — the same
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
   `previews/blender/`; a build that draws the models packs them from
   there (`make models`, then the switches — below).
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
| `scripts/blender.mjs` | THE DRIVER (`make blender`): `KINDS` (per kind: its ids, the JSON of the game's data for one, its builder, its default), finds Blender, runs each QUALITY, echoes what matters (`BONES`, `CLIPS`, `TRIANGLES`, what was saved, any traceback) and fails on a Python error |
| `scripts/blender/lib.py` | THE SHELF every builder imports: the scene, `mat`, the geometry (`loft`, `superellipse`, `tube`, `cyl`, `box`, `ellipsoid`, `coil`, `catmull`, `resample`, boolean cutters), THE RIG (`rides`, `bone`, `marker`, `clip`, `morph`), and `finish()` — the rig built and skinned, the clips baked, the studio, the Cycles stills, the join into one skinned mesh, LOD0 and the decimated LODs as glTF |
| `scripts/blender/rider.py` | THE RIDER BUILDER (`KIND=rider`, `ID=rider0…3` a grid slot's kit): one SUIT that bends (a man of the ANSUR II survey's mean measure in a racer's kit, lofted a piece a bone, remeshed into one skin, creased where a joint bends, cut along the hem, yoke, cuff and lap planes before it is coloured, weighted across each joint between the two bones that meet there) and rigid parts on one bone each — the helmet laid on the game's MEASURED shell (`helmetReach` / `helmetPart` sampled on a grid), the boots, the gloves |
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
- **Use every point the trace carries.** The screen is FOUR corners (the
  front edge base → top, the side edge foot → back): lofted off the front
  edge alone, a touring screen came out a flat slab hovering over the bars;
  wrapped from the front edge round to the side edge, its lower edge laid
  on the cowl, it reads as the tall wrapped screen it is. The mirrors and a
  race sled's plates are in the trace too — check `SledLook`'s fields
  against the builder whenever a class looks thin.
- **Lay what sits on a panel ON the cage** (`ring_at`, `cowl_top`): a flat
  box for a number plate cuts through the curved cowl; a patch lofted off
  the cage's own points follows it.
- **A boolean needs a rim.** A hole placed off one edge of a plate goes
  through that edge where the plate is shallow (a touring tunnel is 4 cm
  deep at the tail), and the boolean then drops the whole panel — silently.
  Place holes at mid-depth and skip them where the plate is too shallow.
- **Hang what hangs from what it hangs on.** A traced flap that starts
  below a shallow tunnel's deck floats; carry its top up to the deck.
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
   frame stated in its header, `rides()` / `bone()` for the rig, `clip()`
   for what it plays, `finish(name, OUT, SAMPLES, centre, size)` at the end. A helper two
   kinds need goes into `lib.py`.
3. **The lab.** The kind's own lab owes an asset view like the sled lab's
   (`--asset=`), with the turn back into the game's frame in the lab, not
   in the model, and a rig sheet posing it by the game's own numbers beside
   the builder's (the sled's `rig` sheet and `sled-rig.ts` are the
   pattern).
4. Register nothing new: `make blender KIND=<kind>` is already the target.
   Update this skill's table and the README's `make blender` row.

## The models in the game

A build draws them when it is ASKED to: `VITE_MODEL_SLEDS=1` (every
machine) and/or `VITE_MODEL_RIDERS=1` (the rider), in the environment or
the root `.env` — both OFF by default, and off the game is exactly the one
that ships no asset files. The loop: `make models` (every sled and
`rider0`, game quality, into `previews/blender/`), then
`VITE_MODEL_SLEDS=1 VITE_MODEL_RIDERS=1 make build` and `make screenshots`
(a race, `--camera far`, and `--surface sled` for the turntable).

- **Packed by the build, never committed.** `pwa/models-plugin.ts` emits
  `models/<id>.glb` and `models/rider.glb` from `previews/blender/*-lod0.glb`
  into the bundle (before `appPwa`, so the worker precaches them) and
  serves them the same way in dev; a switched-on build whose model has not
  been made FAILS, naming `make models`. `envDir` is the repository root.
- **Fetched before anything is built.** `loadModels()` runs where the
  renderer's chunk lands (`use-render-kit.ts`) and where the sled card's
  turntable chunk lands (`sled-picker.tsx`) — a builder that ran first drew
  the code's machine on the card while the race drew the model.
- **The code machine is still built and still the machine.** `attachModels`
  (in `createSledModel`) hangs the model beside it and COLLAPSES the code's
  drawn parts out of the merged draw (hidden parts get a zero bone,
  `posed-merge.ts`); the lamps, the glow, the bound, the thrown rider, the
  cockpit views' hidden rider and every reader of a `SledModel` go on as
  they were. The model is posed each frame off the same readings: the
  machine by `sled-rig.ts` (with the drawn furrow's `SINK_SHARE` and the
  belt's run off `way`), the rider by `rider-rig.ts` at the figure's own
  pose — on the seat or thrown (`ragdollPose`), his holder where the
  figure's group stands.
- **"Up" and "side" are the MACHINE's.** A rig written against the lab's
  level floor (the world's up, the world's x) turned the skis about the
  wrong axis the moment the machine pitched; `rigAsset` reads both off the
  frame the loaded scene hangs in.
- **Dressed, not repainted by hand.** `dressOf` maps each material's NAME
  (as `sled.py` / `rider.py` name it — `tests/models_test.ts` reads them)
  to the style's colour (paint, trim, seat, springs; the kit's jacket,
  yoke, pants, helmet, peak, goggles), or to the code machine's OWN lamp,
  taillight and glass materials, so `setLamps` lights the model's lenses
  and the brake shows. Every other material is cloned and passed through
  the world's `wrap` (the haze, a ghost's see-through). A livery's colours
  reach a model; its pattern's decals do not (open work: a decal layer).
- **One rider model for every kit**: `rider0` dressed per slot.
- **Cost**: a machine's LOD0 (~16k triangles, a draw per material) and the
  rider's (~9k) for every rider on the grid — the lower LODs are packed by
  nothing yet (open work: rivals at range on LOD1).

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
What belongs here: a Blender or glTF trap met, a budget measured on a new
kind, a modelling move that made a class read (or failed to), a kind added.
