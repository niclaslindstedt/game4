// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED ON THE SNOW, AND THE AIR IT GOES THROUGH, as five layers.
//
//   HISS     the skis and the track on PACKED snow: a bright pink sheet that
//            climbs with the speed — the sound of a groomed loop at pace
//   POWDER   the sled PLOUGHING virgin snow: a dark brown rush with body in
//            it, loudest at the low speeds where the machine is still sunk
//            in and shoving snow aside, thinning as it planes up on top
//   CARVE    the ski edges biting in a turn on the hardpack — a white band
//            scrape that comes with the lock and the speed together
//   TREAD    the track's own clatter on the snow, a mid band that follows
//            the track's speed rather than the sled's
//   WIND     the rider's own wind: the apparent speed, louder off the snow,
//            where there is nothing else to hear
//
// PACKED OR POWDER IS THE WHOLE STORY here, and it is one number: the share
// of the machine's load on packed snow this step (`SledState.packed`). The
// two layers crossfade on it, so riding off the loop into the deep stuff is
// heard as the hiss giving way to the rush before anything else changes.
//
// A pure function of the state, like the engine: `snowTargets` says where
// every layer should be, the scheduler (`ride-bed.ts`) steers them there.

import type { LayerSpec, LayerTarget } from "../../lib/voice.ts";

/** The apparent wind at which the wind layer is as loud as it gets, m/s:
 * the sled flat out, a little past its top speed. */
export const WIND_FULL = 36;

/** The speed at which a sled in powder is up on top of it rather than
 * ploughing — past this the rush thins. Written against the engine's own
 * planing analogy (`snow.ts`), by ear rather than restated from it. */
const PLANE_SPEED = 14;

/** One moment on the snow — everything the layers need. */
export type SnowVoice = {
  /** How fast the sled is going, m/s, and as a share of its top speed. */
  speed: number;
  pace: number;
  /** Share of the machine's load on packed snow, 0..1. */
  packed: number;
  /** Share of the probes touching the snow, 0..1 — 0 in the air. */
  grounded: number;
  /** The bars, -1..1 (the sign is not heard). */
  steer: number;
  /** The track's surface speed, m/s. */
  treadSpeed: number;
  /** The apparent wind at the rider's head, m/s. */
  wind: number;
  airborne: boolean;
};

/** What the seat does to the snow — two of the listener's numbers. */
export type SnowMix = {
  snow: number;
  wind: number;
};

export type SnowLayer = "hiss" | "powder" | "carve" | "tread" | "wind";

/** What each layer is BUILT from — decided once. */
export const SNOW_LAYERS: Record<SnowLayer, LayerSpec> = {
  hiss: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.6 } },
  powder: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  carve: { kind: "noise", color: "white", filter: { type: "bandpass", q: 1.4 } },
  tread: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.1 } },
  wind: { kind: "noise", color: "pink", filter: { type: "lowpass", q: 0.5 } },
};

/** How fast each layer follows, s. The ground layers on a tenth — leaving
 * the snow is a cross-fade, not a switch — the wind a touch slower. */
export const SNOW_GLIDE: Record<SnowLayer, number> = {
  hiss: 0.08,
  powder: 0.1,
  carve: 0.06,
  tread: 0.08,
  wind: 0.15,
};

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** Where every layer of the snow should be for `voice`, heard from `mix`. */
export function snowTargets(voice: SnowVoice, mix: SnowMix): Record<SnowLayer, LayerTarget> {
  const pace = Math.min(1, Math.max(0, voice.pace));
  const packed = Math.min(1, Math.max(0, voice.packed));
  const on = voice.airborne ? 0 : Math.min(1, Math.max(0, voice.grounded));
  const moving = ramp(voice.speed, 0, 4);
  const plough = 1 - 0.6 * ramp(voice.speed, 4, PLANE_SPEED);
  const lock = Math.min(1, Math.abs(voice.steer));
  const gust = ramp(voice.wind, 0, WIND_FULL);
  return {
    hiss: {
      level: on * packed * moving * (0.004 + 0.02 * Math.pow(pace, 1.2)) * mix.snow,
      cutoff: 1800 + 3600 * pace,
    },
    powder: {
      level: on * (1 - packed) * moving * plough * (0.012 + 0.02 * pace) * mix.snow,
      cutoff: 260 + 700 * pace,
    },
    carve: {
      level: on * packed * lock * ramp(voice.speed, 3, 25) * 0.012 * mix.snow,
      cutoff: 2600 + 2400 * pace,
    },
    tread: {
      level: on * ramp(Math.abs(voice.treadSpeed), 0.5, 30) * 0.009 * mix.snow,
      cutoff: 500 + 30 * Math.min(40, Math.abs(voice.treadSpeed)),
    },
    // THE WIND is the only thing here that plays over a sled in the air, and
    // it comes up there: with the snow gone it is most of what there is.
    wind: {
      level: gust * gust * (voice.airborne ? 0.032 : 0.02) * mix.wind,
      cutoff: 400 + 1800 * gust,
    },
  };
}
