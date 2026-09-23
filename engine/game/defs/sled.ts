// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLEDS — the catalog of machines this game is ridden on, stated as
// data. Every one is the same kind of thing: two steerable skis on
// independent front suspension and a rubber track (the TREAD, so it is never
// confused with the race track) on a slide-rail rear suspension, an
// engine through a CVT, and a rider on the saddle. Every number
// carries its unit, and where it came from is said beside it: a real
// machine's proportions are kept as the BAND they sit in, never as a make
// and model.
//
// SIX MACHINES, SIX ANSWERS TO A KIND OF SNOW — never six points on one
// scale. Each is a real class of machine, named for an animal that rides
// the way it does, and its numbers sit inside that class's measured bands:
//   HARE    a performance TRAIL sled — low, wide, short-belted, studded:
//           the quickest thing round a groomed bend, stopped by a drift.
//   FOX     a CROSSOVER — the middle of every band, the machine the shared
//           model was tuned on (`TUNING` is stated against it), the default.
//   IBEX    a deep-snow MOUNTAIN sled — long, light, narrow, tall paddles:
//           climbs and floats, pushes and tips on the groomer.
//   STOAT   a SNOCROSS race sled — light, stiff, long in travel, geared
//           short: lands anything, runs out of gear on a straight.
//   BEAVER  a UTILITY work sled — a wide belt under a heavy four-stroke:
//           floats over every drift, fights every bend and every landing.
//   BISON   a turbo four-stroke TOURING machine — heavy, plush, the most
//           power: flat out it outruns everything, and it pushes in a bend.
// What separates them is what separates the real classes: the footprint
// (the belt's length, width and lugs, the studs, the skis' width and their
// carbides — `footprint.ts` prices every one), the mass and where it sits,
// the stance, the springs and their travel, and the engine — a two-stroke
// that freewheels or a four-stroke that brakes, peaky or flat.
//
// WHERE THE SKIS AND THE BELT STAND is traced, not guessed: each machine's
// ski line and the belt's run on the snow (from the rear idler to where the
// belt leaves a hard floor at the front, and a tenth of a metre on for the
// rails' curved front, which bears in snow) are read off its class's traced side
// profile (`pwa/src/game/sled-looks.ts`), and the centre of gravity placed
// between them where the class carries its weight — so the machine drawn is
// the machine simulated, to the centimetre.
//
// The body frame is the engine's: x to the rider's right, y up, z forward,
// the origin at the centre of gravity of sled AND rider together. Every
// position below is measured from there.
//
// `topSpeed` and `accel0to100` are DOCUMENTED EXPECTATIONS, not inputs: the
// physics is what delivers them, `tests/sled_test.ts` holds it to them, and
// the bot reads the top speed (`limits.ts`) to know what flat out is.

export type SuspensionSpec = {
  /** Spring rate PER CONTACT PROBE, N/m. */
  rate: number;
  /** Damping per probe, N·s/m — `bump` while compressing, `rebound` while
   * extending (a shock is always softer in bump than in rebound). */
  bump: number;
  rebound: number;
  /** Travel from full extension to the bump stop, m. */
  travel: number;
};

export type SledId = "hare" | "fox" | "ibex" | "stoat" | "beaver" | "bison";

export type SledSpec = {
  id: SledId;
  /** The machine's own name — an animal that rides the way it does. */
  name: string;
  /** The kind of machine it is, as the sled card bills it. */
  kind: string;
  /** One line the sled card says about it — what it is FOR. */
  blurb: string;
  /** Machine dry, kg — 195–235 kg for the two-stroke sport classes, up to
   * 315 kg for a four-stroke utility or touring machine. */
  dryMass: number;
  /** The rider in his gear, kg. */
  riderMass: number;
  /** Overall envelope, m: bumper to snow flap, ski tip to ski tip, snow to
   * the top of the windscreen. What the hull contacts and the trees see. */
  length: number;
  width: number;
  height: number;
  /** Centre of gravity above the snow at rest, m (sled and rider). */
  cogHeight: number;
  /** Ski stance, centre to centre, m (mountain 0.86–0.93, trail 1.05–1.09). */
  skiStance: number;
  /** How far ahead of the CoG the ski's contact centre stands, m. */
  skiForward: number;
  /** Ski running width, m — the width of snow a ski ploughs, and what it
   * floats and steers on in powder (`footprint.ts`). */
  skiWidth: number;
  /** The CARBIDE under each ski's keel, m of it — what bites a groomed
   * surface and turns the sled there (`footprint.ts`): mountain skis carry
   * 4 in, trail skis 6, race and touring skis 8 or twin runners. */
  carbide: number;
  /** The tread: belt length (the catalog's figure, for the record), its
   * width, and the stretch of it on the snow — from `treadFront` ahead of
   * the CoG to `treadRear` behind it, m. */
  treadLength: number;
  treadWidth: number;
  treadFront: number;
  treadRear: number;
  /** How tall the tread's lugs stand, m — the paddle a belt bites powder
   * with, and what folds under it on a groomed bend (trail belts 25–38 mm,
   * mountain belts 64–76 mm). */
  lugHeight: number;
  /** Traction STUDS through the belt, a count — carbide-tipped spikes that
   * bite packed snow and ice, driving, braking and holding sideways alike
   * (`footprint.ts`); worth nothing in powder. Trail and race belts run
   * 96–144, deep-snow and work belts none. */
  studs: number;
  /** Front and rear suspension, per probe. */
  front: SuspensionSpec;
  rear: SuspensionSpec;
  /** The engine: peak power, kW, the rpm it is made at, idle, the redline
   * the limiter holds, and the rpm the drive clutch engages at. */
  powerKw: number;
  peakRpm: number;
  maxRpm: number;
  idleRpm: number;
  engageRpm: number;
  /** THE POWER CURVE's shape under the peak (`traction.ts`): 2 is a
   * two-stroke's — little down low and a rush onto the pipe — and 3 a
   * turbocharged four-stroke's broad, flat midrange. */
  curve: number;
  /** Engine braking with the throttle shut, N per m/s of belt speed while
   * the driven clutch is still engaged: a two-stroke freewheels, and a
   * four-stroke's compression slows the machine the moment it is lifted. */
  engineBrake: number;
  /** THE CVT, as the belt speed it gives at the redline in its TOP ratio,
   * m/s, and how many times slower the tread runs in its LOWEST ratio at
   * the same rpm (the ratio span; CVTs sit at 3–4, and a two-speed work
   * box's low range carries it past 5). */
  gearTop: number;
  gearSpan: number;
  /** Share of the crank's power that reaches the tread, 0..1 — the CVT
   * belt, the chaincase or gearbox and the drive sprockets. */
  driveline: number;
  /** Drag area, m² — sled and seated rider, nose on. */
  cdA: number;
  /** Full ski lock at a standstill, rad (30–36° each way). */
  skiLock: number;
  /** The brake: the most retarding force the disc can put on the tread, N. */
  brakeForce: number;
  /** Rider mass centre above the sled's CoG, m, and how far he can hang
   * off to either side, m. */
  riderHeight: number;
  riderReach: number;
  /** Documented expectations: km/h flat out on packed snow, and seconds
   * from rest to 100 km/h on packed snow. */
  topSpeed: number;
  accel0to100: number;
};

/** THE FOX — the CROSSOVER, the reference machine, and the one every shared
 * number in `TUNING` was tuned on: at home on the trail and off it, the
 * middle of every band and best at nothing. An 850-class two-stroke twin,
 * 165 hp (123 kW), about 220 kg dry (the class is 203–227), a 1.04 m
 * stance, a 146-inch (3.71 m) belt of 1.75-inch (44 mm) lugs, unstudded,
 * on 6-inch carbides. */
export const SLED: SledSpec = {
  id: "fox",
  name: "Fox",
  kind: "Crossover",
  blurb: "At home on the trail and off it: asks nothing of the snow and refuses nothing.",
  dryMass: 220,
  riderMass: 85,
  length: 3.17,
  width: 1.16,
  height: 1.28,
  cogHeight: 0.55,
  skiStance: 1.04,
  skiForward: 0.99,
  skiWidth: 0.15,
  carbide: 0.15,
  treadLength: 3.71,
  treadWidth: 0.38,
  treadFront: 0.2,
  treadRear: -1.17,
  lugHeight: 0.044,
  studs: 0,
  // Rest sag of about 8 cm on either end (the load shares come off the
  // geometry, `suspension.ts`), a bit under 2 Hz in heave, and a shock that
  // is about half critical: a sled that settles in one bob.
  front: { rate: 6000, bump: 370, rebound: 540, travel: 0.23 },
  rear: { rate: 2900, bump: 185, rebound: 270, travel: 0.3 },
  powerKw: 123,
  peakRpm: 7900,
  maxRpm: 8400,
  idleRpm: 1500,
  engageRpm: 3800,
  curve: 2,
  engineBrake: 45,
  gearTop: 50,
  gearSpan: 3.6,
  driveline: 0.8,
  cdA: 0.9,
  skiLock: 0.42,
  brakeForce: 3400,
  riderHeight: 0.45,
  riderReach: 0.3,
  topSpeed: 162,
  accel0to100: 3.5,
};

/** THE HARE — a PERFORMANCE TRAIL sled: low, wide and quick, and at home
 * only on the groomer. The same 850 twin (123 kW) laid down low and back, a
 * short 129-inch (3.28 m) belt of 1.25-inch (32 mm) lugs with 96 studs
 * through it, the widest stance here (1.09 m, 43 in), about 222 kg dry, a
 * clutch that engages early and long-travel trail suspension (0.25 m front,
 * 0.33 m rear). The least belt to turn is the least belt to lose to and
 * the studs bite every bend, so it is the quickest thing on packed snow —
 * and the smallest footprint under the most weight, so a drift trenches
 * it and deep powder stops it dead. */
export const HARE: SledSpec = {
  ...SLED,
  id: "hare",
  name: "Hare",
  kind: "Trail",
  blurb: "Low, wide and studded: darts round the groomer, and a drift stops it dead.",
  dryMass: 222,
  length: 3.01,
  width: 1.21,
  height: 1.27,
  cogHeight: 0.51,
  skiStance: 1.09,
  skiForward: 1.05,
  treadLength: 3.28,
  treadFront: 0.24,
  treadRear: -1.0,
  lugHeight: 0.032,
  studs: 96,
  front: { rate: 6400, bump: 400, rebound: 590, travel: 0.25 },
  rear: { rate: 3100, bump: 200, rebound: 290, travel: 0.33 },
  engageRpm: 3300,
  gearTop: 53,
  cdA: 0.86,
  topSpeed: 172,
  accel0to100: 3.0,
};

/** THE IBEX — a DEEP-SNOW MOUNTAIN sled, built to be tipped onto an edge
 * and steered with the body. The turbocharged 850 (180 hp, 134 kW), the
 * lightest machine here (205 kg dry; the class is 195–210), a 165-inch
 * (4.19 m) belt 16 in (0.41 m) wide of 3-inch (76 mm) paddles, unstudded,
 * on a 0.88 m (35 in) stance with wide skis on short 4-inch carbides and the
 * most lock. The footprint floats it and the paddles climb anything; on the
 * groomer the paddles fold under a bend, the narrow stance lifts a ski, the
 * skis push, and the long, tall belt costs it the top end. */
export const IBEX: SledSpec = {
  ...SLED,
  id: "ibex",
  name: "Ibex",
  kind: "Mountain",
  blurb: "Tall paddles on a long, light machine: climbs where others bog, lost on the groomer.",
  dryMass: 205,
  length: 3.22,
  width: 1.05,
  height: 1.31,
  cogHeight: 0.6,
  skiStance: 0.88,
  skiForward: 1.09,
  skiWidth: 0.17,
  carbide: 0.1,
  treadLength: 4.19,
  treadWidth: 0.41,
  treadFront: 0.17,
  treadRear: -1.36,
  lugHeight: 0.076,
  front: { rate: 5200, bump: 320, rebound: 470, travel: 0.21 },
  rear: { rate: 2700, bump: 170, rebound: 250, travel: 0.27 },
  powerKw: 134,
  engageRpm: 4200,
  gearTop: 43,
  skiLock: 0.55,
  topSpeed: 148,
  accel0to100: 3.7,
};

/** THE STOAT — a SNOCROSS RACE sled: small, stiff and fierce, and made to
 * fly. The race 600 (130 hp, 97 kW) revving to 8,800 and engaging late, a
 * 137-inch (3.48 m) belt of 1.6-inch (41 mm) lugs and 144 studs, about
 * 200 kg dry, the spindles moved forward, 8-inch race carbides, and the
 * longest, stiffest stroke here — 0.28 m front and 0.40 m rear on firm
 * springs with a strong bump stop — geared short for the drive out of a
 * berm. It takes the landing that bottoms any other machine and turns
 * where it points; it runs out of gear on a long straight, and its short,
 * heavily loaded belt sinks in deep powder. */
export const STOAT: SledSpec = {
  ...SLED,
  id: "stoat",
  name: "Stoat",
  kind: "Snocross",
  blurb: "A race sled on long, stiff legs: lands anything, turns on a berm, runs out of gear.",
  dryMass: 200,
  length: 3.29,
  width: 1.15,
  height: 1.1,
  cogHeight: 0.62,
  skiStance: 1.07,
  skiForward: 1.09,
  carbide: 0.2,
  treadLength: 3.48,
  treadFront: 0.18,
  treadRear: -0.97,
  lugHeight: 0.041,
  studs: 144,
  front: { rate: 7400, bump: 560, rebound: 800, travel: 0.28 },
  rear: { rate: 3700, bump: 290, rebound: 420, travel: 0.4 },
  powerKw: 97,
  peakRpm: 8500,
  maxRpm: 8800,
  engageRpm: 4300,
  gearTop: 40,
  cdA: 0.82,
  skiLock: 0.45,
  topSpeed: 142,
  accel0to100: 3.2,
};

/** THE BEAVER — a UTILITY work sled: a tractor on skis. A turbocharged
 * four-stroke triple (130 hp, 97 kW) with a broad, flat pull and hard
 * engine braking, through a two-speed box whose low range widens the ratio
 * span; the heaviest machine here (305 kg dry; wide-track work sleds are
 * 290–315), on a 154-inch (3.91 m) belt 24 in (0.61 m) wide, long wide
 * skis on a narrow 0.95 m stance, soft springs on short travel, a rack
 * and a hitch. That footprint floats over any drift and never digs in; the
 * mass and the wide belt fight every bend and every landing. */
export const BEAVER: SledSpec = {
  ...SLED,
  id: "beaver",
  name: "Beaver",
  kind: "Utility",
  blurb: "A tractor on a belt two feet wide: floats over every drift, fights every bend.",
  dryMass: 305,
  length: 3.2,
  width: 1.09,
  height: 1.51,
  cogHeight: 0.62,
  skiStance: 0.95,
  skiForward: 0.97,
  skiWidth: 0.19,
  treadLength: 3.91,
  treadWidth: 0.61,
  treadFront: 0.23,
  treadRear: -1.28,
  lugHeight: 0.038,
  front: { rate: 6400, bump: 440, rebound: 650, travel: 0.19 },
  rear: { rate: 3900, bump: 260, rebound: 380, travel: 0.24 },
  powerKw: 97,
  peakRpm: 7200,
  maxRpm: 7600,
  idleRpm: 1200,
  engageRpm: 2800,
  curve: 3,
  engineBrake: 130,
  gearTop: 45,
  gearSpan: 5.2,
  driveline: 0.78,
  cdA: 1.05,
  skiLock: 0.4,
  brakeForce: 4200,
  topSpeed: 144,
  accel0to100: 4.1,
};

/** THE BISON — a TURBO FOUR-STROKE TOURING machine: a heavy, plush
 * freight train. The turbocharged triple at its strongest (200 hp, 149 kW,
 * made at 8,750 rpm), a broad midrange and the engine braking that comes
 * with it, about 285 kg dry, the weight well forward over 8-inch twin
 * carbides, a bare 137-inch (3.48 m) belt of low 1.1-inch (29 mm) lugs, a
 * tall screen and a two-up seat, soft springs on plush travel.
 * The fastest thing here in a straight line and the steadiest over the
 * groomer's chatter; it pushes into a bend, lands heavily and sinks in
 * powder. */
export const BISON: SledSpec = {
  ...SLED,
  id: "bison",
  name: "Bison",
  kind: "Touring",
  blurb: "A turbo four-stroke freight train: flat out it outruns everything, and it hates a bend.",
  dryMass: 285,
  length: 3.09,
  width: 1.21,
  height: 1.51,
  cogHeight: 0.6,
  skiStance: 1.08,
  skiForward: 1.0,
  carbide: 0.2,
  treadLength: 3.48,
  treadFront: 0.21,
  treadRear: -1.09,
  lugHeight: 0.029,
  studs: 0,
  front: { rate: 7000, bump: 420, rebound: 620, travel: 0.23 },
  rear: { rate: 3400, bump: 210, rebound: 310, travel: 0.3 },
  powerKw: 149,
  peakRpm: 8750,
  maxRpm: 9100,
  engageRpm: 3900,
  curve: 3,
  engineBrake: 120,
  gearTop: 57,
  cdA: 0.95,
  skiLock: 0.38,
  brakeForce: 4000,
  topSpeed: 180,
  accel0to100: 3.2,
};

/** THE CATALOG, in the order the sled card turns through it — the order a
 * rider should pick them in, best all-round first and the one that asks
 * most of him last: the crossover that refuses nothing, the trail sled that
 * wins on the groomer, the mountain sled that wins in powder, the race sled,
 * the touring sled, and the work sled. (`make sim ARGS="--sled all"` is the
 * measure: the roster's race times fall in this order after the first.) */
export const SLEDS: readonly SledSpec[] = [SLED, HARE, IBEX, STOAT, BISON, BEAVER];

/** The machine with this id, or the crossover for one this build does not
 * carry (a stored pick from another version — the catalog's machines were
 * renamed once — or a hand-typed link). */
export function sledById(id: string): SledSpec {
  return SLEDS.find((s) => s.id === id) ?? SLED;
}

/** Whether `id` names a machine in the catalog. */
export function isSledId(id: string): id is SledId {
  return SLEDS.some((s) => s.id === id);
}

/** Sled and rider, kg. */
export function totalMass(spec: SledSpec): number {
  return spec.dryMass + spec.riderMass;
}

/** The principal moments of inertia, kg·m², about the body's right (pitch),
 * up (yaw) and forward (roll) axes: a solid box of the envelope's length,
 * width and height, which is where a machine this dense in its middle
 * sits to within a fifth. */
export function inertiaOf(spec: SledSpec): { x: number; y: number; z: number } {
  const m = totalMass(spec);
  const L = spec.length;
  const W = spec.width;
  const H = spec.height;
  return {
    x: (m * (L * L + H * H)) / 12,
    y: (m * (L * L + W * W)) / 12,
    z: (m * (W * W + H * H)) / 12,
  };
}
