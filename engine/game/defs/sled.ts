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
  /** Machine dry, kg — 850-class sleds sit at 190–235 kg, the mountain
   * machines lightest. */
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
   * from rest to 100 km/h on packed snow (the 850 class runs 105–128 mph
   * flat out and does 0–60 mph in 3–6 s). */
  topSpeed: number;
  accel0to100: number;
};

/** THE CROSSOVER — the reference machine, and the one every shared number
 * in `TUNING` was tuned on. An 850-class crossover at the middle of every
 * band: 165 hp (123 kW) out of the two-stroke 850, about 230 kg dry, a
 * 1.02–1.07 m stance, a 146-inch (3.71 m) belt of 1.75-inch (44 mm) lugs —
 * crossover belts run 137–146 in with 1.5–2 in lugs. */
export const SLED: SledSpec = {
  id: "crossover",
  name: "Crossover",
  blurb: "The middle of every road: groomer or powder, it asks nothing and refuses nothing.",
  dryMass: 230,
  riderMass: 85,
  length: 3.2,
  width: 1.2,
  height: 1.25,
  cogHeight: 0.55,
  skiStance: 1.04,
  skiForward: 1.15,
  skiWidth: 0.15,
  treadLength: 3.71,
  treadWidth: 0.38,
  treadFront: 0.2,
  treadRear: -1.45,
  lugHeight: 0.044,
  // Rest sag of about 8 cm on either end (the load shares come off the
  // geometry, `suspension.ts`), a bit under 2 Hz in heave, and a shock that
  // is about half critical: a sled that settles in one bob.
  front: { rate: 6200, bump: 380, rebound: 560, travel: 0.23 },
  rear: { rate: 3000, bump: 190, rebound: 280, travel: 0.3 },
  powerKw: 123,
  peakRpm: 7900,
  maxRpm: 8400,
  idleRpm: 1500,
  engageRpm: 3800,
  gearTop: 50,
  gearSpan: 3.6,
  driveline: 0.8,
  cdA: 0.9,
  skiLock: 0.42,
  brakeForce: 3400,
  riderHeight: 0.45,
  riderReach: 0.3,
  topSpeed: 160,
  accel0to100: 4.1,
};

/** THE TRAIL SLED — an 850 trail machine: the same 165 hp, a 129-inch
 * (3.28 m) belt of 1.25-inch (32 mm) lugs (trail belts are 120–137 in with
 * 1.25–1.5 in lugs), the wide 1.09 m (43 in) stance trail sleds have grown
 * to, about 227 kg dry (474–500 lb for the class), a firm front end and a
 * clutch that engages early. The least belt to turn is the least belt to
 * lose to, so it is the quickest thing on packed snow — and the smallest
 * footprint under the most weight, so it is the first to bog in a drift. */
export const TRAIL_SLED: SledSpec = {
  ...SLED,
  id: "trail",
  name: "Trail",
  blurb: "Short on tread and low on lugs: planted and quick on the groomer, lost in a drift.",
  dryMass: 227,
  length: 3.05,
  skiStance: 1.09,
  treadLength: 3.28,
  treadFront: 0.25,
  treadRear: -1.15,
  lugHeight: 0.032,
  front: { rate: 7000, bump: 430, rebound: 630, travel: 0.22 },
  rear: { rate: 3300, bump: 210, rebound: 310, travel: 0.28 },
  engageRpm: 3500,
  gearTop: 52,
  topSpeed: 168,
  accel0to100: 3.5,
};

/** THE MOUNTAIN SLED — a turbocharged 850 on a 155-inch (3.94 m) belt of
 * 2.6-inch (66 mm) paddles: 180 hp (134 kW), and the lightest machine here
 * — about 194 kg dry (428 lb for the class) — on a 0.89 m (35 in) stance,
 * mountain sleds having narrowed to 34–36 in to sidehill. Engages high and
 * geared low to turn all that belt. The footprint floats it and the lugs
 * dig; on the groomer the same lugs fold under a bend, the narrow stance
 * lifts a ski, and the long, tall belt costs it the top end. */
export const MOUNTAIN_SLED: SledSpec = {
  ...SLED,
  id: "mountain",
  name: "Mountain",
  blurb:
    "A long belt of tall paddles: floats where the others bog, and pushes wide on the groomer.",
  dryMass: 195,
  length: 3.55,
  width: 1.0,
  skiStance: 0.89,
  skiForward: 1.2,
  treadLength: 3.94,
  treadFront: 0.3,
  treadRear: -1.65,
  lugHeight: 0.066,
  front: { rate: 5600, bump: 340, rebound: 500, travel: 0.23 },
  rear: { rate: 2900, bump: 180, rebound: 270, travel: 0.33 },
  powerKw: 134,
  engageRpm: 4300,
  gearTop: 44,
  topSpeed: 151,
  accel0to100: 4.3,
};

/** THE CROSS SLED — a race-bred 850: 165 hp, about 212 kg dry (race-bred sleds sit
 * at 205–215 kg), a 1.09 m stance, a 137-inch (3.48 m) belt of
 * 1.25-inch lugs, and stiff springs on long travel — 0.265 m (10.4 in)
 * front and 0.34 m rear, trail rears running 9–16 in — with firm damping
 * and an engine that revs higher and engages late, geared short the way a
 * race sled is — for the drive out of a corner and off a landing, at the
 * cost of the top end. It shrugs off the landing that bottoms the others —
 * and carries its weight on a short footprint, so deep powder swallows it. */
export const CROSS_SLED: SledSpec = {
  ...SLED,
  id: "cross",
  name: "Cross",
  blurb: "Light, stiff and long in travel: lands what the others bottom on, and sinks in powder.",
  dryMass: 212,
  length: 3.1,
  height: 1.32,
  cogHeight: 0.61,
  skiStance: 1.09,
  treadLength: 3.48,
  treadFront: 0.25,
  treadRear: -1.2,
  lugHeight: 0.032,
  front: { rate: 7600, bump: 560, rebound: 800, travel: 0.265 },
  rear: { rate: 3800, bump: 290, rebound: 420, travel: 0.34 },
  peakRpm: 8200,
  maxRpm: 8700,
  engageRpm: 4100,
  gearTop: 41,
  cdA: 0.85,
  topSpeed: 146,
  accel0to100: 3.5,
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
