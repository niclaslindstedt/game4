---
name: sled-physics
description: "Use when working on HOW THE SLED ANSWERS THE SNOW — the ten probes and the springs they stand on, the sink into powder and how the machine climbs onto the top of it with speed, the rolling resistance, the plough and the powder drag, the grip of the tread and the skis, the engine, the CVT and the belt, ski steering and the arcade's hand on the yaw, the rider's weight and the carve in powder, the chassis meeting the snow when the springs run out, the rollover, flight and landings. Owns `engine/game/sled.ts`, `suspension.ts`, `snow.ts`, `traction.ts`, `flight.ts`, `chassis.ts`, `limits.ts`, the `TUNING.snow` / `.grip` / `.tread` / `.steer` / `.rider` / `.air` / `.hull` / `.reset` blocks, and `make ride` — the lab that must run before and after any change here. Not the machine's own numbers (`sled-tuning`) and not trees, checkpoints or the edge (`collision`)."
---

# The sled's physics

This skill owns **one question**: given the snow under it, what does the sled
do next?

Seven modules answer it, and the split matters:

- **`engine/game/suspension.ts`** — WHERE THE MACHINE MEETS THE SNOW: the
  probe layout off the spec (one under each ski, the tread's footprint as
  four stations by two), each a spring-damper cast along the body's own down
  axis (the raycast vehicle), and the unsprung chassis points (`hullOf`). The
  rest load each probe carries comes off the geometry (`skiShare`), never off
  an authored number.
- **`engine/game/snow.ts`** — THE SNOW UNDER A PROBE: how far it lets the
  machine sink (`sinkTarget`, `powderFloor`), what it costs to push through
  (`snowDrag`: rolling, the plough, powder drag) and how hard it can be
  gripped (`gripAt`). Knobs in `TUNING.snow` and `TUNING.grip`.
- **`engine/game/traction.ts`** — THE DRIVE: the engine's power curve
  (`powerShare`), the CVT modelled by what it does, the belt as a mass of its
  own (`stepTread`), the brake on it. Knobs in `TUNING.tread`.
- **`engine/game/sled.ts`** — THE BODY: every force summed in the world frame,
  torques about the CoG turned into the body frame, one semi-implicit step at
  120 Hz (velocity then position, body rates then the quaternion). The ski
  steering, the rider's weight, the roll into a turn and the CARVE, the
  arcade's hand on the yaw. Knobs in `TUNING.steer` and `TUNING.rider`.
- **`engine/game/flight.ts`** — THE AIR: the rider's three pitch levers (the
  lean, the throttle's gyro, the brake), the roll he levels himself, and
  `landingLoss` — what a landing the suspension could not take costs. Knobs
  in `TUNING.air`.
- **`engine/game/chassis.ts`** — the unsprung points meeting the snow when
  the springs have run out, as IMPULSES (sequential impulse, one pass), never
  as penalty springs. Knobs in `TUNING.hull`.
- **`engine/game/limits.ts`** — what a sled CAN do (`maxRpm`, `topSpeedOf`,
  `treadCeiling`, `lockAt`, `brakeDecel`, `cornerGrip`), stated once, read by
  the physics AND `sim/bot.ts`.

`docs/riding.md` is the long-form account of every one of these, with every
number and what the ride lab measured at this tuning. Read it before the
first edit; update it with the last.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs sled-physics --list`.

| Load beside this one | For |
| --- | --- |
| `sled-tuning` | the machine's own numbers (`defs/sled.ts`) and the expectations a test holds them to |
| `collision` | the trees, the checkpoints, the reset and the map's edge |
| `mapgen-improvement` | the snow the probes read: `groundAt`, `packedAt`, the kickers' profile |
| `game-feel` | whether the answer READS as a sled on snow |
| `test-scenario` | staging a rest, a launch, a sidehill on a synthetic map |

## The forces, and where each is written down

Each force is stated ONCE, with its model in the comment above it. Change a
term and the comment's claim has to stay true.

| Force | Model | Where |
| --- | --- | --- |
| Suspension | Raycast vehicle: each probe a spring-damper along the body's down axis against the snow's SUPPORT (the surface less the sink), a bump stop past its travel; the damper's rate is the compression's own change, read off the same surface as the spring | `suspension.ts`, `sled.ts` |
| The sink | The planing-hull analogy: support rises with speed as exp(−(v/planeSpeed)²), blended by `packed`, eased over `sinkLag` | `snow.ts` — `sinkTarget` |
| Resistance | Rolling resistance as a share of the load; THE PLOUGH (the bow wave of a sunk footprint, ∝ width · sink · v², front row only); powder drag ∝ load · v | `snow.ts` — `snowDrag` |
| Grip | Coulomb on the probe's load, each coefficient a `tanh` of its slip over a reference speed (a lugged belt and a carbide keel let go progressively), blended by `packed` | `snow.ts` — `gripAt`; summed in `sled.ts` |
| The drive | A power curve over rpm; the CVT holds the engine at the rpm the lever asks for until it runs out of ratio; force = power / belt speed, floored at `launchFloor`, capped at `maxDriveForce` | `traction.ts` |
| The belt | A mass of its own: the engine pushes, the snow pushes back through the tread's grip, rails and idlers drag, the brake clamps; one-way | `traction.ts` — `stepTread` |
| Steering | The skis' sideways grip along their steered line, the lock falling with speed (`skiLockAt`) | `sled.ts` |
| The yaw hand | ARCADE: the yaw rate held toward the ski geometry's, the nose held to the way — models nothing, stated as such | `sled.ts`, `TUNING.steer.yawHold` |
| The rider | His weight moved by the bars and the lean, lagging; the roll the chassis settles at into a turn; in powder THE CARVE — load per radian of roll turned toward the low side | `sled.ts`, `TUNING.rider` |
| Air control | Lean → pitch, throttle → nose up (the belt as a gyroscope), brake → nose down, a little yaw off the bars, the rider levelling the roll up to `rollGiveUp` | `flight.ts` |
| Landing cost | Past `harshSpeed` INTO the slope, a share of the way per m/s over, capped | `flight.ts` — `landingLoss` |
| Chassis contacts | Velocity-level impulse through the effective mass (angular term in), a little restitution, a capped push-out, Coulomb friction; against the powder's FLOOR | `chassis.ts` |
| Gravity, air drag | g on the CoG; ½ ρ C_dA v² with ρ at −10 °C | `sled.ts`, `TUNING.airDensity` |

## The instrument: `make ride`

A sled crossing a kicker is a dozen numbers changing together over two
seconds, and watching it in the game shows a spray of snow. So do not: stage
it on the bench and read it.

```sh
make ride SCENARIO=rest               # ONE scenario
make ride SCENARIO=kicker
npm run ride                          # every scenario, one table
npm run ride -- accel-powder --seconds 30
```

It stages the scenario on a SYNTHETIC map (`tests/support/synthetic.ts`) with
`placeRun`, rides a scripted input through the real engine at 120 Hz, prints
the numbers and writes `previews/ride-<scenario>.png`. **The table is what a
claim gets made out of; the picture is what tells you which number to go and
look at.** The scenarios are `scripts/lib/ride-scenarios.mjs`:

| Scenario | What it isolates |
| --- | --- |
| `rest` / `rest-powder` | The stance: the CoG height, the sag, the sink, level, no drift — on the groomer and in fresh snow |
| `accel` / `accel-powder` | 0–50 and 0–100 km/h, the top speed, the tread's slip; in powder, the speed it PLANES at |
| `brake` | 100–0 km/h: the time, the metres, the g |
| `turn` / `turn-fast` | Full lock at 60 and 100 km/h: radius, g, roll |
| `brake-turn` | Braking into a turn: the worst slide, whether it spins |
| `turn-powder` | The carve: radius, g, and the lean into it |
| `kicker` / `kicker-slow` | The stadium kicker at speed and slowly: air time, carry, height, the landing's impact and cost |
| `drop` | Dropped off a step at speed: the impact and what it cost |
| `climb` / `wall` | A powder slope and a face too steep: how far up, the stall, the slide back |
| `sidehill` | Traversing a steep slope: the roll held, the slide down it |
| `tree` | A trunk met at speed: in, out, turned |

**Run it BEFORE the first edit and AFTER the last**, on every scenario the
change plausibly reaches, and put both tables in the PR. `docs/riding.md`'s
"Measured" table is the baseline at this tuning; a change that moves a row
rewrites that row. No build, no browser, seconds.

### The bench — where a NUMBER about the sled comes from

- **On the flat, not on a generated map.** `flatLevel()` is a drag strip,
  all packed or all powder; `syntheticLevel()` is the stadium with a kicker,
  hills and a lone tree. A figure taken on a generated map is a figure about
  whatever hill, bank or trunk the run happened to meet.
- **A plain-Node bench CAN use the synthetic map.** `aliasEngine('<repo>')`
  from `scripts/lib/engine-alias.mjs` before the dynamic `import()` resolves
  `@engine`, and vitest is a devDependency so the support file's imports
  resolve. Import `syntheticLevel` / `flatLevel` directly.
- **NEVER MEASURE AN ATTITUDE OFF `pitch` OR `heading`.** Both are Euler
  readings `toEuler` folds at ±90° of pitch, so a sled going over backwards
  reads as a reversal and a heading swings a clean 180°. Use `∫ −wx dt` over
  the airborne stretch for how far it pitched (body-frame, does not wrap), and
  `rotate(q, {x:0,y:1,z:0}).y` — the sled's own up in world — for whether it
  is still the right way up (the reset reads exactly that: `reset.overUp`).
- **`speed` HAS NO DIRECTION.** It is `|v|`, vertical included. "How fast
  forwards" is `way`, the speed along the nose, signed.
- **Spin up before measuring.** `placeRun`'s `speed` is a placement, not a
  settled machine; give it a few seconds at the throttle the case asks for.
- **Quote a rate at a FIXED TIME and a time to half.** An average to a full
  stop is mostly the tail. For a turn, quote the lateral g and the radius at
  a MATCHED entry speed, re-staged as its own run — radius goes as v², so a
  change that raised the top speed gets credited with a turn it never lost.

## The rules

- **THE SLED STANDS AT THE HEIGHT ITS SPEC SAYS.** The rest loads come off
  the geometry and each attachment is placed so its spring sits at its rest
  sag with the CoG at `cogHeight`; `tests/sled_test.ts` holds it. A sled that
  sits wrong at rest is wrong everywhere else too, so `rest` and
  `rest-powder` are the first strips after any probe or spring change.
- **THE SINK IS THE SUPPORT, AND THE TRAIL NEVER DRAWS SHALLOWER.** Every
  probe's `SnowContact.sink` is the depth of the support under the untouched
  surface. The renderer's `drawnDepth` (`trail-stamp.ts`) draws the sink or
  the powder's own furrow, whichever is DEEPER — a planing sled is carried a
  couple of centimetres in, but the eye expects a hand-deep furrow — so the
  drawn trail may be deeper than the physics, never shallower. A sink
  computed anywhere but `snow.ts` is a sled riding inside its own furrow.
- **POWDER IS A HUMP.** The plough grows with v² while the sink it multiplies
  falls away with speed, so a bogged sled wants MOMENTUM, and a sled that
  planes at walking pace or never planes at all has lost the one thing that
  makes powder powder. `accel-powder`'s planing speed is the number to read.
- **THE DAMPER READS THE COMPRESSION'S OWN CHANGE.** Against the same surface
  as the spring, so a crease is a crease in both. A damper reading the CoG's
  vertical speed brakes a whole sled for one probe crossing a lip.
- **THE CHASSIS IS IMPULSES, NEVER A STIFF SPRING.** A penalty spring stiff
  enough to hold three hundred kilos off a slope met at speed stores the
  impact and hands it back — the sled was fired forty metres up the face it
  hit. The two FUSES (`MAX_LOAD`, `MAX_SPIN`) are guards, not models; a
  change that leans on one is a force that is wrong.
- **THE DRIVE IS ONE-WAY, AND THE TREAD SPINS.** The belt never runs
  backwards; whenever the grip cannot take what the engine gives, the tread
  runs faster than the snow (`slip`), which the spray and the audio both
  read. In the air it spins up free — and that is the gyro the throttle
  pitches the nose with.
- **THE TOP SPEED IS WHERE THE DRAGS MEET THE POWER, NOT THE GEARING'S
  CEILING.** The belt's own losses are the largest drag at speed. A model
  that needs `maxRpm` to hold the top speed is wrong; `SLED.topSpeed` and
  `accel0to100` are EXPECTATIONS the test holds the physics to (`sled-tuning`).
- **THE YAW HAND IS ARCADE, AND SAYS SO.** `steer.yawHold` exists because the
  bare physics spun a sled braked hard into a turn through 98° of slide. It
  must stay a hand on the RATE the skis ask for, never a source of turn: a
  hand that turns the sled on its own is a sled that steers without skis.
- **MEASURE THE SLIDE OFF WHAT WAS ASKED, NOT OFF WHAT THE SLED IS DOING.**
  (The sibling rally game learned this twice.) Any assist or threshold read
  off the resulting yaw rate or slip angle closes a loop — more slide, more
  authority, more slide — and a loop with gain over 1 has no middle: the sled
  becomes two-state, gripped or fully sideways a notch of bars apart. Read
  the demand off the bars and the way.
- **GATE A LATCH ON BOTH EDGES.** Anything that switches — the `air` event
  (`air.counts`), the automatic reset (`overFor`, `stuckFor`), a harsh
  landing — needs hysteresis or a hold time, or it chatters several times a
  second on a sled skipping over a crest.
- **THE CARVE IS THE LEAN'S, AND ONLY IN POWDER.** On packed snow the skis
  turn the sled; in powder the rider rolling the tread onto its edge does.
  A carve that works on the groomer is a sled that turns twice.
- **THE AIR IS THE RIDER'S, AND NOTHING ROLLS A SLED IN THE AIR.** Once no
  probe and no chassis point touches, `flight.ts` has the controls; the roll
  is levelled by the rider's body and given up past `rollGiveUp` — a sled
  thrown onto its side comes down on its side. A landing is a hand-back to
  the springs; `land` fires off that transition, and nothing in `flight.ts`
  decides a landing happened.
- **THE ROLLOVER IS THE FAR END OF THE SAME MODEL, NOT ITS OWN SYSTEM.** A
  sled goes over when the roll load passes what the rider and the chassis can
  hold (`rollMax`) or the sidehill is steep enough; after that the chassis
  points carry it and `reset.overFor` stands it back up. Stage it on the
  bench (`sidehill`), never judge it from a run in the game. A sled that goes
  over AT SPEED throws its rider (`crash.ts`, the `crash` skill), and a
  trenched tread (`trench.ts`) is a deeper sink and a weaker drive read here
  — `trenchGrip` and the trench on the tread probes' sink target, both
  exactly neutral out of a hole, as the damage shares are on a sound sled.
- **ANGULAR VELOCITY IS BODY-FRAME, THE QUATERNION IS BODY→WORLD, AND IT IS
  RENORMALISED EVERY STEP.** `heading`, `pitch`, `roll` are derived from `q`
  each step for the HUD, the camera and the bot — never integrated on their
  own. Nose-up is a NEGATIVE `wx`; right-side-down a negative `wz`
  (`state.ts`'s header).
- **A CONTROL GAIN IS AN ACCELERATION, NOT A TORQUE.** The sled's inertia is
  ~290 kg·m² in pitch and yaw and ~79 in roll (`inertiaOf`), so a gain in N·m
  means very different corrections about different axes. Print `inertiaOf`
  before sizing anything; moving θ rad in t seconds needs about 2θ/t² of
  angular acceleration.
- **SIGNS BITE AND READ AS SOMETHING ELSE.** A body torque about axis `a`
  swings a fixed WORLD direction the other way round it: anything steering
  toward an attitude works on `unrotate(q, worldUp)` and the axis carrying
  that onto the target is the NEGATIVE of the torque axis. The tell of a
  flipped sign is a controller that is large, smooth and confidently wrong; a
  mistuned gain oscillates.
- **EVERY NUMBER HAS UNITS AND SAYS WHAT KIND IT IS.** A measurement (the
  air's density, a spring rate off a real shock) is argued against the world;
  an arcade dial (the yaw hand, the air levers' authority) against `make ride`.

## Workflow

1. **Take the baseline first.** `make ride` on every scenario the change
   reaches (`rest` and `accel` always), before the first edit.
2. **Find WHICH STEP goes wrong, and which FORCE.** Walk the run one step at
   a time and print any step where the speed, a body rate or a probe's
   compression jumps; a sled that is wrong is almost always one force firing
   where it should not (the plough on a probe running in the trench, a bump
   stop on a probe that is not touching, drive with the tread in the air) and
   a long correct stretch after it that an average hides. When a ROTATION is
   wrong, print each torque's contribution per step.
3. **Make the comment true before changing the number.**
4. **Re-run the lab, the tests, then `make sim`** —
   `npx vitest run tests/sled_test.ts tests/flight_test.ts tests/collision_test.ts tests/simulation_test.ts tests/determinism_test.ts`,
   then the table (pace, air, hits, resets are where a sled change shows).
5. **LOOK.** `make world SEED=<n>` (no dist needed) for the sled on real
   snow from the renderer's own cameras; `make build` then
   `make screenshots` for the app.
6. Docs: `docs/riding.md` — the model, the numbers, the measured table.

## What the change obliges elsewhere

- `docs/riding.md` for any force, model or constant, and its measured table.
- `make ride` before/after on the reached scenarios, and `make sim`
  before/after, in the PR.
- `SLED.topSpeed` / `accel0to100` re-derived if the physics legitimately
  moved them (`sled-tuning`).
- A `.changes/unreleased/` fragment — the sled is what the player rides.

## Skill self-improvement

Record lessons under `.agents/skills/sled-physics/.lessons/` via the
**`skill-reflection`** skill. What belongs here: a force that fired where it
should not have and the tell in the ride table that found it, a feedback loop
that made the sled two-state, a spring or a fuse that read as the model — the
class of failure, not the one-off.
