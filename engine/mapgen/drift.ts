// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R17 — THE DRIFTS: stretches of the groomer the wind has laid fresh snow
// across. They are what makes one map a groomer's and the next a powder
// sled's: the catalog's machines answer different kinds of snow
// (`defs/sled.ts`), and a loop groomed end to end asks only one question.
//
// THEIR OWN STREAM. The drifts are dealt off a stream seeded from the
// attempt's sub-seed but separate from it, so a map's country, loop,
// kickers, spawn, forest and day are exactly what they were before drifts
// existed — the drifts only thin the packed field over the loop already laid.
//
// Dealt in arc length on the finished loop (after `rotateLoop`, so the start
// line is arc 0) and stamped into the packed field through the corridor's
// own nearest-segment index, so a drift covers the track's full width and
// its shoulders, and eases in and out along the loop rather than across it.

import type { Heightfield } from "../lib/heightfield.ts";
import { createRng } from "../lib/prng.ts";
import { smoothstep } from "../lib/math.ts";
import { LEVEL_RULES, inBand } from "./rules.ts";
import type { Drift, Kicker } from "./types.ts";

const R = LEVEL_RULES.drift;

/** What sets the drifts' stream apart from the attempt's own. */
const DRIFT_SALT = 0x5eedd71f;
/** How many stretches the dealer tries to stand before it settles for the
 * share it has. */
const TRIES = 60;

/** R17 — deal the drifted stretches of a loop `length` m long, clear of the
 * start line and of every on-track kicker. `sub` is the attempt's sub-seed. */
export function dealDrifts(sub: number, length: number, kickers: readonly Kicker[]): Drift[] {
  const rng = createRng((sub ^ DRIFT_SALT) >>> 0);
  const target = inBand(rng, R.share) * length;
  // The stretches no drift (with its ease) may touch: each kicker's ramp and
  // landing, as arc ranges.
  const kept: { from: number; to: number }[] = kickers
    .filter((k) => k.onTrack && k.s !== undefined)
    .map((k) => ({ from: k.s! - k.ramp, to: k.s! + k.landing }));
  const drifts: Drift[] = [];
  let laid = 0;
  const lo = R.clear + R.fade;
  for (let t = 0; t < TRIES && laid < target; t++) {
    const len = Math.min(inBand(rng, R.length), target - laid + R.length.min);
    const hi = length - R.clear - R.fade - len;
    if (hi <= lo) break;
    const from = rng.range(lo, hi);
    const to = from + len;
    const clash =
      drifts.some((d) => from < d.to + R.gap + 2 * R.fade && to > d.from - R.gap - 2 * R.fade) ||
      kept.some((k) => from < k.to + R.fade && to > k.from - R.fade);
    if (clash) continue;
    drifts.push({ from, to });
    laid += len;
  }
  return drifts.sort((a, b) => a.from - b.from);
}

/** How deep a drift lies at arc `s`, 0 (groomed) … 1 (a drift's core). */
export function driftAt(drifts: readonly Drift[], s: number): number {
  let w = 0;
  for (const d of drifts) {
    const into = Math.min(s - (d.from - R.fade), d.to + R.fade - s);
    if (into <= 0) continue;
    w = Math.max(w, smoothstep(0, R.fade, into));
  }
  return w;
}

/** R17 — thin the packed field under every drift. `near` / `along` are the
 * corridor's nearest-segment index (`stampCorridor`), taken on the loop
 * before it was rotated by `start` points; the loop has `n` points `step` m
 * apart. Writes `packed` in place. */
export function stampDrifts(
  packed: Heightfield,
  near: Int32Array,
  along: Float32Array,
  drifts: readonly Drift[],
  start: number,
  n: number,
  step: number,
): void {
  if (drifts.length === 0) return;
  const p = packed.data;
  for (let o = 0; o < p.length; o++) {
    const i = near[o];
    if (i < 0 || p[o] <= 0) continue;
    const s = (((i - start + n) % n) + along[o]) * step;
    const w = driftAt(drifts, s);
    if (w > 0) p[o] *= 1 - (1 - R.packed) * w;
  }
}
