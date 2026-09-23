// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED — the one machine this slice is ridden on, stated as data. A
// trail/cross sled: two steerable skis on independent front suspension and
// a rubber track (the TREAD, so it is never confused with the race track)
// on a slide-rail rear suspension, a two-stroke twin through a CVT, and a
// rider on the saddle. Every number carries its unit, and where it came
// from is said beside it: a real machine's proportions are kept as the BAND
// they sit in, never as a make and model.
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

export type SledSpec = {
  id: string;
  name: string;
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

export const SLED: SledSpec = {
  id: "trail",
  name: "Trail",
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
