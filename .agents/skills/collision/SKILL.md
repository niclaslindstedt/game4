---
name: collision
description: "Use when working on the sled TOUCHING SOMETHING THAT IS NOT SNOW, and on the course COUNTING something — a trunk met, another sled shouldered, the soft push back from the map's edge, a checkpoint's line crossed or ridden past, a lap closed, the flag, the reset back onto the track — and on what the events (`hit`, `bump`, `checkpoint`, `missed`, `lap`, `finish`, `reset`, `land`, `air`) mean. Owns `engine/game/collision.ts` (the trunks and the edge), `course.ts` (the checkpoints, the laps, the reset), the sled-against-sled shoulder in `rivals.ts`, `TUNING.trees` / `.bounds` / `.course` / `.reset`, and the stage-a-contact → LOOK loop. The snow itself is `sled-physics`'s; what a crash does to the rider and the machine (the wipeout, the trench, damage) is `crash`'s."
---

# Collision: the sled meeting what is not snow

The snow is `sled-physics`'s — the springs, the sink, the chassis points on a
slope. This skill owns the moments the sled meets something that STANDS UP
out of the snow — a trunk, another sled, the map's edge — and the moments the
course COUNTS something — a checkpoint crossed, one ridden past, a lap, the
flag, the reset. They are one skill because they share the path: the same
segment from last step's CoG to this step's that crosses a checkpoint's line
is the one the trunks and the edge push back.

Load **`write-code`** beside this one (always), **`sled-physics`** when the
answer involves what the sled does AFTER a contact, **`mapgen-improvement`**
when the work touches where trees and checkpoints STAND, and
**`test-scenario`** for staging exact contacts.

## The map — who owns what

| Piece | File |
| --- | --- |
| Trunks: a vertical cylinder per tree, the sled as three plan circles down its length, push-out along the line of centres, restitution, the scrub along the trunk, the lever that turns the sled; hashed per level (`treesNear`); the `hit` event | `engine/game/collision.ts` (`collideTrees`) |
| The map's edge: a soft push over the last `bounds.soft`, a hard stop `bounds.margin` inside | `engine/game/collision.ts` (`keepInBounds`) |
| The chassis on the snow: belly, cowl, bumper, helmet — impulses when the springs run out | `engine/game/chassis.ts` (the `sled-physics` skill) |
| Checkpoints: a line across the track crossed in its facing direction within its width plus `course.grace`; ONE LIVE AT A TIME; the laps; the flag | `engine/game/course.ts` (`crossedCheckpoint`, `crossedLine`, `stepCourse`) |
| The arrow to the owed checkpoint | `bearingToNext` in `course.ts` — the HUD and the bot both read it |
| The reset: stood on the track `course.resetAhead` past the last checkpoint taken (or short of the start line), facing along it, at rest; the rider's or the engine's (on its back, or stuck) | `course.ts` (`resetPose`, `standSled`, `resetSled`), `run.ts` for the automatic one, `TUNING.reset` |
| SLED AGAINST SLED: two plan circles down each machine, pushed apart with the closing speed traded at `RACE.bump.restitution` — a shoulder, not a solver; the `bump` event | `rivals.ts` (`clipRiders`), `RACE.bump` in `defs/modes.ts` |
| Every number | `TUNING.trees`, `.bounds`, `.course`, `.reset` in `defs/tuning.ts`; `RACE` in `defs/modes.ts` |
| Where a tree, a checkpoint, the grid stands | `engine/mapgen/` (`forest.ts`, `spawn.ts` under `rules.ts`) — the `mapgen-improvement` skill |
| Drawing the trees and the checkpoints | `pwa/src/game/forest.ts`, `gates.ts` |
| What the events mean to the app | `pwa/src/game/run-news.ts` (the news line), `audio/route.ts` (the sound), `rumble.ts` (the pulse), `spray.ts` (the landing puff) |
| The wipeout, the trench, damage | `crash.ts`, `trench.ts`, `damage.ts` — the `crash` skill: a contact STARTS a crash here (the `hit` closing speed), and what it does to the rider and the machine is decided there |
| Tests | `tests/collision_test.ts` (trunks, the edge), `tests/course_test.ts` (order, laps, misses, the reset), `tests/rivals_test.ts` (the grid, the shoulder, the standings) |

## The events, and what each MEANS

| Event | Fires when | Carries |
| --- | --- | --- |
| `hit` | A body circle met a trunk at `trees.hitSpeed` closing or more, at most once per `trees.cooldown` | the closing speed, where |
| `bump` | The player's sled met a rival's | which rival, the speed |
| `air` | The sled has been off the snow `air.counts` s | the climb it left with, the speed |
| `land` | Back on the snow after `air` | air time, impact INTO the slope, `harsh`, the share `lost` |
| `checkpoint` | The owed checkpoint's line crossed, facing, within its width + grace | index, lap, split |
| `missed` | The NEXT checkpoint's line crossed while this one is still owed | index |
| `lap` | Checkpoint 0 crossed after all the others | laps done, that lap's time |
| `finish` | The last lap closed | the race time, the place |
| `reset` | Stood back on the track | the checkpoint, whether the engine did it |
| `wipeout` | The rider thrown off (`crash.ts`): a `hit` past `crash.treeSpeed`, a nose-in `land`, a rollover at speed | the cause, the speed, where |
| `stuck` | The tread dug in past `trench.stuckAt` (`trench.ts`) | — |
| `damage` | A part bent (`damage.ts`, damage on only) | the part, how bad it now is |
| `count` / `go` | The lights | seconds left / the clock starts |

**Each fires ONCE per occurrence.** A `hit` every step the sled leans on a
trunk is a sound played a hundred times a second and a sim table counting one
tree as a forest. The contact persists; the EVENT is the transition into it
(which is what `cooldown` and `air.counts` are for).

## The invariants — each one is load-bearing

- **The engine owns every number and every decision.** The renderer plays a
  puff where `land` says and a crack where `hit` says, nothing more. New
  contact behaviour starts in `collision.ts` / `tuning.ts`, never in the
  renderer.
- **A tree is its trunk.** The crown is drawn and is nothing to the physics;
  a sled brushing the lowest branches is a picture, a sled meeting the trunk
  is the whole hit. A trunk drawn thicker or offset from `TreeDef.x/z/radius`
  is a tree the rider sees and passes through — **when a contact is reported
  missing, check the drawn trunk against the engine's before tuning the
  contact.**
- **The lever turns the sled.** The push acts at the circle's centre, not the
  CoG, so a clipped bumper spins the sled and a trunk met dead centre stops
  it. A push at the CoG is a sled that bounces off trees like a ball.
- **Checkpoints are counted on the PATH, not the position.** The segment from
  last step's CoG to this step's crosses the line; at 33 m/s a step is 0.28
  m, fine — but sampling positions alone can still skip a line clipped at an
  angle across its end.
- **ONE LIVE CHECKPOINT, and a miss costs no DQ.** A rider who skips one is
  not disqualified: the next is simply not credited until the skipped one is
  taken, `missed` fires once, and the HUD's arrow points back at it. Nothing
  sends him back by force — the reset is his own way back.
- **THE START LINE IS OWED FIRST.** The grid stands in powder off the track;
  crossing checkpoint 0 opens lap one (with `course.startGrace` on its first
  crossing, because the field arrives abreast). A race of n checkpoints over
  L laps is 1 + n·L crossings, and the standings count them (`raceProgress`).
- **The reset is ONE decision: the pose and the progress.** `resetPose` stands
  the sled past the last checkpoint TAKEN, facing along the track, at rest;
  the progress stays where it was, so the checkpoint owed is still the next
  one ahead. Stood BEHIND the owed checkpoint and it would be taken twice.
- **The automatic reset is a latch with a hold.** On its side or back
  (`reset.overUp`) for `reset.overFor`, or at over half throttle going
  nowhere (`stuckSpeed`) for `stuckFor` — the hold is what stops a sled that
  is merely slow in powder being teleported.
- **The edge pushes, then stops.** A soft spring over the last
  `bounds.soft` metres turns a runaway back; the hard stop is the last
  resort. A hard wall alone is a sled that stops dead on an invisible line.
- **Rivals shoulder, they do not solve.** Two circles per machine, pushed
  apart with the closing speed traded. It exists so sleds cannot pass
  through each other side by side; a rider thrown by a rival is a bug.
  `rules.contact` off (the solo measurements) asks no pairs at all.
- **Synthetic maps must state their trees.** `flatLevel()` has none; a
  collision test uses `syntheticLevel()`'s `LONE_TREE` or builds its own,
  or the test tests nothing.
- **A contact change is verified by a SWEEP, not one staged run.** Bearing
  (30° steps) × speed × offset from the trunk's centre, printing speed out,
  yaw turned and any vertical launch per cell, once on the baseline and once
  after. It names the bad approach and proves the other cells did not move.
- **ANY UPWARD COMPONENT IN A CONTACT NORMAL IS A LAUNCHER until proved
  otherwise.** A trunk's push is in plan; the ground's is the chassis's.
  A sled thrown tens of metres up after meeting something is a normal that
  tipped up, never the flight model.

## Workflow

1. **Stage it.** `syntheticLevel()` with its lone tree (or a hand-built
   `Level`), `placeRun` at the moment, then step — the patterns live in
   `tests/collision_test.ts` and `course_test.ts`.
2. **Tune defs first.** A bounce too hard, a reset too eager, a grace too
   mean is a `TUNING` number with its unit, not a model edit.
3. **Assert the rule you claim**: a trunk met square (stopped, `hit` once),
   clipped (turned, speed kept), the edge (pushed back), a checkpoint crossed
   backwards (no credit), one skipped (`missed` once, then credited when
   taken), a lap closed, the flag, a reset past the last checkpoint.
4. **Bench it.** `make ride SCENARIO=tree` — in, out, turned.
5. **Measure.** `make sim` before and after — watch hits, resets, missed
   and finishes; the bot must keep finishing with hits and resets near zero.
6. **LOOK.** `make world SEED=<n> ARGS=--views=forest,track` for the trunks
   and the flags as drawn; `make build`, `make screenshots` for the app.
7. Docs: `docs/riding.md` ("Trees and the edge", "The reset"); the course
   and the race in `docs/architecture.md`; the sim columns in
   `docs/simulation.md`.

## Tuning intuition

- `restitution` low and `scrub` moderate make a glancing trunk a scrape
  rather than a bounce; a square hit stops you either way.
- `bodyRadius` is the sled's half-width plus a little — the generator's
  `forest.corridor` keeps trunks off the track by more than that, so a
  `hit` on the racing line is a generator bug reported through this module.
- `course.grace` answers "did I clip that flag?" in the rider's favour; half
  a metre either side nobody can see at gate range.
- The stuck and over timers are the cost of a mistake: shorter and a slow
  powder crossing is teleported; longer and a rolled sled is a long wait.

## Skill self-improvement

Record lessons under `.agents/skills/collision/.lessons/` via the
**`skill-reflection`** skill: a contact that fired twice and why, a
checkpoint the bot could cross without passing, a trunk drawn where the
engine's is not — the class of failure, not the one-off.
