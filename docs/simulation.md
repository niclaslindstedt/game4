# Simulation

The headless harness (`engine/sim/simulate.ts`) runs the REAL engine — `createGame`, `step`, the bot rider (`engine/sim/bot.ts`) — with no renderer attached and reports what happened. It is how a sled, snow, bot or generator change is measured: run `npm run sim` before and after, read the diff, paste both tables in the PR. Runs are deterministic: the same seed and map always give the same digest.

## The harness

`simulateRun(seed, options?)` builds the seed's map (or rides `options.level`, a synthetic one in the tests), stands the bot on the grid's first slot with **no lights** (`countdown: 0`) and, by default, **nobody else on the snow** (`rivals: 0` — a solo run is the measurement; `rivals: 3` is the race), and steps it at 120 Hz until the flag or `SIM_SECONDS` = 900 s of race clock, which is three laps of a four-kilometre loop at a crawl: it catches a rider who has STOPPED, it does not assert a pace. The report (`RunReport`):

| Field                            | Meaning                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `finished`, `time`               | The flag, and the race clock at it (or at the timeout), s                                             |
| `laps`, `lapTimes`               | Laps completed and each lap's own time, s                                                             |
| `checkpoints`, `crossings`       | Checkpoints credited, of the race's total (`1 + n·laps`: the start line, then every checkpoint a lap) |
| `trackLength`                    | The loop, m                                                                                           |
| `topSpeed`, `meanSpeed`          | m/s; the mean is plan distance over the race clock                                                    |
| `airTime`, `bestAir`, `jumps`    | Seconds of air summed over flights longer than 0.3 s, the longest flight, how many                    |
| `harshLandings`                  | Landings the suspension could not take whole (`land.harsh`)                                           |
| `treeHits`, `bumps`              | Trunks met and (in a race) rivals leaned on                                                           |
| `resets`, `autoResets`, `missed` | Resets, the engine's own among them, and checkpoints ridden past                                      |
| `place`                          | Where the bot finished against the field (1 solo)                                                     |
| `digest`                         | FNV-1a over the sled's position and speed every quarter second — the determinism fingerprint          |

## The CLI

```sh
npm run sim                        # seeds 1..8, solo, the map's laps
npm run sim -- --count 20          # seeds 1..20
npm run sim -- --seeds 3,7,38      # these seeds
npm run sim -- --rivals 3          # a whole race
npm run sim -- --laps 1 --json out.json
```

It exits non-zero when the bot finishes NO seed at all — a sled that cannot get round any map is broken, not slow. At the tuning in this tree:

```
 seed  fin    time              laps     cps    len  mean   top   air  best  jmp hrsh tree  rst auto miss  plc    digest
    1  yes   422.6       138/137/137   67/67   3277    85   124  11.3   1.3    9    0    0    0    0    0    1  a9521577
    2  yes   370.7       120/119/119   58/58   2915    86   125  13.1   1.6    9    5    0    0    0    0    1  90f7df3c
    3  yes   425.5       140/139/139   61/61   2992    77   120  11.0   1.4    9    3    0    0    0    0    1  0f50bf7f
    4  yes   389.7       129/126/126   58/58   2908    82   122  10.1   1.2    9    0    0    0    0    0    1  de56737f
    5  yes   368.6       122/120/120   61/61   2986    88   124  11.3   1.3    9    0    0    0    0    0    1  ca8c6b9d
    6  yes   413.2       136/135/135   67/67   3281    87   126  11.7   1.5    9    0    0    0    0    0    1  af5cec1b
    7  yes   381.5       124/123/123   55/55   2687    77   115  12.1   1.4    9    3    0    0    0    0    1  0391b094
    8  yes   374.3       123/121/121   61/61   2927    85   124  11.3   1.3    9    0    0    0    0    0    1  0b2e1a76

8/8 finished · mean 83 km/h · top 126 km/h · air 11.5 s/run · jumps 72 · harsh 11 · trees 0 · resets 0 (auto 0) · missed 0
```

## Reading the table

- **`fin` NO** on any seed is a regression until it is explained: the bot is a competent rider, and a map it cannot finish is a map a player will not finish either — or a sled that cannot climb what the generator builds.
- **`laps`** should be three near-equal numbers. The first is a few seconds longer (the run from the grid through the powder onto the track); a first lap tens of seconds longer than the others is the bot circling at the start line.
- **`mean`** sits around 75–90 km/h. A drop across every seed is a sled that got slower or a bot that got timid; a drop on one seed is that map.
- **`air`/`jmp`** are the on-track kickers (three a lap on most seeds). Fewer jumps is a kicker the bot is taking too slowly to leave the snow; `best` over 2.5 s is a kicker overshot.
- **`hrsh`** counts landings past `air.harshSpeed`: a few is a kicker whose landing the bot's plan misjudges; many is a landing model gone hard.
- **`tree`, `rst`, `auto`** should be zero or nearly. A tree hit on a generated map is the bot leaving the track; an automatic reset is a sled on its back or stuck.
- **`digest`** changes with ANY change to the physics, the bot or the generator, and must not change between two runs of the same tree — `tests/determinism_test.ts` holds that.

## The bot (`engine/sim/bot.ts`)

A deterministic rider that reads the same `GameState` the HUD reads and produces the same `SledInput` a thumb produces; it never reaches into the physics — what it knows about the machine it reads off `limits.ts` (`cornerGrip`, `brakeDecel`, the ski lock). The target is HUMAN capability: a competent rider, never a superhuman one.

- **Where it is**: the nearest point of the loop, restricted to the stretch between the last checkpoint it took and the one it owes — so a hairpin's other leg is never mistaken for its own, and a checkpoint gone past is ridden back to.
- **What it steers at**: a point `lookBase` + `lookPerSpeed`·v metres further along the centreline, against the heading its yaw rate is carrying it to (`yawLead`); in powder it reads further ahead and asks for less, because a sled turns there off its roll, which lags the bars.
- **Off the grid**: before the start line it aims onto the track a few metres SHORT of it, so the line is crossed riding along the track; and it brakes for the turn onto the track before the grid's lane runs out.
- **How fast**: for every bend within braking reach, the speed its curvature allows at `cornerShare` of the corner grip, less what braking at `brakeShare` of the grip can take off before it; for every on-track KICKER, the fastest a sled can leave its lip and still land on its landing (flown once per kicker over the real snow, `kickerSpeed`); and pure pursuit's own curvature for the turn onto its aim. Over that it brakes; near it it eases; under it, flat out.
- **In the air**: levels the pitch to the slope it is going to land on, with the lean.
- **Trees**: moves its aim off a trunk standing in its line.
- **Giving up**: asks to be reset after `giveUpAfter` = 35 s without a checkpoint.

A RIVAL is the same bot on a run of its own, its throttle capped at the pace it was dealt at the grid (`RACE.paceBand`).
