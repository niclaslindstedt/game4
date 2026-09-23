// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRST-VISIT PROBE: time this machine drawing the design point (the
// MEDIUM picture, `DEFAULT_VIDEO`) under the front door, once, and move the
// picture to the tier it can actually hold before the rider ever opens
// OPTIONS.
//
// On a phone nobody finds out what their machine can afford: the game opens
// at the design point and either stutters (and the rider blames the game)
// or looks fine while twice the headroom goes unused. This module is the
// finding-out, done on the front door, where a couple of seconds of
// measuring cost the rider nothing. Ported from the sibling game's probe,
// which only ever promotes; this one DEMOTES too, because the ground's
// clipmap and the trail maps are a bill a phone can fail at the design point.
//
// IT MEASURES, IT NEVER LOOKS UP. A browser on a phone reports every GPU as
// the same string, so there is no table of devices to consult — the only
// honest answer is to draw the design point for a while and time it. What is
// timed is the whole frame DRAINED: the CPU's bill and the GPU's own
// execution, which the renderer waits for (`drain`) so a machine whose
// processor is idle while its GPU is flat out cannot read as a fast one.
//
// THE RULE IS AGAINST THE DISPLAY'S OWN FRAME. Promotion may not cost a frame
// the machine is currently drawing: the HIGH picture has to fit inside the
// period the display is delivering at MEDIUM, with `PROBE_HEADROOM` standing
// for how much dearer HIGH is. Demotion is the other end: a machine that
// already misses frames at MEDIUM, or cannot keep a display rate at all, is
// handed LOW.
//
// DOM-free: `judgeTier` takes samples and returns a verdict, and
// `tests/video_test.ts` holds the whole rule without a browser. `App.tsx`
// feeds the probe one frame at a time from the loop and applies the verdict,
// and only to a picture nobody has touched (`videoUntouched`).

import { DEFAULT_VIDEO, withPreset, type Tier, type VideoSettings } from "./settings-video.ts";

/** Frames drawn before the first one is measured: the first seconds of a
 * visit are shaders compiling and the browser's own tier-up. */
export const PROBE_WARMUP = 30;

/** Frames measured before a verdict — a second and a half at sixty, enough
 * for the bot to have thrown some spray and turned past some woods. */
export const PROBE_SAMPLES = 90;

/** How much dearer HIGH is than MEDIUM, as a ratio of drained frame time —
 * the margin asked for over the period before promoting. The ground at HIGH
 * is about twice MEDIUM's triangles (`tests/video_test.ts` holds this above
 * that ratio), and the shadow map four times the texels. */
export const PROBE_HEADROOM = 2.5;

/** A frame this many display periods long is a MISSED frame. */
export const PROBE_MISSED = 1.5;

/** Missed frames a machine may drop before it gets nothing dearer... */
export const PROBE_MISS_SHARE = 1 / 30;

/** ...and before it is judged to be failing the design point outright. */
export const PROBE_DEMOTE_SHARE = 1 / 8;

/** The longest display period, ms, that still counts as keeping a frame
 * rate: a median much past sixty hertz's sixteen and two thirds is not a
 * slower display, it is a machine drawing every other frame of one. */
export const PROBE_KEEPS_MS = 21;

/** A gap this long is not a frame but a stall — a build, a tab coming back
 * — and is never counted as one. */
export const PROBE_STALL_MS = 250;

/** How many stalls the probe sits through before giving up with no move. */
export const PROBE_STALLS = 30;

/** One measured frame: how long the display waited for it, and how long the
 * whole of it took with the GPU drained, both ms. */
export type ProbeSample = { elapsedMs: number; drawMs: number };

/** The value `share` of the way up the sorted list — the nearest rank, so a
 * decile is a frame that actually happened. */
function decile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * (sorted.length - 1) + 0.5))];
}

/**
 * The tier a machine can hold, off samples of it drawing MEDIUM.
 *
 * LOW when it is not keeping a display rate at all, or is missing more than
 * `PROBE_DEMOTE_SHARE` of its frames. HIGH when it is keeping its rate
 * steadily AND its ninth-decile drained frame, `PROBE_HEADROOM` times
 * dearer, would still fit the period — the ninth decile rather than the
 * mean because a picture is judged by its worst ordinary frame. MEDIUM
 * otherwise, which is where it already is.
 */
export function judgeTier(samples: readonly ProbeSample[]): Tier {
  if (samples.length === 0) return "medium";
  const period = decile(
    samples.map((s) => s.elapsedMs),
    0.5,
  );
  const missed = samples.filter((s) => s.elapsedMs > period * PROBE_MISSED).length;
  const share = missed / samples.length;
  if (period > PROBE_KEEPS_MS || share > PROBE_DEMOTE_SHARE) return "low";
  if (share > PROBE_MISS_SHARE) return "medium";
  const worst = decile(
    samples.map((s) => s.drawMs),
    0.9,
  );
  return worst * PROBE_HEADROOM <= period ? "high" : "medium";
}

/** True while the rider has expressed no opinion about the picture: every
 * row where it shipped. A picture anybody has moved is never overwritten. */
export function videoUntouched(video: VideoSettings): boolean {
  return (Object.keys(DEFAULT_VIDEO) as (keyof VideoSettings)[]).every(
    (key) => video[key] === DEFAULT_VIDEO[key],
  );
}

/** The picture a verdict hands out — applied only to an untouched one; any
 * other comes back as it was, the same object, so a caller can tell. */
export function applyVerdict(video: VideoSettings, tier: Tier): VideoSettings {
  if (!videoUntouched(video) || tier === "medium") return video;
  return withPreset(video, tier);
}

/** The probe as the loop feeds it: one call a drawn frame, a verdict once. */
export type VideoProbe = {
  /** One frame: the display's wait for it and its drained draw time, ms.
   * Null while measuring; the verdict on the frame that completes the
   * sample; null forever after. */
  frame: (elapsedMs: number, drawMs: number) => Tier | null;
  done: () => boolean;
};

export function createVideoProbe(): VideoProbe {
  let warm = 0;
  let stalls = 0;
  const samples: ProbeSample[] = [];
  let done = false;
  return {
    frame: (elapsedMs, drawMs) => {
      if (done) return null;
      if (!(elapsedMs > 0) || elapsedMs > PROBE_STALL_MS) {
        if (++stalls < PROBE_STALLS) return null;
        // A machine that stalls this often is not one to promote — and not
        // one this probe can say anything else about either.
        done = true;
        return "medium";
      }
      if (warm < PROBE_WARMUP) {
        warm++;
        return null;
      }
      samples.push({ elapsedMs, drawMs });
      if (samples.length < PROBE_SAMPLES) return null;
      done = true;
      return judgeTier(samples);
    },
    done: () => done,
  };
}
