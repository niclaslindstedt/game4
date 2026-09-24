# Simulation

The headless harness (`engine/sim/simulate.ts`) runs the REAL engine — `createGame`, `step`, the bot rider (`engine/sim/bot.ts`) — with no renderer attached and reports what happened. It is how a sled, snow, bot or generator change is measured: run `npm run sim` before and after, read the diff, paste both tables in the PR. Runs are deterministic: the same seed and map always give the same digest.

## The harness

`simulateRun(seed, options?)` builds the seed's map (or rides `options.level`, a synthetic one in the tests), stands the bot on the grid's first slot with **no lights** (`countdown: 0`) and, by default, **nobody else on the snow** (`rivals: 0` — a solo run is the measurement; `rivals: 3` is the race), and steps it at 120 Hz until the flag or `SIM_SECONDS` = 900 s of race clock, which is three laps of a four-kilometre loop at a crawl: it catches a rider who has STOPPED, it does not assert a pace. The report (`RunReport`):

| Field                            | Meaning                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `finished`, `time`               | The flag, and the race clock at it (or at the timeout), s                                                          |
| `laps`, `lapTimes`               | Laps completed and each lap's own time, s                                                                          |
| `checkpoints`, `crossings`       | Checkpoints credited, of the race's total (`1 + n·laps`: the start line, then every checkpoint a lap)              |
| `trackLength`                    | The loop, m                                                                                                        |
| `topSpeed`, `meanSpeed`          | m/s; the mean is plan distance over the race clock                                                                 |
| `airTime`, `bestAir`, `jumps`    | Seconds of air summed over flights longer than 0.3 s, the longest flight, how many                                 |
| `harshLandings`                  | Landings the suspension could not take whole (`land.harsh`)                                                        |
| `treeHits`, `bumps`              | Trunks met and (in a race) rivals leaned on                                                                        |
| `wipeouts`                       | Times the rider was thrown off (`crash.ts`) — the table's `wipe`                                                   |
| `resets`, `autoResets`, `missed` | Resets, the engine's own among them, and checkpoints ridden past                                                   |
| `place`                          | Where the bot finished against the field (1 solo)                                                                  |
| `score`                          | The score the run banked (`tricks.ts`): the bot turns nothing, so it is its air and the ground its flights covered |
| `digest`                         | FNV-1a over the sled's position and speed every quarter second — the determinism fingerprint                       |

## The CLI

```sh
npm run sim                        # seeds 1..8, solo, the map's laps
npm run sim -- --count 20          # seeds 1..20
npm run sim -- --seeds 3,7,38      # these seeds
npm run sim -- --rivals 3          # a whole race
npm run sim -- --sled ibex         # one machine of the catalog (the Fox when left out)
npm run sim -- --sled all          # the roster: every machine's table, then who was quickest on each seed
npm run sim -- --tricks            # each seed's map with its trick field laid (R20)
npm run sim -- --laps 1 --json out.json
```

It exits non-zero when the bot finishes NO seed at all — a sled that cannot get round any map is broken, not slow. At the tuning in this tree:

```
 seed  fin    time              laps     cps    len  pow  mean   top   air  best  jmp hrsh tree wipe  rst auto miss  plc  score    digest
    1  yes   399.5       133/133/133   67/67   3277  14%    89   131  18.6   1.0   21   18    0    0    0    0    0    1   2170  72d7f889
    2  yes   401.1       134/133/133   58/58   2915  27%    79   146  19.8   1.0   24   18    0    0    0    0    0    1   1971  25a89de8
    3  yes   375.9       125/124/124   61/61   2992   2%    87   139  20.5   1.0   24   21    0    0    0    0    0    1   2338  772cad92
    4  yes   347.4       116/115/115   58/58   2908   6%    91   148  16.1   1.1   18   13    0    0    0    0    0    1   1861  9d04db48
    5  yes   399.0       133/132/132   61/61   2986  35%    82   145  19.9   1.0   21   21    0    0    0    0    0    1   2560  cef39b28
    6  yes   440.2       147/146/146   67/67   3281  35%    81   150  22.1   1.0   24   21    0    0    0    0    0    1   2720  21b8c3f3
    7  yes   331.2       110/110/110   55/55   2687   4%    88   129  18.9   1.0   21   18    0    0    0    0    0    1   2351  07db7184
    8  yes   390.6       130/129/129   61/61   2927  28%    82   144  14.6   1.0   18    5    0    0    0    0    0    1   1481  b6e94e0d

8/8 finished · mean 85 km/h · top 150 km/h · air 18.8 s/run · jumps 171 · harsh 135 · trees 0 · wipeouts 0 · resets 0 (auto 0) · missed 0 · score 2182/run
```

## Reading the table

- **`pow`** is how much of the loop lies under a drift (R17) — the column the roster is read against. `--sled all` ends with one row a seed, every machine's race time and a `*` on the quickest: no machine should win them all, the trail sled (the Hare) should take the groomed maps and the mountain sled (the Ibex) the drifted ones.

- **`fin` NO** on any seed is a regression until it is explained: the bot is a competent rider, and a map it cannot finish is a map a player will not finish either — or a sled that cannot climb what the generator builds.
- **`laps`** should be three near-equal numbers. The first is a few seconds longer (the standing start from the grid); a first lap tens of seconds longer than the others is the bot circling at the start line.
- **`mean`** sits around 75–90 km/h. A drop across every seed is a sled that got slower or a bot that got timid; a drop on one seed is that map.
- **`air`/`jmp`** are the on-track kickers (three a lap on most seeds). Fewer jumps is a kicker the bot is taking too slowly to leave the snow; `best` over 2.5 s is a kicker overshot.
- **`hrsh`** counts landings past `air.harshSpeed`: a few is a kicker whose landing the bot's plan misjudges; many is a landing model gone hard.
- **`tree`, `rst`, `auto`** should be zero or nearly. A tree hit on a generated map is the bot leaving the track; an automatic reset is a sled on its back or stuck.
- **`wipe`** must be zero on a solo run: every wipeout threshold (`TUNING.crash`) sits well past anything a clean ride meets, so a wipeout there is a threshold come down into clean riding or a bot that got worse. In a race (`--rivals 3`) the field shoulders riders into the woods, and a wipeout there can be honest.
- **`score`** is what the run banked (`tricks.ts`). The bot turns nothing, so on a race map it is the air and the ground the kickers threw it across, combo by combo — a fall across every seed is a kicker that stopped throwing, or a scoring rule that moved. `--tricks` rides each seed's map with its trick field laid (R20): three to four times the jumps, and roughly three times the score; the field's landings are steeper to reach than a race's, so a third of them come in harsh without a wipeout among them.
- **`digest`** changes with ANY change to the physics, the bot or the generator, and must not change between two runs of the same tree — `tests/determinism_test.ts` holds that.

## The bot (`engine/sim/bot.ts`)

A deterministic rider that reads the same `GameState` the HUD reads and produces the same `SledInput` a thumb produces; it never reaches into the physics — what it knows about the machine it reads off `limits.ts` (`cornerGrip`, `brakeDecel`, the ski lock). The target is HUMAN capability: a competent rider, never a superhuman one.

- **Where it is**: the nearest point of the loop, restricted to the stretch between the last checkpoint it took and the one it owes — so a hairpin's other leg is never mistaken for its own, and a checkpoint gone past is ridden back to.
- **What it steers at**: a point `lookBase` + `lookPerSpeed`·v metres further along the centreline, against the heading its yaw rate is carrying it to (`yawLead`); in powder it reads further ahead and asks for less, because a sled turns there off its roll, which lags the bars.
- **Off the grid**: before the start line it aims onto the track a few metres SHORT of it, so the line is crossed riding along the track; and it brakes for the turn onto the track before the grid's lane runs out.
- **How fast**: for every bend within braking reach, the speed its curvature allows at `cornerShare` of the corner grip, less what braking at `brakeShare` of the grip can take off before it; for every on-track KICKER, the fastest a sled can leave its lip and still land on its landing (flown once per kicker over the real snow under the run's own flight pull, `flightGravity`, off the lip's own slope — the ramp rises as t², so a grade averaged over its last metres reads flatter than the one the sled leaves on — `kickerSpeed`); and pure pursuit's own curvature for the turn onto its aim. Over that it brakes; near it it eases; under it, flat out.
- **In the air**: levels the pitch to the slope it is going to land on, with the lean.
- **Trees**: moves its aim off a trunk standing in its line.
- **Giving up**: asks to be reset after `giveUpAfter` = 35 s without a checkpoint.

A RIVAL is the same bot on a run of its own, its throttle capped at the pace it was dealt at the grid (`RACE.paceBand`).
