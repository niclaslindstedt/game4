// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLEAR WINTER SKY, as numbers. Where the sun stands at the hour the
// run has reached (`sunAtRun` — one engine clock, one sun), and what colour
// everything the sun and the sky light is at that elevation: the dome's
// zenith and horizon, the sun's own colour through the air it has to cross,
// the two halves of the hemisphere light, and the haze the distance fades
// into.
//
// THREE-FREE ON PURPOSE, so the suite reads the whole colour model
// (`tests/world_render_test.ts`). `environment.ts` turns a `SkyLook` into
// lights and uniforms every frame; nothing else decides what colour the air
// is.
//
// THIS SLICE HAS ONE WEATHER. There is no cloud, no night and no season's
// cast: a seeded hour on a seeded day at a seeded latitude, always clear.
// What changes over a run is the sun's height alone, and everything here is
// a function of it:
//
//   * THE SUN'S COLOUR is the air it crossed. Transmittance per channel is
//     `exp(-k · airmass)` with the Rayleigh-leaning extinction below and the
//     Kasten–Young air mass, so a noon sun is a hair warm of white and a sun
//     ten degrees up is gold — without a table of hand-picked oranges.
//   * THE SKY OVER SNOW IS BRIGHT. Fresh snow sends most of the light back
//     up, and a winter sky's horizon is a pale, almost white blue because of
//     it; the zenith deepens as the sun climbs.
//   * THE SHADOWS ARE BLUE. What fills a snow shadow is the sky, so the
//     hemisphere's upper colour is a real blue and the ground bounce under
//     it is near-white — which is what makes shade on snow read as snow in
//     shade rather than grey paint.
//
// Every colour is LINEAR RGB (what the shaders mix in); `sRGB` hexes are
// never written here.

import { sunAtRun, type Level } from "@engine";

export type Rgb = [number, number, number];

/** A unit vector in the world frame. */
export type Dir = { x: number; y: number; z: number };

export type SkyLook = {
  /** Toward the sun, unit, world frame (y up; heading 0 along +z). */
  sun: Dir;
  /** Radians above the horizon. */
  elevation: number;
  /** The dome overhead and at the horizon away from the sun. */
  zenith: Rgb;
  horizon: Rgb;
  /** The horizon's glow around the sun, and the disc itself. */
  glow: Rgb;
  /** The key light's colour and its intensity (three's units). */
  sunColour: Rgb;
  sunIntensity: number;
  /** The hemisphere light: the sky half and the snow-bounce half, and how
   * strong the pair is. */
  skyLight: Rgb;
  groundLight: Rgb;
  ambient: number;
  /** The haze's density, 1/m — the distance the far rim is lost over. */
  haze: number;
};

/** Extinction per unit air mass, per channel — mostly Rayleigh (blue lost
 * first), with a little aerosol so a low sun goes gold rather than magenta. */
const EXTINCTION: Rgb = [0.06, 0.1, 0.19];

/** Kasten–Young relative optical air mass for a sun `elevation` rad up. */
export function airMass(elevation: number): number {
  const deg = Math.max(-2, (elevation * 180) / Math.PI);
  return 1 / (Math.sin(Math.max(elevation, -0.03)) + 0.50572 * Math.pow(deg + 6.07995, -1.6364));
}

/** The world direction toward a sun at `azimuth` (a world heading) and
 * `elevation`. */
export function sunDirection(azimuth: number, elevation: number): Dir {
  const c = Math.cos(elevation);
  return { x: Math.sin(azimuth) * c, y: Math.sin(elevation), z: Math.cos(azimuth) * c };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The colour of sunlight after `elevation`'s worth of air, normalised so
 * its brightest channel is 1. */
export function sunTint(elevation: number): Rgb {
  const m = Math.min(airMass(elevation), 38);
  const t: Rgb = [
    Math.exp(-EXTINCTION[0] * m),
    Math.exp(-EXTINCTION[1] * m),
    Math.exp(-EXTINCTION[2] * m),
  ];
  const top = Math.max(t[0], t[1], t[2]);
  return [t[0] / top, t[1] / top, t[2] / top];
}

/** THE WHOLE LOOK for a sun at `azimuth`, `elevation`. */
export function skyLookFor(azimuth: number, elevation: number): SkyLook {
  // How "high" the day is, 0 at the horizon to 1 at 45° and over.
  const high = smooth(0.0, 0.8, elevation);
  const tint = sunTint(elevation);
  // Total transmittance (not normalised) is what dims a low sun.
  const m = Math.min(airMass(elevation), 38);
  const through = Math.exp(-0.16 * m);

  const zenith = mix([0.08, 0.22, 0.62], [0.03, 0.13, 0.5], high);
  const horizonCool: Rgb = [0.56, 0.72, 0.92];
  const horizon = mix(mix(horizonCool, [0.8, 0.78, 0.8], (1 - high) * 0.35), horizonCool, high);
  const glow = mix([1.0, 0.72, 0.45], [1.0, 0.95, 0.88], high);

  return {
    sun: sunDirection(azimuth, elevation),
    elevation,
    zenith,
    horizon,
    glow,
    sunColour: tint,
    // A winter sun at 20° still throws hard light onto snow; the key is
    // kept strong and the exposure (renderer.ts) takes the glare down.
    sunIntensity: 3.1 * (0.35 + 0.65 * through) * smooth(-0.04, 0.08, elevation),
    skyLight: mix([0.42, 0.58, 0.95], [0.36, 0.55, 1.0], high),
    groundLight: [0.86, 0.9, 0.96],
    ambient: 1.25 + 0.35 * high,
    haze: 1 / 1500,
  };
}

/** The look at run time `t` on `level`. */
export function skyLookAt(level: Pick<Level, "sun">, t: number): SkyLook {
  const place = sunAtRun(level, t);
  // The slice has no night; a seed's hour is dealt in daylight (R13), and
  // the floor here only keeps a long run from dimming into a dusk the rest
  // of the picture was never tuned for.
  return skyLookFor(place.azimuth, Math.max(place.elevation, 0.06));
}
