# Riding

The sled model (`engine/game/sled.ts`, with `suspension.ts`, `snow.ts`, `traction.ts`, `flight.ts`, `chassis.ts` and `collision.ts`; the shared numbers in `engine/game/defs/tuning.ts` and the machine in `defs/sled.ts`) is a rigid body on the snow, integrated semi-implicitly at 120 Hz. Every force is summed in `stepSled`, each from the module that owns its model, and each model says where its numbers come from at the function that implements it. **There is no MODE.** A launch is a sled whose probes have all left the snow; a landing is one whose probes came back; a rollover is a chassis lying on its side. Each is read off the same forces every other step is made of, and the events say so after the fact.

Every number below is quoted with its unit as `TUNING` or `SLED` states it; the measured ones at the end come from riding the real engine on the synthetic maps the tests use (`npm run ride`).

## The machine (`defs/sled.ts`)

ONE sled: a trail/cross machine of `dryMass` = 230 kg with an `riderMass` = 85 kg rider, 3.1 × 1.2 × 1.25 m, its centre of gravity (sled and rider together, the body frame's origin) `cogHeight` = 0.55 m over the snow. Two skis `skiStance` = 1.05 m apart stand `skiForward` = 1.15 m ahead of it; the tread (the rubber track, so it is never confused with the race track) is `treadLength` = 3.35 m of belt × `treadWidth` = 0.38 m, on the snow from `treadFront` = 0.2 m ahead of the CoG to `treadRear` = 1.3 m behind it. A 110 kW engine peaking at 7900 rpm, idling at 1500, engaging its clutch at 3800 and limited at 8400, drives the tread through a CVT that gives `gearTop` = 36 m/s of belt at the redline in its top ratio and runs `gearSpan` = 3.6 times slower in its lowest, with `driveline` = 0.8 of the crank's power reaching the snow. `topSpeed` = 120 km/h and `accel0to100` = 4.5 s are documented EXPECTATIONS, not inputs: the physics delivers them and `tests/sled_test.ts` holds it to them.

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

with `powderSink` = 0.26 m (a resting tread buried to its rails in fresh snow), `packedSink` = 0.02 m (a groomed track's cut), `planeSpeed` = 8 m/s, `scale` 1 for the tread and `skiSink` = 0.7 for the skis (a wider, lighter footprint), and `packed` the level's `packedAt` under the probe. Each probe's support eases toward that over `sinkLag` = 0.25 s — a sled slowing in powder settles rather than drops. At the planing speed a sled carries a third of its rest sink and by 40 km/h it rides a few centimetres into the powder: the moment a rider feels it lift onto the top. The sink is the support's depth under the untouched surface — the springs push against `groundAt − sink` — and it is what every `SnowContact` reports; the renderer's trail is drawn at that depth or at the powder's own furrow, whichever is deeper (`drawnDepth` in `pwa/src/game/trail-stamp.ts`), never shallower.

**The resistance**, per probe, along its line of travel, faded out below `DRAG_FADE` = 0.3 m/s so a sled at rest is not rocked through zero:

- _rolling_: `crrPacked` = 0.03 or `crrPowder` = 0.07 of the probe's load;
- _the plough_: `plough` = 80 N per metre of footprint width per metre of sink per (m/s)², in powder only and only at the FRONT of a footprint (the skis and the tread's front row — the rest run in the trench those cut). This is the bow wave, and why a bogged sled wants momentum: it grows with the square of the speed while the sink it is multiplied by falls away, so it is a HUMP a sled has to get over;
- _powder drag_: `powderDrag` = 0.008 of the load per m/s — what compacting fresh snow costs at speed, gone on the groomed track.

**The grip** — coefficients on the probe's load, each a `tanh` of its slip over a reference speed, which is how a lugged belt or a carbide keel lets go (progressively): the tread driving along its length (`treadPacked` = 1.0, `treadPowder` = 0.6, over `slipRef` = 1.4 m/s), the tread holding sideways (`treadSidePacked` = 1.0, `treadSidePowder` = 0.45) and the skis holding sideways along their steered line (`skiPacked` = 0.95, `skiPowder` = 0.45), both over `sideRef` = 0.5 m/s. All three blend by `packed`.

## The drive (`traction.ts`)

**The engine** is a power curve over rpm (`powerShare`): 12 % at idle rising as `x(2 − x)` to its peak, falling a quarter past it to the limiter.

**The CVT** is modelled by what it does rather than by its sheaves: with the throttle open it holds the engine at the rpm the lever asks for — from the clutch's engagement up to the power peak at full throttle — shifting up as the tread gains speed, until it runs out of ratio; past that the engine is locked to the belt (`rpmAtTop`) and climbs with it to the limiter, which cuts the fuel over the last 2 %. So the drive offers the belt POWER over belt speed — flat power, falling force — floored at `launchFloor` = 2.5 m/s (the clutch slipping off the line) and capped at what the peak torque can do through the lowest ratio (`maxDriveForce`, about 9.4 kN). The engine's rpm follows the CVT's goal at `rpmRate` = 9 /s; the throttle follows the lever at `throttleRate` = 8 /s. With the throttle shut and the belt still driving the engine past engagement, it brakes the belt at `engineBrake` = 45 N per m/s.

**The belt** is a mass of its own (`stepTread`, `beltMass` = 22 kg reflected): the engine pushes it, the snow pushes back through every tread probe's grip (the sum of what those put into the snow), its rails and idlers drag it (`lossLin` = 8 N per m/s, `lossQuad` = 1.1 N per (m/s)² — the largest of a sled's drags at speed, and why it tops out where it does rather than at the gearing's ceiling), and the brake clamps it — `brakeForce` = 3.4 kN at full lever, holding it at zero if that is enough. It never runs backwards: the drive is one-way. So the tread spins faster than the sled goes whenever the grip cannot take what the engine gives — off the line on packed snow, and nearly always in powder, where it runs up to the limiter (`SledState.slip`) — and it spins up free in the air.

## Steering and the rider

**The skis** turn up to `skiLock` = 0.42 rad at a standstill, the lock halved by `steer.fadeSpeed` = 17 m/s (`skiLockAt`, which the bot reads too) and swung at `steer.rate` = 2.6 rad/s. Their sideways grip, a long way ahead of the CoG, is what turns the sled on packed snow; the tread's, just behind it, is what holds the back.

**The rider** is a quarter of the moving mass, and moving him is how a sled is ridden. The bars hang him `riderReach` = 0.3 m into the turn and the lean moves him `rider.aftReach` = 0.35 m fore or aft, both lagging `rider.lag` = 0.18 s; his weight off-centre is a moment on the chassis. Rider and chassis together hold the sled toward a ROLL into the turn — `rollPacked` = 0.08 rad at full bars on the groomed track, `rollPowder` = 0.4 rad in powder — with `rollStiff` = 5000 N·m per rad, `rollDamp` = 420 N·m·s, but never more than `rollMax` = 2600 N·m, and giving out past about a radian: a load past that, or a sidehill steep enough, rolls the sled over, and a sled well over is going over. In powder the lean is the whole of how a sled turns: **THE CARVE** puts `rider.carve` = 1.4 of each tread station's load per radian of roll into a force toward the low side, once there is way on (`carveSpeed` = 6 m/s).

**THE ARCADE'S HAND ON THE YAW** (`steer.yawHold`) models nothing. The skis stand a long way ahead of the CoG and the tread's centroid a short way behind it, so a sled whose weight is thrown onto its skis — braked hard with the bars over — has more turning moment at the front than holding moment at the back, and swaps ends. On the snow the yaw rate is held toward the one the skis' own geometry asks for (the way × tan(ski angle) over `steer.base` = 1.7 m) but no faster than the corner grip can turn the way itself, at `yawHold` = 1500 N·m per rad/s; and the nose is held to the way the sled is going, `slipHold` = 2500 N·m per radian of slide past `slipFrom` = 3 m/s; the two together no more than `yawHoldMax` = 3000 N·m. The bare physics, measured, spun a sled braked from 100 km/h into a 0.6-lock turn through 98° of slide; with the hand it slides 34° and stops straight.

## The air (`flight.ts`)

A sled is airborne when no probe and no chassis point touches the snow; the `air` event fires once it has been up `air.counts` = 0.15 s (anything shorter is a skip over a bump). In the air the rider has three levers on the pitch, all in the body frame (nose up is a negative torque about x): the LEAN (`leanTorque` = 520 N·m at full lean, back = nose up), the THROTTLE (`throttleTorque` = 80 N·m at full lever — the tread wound up as a gyroscope, the reason every rider gasses it off a lip that is pitching him forward) and the BRAKE (`brakeTorque` = 420 N·m — stopping twenty kilos of belt dead drops the nose). The bars have a little yaw (`steerTorque` = 90 N·m), and the air damps every rate at `damping` = 60 N·m·s. No control rolls a sled in the air, so the rider levels the roll himself (`rollLevel` = 900 N·m per rad, `rollDamp` = 160), up to `rollGiveUp` = 1.1 rad off level: a sled thrown onto its side comes down on its side.

**A landing** is the suspension's job and the springs take it — the model of a good one is nothing at all. Past `air.harshSpeed` = 6 m/s of speed INTO the slope the suspension has bottomed and the machine pays `harshLoss` = 5 % of its way along the slope per m/s over, up to `harshMax` = 35 % (`landingLoss`). That is why landing on the downslope of a kicker is fast and landing flat after overshooting it is not; the `land` event carries the impact, whether it was harsh and what it cost.

## The chassis (`chassis.ts`)

Ten unsprung points — the belly's corners, the cowl's and the seat's, the bumper, the rider's helmet (`hullOf`) — meet the snow when the springs have run out. They are resolved at the VELOCITY level, not with springs: a penalty spring stiff enough to hold the sled off a slope met at eighty kilometres an hour stores the impact and hands it back, and one did fire a sled forty metres up the face it had hit. Each point under the snow has the part of its velocity into the slope taken away by an impulse through the body's effective mass there (the angular term included, so a nose meeting the snow pitches the sled as well as stopping it), with `hull.restitution` = 0.1 of it given back, a push-out of `pushRate` = 10 /s of its depth capped at `pushOut` = 1.5 m/s, and Coulomb friction `hull.friction` = 0.35 against the slide. The snow under a chassis point is the powder's FLOOR — deep powder does not hold a belly up, it is pushed aside by it.

## Trees and the edge (`collision.ts`)

A tree is its trunk: a vertical cylinder of `radius` from its foot to its top (the crown is drawn and is nothing to the physics). The sled is three plan circles of `trees.bodyRadius` = 0.55 m down its length; a circle inside a trunk is pushed out along the line between their centres, the closing speed comes back at `restitution` = 0.15, the speed along the trunk is scrubbed by up to `scrub` = 35 %, and the blow's lever about the CoG turns the sled — a clipped bumper spins it, a trunk met dead centre stops it. A `hit` is reported at `hitSpeed` = 1.5 m/s closing, at most once per `cooldown` = 0.6 s. The trunks are hashed once per level (`treesNear`, `trees.cell` = 12 m), so a step reads the handful near the sled.

The map's edge pushes a rider back toward the middle over its last `bounds.soft` = 20 m, and stops him `bounds.margin` = 6 m inside it.

## The reset

A rider's own (`SledInput.reset`) or the engine's: a sled whose up axis has been under `reset.overUp` = 0.25 of vertical for `reset.overFor` = 3 s, or held at over half throttle below `stuckSpeed` = 0.8 m/s for `stuckFor` = 3 s, is stood back on the track `course.resetAhead` = 3 m past the last checkpoint it took (or short of the start line before it has taken one), at rest, facing along the track (`course.ts`).

## Measured

`npm run ride` rides each scenario (`scripts/lib/ride-scenarios.mjs`) on the synthetic maps and draws it to `previews/ride-<scenario>.png`. At the tuning in this tree:

| Scenario                      | What came back                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| rest (packed)                 | CoG 0.530 m over the snow, skis 0.081 m and tread 0.087 m of sag, 0.02 m of sink, level, no drift               |
| rest (powder)                 | CoG 0.315 m over the untouched surface, 0.26 m of sink, 2° nose up (the skis sink less)                         |
| accel (packed)                | 0–50 km/h 1.87 s, 0–100 km/h 4.18 s in 63 m, top 121.9 km/h with 0.6 m/s of tread slip                          |
| accel (powder)                | 0–50 km/h 8.0 s, planed (sink under 5 cm) at 38 km/h, top 90.3 km/h with the tread spinning 7 m/s over the snow |
| brake                         | 100–0 km/h in 5.0 s and 65 m (0.56 g)                                                                           |
| turn, 60 km/h full lock       | radius 42 m, 0.71 g, 4° of roll                                                                                 |
| turn, 100 km/h full lock      | radius 119 m, 0.66 g                                                                                            |
| brake into a turn             | worst slide 34°, stopped in 49 m, no spin                                                                       |
| turn in powder, 50 km/h       | radius 68 m at 70 km/h, 0.57 g, 12° of lean into it                                                             |
| the stadium kicker at 45 km/h | 0.96 s of air, 13 m carry, 2.5 m up                                                                             |
| the same at 100 km/h          | 2.0 s of air, 51 m carry, 6.2 m up, a flat landing at 10.5 m/s costing 23 %                                     |
| dropped 3 m at 70 km/h        | 7.6 m/s impact, 8 % lost                                                                                        |
| 30° powder slope at 70 km/h   | climbs 17 m before it stalls                                                                                    |
| 45° face at 90 km/h           | climbs 13.5 m, stalls, slides back                                                                              |
| 40° sidehill at 40 km/h       | holds 48° of roll, slides 43 m down it                                                                          |
| a trunk at 50 km/h            | 55 km/h into it, 21 km/h out, turned 18°                                                                        |

What the bot makes of it on generated maps is `npm run sim`'s, and `docs/simulation.md` says how to read it.
