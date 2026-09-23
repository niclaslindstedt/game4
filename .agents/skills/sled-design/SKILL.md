---
name: sled-design
description: "Use when designing or changing how the SLED LOOKS — its silhouette, the skis and their spindles, the tunnel and the tread under it, the cowl, the windshield, the bars, the seat and the running boards, the snow flap, the colours of the four grid slots. Owns the low-poly builder (`pwa/src/game/sled-body.ts`: the machine built in the engine's own body frame off `defs/sled.ts`, the skis turning with `skiAngle` and riding their compression, the tread with the rear's), the style table (`SLED_STYLES`), and the render-compare-iterate loop: `make world` for the renderer's own views of a ridden run, then the built app with `make screenshots`, LOOK, refine, then verify at speed."
---

# Sled design

The sled is not modelled in a DCC tool: it is **generated**.
`pwa/src/game/sled-body.ts` builds it from extruded profiles and boxes in the
engine's own BODY FRAME — x right, y up, z forward, the origin at the centre
of gravity of machine and rider, the snow `SLED.cogHeight` under it — so
every dimension reads against `engine/game/defs/sled.ts` and the drawn skis
stand where the physics' ski probes are. Designing the sled means editing
the builder or a style and LOOKING, never guessing from numbers.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs sled-design --list`. Load `skill-reflection`
at both ends, and `write-code` beside this skill for any code change.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/sled-body.ts` | The builder (`createSledModel`): two SKIS a stance apart on SPINDLES under A-arms, turning with the engine's `skiAngle` and riding up and down with each ski's compression; the TREAD under the TUNNEL from `treadFront` to `treadRear`, climbing to the drive under the cowl, with a SNOW FLAP moving with the rear's compression; the COWL and its headlight, the WINDSHIELD, the BARS on their riser, the SEAT, the RUNNING BOARDS; and the rider hung on top. `SLED_STYLES` — four colour schemes, one per grid slot |
| `pwa/src/game/posed-merge.ts` | ONE DRAW PER POSED FIGURE: the sled and its rider are posed as a tree of small meshes (a group a ski, a capsule a limb), but every part is taken off the picture and what is drawn is one vertex-coloured mesh per machine, its vertices re-laid each frame through each part's matrix — forty parts in four riders were most of a frame's draws. A new part goes into the tree and is merged like the rest, never drawn on its own |
| `pwa/src/game/rider.ts`, `rider-pose.ts` | The rider — the `rider` skill's. His hands and feet are fixed to this builder's grips and boards through `MOUNTS` in `rider-pose.ts`, so moving the bars, the seat or the boards moves him |
| `engine/game/defs/sled.ts` | NOT this skill's file — the physics' spec. The builder READS `skiStance`, `skiForward`, `skiWidth`, `treadLength`/`Width`/`Front`/`Rear`, `length`, `width`, `height`, `cogHeight`, the suspensions' travel; a style never restates them |
| `pwa/src/game/renderer.ts` | Places each model off its `SledState` (interpolated in `interp.ts`) — the mesh's origin is the CoG, so it pitches and rolls about the point the physics does |
| `pwa/src/identity.ts` | The PALETTE — the player's sled is `PALETTE.flag`, the brand's red |
| `scripts/world-preview.mjs` | `make world` — one map ridden by the bot, photographed through the game's own renderer at named views (`hood`, `bars`, `far`, `orbit`, `jump`, `landing`, …). Its own bundle, no `make build` |

## The loop: world → LOOK → iterate → the built app

1. **Shoot the current state**: `make world SEED=38
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
