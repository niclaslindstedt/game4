---
name: crash
description: "Use when working on the sled PAST SAVING and the rider OFF IT — the three ways a rider is thrown (a trunk met hard, a nose-in landing, a rollover at speed), the rider's own body tumbling on the snow until the reset, the sled trenched in deep powder and rocked back out, and what a blow costs the machinery when damage is on (a bent ski, a hurt suspension). Owns `engine/game/crash.ts`, `trench.ts`, `damage.ts`, the `TUNING.crash` / `.trench` / `.damage` blocks, the `wipeout` / `stuck` / `damage` events, and the ride lab's `tree`, `tree-glance`, `nose-in`, `rollover`, `stuck` and `stuck-held` scenarios. Not the contact that STARTS a crash (`collision` — the trunk, the rival, the edge) and not the rollover's own physics (`sled-physics` — the chassis carries a sled over)."
---

# The crash

This skill owns **one question**: what happens to the rider and the machine
once a mistake is past saving — and how the rider gets going again?

Three modules answer it, and the split matters:

- **`engine/game/crash.ts`** — THE WIPEOUT. `wipeoutCause` reads the step
  just taken (the `hit` and `land` events, the sled's attitude against the
  snow) and names a cause or none; `throwRider` puts the rider off onto a
  body of his own (`SledState.thrown`, a `Thrown`); `stepThrown` moves that
  body — a RAGDOLL (`engine/game/ragdoll.ts`): thirteen jointed points,
  each meeting the snow (the floor, friction, the powder's plough) and the
  trunks on its own — and `crashOver` says when the reset may stand them
  back up. Knobs in `TUNING.crash` (`.body` is the rider's measures, the
  same bones `rider-pose.ts`'s `BODY` draws — `world_render_test` holds
  them together).
- **`engine/game/trench.ts`** — STUCK IN DEEP POWDER. `stepTrench` digs the
  hole under a bogged tread (`SledState.trench`, m) and fills it back as the
  rider rocks it or drives out; `sled.ts` adds the trench to the tread's
  sink and takes the drive with it (`trenchGrip`). Knobs in `TUNING.trench`.
- **`engine/game/damage.ts`** — WHAT A BLOW COSTS, only on a run that asked
  for it (`GameState.damage`). `takeDamage` charges this step's blows to the
  two skis and the suspension (`SledState.damage`); `sled.ts` reads four
  shares off it (`skiPull`, `skiBite`, `springShare`, `dampShare`,
  `harshShare`). Knobs in `TUNING.damage`.

`run.ts` is where they meet the step: with the rider off, the sled is
stepped under the neutral input, his body under `stepThrown`, the course
takes nothing, and the reset comes off `crashOver`; a trenched sled's
automatic reset waits `trench.holdFor` instead of `reset.stuckFor`.

The design came from the rally game's (`game2`) `crash` skill and its
`roll.ts`: a crash is judged on a bench, one mechanism at a time, and a
rollover is the far end of the handling model rather than its own system.
What is ours alone is the rider leaving the machine and the snow he lands
in — and the trench, which is snow's own way of stopping a sled.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs crash --list`.

| Load beside this one | For |
| --- | --- |
| `sled-physics` | the rollover itself, the landing's cost, the sink the trench deepens |
| `collision` | the trunk and the rival that start a crash, the reset that ends one |
| `rider` | the figure thrown: `ragdollPose` off `Thrown.points` and how `sled-body.ts` lays him |
| `visual-effects` | the burst, the puffs and the gouge a body leaves, the pulse |
| `test-scenario` | staging a crash on the synthetic maps with `placeRun` |

## The instrument: `make ride`

A crash is over in two seconds and in the game it is mostly spray. So stage
it and read the numbers:

```sh
make ride SCENARIO=tree          # a trunk at 50 km/h: thrown, how far, when stood up
make ride SCENARIO=tree-glance   # a trunk clipped slowly: a hit held on through
make ride SCENARIO=nose-in       # a landing 40 degrees nose-down at 60 km/h
make ride SCENARIO=rollover      # thrown onto its side at 70 km/h
make ride SCENARIO=stuck         # nosed into a powder bank, dug in, rocked out
make ride SCENARIO=stuck-held    # the same with the throttle pinned: the reset
```

Every wipeout scenario prints the same line — the cause and when, the speed,
how far the rider slid from the sled, how many turns he tumbled, when the
reset came. The trench's prints when it dug in, how deep, when it was out
and whether the engine had to reset it. Then look: `make world
ARGS=--views=wipeout,wipeout-lie` puts the player into the nearest trunk
through the game's own renderer and photographs the rider in the air and
where he came to rest, with the gouge his slide cut.

**`make sim` is the no-regression check, and its `wipe` column must read
0.** The bot on every seed on every machine lands at most about 6° nose-down
and 9 m/s into the slope, never goes past half over and meets no trunk — the
thresholds sit well beyond all of it (`TUNING.crash`'s comment says by how
much). A wipeout in the solo table is a threshold that has come down into
clean riding, or a bot that has got worse. In a race (`--rivals 3`) the field
shoulders riders into the woods and a wipeout there is honest.

## The rules

- **A WIPEOUT IS A THRESHOLD ON WHAT THE STEP ALREADY MEASURED.** The trunk's
  closing speed is the `hit` event's, the landing's impact the `land`
  event's, the attitude the sled's own quaternion against the snow's normal.
  Nothing here re-measures a contact; a cause that needs a new measurement
  belongs in the module that makes the contact.
- **NO CLEAN RIDE CROSSES A THRESHOLD.** Before moving one, run the bot over
  the corpus on every machine and print the distribution of what it meets
  (nose angle and impact at every landing, the worst attitude, every trunk).
  The margin between that and the threshold is the point of the number.
- **OVER IS OVER AGAINST THE SNOW, ON THE SNOW, AND HELD.** A sled climbing a
  face stands far off vertical while perfectly upright on the slope: read the
  sled's up against the ground's normal, never against the sky, and only
  while it is ON the snow (`rolledFor`, not `overFor`) for `crash.rollHold`.
  A sled turning over in the air has not rolled — the landing decides — and
  one that clips a side on the way round and comes back onto its skis is
  ridden away.
- **JUDGE THE LANDING THAT ENDS A FLIGHT, NEVER ITS REBOUND.** A hard
  touchdown hands the sled back up for 0.15–0.22 s and the `land` event fires
  again when it comes down; that second contact is the same landing, and its
  nose angle is the slap of the springs, not a dive. `crash.noseAir` keeps
  the nose-in to flights that were flights. Before shipping a threshold, ride
  the stock `kicker` on every machine (`make ride SCENARIO=kicker ARGS="--sled
  all"`, `crash_test`'s kicker case): an ordinary jump overshot must be
  ridden out.
- **THE RIDER CARRIES THE WAY THE SLED HAD BEFORE THE BLOW.** A trunk stops
  the machine in one step; the velocity the rider leaves with is the one from
  before that step (`run.ts` keeps it), times `keep`. Read after the trunk,
  he would drop off a stopped sled.
- **A CRASH DRAWS NOTHING FROM THE STREAM.** The tumble, the throw and the
  slide are functions of the moment, so a crash replays exactly and the sim's
  digests do not move when one is added. Anything random-looking in the
  picture is the renderer's, off its own seed.
- **WITH THE RIDER OFF, THE SLED IS LET GO AND TAKES NOTHING.** The neutral
  input, no checkpoint, the automatic reset's clocks quiet; the reset is
  `crashOver`'s — `lieMin` off and `lieStill` lain still (`Thrown.still`),
  the beat the app's death cam (`camera-death.ts`) rises over him on; cut it
  and the camera has nothing to rise into. A rider who presses reset gets it
  at once.
- **THE TRENCH DIGS ONLY WHEN BOGGED, AND IS PACKED BY MOVING WEIGHT.** It
  grows while the sled is on the gas at a crawl in powder with the belt
  slipping, for `trench.after` s first — so no launch out of a powder grid
  ever gets there; it shrinks by the metre the rider's weight moves
  (`riderAft`, `riderRight`) and by the way made good past `creep`. A rider
  rocking with the throttle pinned is digging as fast as he packs: that is
  the lesson the mechanic teaches.
- **A SOUND MACHINE READS EXACTLY 0 AND EXACTLY 1.** Every damage share is
  `1 - k · d`, every pull `k · (dR - dL)`, and the trench's grip and sink
  terms the same, so a run without damage and out of any hole is the same
  arithmetic to the last bit — which is why no digest moved when they landed.
  Keep it so: a share written as `(1 - d) ** k` or a clamp with a floor is a
  digest that moves for no reason.
- **DAMAGE IS THE PLAYER'S AND NEVER A RIVAL'S.** `createRivals` deals every
  rival `damage: false`; the field is never slowed by a setting the player
  chose.

## Workflow

1. **Take the baseline first.** `make ride` on the crash and trench scenarios
   and `kicker --sled all` (an ordinary overshot jump must be ridden out), and
   `make sim`, before the first edit.
2. **Find WHICH STEP decided it.** Print every step's cause candidate —
   impact, nose angle against the snow, up against the normal, `overFor`,
   the trench and its clock — around the moment; a crash that fired where it
   should not is one threshold met on one step.
3. **Tune defs, with the bot's distribution beside the number.**
4. **Re-run the lab, then the tests** —
   `npx vitest run tests/crash_test.ts tests/collision_test.ts tests/course_test.ts tests/simulation_test.ts tests/determinism_test.ts tests/hud_test.ts tests/rumble_test.ts`.
5. **LOOK.** `make world ARGS=--views=wipeout,wipeout-lie`.
6. Docs: `docs/riding.md` ("The wipeout", "Stuck in powder", "Damage").

## Skill self-improvement

Record lessons under `.agents/skills/crash/.lessons/` via the
**`skill-reflection`** skill: a threshold a clean ride crossed and the
measurement that showed it, a crash that moved a digest, a trench a launch
fell into — the class of failure, not the one-off.
