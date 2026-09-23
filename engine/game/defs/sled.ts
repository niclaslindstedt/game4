// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLEDS — the catalog of machines this game is ridden on, stated as
// data. Every one is the same kind of thing: two steerable skis on
// independent front suspension and a rubber track (the TREAD, so it is never
// confused with the race track) on a slide-rail rear suspension, a
// two-stroke twin through a CVT, and a rider on the saddle. Every number
// carries its unit, and where it came from is said beside it: a real
// machine's proportions are kept as the BAND they sit in, never as a make
// and model.
//
// FOUR MACHINES, FOUR ANSWERS TO A KIND OF SNOW — never four points on one
// scale. What separates them is the footprint (the tread's length and its
// lugs, which is flotation and paddle — `footprint.ts` prices both), the
// mass, the ski stance, the springs and their travel, the engine and where
// its clutch engages:
//   TRAIL      a short tread with low lugs, a wide stance and the least belt
//              to turn: planted and quick on the groomer, and it bogs in a
//              drift.
//   CROSSOVER  the middle of every band — the machine the shared model was
//              tuned on (`TUNING` is stated against it), and the default.
//   MOUNTAIN   a long, tall-lugged tread and a narrow stance: floats and
//              paddles in powder, and pushes wide on a groomed bend.
//   CROSS      light, stiff and long in travel: takes a landing the others
//              bottom on, and sinks in deep powder on its short tread.
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

export type SledId = "trail" | "crossover" | "mountain" | "cross";

export type SledSpec = {
  id: SledId;
  name: string;
  /** One line the sled card says about it — what it is FOR. */
  blurb: string;
  /** Machine dry, kg — a 600-class trail/cross sled sits at 210–240 kg. */
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
  /** Ski stance, centre to centre, m (trail sleds: 1.0–1.1). */
  skiStance: number;
  /** How far ahead of the CoG the ski's contact centre stands, m. */
  skiForward: number;
  /** Ski running width, m — the width of snow a ski ploughs. */
  skiWidth: number;
  /** The tread: belt length (the catalog's 3.2–3.5 m figure, for the
   * record), its width, and the stretch of it on the snow — from `treadFront`
   * ahead of the CoG to `treadRear` behind it, m. */
  treadLength: number;
  treadWidth: number;
  treadFront: number;
  treadRear: number;
  /** How tall the tread's lugs stand, m — the paddle a belt bites powder
   * with, and what folds under it on a groomed bend (trail belts 25–35 mm,
   * mountain belts 60–75 mm). */
  lugHeight: number;
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
  /** THE CVT, as the belt speed it gives at the redline in its TOP ratio,
   * m/s, and how many times slower the tread runs in its LOWEST ratio at
   * the same rpm (the ratio span; CVTs sit at 3–4). */
  gearTop: number;
  gearSpan: number;
  /** Share of the crank's power that reaches the tread, 0..1 — the CVT
   * belt, the chaincase and the drive sprockets. */
  driveline: number;
  /** Drag area, m² — sled and seated rider, nose on. */
  cdA: number;
  /** Full ski lock at a standstill, rad. */
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

/** THE CROSSOVER — the reference machine. A 600-class trail/cross sled at
 * the middle of every band: 210–240 kg dry, 90–125 kW, a 1.0–1.1 m stance,
 * a 3.2–3.5 m belt of 38 mm lugs, 110–130 km/h flat out on the groomer. */
export const SLED: SledSpec = {
  id: "crossover",
  name: "Crossover",
  blurb: "The middle of every road: groomer or powder, it asks nothing and refuses nothing.",
  dryMass: 230,
  riderMass: 85,
  length: 3.1,
  width: 1.2,
  height: 1.25,
  cogHeight: 0.55,
  skiStance: 1.05,
  skiForward: 1.15,
  skiWidth: 0.15,
  treadLength: 3.35,
  treadWidth: 0.38,
  treadFront: 0.2,
  treadRear: -1.3,
  lugHeight: 0.041,
  // Rest sag of about 8 cm on either end (the load shares come off the
  // geometry, `suspension.ts`), a bit under 2 Hz in heave, and a shock that
  // is about half critical: a sled that settles in one bob.
  front: { rate: 6200, bump: 380, rebound: 560, travel: 0.23 },
  rear: { rate: 3000, bump: 190, rebound: 280, travel: 0.3 },
  powerKw: 110,
  peakRpm: 7900,
  maxRpm: 8400,
  idleRpm: 1500,
  engageRpm: 3800,
  gearTop: 36,
  gearSpan: 3.6,
  driveline: 0.8,
  cdA: 1.05,
  skiLock: 0.42,
  brakeForce: 3400,
  riderHeight: 0.45,
  riderReach: 0.3,
  topSpeed: 120,
  accel0to100: 4.5,
};

/** THE TRAIL SLED — a short-tread groomer machine: a 3.0–3.1 m belt of low
 * 30 mm lugs, a wide 1.07–1.1 m stance, a firm front end and a clutch that
 * engages early. The least belt to turn is the least belt to lose to, so it
 * is the quickest thing on packed snow — and the smallest footprint under
 * the most weight, so it is the first to bog in a drift. */
export const TRAIL_SLED: SledSpec = {
  ...SLED,
  id: "trail",
  name: "Trail",
  blurb: "Short on tread and low on lugs: planted and quick on the groomer, lost in a drift.",
  dryMass: 235,
  length: 2.95,
  skiStance: 1.09,
  treadLength: 3.07,
  treadFront: 0.25,
  treadRear: -1.08,
  lugHeight: 0.03,
  front: { rate: 7000, bump: 430, rebound: 630, travel: 0.22 },
  rear: { rate: 3300, bump: 210, rebound: 310, travel: 0.28 },
  powerKw: 108,
  engageRpm: 3500,
  gearTop: 37,
  topSpeed: 124,
  accel0to100: 3.9,
};

/** THE MOUNTAIN SLED — a long-tread powder machine: a 3.9–4.1 m belt of
 * 64 mm paddles on the snow for half again the crossover's length, a narrow
 * 0.9–1.0 m stance to sidehill on, a bigger engine that engages high, and a
 * CVT geared low to turn all that belt. The footprint floats it and the
 * lugs dig; on the groomer the same lugs fold under a bend, the narrow
 * stance lifts a ski, and the long belt costs it the top end. */
export const MOUNTAIN_SLED: SledSpec = {
  ...SLED,
  id: "mountain",
  name: "Mountain",
  blurb:
    "A long belt of tall paddles: floats where the others bog, and pushes wide on the groomer.",
  dryMass: 225,
  length: 3.55,
  width: 1.1,
  skiStance: 0.96,
  skiForward: 1.2,
  treadLength: 3.94,
  treadFront: 0.3,
  treadRear: -1.65,
  lugHeight: 0.064,
  front: { rate: 5600, bump: 340, rebound: 500, travel: 0.23 },
  rear: { rate: 2900, bump: 180, rebound: 270, travel: 0.33 },
  powerKw: 124,
  engageRpm: 4300,
  gearTop: 34,
  topSpeed: 118,
  accel0to100: 4.5,
};

/** THE CROSS SLED — a race machine: 195–210 kg dry on a short 3.0–3.1 m
 * belt, stiff springs on long travel (a 0.25–0.28 m front, a 0.35–0.4 m
 * rear) with firm damping, a revvy 600 that engages late. It shrugs off the
 * landing that bottoms the others — and puts the most weight on the least
 * belt, so deep powder swallows it. */
export const CROSS_SLED: SledSpec = {
  ...SLED,
  id: "cross",
  name: "Cross",
  blurb: "Light, stiff and long in travel: lands what the others bottom on, and sinks in powder.",
  dryMass: 202,
  length: 2.95,
  height: 1.3,
  cogHeight: 0.58,
  skiStance: 1.08,
  treadLength: 3.07,
  treadFront: 0.25,
  treadRear: -1.08,
  lugHeight: 0.035,
  front: { rate: 7600, bump: 560, rebound: 800, travel: 0.27 },
  rear: { rate: 3500, bump: 270, rebound: 390, travel: 0.38 },
  powerKw: 100,
  peakRpm: 8200,
  maxRpm: 8700,
  engageRpm: 4100,
  gearTop: 36,
  cdA: 1.0,
  topSpeed: 122,
  accel0to100: 3.9,
};

/** THE CATALOG, in the order the sled card turns through it: groomer to
 * powder, with the race machine last. */
export const SLEDS: readonly SledSpec[] = [TRAIL_SLED, SLED, MOUNTAIN_SLED, CROSS_SLED];

/** The machine with this id, or the crossover for one this build does not
 * carry (a stored pick from another version, a hand-typed link). */
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
