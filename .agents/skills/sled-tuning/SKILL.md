---
name: sled-tuning
description: "Use when changing THE MACHINE'S OWN NUMBERS — the spec in `engine/game/defs/sled.ts` (mass, envelope, stance, the tread's footprint, the springs, the engine, the CVT, the brake, the rider's reach), the documented expectations a test holds the physics to (`topSpeed`, `accel0to100`), what separates one rival from another in the field (`Rival.pace`), or the day a second sled is added to the catalog. Owns what every per-sled knob buys, the real-machine bands each number must stay inside, and the `make ride` + `make sim` sweep that is the only honest test of a retune. Not the LOOK of the sled (`sled-design`) and not the shared model every sled inherits (`sled-physics`)."
---

# Tuning the machine

This skill owns **one question**: is the sled a believable trail sled — does
it get going, top out, stop, turn and land the way its numbers say it will?
And, the day there is more than one, is each an ANSWER to a kind of snow
rather than a point on one scale with a winner?

The answer is measured, never asserted. **Any change to `defs/sled.ts` owes
`make ride` and `make sim`, before and after.**

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs sled-tuning --list`.

| Load beside this one | For |
| --- | --- |
| `sled-physics` | the SHARED model every sled inherits — the forces read the spec, the spec never branches the model |
| `simulate-run` | reading the `make sim` table |
| `bot-improvement` | when the bot cannot use what you just gave the sled |
| `sled-design` | how the sled LOOKS — its drawing reads the same spec |

## The catalog

ONE sled in this slice: `SLED` (id `trail`), an invented trail/cross machine
with no real brand behind it — two steerable skis on independent front
suspension, a rubber tread on a slide-rail rear, a two-stroke twin through a
CVT, a rider on the saddle. Every host reads it through `@engine`.

Real-machine BANDS, so the numbers stay honest (a band, never a make and a
model — the router's rule): a 600-class trail sled is 210–240 kg dry, 90–125
kW, stance 1.0–1.1 m centre to centre, a belt of 3.2–3.5 m by 0.38 m, a CVT
ratio span of 3–4, and 110–130 km/h flat out on a groomed trail. A sled
outside those bands is a different vehicle and says so in its comment.

## Where the numbers live

| Layer | File | What it decides |
| --- | --- | --- |
| The spec | `engine/game/defs/sled.ts` (`SledSpec`, `SuspensionSpec`, `SLED`) | how much of each thing THIS machine has; `totalMass`, `inertiaOf` derive from it |
| The magnitudes | `TUNING.snow`, `.grip`, `.tread`, `.steer`, `.rider`, `.air` | how strong each effect is, for every sled |
| The ceilings | `engine/game/limits.ts` | what any sled may reach — read by the model AND the bot |
| The field | `Rival.pace` (dealt in `rivals.ts`), `RACE` in `defs/modes.ts` | how hard each rival's bot may ride |

**Nothing in the model branches on a sled** — a new behaviour is a new field
on the spec that the model reads, never an `if (spec.id === …)`.

## What each knob buys

| Knob | Moves |
| --- | --- |
| `dryMass`, `riderMass` | EVERYTHING: acceleration, the sink's load, the landing, the roll. The rider is a quarter of the moving mass — which is why moving him is how a sled is ridden |
| `length`, `width`, `height` | The envelope: `inertiaOf` (a solid box), the tree footprint, the chassis points |
| `cogHeight` | How high it stands and how readily it rolls; the suspension's attachments are placed off it |
| `skiStance`, `skiForward` | The ski share of the weight (`skiShare`, by moment balance) and the lever the skis turn the sled with; a wider stance resists the roll |
| `treadLength`, `treadWidth`, `treadFront`, `treadRear` | The footprint the tread's probes stand on, the plough's width, the flotation |
| `front`, `rear` (`rate`, `bump`, `rebound`, `travel`) | The ride: sag, heave frequency, how a landing is taken, when the bump stop bites |
| `powerKw`, `peakRpm`, `maxRpm`, `idleRpm`, `engageRpm` | The engine's curve and where the clutch holds it |
| `gearTop`, `gearSpan`, `driveline` | The CVT: the belt speed at the redline in top, how much slower in low, what reaches the snow |
| `cdA` | Air drag at speed (the belt's own losses are bigger) |
| `skiLock` | Full lock at a standstill; `skiLockAt` fades it with speed |
| `brakeForce` | What the disc can put on the belt |
| `riderHeight`, `riderReach` | How far his weight moves, and how high it acts |
| `topSpeed`, `accel0to100` | NOT INPUTS — documented expectations |

## The expectations are a test

`topSpeed` (km/h on packed snow) and `accel0to100` (s) are what the physics
is meant to reproduce from the rest of the row, and `tests/sled_test.ts`
holds the physics to them (±10 % top speed, ±20 % acceleration). A change
that moves them is either a physics bug or a spec whose expectations need
re-deriving; say which in the PR, and re-derive from `make ride
SCENARIO=accel`, never by editing the number until the test passes.
`limits.ts`'s `topSpeedOf` hands the bot the same figure — the bot's idea of
flat out is this row.

## The field

The rivals ride the same `SLED`. What tells one from the next is `Rival.pace`
— the throttle its bot is allowed — dealt off the run's own stream at the
grid (`rivals.ts`), so the same seed deals the same field. A field that is
too fast or too slow is a `RACE` / pace change measured with
`make sim ARGS="--rivals 3"`, not a spec change: a rival on a different
machine is a rival in a different game.

## The workflow

1. **State the target** as a figure and a band: "0–100 km/h in 4–5 s on the
   groomer, and the sled planes by 40 km/h in powder".
2. **Baseline**: `make ride` on `rest`, `rest-powder`, `accel`,
   `accel-powder`, `brake`, `turn`, `kicker`; `make sim`.
3. **Move the one knob** that owns the figure (table above). Stay in the
   real bands.
4. **Re-run both labs**, `npx vitest run tests/sled_test.ts
   tests/flight_test.ts tests/simulation_test.ts tests/determinism_test.ts`.
5. **Update `docs/riding.md`** — its machine paragraph quotes every spec
   number, and its measured table is the new baseline.
6. **Check the drawing still fits**: `sled-body.ts` builds the machine off
   the same spec, so a stance or a length moved moves the picture
   (`make world SEED=38 ARGS=--views=hood,orbit`).

## Adding a second sled (not yet built)

The day a roster exists: a `SLED`-shaped row per machine, a catalog array
exported from `defs/sled.ts`, `createGame({ spec })` already takes one, and
each machine an ANSWER to a kind of snow (a light short-track sled that is
nimble on the groomer and bogs in powder, a long-track mountain sled that
floats and turns badly) — never four points on one scale. `make sim` then
owes a row per machine, and the start card a picker (`menu-system`).

## Skill self-improvement

Record lessons under `.agents/skills/sled-tuning/.lessons/` via the
**`skill-reflection`** skill: a knob that moved a figure nobody expected, a
real-machine band that turned out wrong, an expectation that drifted and why.
