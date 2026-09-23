---
name: test-scenario
description: "Use when a bug repro, a physics assertion, or a visual judgement needs the game in an EXACT situation — the sled at rest in powder, a kicker taken at a known speed, a full-lock turn at 100 km/h, a trunk met square, a sidehill, a landing off a known height, a checkpoint skipped. Covers the synthetic maps in `tests/support/synthetic.ts` (`syntheticLevel()`, the stadium; `flatLevel()`, the drag strip) handed to `createGame({ level })`, standing the sled at a moment with `placeRun`, scripting inputs step by step, the ride lab's scenarios (`scripts/lib/ride-scenarios.mjs`), and photographing a race at a moment with `make screenshots`."
---

# Test Scenarios

Riding your way into a situation is slow and unrepeatable. This repo stages
situations **declaratively** instead: hand the engine a synthetic map shaped
for the scenario, stand the sled at the moment with `placeRun`, and script
the inputs step by step. The same technique backs every physics test
(`tests/sled_test.ts`, `flight_test.ts`, `collision_test.ts`,
`course_test.ts`, `rivals_test.ts`) — reuse it whenever you are reproducing a
bug, asserting a rule or measuring a number.

## The synthetic maps

`createGame` takes a `level`, and it does not have to come from the
generator. A hand-built `Level` bypasses `mapgen` entirely, so the scenario
contains exactly what you put in it. `tests/support/synthetic.ts` owns two:

- **`syntheticLevel(options)`** — THE STADIUM: a packed loop of two 500 m
  straights joined by two 100 m-radius bends on flat snow, ridden
  anticlockwise; a KICKER across the north straight (1.8 m over 6 m to a lip,
  then dropping away); gentle hills north of the loop; a few infield trees
  and ONE lone tree in the powder south of it at `LONE_TREE`; the grid 50 m
  south of the start line. `noTrees`, `noKicker`, `laps` take pieces out.
  `STADIUM` is its geometry.
- **`flatLevel({ packed, size, grade, slopeFrom })`** — THE DRAG STRIP: a huge
  flat square all packed (`packed: 1`) or all powder (`0`), optionally a slope
  from `slopeFrom`, with a square loop round it only so the `Level` is whole.

Build a new one with `createHeightfield` / `fillField` and the `Level` shape
in `engine/mapgen/types.ts` (the optional fields — `packed`, `kickers`,
`basin`, `attempt` — need not be invented). Nothing validates a hand-built map
against the R-rules — that is the point: a scenario may stage what the
generator would never build. Add a builder to `synthetic.ts` rather than
inside a test when a second file wants it; generated maps for a sweep come
from `tests/support/levels.ts` (`LEVEL_SEEDS`, `levelFor`, `analysisFor` —
shared, read-only).

```ts
import { createGame, NEUTRAL_INPUT, placeRun, step, TUNING, type GameEvent, type GameState, type SledInput } from "@engine";
import { flatLevel } from "./support/synthetic.ts";

function stage(speed = 0): GameState {
  // No rivals, no lights, no log: the run is the sled and the snow.
  const state = createGame({ level: flatLevel({ packed: 0 }), rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 1500, z: 150, heading: 0, speed });
  return state;
}
```

## Standing the sled at a moment

`placeRun(state, moment)` (`engine/game/place.ts`) puts the sled AT a
`RunMoment` — `x, z, heading`, a `speed` along it, optionally a `height` over
the snow with `vy` of climb, a `pitch`, a `roll`, a `pitchRate`, the race
clock (`time`) and the checkpoint owed (`nextCheckpoint`) — on its suspension
on the snow (or in the air), with the engine and the tread turning as though
it had been pulling. It ends the lights: a placed run is racing.

- a sled at 80 km/h 40 m before the stadium's kicker, for a launch;
- a sled 3 m up, nose down, falling, for a landing;
- a sled between checkpoints 4 and 5 owing 5, for a reset or a miss.

`placeRun` writes state and nothing else: the next `step` is what lands,
hits or resets, so assert on the events that step emits exactly as for a
ridden one. A sled placed at rest on flat snow should be still after a second
of `NEUTRAL_INPUT` — if it is not, `placeRun` and the suspension disagree
about the stance, and that is the bug.

## Scripting inputs

Drive the state with a fixed-step helper; seconds → steps via
`TUNING.physicsHz`:

```ts
function ride(state: GameState, input: Partial<SledInput>, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, ...input });
    events.push(...state.events);
  }
  return events;
}
```

Collect the events as you go — `state.events` holds THIS step's and is
cleared at the top of the next. They are the assertion surface for anything
transitional (`air`, `land`, `hit`, `bump`, `checkpoint`, `missed`, `lap`,
`finish`, `reset`). `reset` in the input is an EDGE: true for one step.

## Rules of thumb

- **Stage, don't ride.** If a repro starts with "ride to the second kicker",
  replace the ride with the stadium and a `placeRun` at speed before its
  kicker.
- **Silence what you're not testing.** `rivals: 0` takes the field out,
  `countdown: 0` the lights, `quiet: true` the log; `flatLevel()` has no trees
  and no kicker; `steer: 0` isolates pitch from roll.
- **Build the precondition, then assert you built it.** A powder test rides
  until the sled has planed and then `expect(state.sled.contacts[…].sink)`
  is under a few centimetres before measuring anything — so a tuning change
  that keeps it bogged fails at the precondition instead of silently passing
  a test whose scenario never happened.
- **Reference thresholds from `TUNING` and `SLED`, not copied literals.**
  `SLED.topSpeed` and `accel0to100` are EXPECTATIONS the physics reproduces
  within a stated tolerance; that tolerance is the one literal a test carries.
- **Attitude off the quaternion, not Euler.** `pitch` folds at ±90°; count
  rotation as `∫ −wx dt` and "right way up" as `rotate(q, up).y`.
- **One scenario per behaviour, named after it.** The repro for a bug becomes
  the regression test, in the topic's `tests/<topic>_test.ts`.
- **Whole-race scenarios** (does the bot finish this map?) go through
  `simulateRun` with a real seed — see `simulate-run`.

## The bench and the browser

- **The ride lab stages the same way.** `scripts/lib/ride-scenarios.mjs` is a
  list of `RunMoment`s and scripted inputs on the synthetic maps; `make ride
  SCENARIO=<id>` draws what a test would measure. A moment worth a test is
  usually worth a scenario there — add it in the same change.
- **The built app is staged by URL, not by `placeRun`.** `make screenshots`
  opens `?start=race&seed=&t=&shot=1`: a generated race with `t` seconds
  ridden by the bot, held still. `make world` rides one seed and seeks named
  views (`jump`, `landing`, `furrow`…). There is no `?scene=` that stands the
  app at an arbitrary `RunMoment` yet; the sibling `game3`'s `scenarios.ts`
  (one DOM-free list read by a test, the ride lab and the screenshot harness)
  is the model when one is needed. `playtest` has the loop.

## Skill self-improvement

When a staging need doesn't fit the current engine surface (a `RunMoment`
field that does not exist, a map the builders can't express), grow
`place.ts` / `tests/support/synthetic.ts` plus their tests, then document the
option here. Recurring stagings and gotchas are lesson fragments — load
**`skill-reflection`** at both ends (`node scripts/skill-lessons.mjs
test-scenario --list`).
