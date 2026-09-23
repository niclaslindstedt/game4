---
name: sled-tuning
description: "Use when changing THE MACHINE'S OWN NUMBERS — the spec in `engine/game/defs/sled.ts` (mass, envelope, stance, the tread's footprint, the springs, the engine, the CVT, the brake, the rider's reach), the documented expectations a test holds the physics to (`topSpeed`, `accel0to100`), what separates one rival from another in the field (`Rival.pace`), or adding a machine to the catalog of four. Owns what every per-sled knob buys, the real-machine bands each number must stay inside, and the `make ride` + `make sim` sweep that is the only honest test of a retune. Not the LOOK of the sled (`sled-design`) and not the shared model every sled inherits (`sled-physics`)."
---

# Tuning the machine

This skill owns **two questions**: is each sled a believable machine of its
kind — does it get going, top out, stop, turn and land the way its numbers
say it will? And is each of the four an ANSWER to a kind of snow rather
than a point on one scale with a winner?

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

FOUR machines, `SLEDS` in `defs/sled.ts`, in the order the sled card turns
through them: `TRAIL_SLED`, `SLED` (the CROSSOVER — the reference every
shared number in `TUNING` was tuned on, and the default), `MOUNTAIN_SLED`
and `CROSS_SLED`. Each is the crossover's row spread with what differs —
two steerable skis on independent front suspension, a rubber tread on a
slide-rail rear, a two-stroke 850 through a CVT, a rider on the saddle.
Every host reads them through `@engine` (`SLEDS`, `sledById`, `isSledId`).

| Machine | Its answer | What buys it |
| --- | --- | --- |
| trail | quickest on the groomer, bogs in a drift | a short 3.28 m belt of 32 mm lugs (the least belt to turn), a wide 1.09 m stance, firm springs, early engagement |
| crossover | the middle of every band | 3.71 m of 44 mm lugs, 1.04 m stance — every `footprint.ts` multiplier exactly 1 |
| mountain | floats and paddles in powder, pushes wide on a packed bend | 3.94 m of 66 mm paddles, the lightest machine, a 0.89 m stance, a turbo, geared low |
| cross | lands what the others bottom on, sinks in deep powder | stiff springs on the longest travel, a short 3.48 m belt, geared short, revs higher |

Real-machine BANDS, so the numbers stay honest (a band, never a make and a
model — the router's rule): an 850-class sled is 190–235 kg dry, 123–134 kW,
stance 0.89–1.09 m centre to centre, a belt of 3.2–4.0 m by 0.38 m with
25–75 mm lugs, a CVT ratio span of 3–4, and 145–170 km/h flat out on a
groomed trail. A machine outside those bands is a different vehicle and
says so in its comment.

The per-sled half of the snow model is `engine/game/footprint.ts`: each
machine's ground pressure and lug height turned into multipliers on the
shared numbers (the sink, the planing speed, the powder paddle, the packed
side grip, the belt's own losses) — all exactly 1 on the crossover. A knob
that should change how a machine meets snow goes through there, never
through a branch on its id.

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

The player rides the machine picked on the sled card (`settings.sled`,
`createGame({ spec })`); each rival is DEALT one of `SLEDS` off the run's own
stream at the grid (`rivals.ts`), and `Rival.pace` — the throttle its bot is
allowed — beside it, so the same seed deals the same field. A field that is
too fast or too slow is a `RACE` / pace change measured with
`make sim ARGS="--rivals 3"`, not a spec change.

## The workflow

1. **State the target** as a figure and a band: "0–100 km/h in 4–5 s on the
   groomer, and the sled planes by 40 km/h in powder".
2. **Baseline**: `make ride ARGS="--sled all"` on `rest`, `rest-powder`,
   `accel`, `accel-powder`, `brake`, `turn`, `kicker`; `make sim ARGS="--sled
   all"` — the roster table, one column a machine, `*` on the quickest per
   seed, and the `pow` column saying how much of each loop is drifted.
3. **Move the one knob** that owns the figure (table above). Stay in the
   real bands.
4. **Re-run both labs**, `npx vitest run tests/sled_test.ts
   tests/flight_test.ts tests/simulation_test.ts tests/determinism_test.ts`.
5. **Update `docs/riding.md`** — its machine paragraph quotes every spec
   number, and its measured table is the new baseline.
6. **Check the drawing still fits**: `sled-body.ts` builds the machine off
   the same spec, so a stance or a length moved moves the picture
   (`make world SEED=38 ARGS=--views=hood,orbit`).

## The roster is judged as a roster

`make sim ARGS="--sled all" COUNT=12` is the verdict: NO machine best
everywhere — the mountain sled wins the powder-heavy seeds (a high `pow`),
the trail sled the packed ones, and every machine wins somewhere or has a
reason in its blurb not to. A retune that makes one machine sweep the table
has collapsed the catalog back to one sled, whatever `tests/catalog_test.ts`
says about each row alone.

## What the card says about a machine

The sled card (`menu-sled.tsx`) bills each machine off `sled-stats.ts`, and
EVERY number there is derived: the figures are the row's own `topSpeed`,
`accel0to100` and `powerKw`; the bars are the engine's own answers —
`cornerGrip(spec, 1)`, the footprint's paddle over its sink (`powderOf`),
`harshSpeedOf` — each scaled across the catalog's spread. So a retune is
billed correctly the moment it lands, and `tests/sled_card_test.ts` holds
the sheet to the catalog's claim: every specialist best at something, the
crossover in the middle of every band, the mountain sled best in powder and
the trail sled worst. A retune that breaks one of those has changed what a
machine IS, and its `blurb` moves with it.

## Adding a fifth machine

A row spread from `SLED` with what differs, added to `SLEDS` (the card turns
through it in that order) and to `SledId`; its own ANSWER to a kind of snow,
never a point between two others. It owes a `tests/catalog_test.ts` row, a
column in the roster table, and a LOOK at the card and in the race: the
builder draws it off the spec (`sled-design`), so a tread or a stance out of
the drawn cowl's reach shows there first.

## Skill self-improvement

Record lessons under `.agents/skills/sled-tuning/.lessons/` via the
**`skill-reflection`** skill: a knob that moved a figure nobody expected, a
real-machine band that turned out wrong, an expectation that drifted and why.
