---
name: game-feel
description: "Use when the task is about how the game FEELS to ride — the sensation of a sled meeting snow (the float onto the powder, the bite of the skis on the groomer, the kick off a crest, the hang, the landing), the sense of speed over snow, the camera's framing, how pace and danger read on screen. The feeling of riding IS the core product; this skill owns the reference (the arcade winter racers of the late 90s, with a modern look), the levers that create the sensation across the snow, the probes, the generator's kickers and the camera, how the levers interact, and the look-first verification loop. Load it for any change whose acceptance test is 'does it feel like riding a sled', alongside the skill that owns the specific subsystem being edited."
---

# Game feel — the sled meeting the snow

The whole game is one sensation: a machine on a ground that is TWO grounds —
a groomed track the skis bite and the tread drives on, and deep powder the
sled sinks into at walking pace and climbs onto the top of as speed builds. A
change can pass every test and still fail the product: **the acceptance test
for feel is a ride table, a picture or a run, looked at**, next to the
reference. This skill owns that judgement and the levers behind it.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs game-feel`. Record what a tuning session
learns at the end (`skill-reflection` owns the format).

## The reference: the arcade winter racers

The arcade snowmobile and snowboard racers of the late nineties are the north
star for how snow and a machine on it should read — named as a GENRE, never
as a title (the router's rule). What they got right, and what every lever
below is measured against:

- **The snow is a PARTICIPANT, not a floor.** The track is fast and sure; the
  powder beside it is slow and deep and costs you, until you carry enough
  speed to skim it. Leaving the line is a decision with a price.
- **Speed is felt through the MACHINE, not the speedo.** The nose nodding
  over every roller, the skis working on their springs while the body floats,
  the roost off the back, the trail you leave — a sled at 110 km/h on a flat
  groomer reads slower than one at 70 through rollers and powder.
- **Air is a moment.** A crest taken at speed throws you: the engine note
  jumps as the tread spins free, the snow stops hissing, the nose drifts, and
  the landing is a decision — gas it to lift the nose, brake to drop it, lean
  to match the slope you are coming down on. Every flight has a launch, a
  hang and a landing that each read distinctly, and a flat landing HURTS.
- **The turn is weight.** On the groomer the skis carve and the sled leans a
  little; in powder the rider throws his weight to the inside and the whole
  machine rolls onto its edge and comes round. Standing up, hanging off,
  tucked — the rider's body is how the sled is ridden and it has to show.
- **The camera stays low and behind, and the horizon breathes.** Close over
  the tunnel, low enough that the next crest hides the dip behind it; it
  follows the sled's heave with a lag, swings through the turn, and a big
  landing shakes it.
- **Checkpoints are the course.** Flags read from a distance, the next one is
  always findable (the arrow says where), and missing one costs.

Two frames to hold in mind: a groomed trail through a snow-loaded forest at
speed, for the rhythm of the rollers and the flags; and an open powder field
in low winter sun, for the float, the glitter and the fresh trail cut behind
the sled. `make world` names these views `track`, `furrow` and `powder`.

## The levers, and who owns each

Feel is produced by several subsystems TOGETHER. A change to one usually
needs a sympathetic change in another — deeper powder with no more power is a
game that is harder, not more dramatic.

| Lever | Where | Owning skill |
| --- | --- | --- |
| How the machine answers the snow: the springs, the sink, the grip, the drive, the carve, the air | `engine/game/sled.ts`, `suspension.ts`, `snow.ts`, `traction.ts`, `flight.ts`, `defs/tuning.ts` | `sled-physics` |
| The machine's own numbers: mass, power, stance, springs | `engine/game/defs/sled.ts` | `sled-tuning` |
| The country: hill scale, the kickers, the loop's corners and length, how much powder there is to cut across | `engine/mapgen/rules.ts` | `mapgen-improvement` |
| The camera: the ladder, its rigs, the flown hand-over | `pwa/src/game/camera.ts`, `camera-rigs.ts` | (this skill) |
| What the sled throws and leaves: the roost, the ski spray, the landing puff, the trail, a pulse in the hands | `pwa/src/game/spray.ts`, `trail-stamp.ts`, `rumble.ts` | `visual-effects` |
| The snow's LIGHT: the glitter, the blue in the shadows, the packed track's grain, the trough walls | `pwa/src/game/snow-glsl.ts`, `terrain.ts`, `trail-map.ts` | `snow-look` |
| The sky and the sun the snow is lit by | `pwa/src/game/sky.ts`, `environment.ts`, `haze.ts` | `atmosphere` |
| The rider on the saddle | `pwa/src/game/rider-pose.ts`, `rider.ts` | `rider` |
| What is heard: the engine, the hiss, the powder's rush, the wind | `pwa/src/game/audio/` | `sound-effects` |

What each contributes:

- **The two grounds are the drama.** The planing speed (`snow.planeSpeed`),
  the sink and the plough decide how long powder holds a rider and how much a
  shortcut costs; the grip blend by `packed` decides how sure the track is.
- **The probes are the sled's nerves.** Two skis and eight tread stations
  read the snow, and their lever arms turn a roller into pitch and a sidehill
  into roll. Softer springs read as a boat; stiffer as a cart.
- **The kickers are the air.** R4 and R9 shape crests so they throw; the
  profile (t² to the lip, steepest at the lip) is what makes a kicker a jump
  rather than a hill. A kicker that flattens at its top hands the sled no
  upward speed.
- **The camera sits low and follows with a lag.** A lens that rides the
  sled's heave exactly reads a mogul field as nothing; one fixed in height
  reads it as the sled bouncing. The answer is in between (`heightFollow`,
  `heightFollowAir` per rung).
- **Speed only feels fast against scale.** Trunks passing close, flags
  flicking by, the trail beside the track — a wide empty meadow at 100 km/h
  reads as 40.

## The camera module, and what it decides

The camera is this skill's own subsystem. `camera-rigs.ts` is the ladder as
data and arithmetic, three-free so `tests/world_render_test.ts` reads it;
`camera.ts` puts the answer on a three.js camera, with the flown hand-over.

| Question | Where |
| --- | --- |
| The rungs, and the order `C` walks them | `RIGS` in `camera-rigs.ts` (`hood`, `bars`, `chase`, `far`, `high`, and `orbit` for the menu); `RUN_CAMERAS` / `nextCamera` in `settings.ts` |
| Where a BOLTED lens sits on the sled, and how much of its pitch and roll it takes | `hood` / `bars`: `eye`, `rollShare` — the lens pitches and rolls WITH the machine, which is the whole sensation of those views |
| Where a BOOM lens stands behind, and how it pulls back with speed | `dist`, `distPerSpeed`, `height`, `fovPerSpeed`, `fovMax` |
| How it follows the heave, on the snow and in the air | `heightFollow`, `heightFollowAir`, `followRate` |
| Looking through a slide | `slipWeight` — the blend between the nose and the way |
| Never inside the snow | `clearance` |
| Never inside a tree or a post | `camera-clear.ts` — the `LineClear` a boom pulls its arm in against: the trees AS DRAWN (a lens meets the crown, not the trunk), the checkpoint stakes and the start banner, walked from the helmet out |
| A switch that is a move rather than a cut | `HANDOVER` seconds of `blendLens` in `camera.ts` |
| Which rung each shell surface gets | `cameraFor` in `shell.ts` |
| The player thrown: the lens off the ladder, after the body, the slow motion into the impact and the rise over him | `camera-death.ts` (`DEATH`, `frameDeath`); the rate reaches the app as `renderer.timeRate()` — slow motion is fewer steps per frame and nothing else |

**A reading that moves where the camera STANDS is taken before the lens is
placed.** The snow height under the lens, the follow target and the
pull-back are all sampled AT the lens; a boom moved after that sample stands
over snow read a metre away, and on a ridge that is a shot that pumps.

## The workflow

1. **State the feeling** being tuned in one sentence ("a kicker at 90 km/h
   should hang long enough to correct the nose, and a flat landing should
   cost you"), and find the reference moment for it.
2. **Change the smallest set of levers** that plausibly produce it. Numbers
   in `defs/tuning.ts`, `defs/sled.ts` or `rules.ts`, not new mechanics,
   unless the mechanic is the gap.
3. **Read it on the bench BEFORE looking at it.** Every feel lever has a lab
   that runs in seconds with no build:

   ```sh
   make ride SCENARIO=accel-powder   # the float: when the sled planes
   make ride SCENARIO=kicker         # the air: launch, hang, carry, landing
   make ride SCENARIO=turn-powder    # the carve
   make level SEED=<n>               # the map: where the kickers and the corners are
   ```

   The ride table is where a claim is made. A feel that cannot be pointed at
   in a row is a feel that will not survive the next tuning pass.
4. **`make sim` before and after** any engine or rules lever — the feeling is
   never allowed to cost the bot the map (finishes, pace, resets and hits are
   the regression surface).
5. **LOOK**: `make world SEED=<n>` (its own bundle, no `make build`) for the
   renderer's views of one ridden run; then `make build` and
   `make screenshots` for the app (in web sessions
   `CHROMIUM_PATH=/opt/pw-browsers/chromium`). Compare proportions, not vibes:
   how much of the frame is snow, where is the horizon, does the sled's
   attitude read, is there snow in the air where the tread meets it? **Every
   camera framing change gets a PORTRAIT shot** (390×844): the fov is
   vertical, so landscape cannot show what a phone held upright does.
6. **Iterate camera and FX freely** — they are presentation and cost nothing
   to re-tune. Engine feel numbers move in small steps, each re-labbed.

## Hard-earned constraints

- **What is drawn IS what is simulated.** The terrain is the engine's own
  heightfield and the sled stands on the engine's own contacts. The trail is
  the one deliberate exaggeration, and it is stated in one place: the drawn
  furrow is the physics' `sink` or the powder's own furrow, whichever is
  deeper (`drawnDepth` in `trail-stamp.ts`) — never shallower than the
  support the sled rides on. Deeper powder is a `sled-physics` change.
- **Powder must cost, and speed must buy it back.** Any help that lets a slow
  sled skim powder flattens the choice between the line and the shortcut.
- **The sled leans into the turn; it does not slide flat.** A sled that yaws
  round on the groomer with no roll reads as a hovercraft; one that slides
  sideways through every corner reads as a car. The arcade hand on the yaw
  (`steer.yawHold`) is there to stop spins, not to add turn.
- **The landing is charged for what the flight put in** — the speed INTO the
  slope, not the fall height. Landing on the downslope of a kicker is fast;
  landing flat past it is not. A landing charged every time a probe chatters
  over a roller is a sled that stops dead in a mogul field.
- **Anything that vibrates the lens is a few incommensurate oscillators
  under 8 Hz on a decaying envelope**, never a fresh random offset per frame:
  white noise at a real landing's amplitude is a broken picture, and at 30
  fps it aliases into a slow lurch.
- The renderer never mutates `GameState`; feel state that must persist
  (camera smoothing, the spray's decay, the trail map) lives in renderer-side
  closures and resets with the next map.
- Readouts the FX need from the rider (throttle, steer, lean, slip) are
  `SledState` / `SledInput` fields the engine wrote — the renderer never
  re-derives intent from physics deltas.
- The screen is a MIRROR of the engine's map view: work in world coords and
  stay sign-consistent; never flip a sign in the camera to fix a perceived
  left/right issue. Heading 0 is +z and grows clockwise from above; forward
  is `(sin h, cos h)`.
- Speed thresholds quoted in feel terms convert as 100 km/h ≈ 27.8 m/s; the
  engine is all metres and seconds.

## What the change obliges elsewhere

- A lever in `tuning.ts` / `sled.ts` → `docs/riding.md`, the ride lab's
  before/after, `make sim` both tables.
- A camera change → `make screenshots` at every reference viewport in the PR.
- A user-visible change → a `.changes/unreleased/` fragment (`changelog`).

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
lever that reliably fixes a feel complaint, a coupling between a snow number
and a map number, a camera fraction that turned out to be the whole
difference — and the reference moment a session found itself comparing
against, so the next one starts there.
