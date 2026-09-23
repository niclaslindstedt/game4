# Riding

The sled model (`engine/game/sled.ts`, with `suspension.ts`, `snow.ts`, `traction.ts`, `flight.ts`, `chassis.ts` and `collision.ts`; the shared numbers in `engine/game/defs/tuning.ts` and the machine in `defs/sled.ts`) is a rigid body on the snow, integrated semi-implicitly at 120 Hz. Every force is summed in `stepSled`, each from the module that owns its model, and each model says where its numbers come from at the function that implements it. **There is no MODE.** A launch is a sled whose probes have all left the snow; a landing is one whose probes came back; a rollover is a chassis lying on its side. Each is read off the same forces every other step is made of, and the events say so after the fact.

Every number below is quoted with its unit as `TUNING` or `SLED` states it; the measured ones at the end come from riding the real engine on the synthetic maps the tests use (`npm run ride`).

## The machine (`defs/sled.ts`)

FOUR sleds, each an answer to a kind of snow rather than a point on one scale (`SLEDS`; `sledById`). Every number is kept inside the real band for its class, never a make and a model:

|                            | Trail              | Crossover (`SLED`) | Mountain       | Cross                 |
| -------------------------- | ------------------ | ------------------ | -------------- | --------------------- |
| dry mass                   | 227 kg             | 230 kg             | 195 kg         | 212 kg                |
| engine                     | 123 kW             | 123 kW             | 134 kW (turbo) | 123 kW, revs to 8700  |
| belt                       | 3.28 m, 32 mm lugs | 3.71 m, 44 mm      | 3.94 m, 66 mm  | 3.48 m, 32 mm         |
| on the snow                | 1.40 m             | 1.65 m             | 1.95 m         | 1.45 m                |
| ski stance                 | 1.09 m             | 1.04 m             | 0.89 m         | 1.09 m                |
| travel, front / rear       | 0.22 / 0.28 m      | 0.23 / 0.30 m      | 0.23 / 0.33 m  | 0.265 / 0.34 m, stiff |
| CVT top ratio              | 52 m/s of belt     | 50                 | 44             | 41 (geared short)     |
| `topSpeed` / `accel0to100` | 168 km/h / 3.5 s   | 160 / 4.1          | 151 / 4.3      | 146 / 3.5             |

Every machine carries an `riderMass` = 85 kg rider; the crossover is 3.2 × 1.2 × 1.25 m with its centre of gravity (sled and rider together, the body frame's origin) `cogHeight` = 0.55 m over the snow, its skis `skiForward` = 1.15 m ahead of it, its belt on the snow from `treadFront` = 0.2 m ahead of the CoG to `treadRear` = 1.45 m behind it. Its engine peaks at 7900 rpm, idles at 1500, engages its clutch at 3800 and is limited at 8400, and drives the tread through a CVT that runs `gearSpan` = 3.6 times slower in its lowest ratio than in its top, with `driveline` = 0.8 of the crank's power reaching the snow. `topSpeed` and `accel0to100` are documented EXPECTATIONS, not inputs: the physics delivers them and `tests/catalog_test.ts` holds every machine to its own.

**The crossover is the reference machine.** Every shared number in `TUNING` was tuned on it, and `footprint.ts` prices every other machine's tread as multipliers on the shared snow model that read exactly 1 for it:

- _the pressure_ is the tread's share of the weight over its footprint on the snow (2.4 kPa on the mountain sled, 3.2 on the crossover, 4.1 on the trail sled). The rest sink goes as `(p / p₀)^footprint.floatExp` (0.8), the planing speed as `√(p / p₀)`, and the powder drag — the work of compacting the snow, which goes as how far it is pressed (Bekker; CRREL's snow-mobility models price motion resistance the same way) — with the sink;
- _the lugs_ bite powder as `(h / h₀)^lugPowder` (0.35), driving and sideways alike, and hold the groomer sideways as `(h₀ / h)^lugSide` (0.5) — a tall lug folds over under a sideways load;
- _the belt's own losses_ go as `(L / L₀) · (h / h₀)^lugLoss` (0.8): riders put a 144-inch belt at a tenth off a 136-inch one at 60 mph of track speed, and a 156-inch belt with 2-inch lugs at a quarter off.

The exponents are tuning values, bounded by the measurements above rather than read off a paper; `make ride ARGS="--sled all"` is what they are judged by.

**The corner** a machine can hold (`cornerGrip`, read by the yaw hold and the bot) is its sideways grip or its TIPPING POINT, whichever comes first (`tipLimit`): half the ski stance, plus how far the rider hanging off carries the weight outboard, over the CoG's height — the static stability factor, which is why a wide, low trail sled holds a groomed bend a narrow mountain sled lifts a ski in. **The landing** a machine takes whole (`harshSpeedOf`) scales `air.harshSpeed` by the square root of its springs' stroke energy per kilo, so long travel on stiff springs lands what a soft short stroke bottoms on.

The inertia is the envelope as a solid box (`inertiaOf`): about 290 kg·m² in pitch and yaw and 79 in roll — which is why a sled rolls far more readily than it pitches.

## Where the machine meets the snow (`suspension.ts`)

TEN PROBES: one under the middle of each ski on the front suspension, and the tread's footprint as four stations along its length by two across it (near its edges, where the lugs bear) on the rear. Each probe is a spring-damper along the body's own down axis, cast from an attachment point on the chassis — the raycast vehicle. Where the ray meets the snow's SUPPORT is found by Newton's method along the ray off the slope of the snow wherever the last guess landed (`RAY_STEPS` = 3); a ray meeting the snow at less than `RAY_GRAZE` = 0.15 m of drop per metre is running along it and meets nothing.

The REST LOAD each probe carries comes off the geometry rather than being authored: the ski line and the tread's centroid either side of the CoG split the weight by moment balance (`skiShare` — 32 % on the skis), and each attachment is placed so its spring sits at exactly its rest sag with the CoG at `cogHeight`. So a sled put down on flat snow stands level at the height the spec says (`tests/sled_test.ts`), and a spec with the skis moved carries less on them without a second number to keep in step.

The springs: `front` = 6200 N/m per ski, `rear` = 3000 N/m per tread station, both sagging about 8 cm at rest — a bit under 2 Hz in heave — with damping about half critical (`bump` softer than `rebound`, as a shock is). Past its travel (0.23 m front, 0.3 m rear) a probe meets its BUMP STOP, `STOP_RATE` = 12 times the spring with `STOP_DAMP` = 4 times the bump damping. **The damper's rate is the compression's own change since the last step**, read off the very surface the spring is, so a crease in the snow is a crease in both; a probe just arriving uses the contact point's speed into the slope. The spring pushes the chassis up its own axis at the attachment.

Two FUSES, which are not models: no probe may push more than `MAX_LOAD` = 15 times its rest load (a strut bottomed on a steep face sees its compression grow with every centimetre the sled slides, and a spring that followed it fired the machine off the slope), and no body rate may exceed `MAX_SPIN` = 25 rad/s (a guard on the explicit gyroscopic term, which a tumble would otherwise feed).

## The snow (`snow.ts`)

**The sink** is the planing hull's draft carried straight over. Snow under a moving footprint has less time to yield the faster it is crossed, so the support rises with speed:

```
sink = powderSink · scale · exp(−(v / planeSpeed)²) · (1 − packed) + packedSink · packed
```

with `powderSink` = 0.26 m (the reference tread at rest, buried to its rails in fresh snow), `packedSink` = 0.02 m (a groomed track's cut), `planeSpeed` = 8 m/s, `scale` the machine's own `Footprint.sink` for the tread and `skiSink` = 0.7 for the skis (a wider, lighter footprint), the planing speed scaled by `Footprint.plane`, and `packed` the level's `packedAt` under the probe. Each probe's support eases toward that over `sinkLag` = 0.25 s — a sled slowing in powder settles rather than drops. At the planing speed a sled carries a third of its rest sink and by 40 km/h it rides a few centimetres into the powder: the moment a rider feels it lift onto the top. The sink is the support's depth under the untouched surface — the springs push against `groundAt − sink` — and it is what every `SnowContact` reports; the renderer's trail is drawn at that depth or at the powder's own furrow, whichever is deeper (`drawnDepth` in `pwa/src/game/trail-stamp.ts`), never shallower.

**The snow dial.** A free ride may ask for shallower or deeper powder (`SNOW_DIAL` in `engine/game/defs/modes.ts`, 0.25–2, the start card's SNOW row): `GameState.snowDepth` multiplies `powderSink` wherever it is read — the sink above, the chassis' `powderFloor`, and the powder drag's compaction term — and the drawn furrow with it; the groomer's `packedSink` is left alone. It is 1 on every race and in every measurement, and it draws nothing from the run's stream, so a run replays the same at any depth.

**The resistance**, per probe, along its line of travel, faded out below `DRAG_FADE` = 0.3 m/s so a sled at rest is not rocked through zero:

- _rolling_: `crrPacked` = 0.03 or `crrPowder` = 0.07 of the probe's load;
- _the plough_: `plough` = 80 N per metre of footprint width per metre of sink per (m/s)², in powder only and only at the FRONT of a footprint (the skis and the tread's front row — the rest run in the trench those cut). This is the bow wave, and why a bogged sled wants momentum: it grows with the square of the speed while the sink it is multiplied by falls away, so it is a HUMP a sled has to get over;
- _powder drag_: `powderDrag` = 0.008 of the load per m/s — what compacting fresh snow costs at speed, gone on the groomed track.

**The grip** — coefficients on the probe's load, each a `tanh` of its slip over a reference speed, which is how a lugged belt or a carbide keel lets go (progressively): the tread driving along its length (`treadPacked` = 1.0, `treadPowder` = 0.6, over `slipRef` = 1.4 m/s), the tread holding sideways (`treadSidePacked` = 1.0, `treadSidePowder` = 0.45) and the skis holding sideways along their steered line (`skiPacked` = 0.95, `skiPowder` = 0.45), both over `sideRef` = 0.5 m/s. All three blend by `packed`.

## The drive (`traction.ts`)

**The engine** is a power curve over rpm (`powerShare`): 12 % at idle rising as `x(2 − x)` to its peak, falling a quarter past it to the limiter.

**The CVT** is modelled by what it does rather than by its sheaves: with the throttle open it holds the engine at the rpm the lever asks for — from the clutch's engagement up to the power peak at full throttle — shifting up as the tread gains speed, until it runs out of ratio; past that the engine is locked to the belt (`rpmAtTop`) and climbs with it to the limiter, which cuts the fuel over the last 2 %. So the drive offers the belt POWER over belt speed — flat power, falling force — floored at `launchFloor` = 2.5 m/s (the clutch slipping off the line) and capped at what the peak torque can do through the lowest ratio (`maxDriveForce`, about 9.4 kN). The engine's rpm follows the CVT's goal at `rpmRate` = 9 /s; the throttle follows the lever at `throttleRate` = 8 /s. With the throttle shut and the belt still driving the engine past engagement, it brakes the belt at `engineBrake` = 45 N per m/s.

**The belt** is a mass of its own (`stepTread`, `beltMass` = 22 kg reflected): the engine pushes it, the snow pushes back through every tread probe's grip (the sum of what those put into the snow), its rails and idlers drag it (`lossLin` = 5 N per m/s, `lossQuad` = 0.3 N per (m/s)² on the reference belt, scaled for another's — with the air, what an 850-class sled tops out against), and the brake clamps it — `brakeForce` = 3.4 kN at full lever, holding it at zero if that is enough. It never runs backwards: the drive is one-way. So the tread spins faster than the sled goes whenever the grip cannot take what the engine gives — off the line on packed snow, and nearly always in powder, where it runs up to the limiter (`SledState.slip`) — and it spins up free in the air.

## Steering and the rider

**The skis** turn up to `skiLock` = 0.42 rad at a standstill, the lock halved by `steer.fadeSpeed` = 17 m/s (`skiLockAt`, which the bot reads too) and swung at `steer.rate` = 2.6 rad/s. Their sideways grip, a long way ahead of the CoG, is what turns the sled on packed snow; the tread's, just behind it, is what holds the back.

**The rider** is a quarter of the moving mass, and moving him is how a sled is ridden. The bars hang him `riderReach` = 0.3 m into the turn and the lean moves him `rider.aftReach` = 0.35 m fore or aft, both lagging `rider.lag` = 0.18 s; his weight off-centre is a moment on the chassis. Rider and chassis together hold the sled toward a ROLL into the turn — `rollPacked` = 0.08 rad at full bars on the groomed track, `rollPowder` = 0.4 rad in powder — with `rollStiff` = 5000 N·m per rad, `rollDamp` = 420 N·m·s, but never more than `rollMax` = 2600 N·m, and giving out past about a radian: a load past that, or a sidehill steep enough, rolls the sled over, and a sled well over is going over. In powder the lean is the whole of how a sled turns: **THE CARVE** puts `rider.carve` = 1.4 of each tread station's load per radian of roll into a force toward the low side, once there is way on (`carveSpeed` = 6 m/s).

**THE ARCADE'S HAND ON THE YAW** (`steer.yawHold`) models nothing. The skis stand a long way ahead of the CoG and the tread's centroid a short way behind it, so a sled whose weight is thrown onto its skis — braked hard with the bars over — has more turning moment at the front than holding moment at the back, and swaps ends. On the snow the yaw rate is held toward the one the skis' own geometry asks for (the way × tan(ski angle) over `steer.base` = 1.7 m) but no faster than the corner grip can turn the way itself, at `yawHold` = 1500 N·m per rad/s; and the nose is held to the way the sled is going, `slipHold` = 2500 N·m per radian of slide past `slipFrom` = 3 m/s; the two together no more than `yawHoldMax` = 3000 N·m. The bare physics, measured, spun a sled braked from 100 km/h into a 0.6-lock turn through 98° of slide; with the hand it slides 34° and stops straight. The hand is a DIAL (`GameState.assist.yaw`, 0..1, OPTIONS ▸ ASSIST ▸ STEER HOLD): the whole term above is scaled by it, so zero is the bare physics, and the field always rides at one.

## The air (`flight.ts`)

A sled is airborne when no probe and no chassis point touches the snow; the `air` event fires once it has been up `air.counts` = 0.15 s (anything shorter is a skip over a bump). In the air the rider has three levers on the pitch, all in the body frame (nose up is a negative torque about x): the LEAN (`leanTorque` = 520 N·m at full lean, back = nose up), the THROTTLE (`throttleTorque` = 80 N·m at full lever — the tread wound up as a gyroscope, the reason every rider gasses it off a lip that is pitching him forward) and the BRAKE (`brakeTorque` = 420 N·m — stopping twenty kilos of belt dead drops the nose). The bars have a little yaw (`steerTorque` = 90 N·m), and the air damps every rate at `damping` = 60 N·m·s. No control rolls a sled in the air, so the rider levels the roll himself (`rollLevel` = 900 N·m per rad, `rollDamp` = 160), up to `rollGiveUp` = 1.1 rad off level: a sled thrown onto its side comes down on its side. The levelling is the second dial (`GameState.assist.air`, OPTIONS ▸ ASSIST ▸ AIR LEVEL) and scales `rollLevel` alone — the damping is the air's, not the rider's.

**A landing** is the suspension's job and the springs take it — the model of a good one is nothing at all. Past `air.harshSpeed` = 6 m/s of speed INTO the slope the suspension has bottomed and the machine pays `harshLoss` = 5 % of its way along the slope per m/s over, up to `harshMax` = 35 % (`landingLoss`). That is why landing on the downslope of a kicker is fast and landing flat after overshooting it is not; the `land` event carries the impact, whether it was harsh and what it cost.

## The chassis (`chassis.ts`)

Ten unsprung points — the belly's corners, the cowl's and the seat's, the bumper, the rider's helmet (`hullOf`) — meet the snow when the springs have run out. They are resolved at the VELOCITY level, not with springs: a penalty spring stiff enough to hold the sled off a slope met at eighty kilometres an hour stores the impact and hands it back, and one did fire a sled forty metres up the face it had hit. Each point under the snow has the part of its velocity into the slope taken away by an impulse through the body's effective mass there (the angular term included, so a nose meeting the snow pitches the sled as well as stopping it), with `hull.restitution` = 0.1 of it given back, a push-out of `pushRate` = 10 /s of its depth capped at `pushOut` = 1.5 m/s, and Coulomb friction `hull.friction` = 0.35 against the slide. The snow under a chassis point is the powder's FLOOR — deep powder does not hold a belly up, it is pushed aside by it.

## Trees and the edge (`collision.ts`)

A tree is its trunk: a vertical cylinder of `radius` from its foot to its top (the crown is drawn and is nothing to the physics). The sled is three plan circles of `trees.bodyRadius` = 0.55 m down its length; a circle inside a trunk is pushed out along the line between their centres, the closing speed comes back at `restitution` = 0.15, the speed along the trunk is scrubbed by up to `scrub` = 35 %, and the blow's lever about the CoG turns the sled — a clipped bumper spins it, a trunk met dead centre stops it. A `hit` is reported at `hitSpeed` = 1.5 m/s closing, at most once per `cooldown` = 0.6 s. The trunks are hashed once per level (`treesNear`, `trees.cell` = 12 m), so a step reads the handful near the sled.

The map's edge pushes a rider back toward the middle over its last `bounds.soft` = 20 m, and stops him `bounds.margin` = 6 m inside it.

## The wipeout (`crash.ts`)

Three ways off, each a threshold on something the step has already measured, and each well past anything a clean ride meets — the bot, over every seed of the sim on every machine, lands at most about 6° nose-down and 9 m/s into the slope, never goes past half over and meets no trunk:

- **a trunk met hard** — a `hit` at `crash.treeSpeed` = 8 m/s (29 km/h) closing or more. The trunk stops the sled; the rider goes on at `keep` = 85 % of the way the sled had before the blow, until the snow or the trunk itself stops him;
- **a nose-in landing** — a `land` ending a flight of `noseAir` = 0.3 s or more, at `noseImpact` = 5 m/s into the slope or more with the nose `noseAngle` = 0.5 rad (29°) or more down against it. The skis dig, he goes over the bars, and the sled is given `sledKick` = 0.35 rad/s of nose-over per m/s of the impact (at most 5). The rebound hop off a touchdown (0.15–0.22 s up) is that landing handing itself back, not a second landing, and is never judged: a kicker overshot at race speed lands tail-first and slaps down onto its nose 37° down a hop later, and is ridden out;
- **a rollover at speed** — the sled lying over on the SNOW (its up axis under `reset.overUp` of the ground's normal, not the sky's — a sled climbing a face stands well off vertical) for `rollHold` = 0.2 s (`SledState.rolledFor`) at `rollSpeed` = 8 m/s or more. Turning over in the AIR is not a roll — a sled that somersaults off a kicker and comes down on its skis is ridden away, and it is the landing that decides — and a slow roll he hangs on through, the reset's own clock standing it up as before.

THE RIDER THROWN is a body of his own (`SledState.thrown`): a point of `radius` = 0.3 m leaving at the sled's way plus a climb of `throwUp` = 2.4 m/s, under gravity, pushed out of any trunk he meets, settling `sink` = 0.12 m into powder, the speed into the snow taken away with `restitution` = 0.25 back from a real arrival, and Coulomb friction on the slide — `frictionPacked` = 0.5 on the groomer, `frictionPowder` = 0.8 in fresh snow, which a sprawled body ploughs. Over it a TUMBLE, head over heels at his speed over `tumbleRadius` = 0.5 m (no faster than 12 rad/s), chasing the slide on the snow and settling flat once he has stopped. None of it draws from the stream: a crash is a pure function of the moment it started, and a run replays wipeout for wipeout.

While he is off it the sled goes on with the controls let go, takes no checkpoint and runs none of the automatic reset's clocks; the race clock runs. The reset comes once he has lain `lieMin` = 1.8 s and stopped (`restSpeed` = 0.6 m/s), or at `lieMax` = 4.5 s whatever he is doing — reported `auto`. The rider's own reset key stands them up at once.

## Stuck in powder (`trench.ts`)

A sled BOGGED — over half throttle in powder, the belt slipping past half of `trench.slipRef` = 6 m/s, going under `creep` = 1 m/s — for `after` = 1 s starts to dig: the hole under the tread (`SledState.trench`) deepens at `dig` = 0.14 m/s at full slip, full throttle and virgin powder, to `max` = 0.3 m on top of the sink. `sled.ts` adds it to the tread probes' sink target, so the tread hangs in its own hole while the belly's chassis points, which read the powder's floor, take the load it lost — high-centred, which is what trenched is — and takes up to `grip` = 75 % of the tread's drive with it. No launch out of a powder grid gets near it.

ROCKING IT OUT: every metre the rider's weight moves (`riderAft` fore and aft on the lean, `riderRight` side to side on the bars) packs `rock` = 0.04 m of it back, and driving out clears `clear` = 0.4 m per metre of way past `creep`. A rider who rocks with the throttle pinned is digging as fast as he packs: ease it and rock. Past `stuckAt` = 0.06 m it is trenched and `stuck` fires once.

## Damage (`damage.ts`)

Only on a run that asked for it (`createGame({ damage: true })`, OPTIONS ▸ ASSIST ▸ DAMAGE, off by default; a rival never takes any). Three figures, each 0 sound … 1 wrecked: the two skis and the suspension. A trunk past `damage.treeFrom` = 4 m/s closing bends the ski on its side by `treeRate` = 0.06 per m/s over (both, half each, met dead centre); a landing past the machine's harsh speed hurts the suspension by `landRate` = 0.05 per m/s over; a wipeout adds `wipeout` = 0.2 to what its cause reaches. Nothing mends it but a new race.

What it does to the ride: a bent ski pulls the skis' line `skiToe` = 0.07 rad toward its own side at fully bent and bites `skiGrip` = 40 % less; a hurt suspension loses up to `springSoft` = 40 % of its rate, `dampSoft` = 50 % of its damping and `harshSoft` = 45 % of the speed into the slope it takes whole. Every share is `1 − k·d`, so a sound sled is the same arithmetic to the last bit.

## The reset

A rider's own (`SledInput.reset`) or the engine's: a sled whose up axis has been under `reset.overUp` = 0.25 of vertical for `reset.overFor` = 3 s, or held at over half throttle below `stuckSpeed` = 0.8 m/s for `stuckFor` = 3 s — or, once it has dug a trench, for `trench.holdFor` = 8 s of trench, the time to rock it out — or whose rider has been thrown and lain long enough (above), is stood back on the track `course.resetAhead` = 3 m past the last checkpoint it took (or short of the start line before it has taken one), at rest, facing along the track (`course.ts`).

## Measured

`npm run ride` rides each scenario (`scripts/lib/ride-scenarios.mjs`) on the synthetic maps and draws it to `previews/ride-<scenario>.png`; `--sled all` rides every scenario on every machine. At the tuning in this tree, the crossover:

| Scenario                      | What came back                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rest (packed)                 | CoG 0.530 m over the snow, skis 0.088 m and tread 0.083 m of sag, 0.02 m of sink, level                                                                                |
| rest (powder)                 | CoG 0.317 m over the untouched surface, 0.26 m of sink, 2° nose up (the skis sink less)                                                                                |
| accel (packed)                | 0–50 km/h 1.97 s, 0–100 km/h 4.07 s in 58 m, top 160 km/h                                                                                                              |
| accel (powder)                | 0–50 km/h 8.9 s, planed at 38 km/h, top 90 km/h with the tread spinning over the snow                                                                                  |
| brake                         | 100–0 km/h in 5.2 s and 69 m (0.54 g)                                                                                                                                  |
| turn, 100 km/h full lock      | radius 123 m, 0.68 g                                                                                                                                                   |
| brake into a turn             | worst slide 33°, stopped in 51 m, no spin                                                                                                                              |
| the stadium kicker at 75 km/h | launched at 112 km/h, 2.2 s of air, 62 m carry, a tail-first landing at 11 m/s costing 25 %, slapped onto the nose a hop later — ridden out, no wipeout on any machine |
| 30° powder slope at 70 km/h   | climbs 20 m before it stalls                                                                                                                                           |
| a trunk at 50 km/h            | 55 km/h into it, 20 km/h out, turned 17°; the rider thrown, 5 m on round the trunk, stood up 1.8 s later                                                               |
| a trunk clipped at 25 km/h    | a 16 km/h hit, held on through                                                                                                                                         |
| nose-in, 40° down at 60 km/h  | a 5.8 m/s impact: over the bars, 21 m of slide, stood up at 2.5 s                                                                                                      |
| onto its side at 70 km/h      | lands on its side, thrown once it has lain over 0.2 s; 17 m of slide, 3 turns of tumble                                                                                |
| nosed into a powder bank      | trenched 0.15 m deep in 4 s at full throttle; rocked out and away by 7 s. Pinned instead, 0.30 m deep and reset after the trench's 8 s                                 |

And where the roster parts:

| Scenario                       | Trail                                                           | Crossover      | Mountain       | Cross          |
| ------------------------------ | --------------------------------------------------------------- | -------------- | -------------- | -------------- |
| top on packed snow             | 168 km/h                                                        | 160            | 151            | 146            |
| 0–100 km/h on packed           | 3.5 s                                                           | 4.1            | 4.3            | 3.5            |
| rest sink in powder            | 0.32 m                                                          | 0.26           | 0.21           | 0.30           |
| 0–50 km/h in powder, top there | 23 s, 55 km/h                                                   | 8.9 s, 90      | 5.1 s, 106     | 16 s, 75       |
| 30° powder slope at 70 km/h    | stalls at 16 m, loops off it and dives in nose-first: a wipeout | stalls at 20 m | tops it (28 m) | stalls at 16 m |
| the kicker at 75 km/h, landing | −30 %                                                           | −25 %          | −24 %          | −18 %          |

What the bot makes of it on generated maps is `npm run sim`'s (`--sled all` for the roster), and `docs/simulation.md` says how to read it.
