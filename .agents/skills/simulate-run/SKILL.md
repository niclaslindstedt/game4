---
name: simulate-run
description: "Use to measure the game's ACTUAL balance by running the real engine headlessly — the bot racing generated maps across seeds, reporting whether it finished, the race time and the lap times, checkpoints credited, the mean and top speed, air time and jumps, harsh landings, tree hits, resets (and the engine's own), checkpoints missed, the place against a field, and the determinism digest. The closing measurement loop of every sled, snow, bot or generator change: run it before and after, read the diff, and paste both tables in the PR. Also the owner of what the table's columns mean and which movements are regressions."
---

# Simulate Run

The sim rides the REAL engine — `createGame`, `step`, the bot — at full speed
with no renderer, and reports what actually happened. Nothing in it models or
approximates a rule; it IS the rules, run fast. **Balancing this game means
balancing pace and feel-as-measured** — does the bot finish, does it take every
checkpoint, does it fly the kickers and land them, does it stay off the trees
and out of the reset — not tuning an economy. The regression surface is the
table.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs simulate-run --list`. Load
**`skill-reflection`** at both ends of the session.

## The tools

- **Engine module: `engine/sim/simulate.ts`** — `simulateRun(seed, options)`
  (`level`, `laps`, `rivals`, `profile`, `maxSeconds`, `keepEvents`).
  Deterministic per options; returns a typed `RunReport`. Solo by default:
  the bot on the grid's first slot, no lights, nobody else on the snow — a
  solo run is the measurement; `rivals: 3` is the race.
- **CLI: `scripts/simulate-run.mjs`** — the sweep and the table. It is CI's
  `simulate` job, and it **exits non-zero when the bot finishes NO seed** — a
  sled that cannot get round any map is broken, not slow.

```sh
make sim                              # seeds 1..8, solo, the map's laps
make sim SEEDS=3,7,38                 # these seeds (a bug report's)
npm run sim -- --count 20             # a wider sweep for a tuning decision
npm run sim -- --rivals 3             # a whole race: the field and the place
npm run sim -- --json out.json        # machine-readable rows
```

## Reading the table

`docs/simulation.md` states every column and the table at the tuning in this
tree; read it before the first run. The movements that matter:

| Column | Meaning | Healthy movement |
| --- | --- | --- |
| `fin` | The flag | **yes, every row** — a map the bot cannot finish is a map a player will not |
| `laps` | Each lap's own time | three near-equal numbers; the first a few seconds longer (the powder run from the grid); tens of seconds longer is the bot circling at the start line |
| `cps` | Checkpoints credited / the race's crossings (`1 + n·laps`) | **all of them** |
| `mean`, `top` | km/h | mean around 75–90; a drop on every seed is a slower sled or a timid bot, on one seed that map; top near `SLED.topSpeed` |
| `air`, `best`, `jmp` | Air summed over counted flights, the longest, how many | the on-track kickers taken every lap; fewer jumps is a kicker taken too slowly to leave the snow; `best` over 2.5 s is one overshot |
| `hrsh` | Landings past `air.harshSpeed` | a few; many is a landing model gone hard or a bot misjudging a kicker |
| `tree`, `rst`, `auto`, `miss` | Trunks met, resets (the engine's own), checkpoints ridden past | **≈ 0** — a tree hit on a generated map is the bot leaving the track |
| `plc` | Place against the field | 1 solo; in a race, read beside the rivals' dealt paces |
| `digest` | FNV-1a over the sled's position and speed every quarter second | changes with ANY physics, bot or generator change; must NOT change between two runs of the same tree |

The footer is the one-line before/after: finished count, mean and top pace,
air per run, jumps, harsh landings, trees, resets, missed.

## The workflow rule

**Run `make sim` before and after every sled, snow, bot or generator change,
and paste both tables in the PR description** — the contract in
CONTRIBUTING.md and the PR template. A change that makes the bot stop
finishing, stop taking checkpoints or start resetting is a regression until
argued otherwise, and the argument happens in the PR over the two tables.

## The knob loop

1. **Baseline**: `make sim` on the clean tree (or `--json baseline.json` for a
   wide sweep you will diff mechanically).
2. **Edit the knob** — `defs/tuning.ts` (shared), `defs/sled.ts` (the
   machine), `mapgen/rules.ts` (the map) or `sim/bot.ts` (the rider). Never
   inline in the model.
3. **Re-run and read the diff.** Did the change move what you intended — and
   nothing you didn't? A sink change that also halves the jumps is telling you
   the systems are coupled (a sled that sits lower meets the lip slower);
   understand why before shipping.
4. **Compare over a sweep, never a seed.** Runs are chaotic — one different
   landing early cascades into a different race — and a generator change
   re-rolls the maps themselves, so seed 7 after is not seed 7 before. Read
   the footer over `--count 20` for a decision.
5. **A race, not only a solo.** A change to the field, the grid, contact or
   the pace band owes `--rivals 3` too.
6. Run the sim-driven tests — `tests/simulation_test.ts` (the bot finishes
   what the generator builds), `determinism_test.ts` (the fingerprint). If one
   breaks, **the change is wrong or the test's world just moved — decide
   which explicitly, never silently.**
7. Finish with `playtest` — the simulator measures numbers, never fun.

## Caveats — what a bot run does and doesn't measure

- **The bot is a probe, not a proof of fun.** It rides like a competent human
  (`bot-improvement`); it measures pace, checkpoint-taking and whether the map
  is rideable, not whether a kicker feels good.
- **Determinism is the instrument's calibration.** Same seed, same options ⇒
  same digest. If two runs diverge, stop tuning: the engine has a
  nondeterminism bug (`debug-game`), and every measurement is noise until it
  is fixed.
- **The bot and the physics are coupled.** A physics change can look like a
  regression because the BOT no longer suits the sled (its corner speed off
  `cornerGrip`, its kicker speed flown over the old snow). Decide whether the
  fix belongs in `tuning.ts` or `bot.ts`, and say which in the PR.
- **Generator changes are measured here too**: a rules edit that builds
  legal-but-unrideable country shows as resets, trees and DNFs long before a
  human rides it. Pair with `make level` on the seeds that went wrong.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Settled balance reads
("harsh landings above N always trace to X", a column movement that reliably
diagnoses a cause) belong here — recorded as fragments, promoted into the
table above once they hold every time.
