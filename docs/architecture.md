# Architecture

Powder Run follows the shape of its sibling repos: a headless engine that IS the game, a thin browser shell that draws it, and tooling that measures it. One direction of dependency:

```
tests/  scripts/(sim, the labs)            pwa/ (Preact + three.js shell)
        \                                   /
         `----------->  engine/  <---------'
           (framework-free TypeScript — imports nothing but itself)
```

`tauri/` and `native/` — the desktop and store shells — stand beside these, outside the npm workspace ([platforms.md](platforms.md)). The app layer's own architecture (the renderer, the snow shader and its trail map, the HUD, the shell of cards) is written up as it lands.

## `engine/` — the game, headless

A pure TypeScript module with no framework, no renderer, no DOM and no `node:` — it imports nothing outside its own tree, which is what lets the browser bundle, the headless simulator and the test runner host it unchanged. Its public surface is `engine/index.ts`, spelled `@engine` by every host.

- `createGame({ seed?, level?, rivals?, laps?, countdown?, contact?, spec?, quiet? })` builds a run: the map the seed generates (or the one handed in — the tests and the labs stage synthetic ones), the player's sled standing on the grid's first slot, and — by default — the race: `RACE.rivals` = 3 rivals on the other slots, the map's laps, three seconds of lights.
- `step(state, input)` advances exactly one fixed 120 Hz step (`TUNING.dt = 1 / TUNING.physicsHz`) and leaves that step's events on `state.events`. The app's frame loop and the headless simulator call this same function; there is no other way to advance a run.
- `placeRun(state, moment)` stands a run at a moment instead of riding to it — a plan point, a heading, a speed, optionally a height, a climb, a pitch and a roll — with the engine turning as though it had been pulling. The tests and the ride lab stage through it; the moment itself is still the engine's to emit.
- `botInput(state)` is the bot's answer for the same state (`sim/bot.ts`); `simulateRun(seed, options)` rides a whole map with it (`sim/simulate.ts`, [simulation.md](simulation.md)).

**Determinism is a hard invariant.** Everything random draws from the seeded stream in the state (`state.rng = createRng(seed)`, `lib/prng.ts`), never `Math.random`; `state.t` is the only clock the engine knows. The only draws a run makes are the rivals' paces at the grid. A seed and a list of inputs reproduce a run to the bit, which is what the sim digests rely on and `tests/determinism_test.ts` holds.

### The step

`step.ts` runs, in order:

1. the clock (`t += dt`, `tick += 1`) and the input copied onto `state.input`;
2. THE LIGHTS: under `countdown` a `count` event as each of the three seconds begins, then `go` and the phase to `racing`;
3. THE PLAYER'S RUN (`run.ts`'s `stepRun`): a reset asked for; else the sled (`sled.ts`'s `stepSled` — under the lights with the brake held, after the flag with the controls let go), the trees and the map's edge (`collision.ts`), the run's air record; and while racing, the race clock, the course (`course.ts`'s `stepCourse`: the checkpoint owed, the laps, the flag) and the automatic reset;
4. THE FIELD (`rivals.ts`'s `stepRivals`): every rival's own run by the same `stepRun`, ridden by the bot under the player's lights;
5. SLED AGAINST SLED (`clipRiders`), once every sled has moved.

### The state (`game/state.ts`)

`GameState` carries the map (`level`), the player's `sled`, the `input` last given, `progress`, the `rules` (`RunRules`: rivals, laps, the lights, contact), the field (`rivals`, each a whole `GameState` of its own sharing the player's level, rules and stream), the `countdown`, the `phase` (`countdown` → `racing` → `finished`) and this step's `events`.

`SledState` (also exported as `CraftState`) is what the renderer, the HUD and the audio read:

- the body: `x, y, z` (the CoG), `vx, vy, vz`, the orientation quaternion `q` (body → world; x right, y up, z forward), body rates `wx, wy, wz`, and `heading`, `pitch`, `roll` derived from `q` each step;
- the readouts: `speed` (|v|, vertical included, written once at the end of the step), `way` (along the nose, signed), `rpm`, `throttle`, `brake`, `steer`, `lean`, `skiAngle`, `treadSpeed` and `slip` (how much faster the tread runs than the snow under it), `packed` (the share of the load on groomed snow);
- the rider's weight: `riderRight`, `riderAft`;
- the snow: `contacts` — every probe (the two skis, then the tread's stations) with its footprint on the snow surface, how deep it is pressed (`sink`, the trail's depth), its width, its suspension `compression`, its `load` and whether it is `touching` — and `skiCompression` (left, right) and `treadCompression` for the springs as drawn;
- the air: `airborne`, `airTime`, `landing` (seconds since the last one).

`GameEvent`: `count`, `go`, `air`, `land` (air time, impact into the slope, `harsh`, the share of way `lost`), `hit` (a trunk, closing speed, where), `bump` (a rival), `checkpoint` (index, lap, split), `missed`, `lap`, `finish` (time, place) and `reset` (the checkpoint, and whether the engine did it).

### By module

- **`game/step.ts`** — `createGame`, `rulesFor`, `step`. **`game/run.ts`** — one rider's step, the player's and every rival's alike. **`game/rivals.ts`** — the grid, standing and stepping the field, sled against sled, the standings (`raceProgress`, `racePlace`, `fieldOrder`). **`game/defs/modes.ts`** — the race's rules and numbers.
- **`game/sled.ts`** — one step of the rigid body: every force summed, then one semi-implicit integration ([riding.md](riding.md)). **`game/suspension.ts`** — the probe layout and the chassis points, off the spec. **`game/snow.ts`** — the sink, the resistance and the grip. **`game/traction.ts`** — the engine, the CVT and the belt. **`game/flight.ts`** — the rider's levers in the air, and what a landing costs. **`game/chassis.ts`** — the unsprung points, as impulses. **`game/collision.ts`** — the trunks (hashed per level) and the map's edge.
- **`game/course.ts`** — checkpoints, laps, the flag, the arrow (`bearingToNext`), the reset (`resetPose`, `standSled`). **`game/limits.ts`** — what a sled CAN do, stated once for the physics and the bot. **`game/place.ts`** — `placeRun`. **`game/clock.ts`** — the sun's hour at run time (ten minutes of riding an hour of sun), and where the sun stands.
- **`game/defs/`** — `sled.ts` (the one machine), `tuning.ts` (every shared number, each with its unit), `modes.ts`.
- **`mapgen/`** — the world generator ([level-generator.md](level-generator.md)); its `query.ts` answers "where on the loop is this point nearest?" and "where is the loop this far along it?" for everyone.
- **`sim/`** — `bot.ts`, `simulate.ts` ([simulation.md](simulation.md)).
- **`lib/`** — the generic pool: `prng.ts`, `math.ts`, `noise.ts`, `heightfield.ts`, `quat.ts` (the one statement of the sign conventions), `solar.ts`, `polyline.ts`.
- **`output.ts`** — the central output module: every line the engine prints goes through it.

## `tests/` and `scripts/`

Root vitest suites, one topic a file (`sled_test`, `flight_test`, `collision_test`, `course_test`, `rivals_test`, `determinism_test`, `simulation_test`, …). The physics is staged on the SYNTHETIC maps in `tests/support/synthetic.ts` — a stadium loop with a kicker, hills and a lone tree, and flat drag strips of packed snow or powder — so the rule suite passes with the generator deleted; `simulation_test` also rides generated maps.

`scripts/` is tooling and may import anything: `npm run sim` (the balance table), `npm run ride` (the ride lab: scripted scenarios on the synthetic maps, numbers and a picture each to `previews/ride-*.png`), every flag through `scripts/lib/cli.mjs`.
