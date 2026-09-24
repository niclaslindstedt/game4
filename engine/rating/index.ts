// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// MAP RATING — how HARD a map is, and what KIND of hard.
//
// `engine/analysis/` asks whether a map is BROKEN, and the generator will
// not hand one out that is. This asks the question that starts where that
// one stops: of two maps that both pass every rule, which asks more of the
// rider, and what does it ask for — the clock, the corners, the hills, the
// air, the trees, the powder, the dark, the sky? A campaign is a LADDER of
// those answers, and it is built out of this module rather than out of the
// analyzer, because "no rule broken" says nothing about whether the second
// rung asks more than the first.
//
// EIGHT AXES, each 0..1 and none of them better than another. Six are the
// MAP's and are read off the level (how long a lap takes, the corners, the
// climb, the kickers, the woods walling the loop, the drifts across it); two
// are the DAY's and are read off what the run is ridden in (the dark and the
// sky) — because an hour and a weather are the cheapest levers a campaign
// has, they cost nothing that has to be re-verified, and a ladder that
// ignores them wastes a part of its climb. `difficulty` folds the eight into
// one number on the weights in `RATING`, about four fifths the map and one
// fifth the day.
//
// THE TIME AXIS IS A MEASUREMENT WHEN THERE IS ONE. What a competent rider
// takes round the loop is the bot's lap (`simulateRun`), which costs half a
// second of simulation a lap and so is not taken here: a caller that has one
// hands it in (`RateOptions.lapSeconds` — `make rate --sim` does, and
// `make rate CAMPAIGN=1` always does), and one that has not is given the
// loop's length at the pace the bot averages across a sweep. Both are
// SECONDS, so the axis means the same thing either way; the measurement is
// only the better reading of it.
//
// The CHARACTER is the axes themselves, and a ladder is read off them as
// much as off the index: six maps that all lead on the corners are the same
// map six times, however well they climb. `scripts/rate-level.mjs` prints
// both, and `scripts/difficulty-preview.mjs` draws the axes over the plan.
//
// Every scale here is a NORMALISER, not a rule: the band a raw measurement
// is laid across to land the population's spread in 0..1. They were read off a sweep of the first ninety-six seeds (`make rate COUNT=96
// ARGS=--stats`), and are meant to be moved when the generator moves: an
// axis pinned at 1 or 0 for most of a sweep is measuring nothing.

import { treesNear } from "../game/collision.ts";
import { angleDiff, clamp, hypot } from "../lib/math.ts";
import { sunAt } from "../lib/solar.ts";
import { LEVEL_RULES } from "../mapgen/rules.ts";
import { declinationOf } from "../mapgen/sun.ts";
import { weatherOf, withSky } from "../mapgen/weather.ts";
import type { Level, SkyOverride, TrackPoint, Weather } from "../mapgen/types.ts";

/** The eight axes, 0..1 each — see the header. */
export type RatingAxes = {
  /** How long a lap takes a competent rider: the bot's lap when measured,
   * the loop's length at `RATING.scale.pace` when not, across
   * `RATING.scale.lap`. */
  time: number;
  /** How much the loop asks of the hands: its tightest corner, and the
   * heading change per km. */
  corners: number;
  /** How much of the loop is uphill: metres climbed a kilometre. */
  climb: number;
  /** How much air the loop throws: lip height on the track, per km. */
  air: number;
  /** How close the woods stand: the share of the loop with a trunk inside
   * `WALL_REACH` of either edge — a loop walled by trees is a loop where a
   * line held wide meets bark. */
  forest: number;
  /** How much of the loop is drifted over (R17): the share of it under a
   * drift, and the longest single stretch of powder. */
  powder: number;
  /** How little light there is at the start: 0 with the sun high, 1 with it
   * under the horizon — an evening map (R19) rides into the dark. */
  dark: number;
  /** How heavy the sky is: a clear day nothing, a blizzard or a thick fog
   * the whole axis (`skyWeight`). */
  sky: number;
};

export type MapRating = {
  seed: number;
  axes: RatingAxes;
  /** The one number the ladder climbs on — the weighted fold of the axes. */
  difficulty: number;
  /** The raw readings the axes were made from, for the table. */
  stats: {
    /** The loop's length, m. */
    length: number;
    /** A lap's seconds, as the time axis read them. */
    lapSeconds: number;
    /** Whether `lapSeconds` is the bot's measurement or the estimate. */
    measured: boolean;
    /** The tightest local radius on the loop, m. */
    tightest: number;
    /** Share of the loop bent tighter than `TIGHT_FLOORS` × R6's floor. */
    tight: number;
    /** Heading change per kilometre, rad/km. */
    sweepPerKm: number;
    /** Metres climbed per kilometre of loop. */
    climbPerKm: number;
    /** Kickers on the track, and the sum of their lips, m. */
    kickers: number;
    lips: number;
    /** Share of the loop walled by trees, 0..1. */
    walled: number;
    /** Share of the loop under a drift, and the longest drift, m. */
    drifted: number;
    longestDrift: number;
    /** The sun's elevation at the start, degrees. */
    sunDeg: number;
    /** The sky the run is ridden under. */
    weather: Weather["kind"];
  };
};

/** The rating's own numbers: the normalisers and the weights. */
export const RATING = {
  /** Each raw reading's BAND: the value that reads as nothing on its axis
   * and the value that reads as all of it, off the sweep's tails. */
  scale: {
    /** m/s the bot averages round a loop across the sweep (its median; the
     * deciles are 18 and 23) — what a lap is estimated at when nobody
     * measured it. */
    pace: 20.5,
    /** A lap's seconds: the sweep runs 112 to 189, its middle half 131 to
     * 154. */
    lap: { min: 110, max: 180 },
    /** The tightest local radius, m — INVERTED: R6's floor is 24 m and the
     * sweep's tightest corners sit at 29, its loosest at 84. */
    tightest: { min: 28, max: 70 },
    /** rad/km of heading change: the sweep runs 3.1 to 7.3. */
    sweepPerKm: { min: 3, max: 7 },
    /** m climbed per km of loop: the sweep runs 29 to 59. */
    climbPerKm: { min: 28, max: 58 },
    /** m of lip on the track per km: two small kickers on a long loop to
     * three big ones on a short one — the sweep runs 1.4 to 2.8. */
    lipsPerKm: { min: 1.3, max: 2.9 },
    /** Share of the loop walled by trees: the sweep runs 0.1 to 0.72. */
    walled: { min: 0.1, max: 0.72 },
    /** Share of the loop drifted (R17 deals up to half of it), and the
     * longest stretch, m (R17's band tops at 180). */
    drifted: { min: 0, max: 0.45 },
    longestDrift: { min: 60, max: 180 },
    /** Degrees of sun above the horizon below which the day starts to read
     * as dark; a winter noon at the band's southern edge is about thirty. */
    sunHigh: 20,
  },
  /** How the eight fold into one: the map about four fifths, the day about
   * one fifth. */
  weight: {
    time: 0.12,
    corners: 0.16,
    climb: 0.12,
    air: 0.14,
    forest: 0.12,
    powder: 0.14,
    dark: 0.1,
    sky: 0.1,
  } satisfies Record<keyof RatingAxes, number>,
} as const;

/** Where `value` sits in `band`, 0..1. */
function across(value: number, band: { min: number; max: number }): number {
  return clamp((value - band.min) / (band.max - band.min), 0, 1);
}

export const RATING_AXES: readonly (keyof RatingAxes)[] = [
  "time",
  "corners",
  "climb",
  "air",
  "forest",
  "powder",
  "dark",
  "sky",
];

/** Track stations (2 m apart) either side of a point a corner is read over:
 * a twenty-metre chord each way, about what a sled spends turning in. */
const CORNER_SPAN = 10;

/** A radius under this many of R6's least radius is a CORNER, not a bend. */
const TIGHT_FLOORS = 2.5;

/** Stations between two the climb and the woods are read at: 10 m. */
const STRIDE = 5;

/** m past the track's edge a trunk counts as WALLING it: the clear corridor
 * R14 keeps, and a sled's length of woods beyond it. */
export const WALL_REACH = LEVEL_RULES.forest.corridor + 6;

/** How heavy a sky reads, 0..1: a lid a little, a fall and a fog by how
 * thick they are. */
export function skyWeight(weather: Weather): number {
  switch (weather.kind) {
    case "clear":
      return 0;
    case "fair":
      return 0.1;
    case "flurries":
      return 0.1 + 0.5 * weather.snowfall;
    case "high":
      return 0.2;
    case "overcast":
      return 0.4;
    case "snow":
      return 0.35 + 0.65 * weather.snowfall;
    case "storm":
      return 0.5 + 0.5 * weather.snowfall;
    case "fog":
      return 0.3 + 0.7 * weather.fog;
  }
}

function circumradius(a: TrackPoint, b: TrackPoint, c: TrackPoint): number {
  const ab = hypot(b.x - a.x, b.z - a.z);
  const bc = hypot(c.x - b.x, c.z - b.z);
  const ca = hypot(a.x - c.x, a.z - c.z);
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

/** The local radius of the closed loop at station `i`, read over
 * `CORNER_SPAN` stations either side. Infinity on a straight. */
export function cornerRadius(points: readonly TrackPoint[], i: number): number {
  const n = points.length;
  return circumradius(points[(i - CORNER_SPAN + n) % n], points[i], points[(i + CORNER_SPAN) % n]);
}

/** What a caller may hand the rating beyond the map. */
export type RateOptions = {
  /** The sky and hour the run is ridden under instead of the map's own
   * (`withSky`) — a campaign rung's pinned day. */
  sky?: SkyOverride;
  /** A lap as the bot rode it, s — the measurement the time axis prefers. */
  lapSeconds?: number;
};

/** THE RATING of one map, ridden under its own day or the one `opts.sky`
 * pins. Pure and cheap — tens of milliseconds — so a sweep of a hundred
 * seeds costs what building them costs. */
export function rateLevel(built: Level, opts: RateOptions = {}): MapRating {
  const level = opts.sky ? withSky(built, opts.sky) : built;
  const points = level.track.points;
  const n = points.length;
  const length = level.track.length;
  const km = Math.max(0.1, length / 1000);

  // THE CLOCK: the bot's lap, or the loop at the sweep's pace.
  const measured = opts.lapSeconds !== undefined && Number.isFinite(opts.lapSeconds);
  const lapSeconds = measured ? (opts.lapSeconds as number) : length / RATING.scale.pace;

  // THE CORNERS: how much of the loop is bent tighter than the floor, and
  // how far the heading turns a kilometre — two readings, because they
  // catch different maps: hairpins joined by straights, and a loop that
  // never stops turning.
  let tightLength = 0;
  let tightest = Infinity;
  let sweep = 0;
  const step = length / n;
  for (let i = 0; i < n; i++) {
    const r = cornerRadius(points, i);
    tightest = Math.min(tightest, r);
    if (r < TIGHT_FLOORS * LEVEL_RULES.track.minRadius) tightLength += step;
    sweep += Math.abs(angleDiff(points[i].heading, points[(i + 1) % n].heading));
  }
  const tight = tightLength / length;
  const sweepPerKm = sweep / km;

  // THE CLIMB, read over ten-metre stations so the berm and the grader's
  // ripple are not counted as hills.
  let climbed = 0;
  for (let i = 0; i < n; i += STRIDE) {
    const rise = points[(i + STRIDE) % n].y - points[i].y;
    if (rise > 0) climbed += rise;
  }
  const climbPerKm = climbed / km;

  // THE AIR: the lips on the loop. A kicker off it is a detour a rider may
  // take and never has to.
  const onTrack = (level.kickers ?? []).filter((k) => k.onTrack);
  const lips = onTrack.reduce((sum, k) => sum + k.height, 0);

  // THE WOODS: at every ten-metre station, is there a trunk inside the reach
  // past each edge? Half a point for each side walled.
  const near: number[] = [];
  let walledSum = 0;
  let stations = 0;
  for (let i = 0; i < n; i += STRIDE) {
    const p = points[i];
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    let left = false;
    let right = false;
    treesNear(level, p.x, p.z, p.width / 2 + WALL_REACH, near);
    for (const t of near) {
      const tree = level.trees[t];
      const side = (tree.x - p.x) * rx + (tree.z - p.z) * rz;
      if (side > 0) right = true;
      else left = true;
      if (left && right) break;
    }
    walledSum += (left ? 0.5 : 0) + (right ? 0.5 : 0);
    stations += 1;
  }
  const walled = stations > 0 ? walledSum / stations : 0;

  // THE POWDER: how much of the loop the drifts lie over, and the longest.
  let drifts = 0;
  let longestDrift = 0;
  for (const d of level.drifts ?? []) {
    drifts += d.to - d.from;
    longestDrift = Math.max(longestDrift, d.to - d.from);
  }
  const drifted = drifts / length;

  // THE DAY: the sun where the run starts, and the sky over it.
  const sun = sunAt(level.sun.hour, level.sun.latitude, declinationOf(level.sun.dayOfYear));
  const sunDeg = (sun.elevation * 180) / Math.PI;
  const weather = weatherOf(level);

  const S = RATING.scale;
  const axes: RatingAxes = {
    time: across(lapSeconds, S.lap),
    corners: 0.5 * (1 - across(tightest, S.tightest)) + 0.5 * across(sweepPerKm, S.sweepPerKm),
    climb: across(climbPerKm, S.climbPerKm),
    air: across(lips / km, S.lipsPerKm),
    forest: across(walled, S.walled),
    powder: 0.5 * across(drifted, S.drifted) + 0.5 * across(longestDrift, S.longestDrift),
    dark: clamp(1 - sunDeg / S.sunHigh, 0, 1),
    sky: clamp(skyWeight(weather), 0, 1),
  };
  let difficulty = 0;
  for (const axis of RATING_AXES) difficulty += axes[axis] * RATING.weight[axis];

  return {
    seed: level.seed,
    axes,
    difficulty,
    stats: {
      length,
      lapSeconds,
      measured,
      tightest,
      tight,
      sweepPerKm,
      climbPerKm,
      kickers: onTrack.length,
      lips,
      walled,
      drifted,
      longestDrift,
      sunDeg,
      weather: weather.kind,
    },
  };
}

/** Which axis a map LEADS on — the one word its character is read as, for a
 * table and a campaign box. */
export function leadingAxis(axes: RatingAxes): keyof RatingAxes {
  let best: keyof RatingAxes = RATING_AXES[0];
  for (const axis of RATING_AXES) if (axes[axis] > axes[best]) best = axis;
  return best;
}

/** How UNLIKE two maps are: the distance between their axes, 0 for the same
 * map twice, about 1 for two that lead on different things. */
export function characterDistance(a: RatingAxes, b: RatingAxes): number {
  let sum = 0;
  for (const axis of RATING_AXES) sum += (a[axis] - b[axis]) ** 2;
  return Math.sqrt(sum / RATING_AXES.length) * 2;
}

/** What a LADDER of ratings does, read in the order the rungs are played:
 * does it climb, is there a wall, are two rungs the same map twice. Each is
 * a number a curator reads; a note names the rung when one is wrong. */
export type LadderReport = {
  /** The difficulty of each rung, in order. */
  asks: number[];
  /** The smallest step up between neighbours — negative where it steps
   * DOWN. */
  climb: number;
  /** The biggest step up between neighbours — a wall past `LADDER.wall`. */
  wall: number;
  /** The character distance of the two most alike rungs. */
  apart: number;
  notes: string[];
};

export const LADDER = {
  /** A step between rungs smaller than this is one a rider cannot feel. */
  step: 0.005,
  /** A step bigger than this is a wall. */
  wall: 0.2,
  /** Two rungs closer than this in character are the same map twice. */
  apart: 0.15,
} as const;

export function rateLadder(rungs: readonly { name: string; rating: MapRating }[]): LadderReport {
  const asks = rungs.map((r) => r.rating.difficulty);
  const notes: string[] = [];
  let climb = Infinity;
  let wall = -Infinity;
  for (let i = 1; i < rungs.length; i++) {
    const step = asks[i] - asks[i - 1];
    climb = Math.min(climb, step);
    wall = Math.max(wall, step);
    if (step < LADDER.step) {
      notes.push(
        `${rungs[i].name} asks ${step < 0 ? "less" : "no more"} than ${rungs[i - 1].name} (${step.toFixed(3)})`,
      );
    } else if (step > LADDER.wall) {
      notes.push(`${rungs[i].name} is a wall after ${rungs[i - 1].name} (+${step.toFixed(3)})`);
    }
  }
  let apart = Infinity;
  for (let i = 0; i < rungs.length; i++) {
    for (let k = i + 1; k < rungs.length; k++) {
      const d = characterDistance(rungs[i].rating.axes, rungs[k].rating.axes);
      if (d < apart) apart = d;
      if (d < LADDER.apart) {
        notes.push(
          `${rungs[i].name} and ${rungs[k].name} are the same map twice (${d.toFixed(2)})`,
        );
      }
    }
  }
  return {
    asks,
    climb: rungs.length > 1 ? climb : 0,
    wall: rungs.length > 1 ? wall : 0,
    apart: rungs.length > 1 ? apart : 1,
    notes,
  };
}
