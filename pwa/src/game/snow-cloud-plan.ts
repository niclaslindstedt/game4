// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT CLOUD A SLED RAISES, as arithmetic — three-free, so the suite reads
// it (`tests/snow_cloud_test.ts`); `snow-cloud.ts` flies and draws it.
//
// WHAT A SLED THROUGH POWDER LOOKS LIKE. The tread's paddles dig the loose
// snow out from under the tunnel and fling it up and back: a ROOSTER TAIL,
// dense at its root, rising two to five metres behind a machine working in
// deep powder. The heavy part of it — grains and clumps — arcs and falls
// back inside a second (`spray.ts`). The FINE part is a different
// substance: crystals a tenth of a millimetre across whose terminal
// velocity is a fraction of a metre a second, carried by the air they were
// thrown into. So the tail STALLS within half a second of leaving the
// tread, swells as it mixes with the air round it, billows, drifts on the
// wind and settles slowly — a curtain hanging over the line the sled cut
// for seconds after it has gone. Its core is thick enough to shade itself
// (the side away from the sun goes the sky's blue-grey); its edges are
// thin, and against a low sun they light up silver, because fine ice
// scatters forward. In cold new snow single crystals glint in it.
//
// THE SNOW DECIDES ALL OF IT (`snowpack.ts`): how much loose snow there is
// to throw (`loose`), how much of it is fine enough to hang (`fine`) — new
// snow is almost all cloud, wet spring snow almost none — how long it hangs
// and how slowly it settles. The groomer gives a thin low mist of ice dust
// at speed and no rooster tail; a wind crust a short-lived grainy cloud
// among its chunks.
//
// And the sled decides the rest: the power going through the tread and how
// hard it is spinning (`throttle`, `slip`), the speed, how deep it is in.

import type { SnowProps } from "./snowpack.ts";

/** THE CLOUD'S NUMBERS, set by looking (`make cloud`). */
export const CLOUD = {
  /** Puffs a second off the tread at full drive in settled powder. */
  roostRate: 200,
  /** Puffs a second off one ski, per m/s of carve, and per metre of
   * ploughing sink, in settled powder. */
  skiCarve: 1.1,
  skiPlough: 60,
  /** The rooster tail's climb off the tread, m/s: the least, and what a
   * full dig of loose snow adds. */
  lift: { min: 2, loose: 5.5 },
  /** Thrown back off the tread, m/s, relative to the sled. */
  back: { min: 2.5, spin: 0.5, most: 9 },
  /** A puff's radius at birth, m, and what it swells by over its life. */
  size: { min: 0.25, fine: 0.25 },
  grow: { min: 1, fine: 3 },
  /** How long a puff hangs, s: the heavy snow's, and what fine snow adds. */
  hang: { min: 0.7, fine: 4.6 },
  /** The settling speed, m/s: the finest's and the heaviest's. */
  settle: { fine: 0.3, coarse: 1.2 },
  /** How fast a puff slows to the air round it, s. */
  tau: { fine: 0.45, coarse: 0.7 },
  /** How much of the sled's own velocity a puff is born with — the wake
   * dragging the tail along. */
  carry: 0.45,
  /** A puff's opacity at its thickest. */
  opacity: 0.85,
  /** The landing's cloud: puffs per unit of landing, and the most. */
  landing: { per: 9, most: 120 },
} as const;

/** What the sled is doing, as the cloud needs it (off `SledState`). */
export type CloudDrive = {
  speed: number;
  throttle: number;
  slip: number;
  treadSpeed: number;
  /** The tread on the snow. */
  treadDown: boolean;
};

/** One source's recipe: how many puffs a second, and what each is born as. */
export type CloudRecipe = {
  /** Puffs a second. */
  rate: number;
  /** The climb off the tread and the throw back, m/s. */
  lift: number;
  back: number;
  /** Radius at birth and gained over the life, m. */
  size: number;
  grow: number;
  /** Life, s; settling speed, m/s; the slowing's time constant, s. */
  hang: number;
  settle: number;
  tau: number;
  /** Opacity at the thickest, 0..1, and how much it glints, 0..1. */
  opacity: number;
  sparkle: number;
};

export function emptyRecipe(): CloudRecipe {
  return {
    rate: 0,
    lift: 0,
    back: 0,
    size: 0,
    grow: 0,
    hang: 0,
    settle: 0,
    tau: 0,
    opacity: 0,
    sparkle: 0,
  };
}

/** What every puff out of this snow is like, whatever threw it. */
function puffOf(snow: SnowProps, out: CloudRecipe): CloudRecipe {
  const fine = Math.min(1, Math.max(0, snow.fine));
  out.size = CLOUD.size.min + CLOUD.size.fine * fine;
  out.grow = CLOUD.grow.min + CLOUD.grow.fine * fine;
  out.hang = CLOUD.hang.min + CLOUD.hang.fine * fine * fine;
  out.settle = CLOUD.settle.coarse + (CLOUD.settle.fine - CLOUD.settle.coarse) * fine;
  out.tau = CLOUD.tau.coarse + (CLOUD.tau.fine - CLOUD.tau.coarse) * fine;
  out.opacity = CLOUD.opacity * (0.55 + 0.45 * fine);
  out.sparkle = snow.sparkle;
  return out;
}

/** THE ROOSTER TAIL: the cloud off the tread, into `out`. Nothing with the
 * tread off the snow, nothing with nothing driving it and nothing where
 * there is no loose snow. */
export function roostCloud(drive: CloudDrive, snow: SnowProps, out: CloudRecipe): CloudRecipe {
  puffOf(snow, out);
  const loose = Math.max(0, snow.loose);
  // The paddles throw what they dig whether or not the rider is on the
  // throttle hard: a turning tread in loose snow throws it; power and spin
  // throw more.
  const dig = drive.treadDown
    ? (0.45 + 0.55 * drive.throttle) *
      (1 + 0.5 * Math.min(1, drive.slip / 4)) *
      Math.min(1, Math.max(0, drive.treadSpeed - 1) / 11)
    : 0;
  // At speed on hard snow the tread still lifts a mist without digging:
  // the air under a fast machine sweeps its loose top off.
  const sweep = drive.treadDown ? Math.min(1, drive.speed / 30) * 0.35 : 0;
  out.rate = CLOUD.roostRate * (dig + sweep) * Math.min(1.8, loose) * snow.fine;
  out.lift = (CLOUD.lift.min + CLOUD.lift.loose * Math.min(1.5, loose)) * (0.35 + 0.65 * dig);
  out.back = Math.min(CLOUD.back.most, CLOUD.back.min + drive.slip * CLOUD.back.spin) * (0.5 + dig);
  return out;
}

/** THE SKI'S CLOUD: the sheet a ski throws off its outside edge when it
 * carves, and the bow wave it shoves up when it is buried. `carve` is the
 * turn times the speed (m/s), `sink` how deep the ski is in, m. */
export function skiCloud(
  carve: number,
  sink: number,
  snow: SnowProps,
  out: CloudRecipe,
): CloudRecipe {
  puffOf(snow, out);
  const loose = Math.min(1.8, Math.max(0, snow.loose));
  out.rate =
    (CLOUD.skiCarve * Math.max(0, carve) + CLOUD.skiPlough * Math.max(0, sink)) * loose * snow.fine;
  out.lift = 1 + 1.6 * Math.min(1.5, loose);
  out.back = 1.5;
  out.size *= 0.8;
  return out;
}

/** THE LANDING'S CLOUD: how many puffs a landing of `hard` (the renderer's
 * measure: the fall's speed plus twice the air time) throws out of this
 * snow — a wall of it off new snow, a puff off the groomer. */
export function landingPuffs(hard: number, snow: SnowProps): number {
  const loose = Math.min(1.8, Math.max(0, snow.loose));
  return Math.min(CLOUD.landing.most, CLOUD.landing.per * Math.max(0, hard) * loose * snow.fine);
}

/** A puff's radius at `age01` (0..1 of its life): quick at first as the
 * jet mixes with the air, then the slow swell of diffusion. */
export function puffRadius(size: number, grow: number, age01: number): number {
  const a = Math.min(1, Math.max(0, age01));
  return size + grow * (0.6 * (1 - Math.exp(-a * 6)) + 0.4 * Math.sqrt(a));
}

/** A puff's opacity at `age01`: in over its first few percent, and thinned
 * as it spreads (the same snow over a bigger disc), gone at the end. */
export function puffOpacity(opacity: number, size: number, grow: number, age01: number): number {
  const a = Math.min(1, Math.max(0, age01));
  const r = puffRadius(size, grow, a);
  const spread = Math.min(1, ((size * 2) / r) ** 0.8);
  const fadeIn = Math.min(1, a * 25);
  const fadeOut = 1 - smoothstep(0.55, 1, a);
  return opacity * spread * fadeIn * fadeOut;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** One step of a puff's flight, in place: it slows toward the air round
 * it (`air`, m/s) with the time constant `tau` and settles at `settle` m/s
 * once it has — the Stokes picture, gravity balanced by the drag at the
 * terminal speed. `v` is [vx, vy, vz] at `i`. */
export function flyPuff(
  v: Float32Array,
  i: number,
  airX: number,
  airY: number,
  airZ: number,
  tau: number,
  settle: number,
  dt: number,
): void {
  const k = 1 - Math.exp(-dt / Math.max(0.01, tau));
  v[i] += (airX - v[i]) * k;
  v[i + 1] += (airY - settle - v[i + 1]) * k;
  v[i + 2] += (airZ - v[i + 2]) * k;
}
