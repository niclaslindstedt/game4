---
name: sled-design
description: "Use when designing or changing how the SLED LOOKS — its silhouette, the skis and their spindles, the tunnel and the tread under it, the cowl, the windshield, the bars, the seat and the running boards, the snow flap, the suspension, the liveries (paint, trim, pattern) and the colours of the four grid slots. Owns the low-poly builder (`pwa/src/game/sled-body.ts` the chassis, `sled-gear.ts` the running gear and its suspension, both built in the engine's own body frame off `defs/sled.ts` and each class's TRACED LOOK in `sled-looks.ts`), the liveries (`sled-liveries.ts`), the style table (`SLED_STYLES`), and the trace-render-compare loop: `make sled` for contact sheets of every machine by view, livery and pose, `make world` for a ridden run, then the built app with `make screenshots`, LOOK, refine, then verify at speed."
---

# Sled design

The sled is not modelled in a DCC tool: it is **generated**, off two sources.
Its SPEC (`engine/game/defs/sled.ts`) says where the physics' skis and belt are
and how tall it stands on its springs; its class's TRACED LOOK
(`pwa/src/game/sled-looks.ts`) says what it looks like — the cowl's outline,
the screen's corners, the grip and the steering post, the seat's line, the
tunnel's edges, the flap, the ski's profile, the idler, the drive and the
belt's upper run, the boards, the lamps, and what rides on the tail — traced
point by point off a studio photograph of a real machine of the class, drawn
back over the photograph to check the line, scaled by the class's published
length, and kept as metres with no make or model. `lookFrame` carries a trace
onto a spec by pinning the traced ski centre to `skiForward` and the traced
rear idler to `treadRear`; the spec's ski line and belt run were themselves
read off the trace, so the stretch is 1 (`tests/livery_test.ts`). The rider
is carried by the traced grip's distance from `MOUNTS.grip`, so he sits on the
seat the trace drew. Designing the sled means editing a trace, the builder or
a livery and LOOKING, never guessing from numbers.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs sled-design --list`. Load `skill-reflection`
at both ends, and `write-code` beside this skill for any code change.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/sled-looks.ts` | THE TRACES, one per class, in the trace's own frame (z forward from the tunnel's end, y up from the snow), and `lookFrame` onto a spec. Three-free |
| `pwa/src/game/sled-body.ts` | The CHASSIS (`createSledModel`): the cowl off the traced outline, tapered to its nose and crown and painted above the side panels (`clip`, `cutBy`), the livery's decals on its flanks and down the tunnel, the lamps under their brow, the screen, mirrors, plates, the bars (a mountain sled's loop), the seat, the tail pack / cargo box / trunk / backrest / rails, the tunnel, the flap, the boards; and the rider. `SLED_STYLES` — four grid slots; `styleIn` dresses one in a livery |
| `pwa/src/game/sled-gear.ts` | THE RUNNING GEAR, posed off the engine's compressions: each ski (traced profile, tip loop) on its spindle, upper and lower A-ARMS, a COIL-OVER and a TIE ROD; the belt as a visible LOOP over the traced idler and drive with its lugs standing all the way round, the SKID RAILS, BOGIE and IDLER wheels, the front and rear ARMS and the coil-overs up to the tunnel — struts re-laid each frame |
| `pwa/src/game/sled-liveries.ts` | THE LIVERIES: four per machine (paint, trim, panels, seat, springs, pattern) and the PATTERNS (stripe, twin, swoosh, split, chevron, race) stated in the cowl flank's own (u, v). The player's pick is `Settings.liveries`; the field keeps its grid slots' colours in its machine's own pattern |
| `pwa/src/game/posed-merge.ts` | ONE DRAW PER POSED FIGURE: the sled and its rider are posed as a tree of small meshes (a group a ski, a capsule a limb), but every part is taken off the picture and what is drawn is one vertex-coloured mesh per machine, each part a rigid bone of it that the GPU lays through the part's matrix (a skinned mesh, so every shadow pass follows the pose) — forty parts in four riders were most of a frame's draws, and re-laying their vertices on the processor was half of a desktop's frame. A new part goes into the tree and is merged like the rest, never drawn on its own |
| `pwa/src/game/rider.ts`, `rider-pose.ts` | The rider — the `rider` skill's. His hands and feet are fixed to this builder's grips and boards through `MOUNTS` in `rider-pose.ts`, so moving the bars, the seat or the boards moves him |
| `engine/game/defs/sled.ts` | NOT this skill's file — the physics' spec. The builder READS `skiStance`, `skiForward`, `skiWidth`, `treadLength`/`Width`/`Front`/`Rear`, `length`, `width`, `height`, `cogHeight`, the suspensions' travel; a style never restates them |
| `pwa/src/game/renderer.ts` | Places each model off its `SledState` (interpolated in `interp.ts`) — the mesh's origin is the CoG, so it pitches and rolls about the point the physics does. A slot whose run is on another machine than its model was built off is REBUILT (a new pick raced on the same map) |
| `pwa/src/game/sled-turntable.ts` | The sled card's stand: the same builder, in the livery picked, at rest at the springs' sag on a disc of snow, turning (`make screenshots ARGS="--surface sled,sled-mountain"`, or `?menu=sled&sled=<id>`) |
| `scripts/sled-preview.mjs`, `pwa/src/tools/sled-harness.ts` | `make sled` — THE SLED LAB: contact sheets built with the game's own builder. `machines` (every machine by side, front, rear, three-quarter and chase — the elevations orthographic on a metre grid), `liveries`, `poses` (one machine, every pose the rider takes), `landing` (the body on its legs through a landing, a frame every 60 ms). No `make build` |
| `pwa/src/identity.ts` | The PALETTE — the player's sled is `PALETTE.flag`, the brand's red |
| `scripts/world-preview.mjs` | `make world` — one map ridden by the bot, photographed through the game's own renderer at named views (`hood`, `bars`, `far`, `orbit`, `jump`, `landing`, …). Its own bundle, no `make build` |

## The loop: world → LOOK → iterate → the built app

1. **Shoot the current state**: `make sled` (every sheet; `ARGS="--sheet=machines
   --views=side --cell=640"` for silhouettes big enough to judge a line), the
   machines on the sled card (`make screenshots ARGS="--surface sled,sled-mountain"`),
   then `make world SEED=38
   ARGS=--views=orbit,far,jump,landing` (with
   `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a web session). `orbit` walks
   round the machine; `far` is its read at range; `jump` and `landing` show
   the skis hanging and the suspension taking the hit. Keep the pictures —
   the PR owes before and after.
2. **Change one axis at a time** — a profile, a proportion, a colour — and
   re-shoot. A change that moved three things teaches nothing.
3. **LOOK — with the Read tool.** Judge the silhouette from the side and
   from behind.
4. **Then the built app**: `make build`, then `make screenshots` (the chase
   camera at its real range, at every reference viewport). The landscape
   frame is the verdict; `make world` only diagnoses.
5. **`make profile`** — the sled is four of them on the grid; a part that
   added a draw call added four.

**A NEW TRACE** is taken the way the six were: a clean studio side view of a
real machine of the class (kept out of the repository, and nothing about it
named), pixel picks cropped and zoomed, scaled by a published length, the
polyline drawn back over the photograph and LOOKED at before a number is
kept, then the ski line and belt run read into the spec.

## Judging the sled

- **The chase view is the verdict.** The sled is judged from behind and a
  little above, at speed, maybe 60 px tall — the tunnel and flap, the rider's
  back, the skis either side must read THERE.
- **It reads as a snowmobile.** Two skis out front on visible spindles, a
  cowl and a windshield, bars with a rider standing up behind them, a long
  tunnel over a tread, a snow flap. A machine that reads as a quad or a jet
  ski has lost a line.
- **Four slots, told apart at a hundred metres against white.** The
  player's red, and three rivals chosen for contrast against snow and pine —
  never white, never pale blue. A rival colour that vanishes in the snow is
  a race nobody can read.
- **The skis are on the snow.** At rest the drawn skis and tread sit at the
  sag the springs settle at (`rest` in `make ride`: about 8 cm either end);
  a sled drawn above its own contacts hovers, one drawn below sinks through
  its own trail.
- **Match the world's art direction**: faceted low-poly, flat-shaded under
  the scene's sun and sky light, colours as hex in the style table or the
  palette. Judge under a low sun as well as at midday (`?seed=` deals the
  hour; pick a seed with an early one).

## The rules

- **The builder reads the spec; the style adds only what the spec does not
  say.** Colours are style; the stance, the tread's run and the CoG height
  are the spec's. A drawn dimension that restates a physics number drifts on
  the next spec change.
- **The mesh's origin is the CoG.** The physics pitches and rolls about it;
  a mesh whose origin is the tread's rear swings the nose through the snow
  for nothing the physics did.
- **What moves, moves off the engine's readings.** The skis' steer is
  `skiAngle`, not the input; each ski's travel is its compression; the flap
  follows the rear. A part animated off the INPUT leads the physics and
  reads as a puppet.
- **Build once, move per frame.** Geometry and materials are built once per
  model; the renderer only moves them. An allocation in the frame loop is a
  leak that shows as a stutter minutes in.
- **One draw per machine.** `posed-merge.ts` draws the whole posed tree as
  one mesh; a part added outside it is a draw call times four riders times
  the shadow pass. `make profile` holds the count.
- **The rider reaches what is drawn.** Moving the bars, the seat or the
  running boards moves `MOUNTS` with them, or his arms stretch to grips that
  are not there — `tests/world_render_test.ts` reads the pose.

## What the change obliges elsewhere

- `make world` before and after, `make screenshots`, `make profile` in the PR.
- A `.changes/unreleased/` fragment — the sled is what the player looks at
  for the whole race.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. What belongs here:
a proportion that reads wrong at chase range and right up close, a colour
that vanishes against snow or pine, a part the builder was missing.
