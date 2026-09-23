// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LEVEL ANALYSIS — the generator's scoreboard, and its gate.
//
// The search builds to the rule book; this re-checks the FINISHED map
// against the same rule book, rule by rule, reading only what the level
// publishes — the baked grids, the loop, the checkpoints, the trees, the
// spawn. It knows nothing the search knew: not the terrain's plan, not
// which loop draws were refused, not where the kickers were scored. That is
// the point — a check that could read the plan would be checking the plan,
// and the plan is not what the rider rides.
//
// It is what `generateLevel` asks before it accepts an attempt, what
// `scripts/analyze-level.mjs` prints, and what the tests hold a
// hand-broken level to. A finding names its rule, so the fix is pointed at
// one paragraph of `mapgen/rules.ts`. `ok` is "no errors": a warn is a
// smell the loop reads and nobody has to fix.

import { angleDiff } from "../lib/math.ts";
import { segmentDistance } from "../lib/polyline.ts";
import { sunAt } from "../lib/solar.ts";
import { nearestTrackPoint, nearestWithin, trackPointAt } from "../mapgen/query.ts";
import { LEVEL_RULES as R, withinBand, type Band } from "../mapgen/rules.ts";
import { declinationOf } from "../mapgen/sun.ts";
import { maxGradeOf, minRadius, minSeparation } from "../mapgen/track.ts";
import type { Level } from "../mapgen/types.ts";
import { selfCrossings } from "./crossings.ts";

export type Severity = "error" | "warn";

export type Finding = {
  /** The rule the finding is against, `R1`…. */
  rule: string;
  severity: Severity;
  message: string;
};

export type LevelAnalysis = {
  seed: number;
  ok: boolean;
  findings: Finding[];
  /** Numbers worth reading even when nothing is wrong. */
  stats: {
    length: number;
    points: number;
    widthMin: number;
    widthMax: number;
    minRadius: number;
    minSeparation: number;
    /** Steepest grade outside the kickers. */
    maxGrade: number;
    /** Steepest the ground falls across the track's width. */
    maxCrossSlope: number;
    trackKickers: number;
    offKickers: number;
    checkpoints: number;
    spacingMin: number;
    spacingMax: number;
    spawnDistance: number;
    trees: number;
    /** Trees standing within R14's corridor. */
    treesOnCorridor: number;
    /** Climb from the lowest to the highest point of the loop, m. */
    relief: number;
    sunElevation: number;
    attempt: number;
  };
};

/** R9 — the least break in grade across a track kicker's lip that still
 * throws a sled: a kicker's own ramp and landing make at least 2/9 + 2/16. */
const KICK = 0.15;

const fmt = (v: number, digits = 1): string => v.toFixed(digits);
const bandText = (b: Band, unit = ""): string => `${b.min}–${b.max}${unit}`;

/** Re-check a finished level against the rule book. */
export function analyzeLevel(level: Level): LevelAnalysis {
  const findings: Finding[] = [];
  const add = (rule: string, severity: Severity, message: string): void => {
    findings.push({ rule, severity, message });
  };
  const pts = level.track.points;
  const n = pts.length;
  const L = level.track.length;
  const step = L / n;
  const size = level.size;
  const inside = (x: number, z: number): boolean => x >= 0 && z >= 0 && x <= size && z <= size;

  // R1 — everything on the map.
  if (!pts.every((p) => inside(p.x, p.z))) add("R1", "error", "the track leaves the map");
  if (!level.grid.every((g) => inside(g.x, g.z))) add("R1", "error", "a grid slot is off the map");
  if (!level.trees.every((t) => inside(t.x, t.z))) add("R1", "error", "a tree stands off the map");

  // R5 — one closed loop, in its length band, that never crosses itself.
  if (!withinBand(L, R.track.length)) {
    add("R5", "error", `loop is ${fmt(L, 0)} m (band ${bandText(R.track.length, " m")})`);
  }
  const join = Math.hypot(pts[0].x - pts[n - 1].x, pts[0].z - pts[n - 1].z);
  if (join > step * 1.5) add("R5", "error", `the loop does not close (a ${fmt(join)} m gap)`);
  if (Math.abs(step - R.track.step) > 0.2) add("R5", "error", `points every ${fmt(step, 2)} m`);
  const crossings = selfCrossings(pts);
  if (crossings > 0) add("R5", "error", `the loop crosses itself ${crossings} time(s)`);
  const separation = minSeparation(level.track);
  if (separation < R.track.separation.plan - 0.5) {
    add("R5", "error", `two stretches pass ${fmt(separation)} m apart (least ${R.track.separation.plan} m)`);
  }

  // R6 — the turns.
  const radius = minRadius(level.track);
  if (radius < R.track.minRadius - 0.5) {
    add("R6", "error", `a turn tightens to ${fmt(radius)} m (least ${R.track.minRadius} m)`);
  }

  // R7 — the width.
  let widthMin = Infinity;
  let widthMax = 0;
  for (const p of pts) {
    widthMin = Math.min(widthMin, p.width);
    widthMax = Math.max(widthMax, p.width);
  }
  if (!withinBand(widthMin, R.track.width) || !withinBand(widthMax, R.track.width)) {
    add("R7", "error", `width runs ${fmt(widthMin)}–${fmt(widthMax)} m (band ${bandText(R.track.width, " m")})`);
  }

  // R8 — the grade along, outside the kickers, and the ground across.
  const trackKickers = level.kickers.filter((k) => k.onTrack);
  const skip = new Uint8Array(n);
  for (const k of trackKickers) {
    const s0 = k.s ?? 0;
    for (let i = 0; i < n; i++) {
      let u = pts[i].s - s0;
      if (u > L / 2) u -= L;
      if (u < -L / 2) u += L;
      if (u > -k.ramp - 4 && u < k.landing + 4) skip[i] = 1;
    }
  }
  const ys = pts.map((p) => p.y);
  const maxGrade = maxGradeOf(ys, step, skip);
  if (maxGrade > R.track.maxGrade + 0.01) {
    add("R8", "error", `the line climbs at ${fmt(maxGrade, 3)} (most ${R.track.maxGrade})`);
  }
  let maxCross = 0;
  let worstCross = 0;
  for (let i = 0; i < n; i += 3) {
    const p = pts[i];
    const hw = p.width / 2;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const c = level.groundAt(p.x, p.z);
    for (const side of [-1, 1]) {
      const e = level.groundAt(p.x + rx * hw * side, p.z + rz * hw * side);
      const sl = Math.abs(e - c) / hw;
      if (sl > maxCross) {
        maxCross = sl;
        worstCross = p.s;
      }
    }
  }
  if (maxCross > 0.08) {
    add("R8", "error", `the ground falls ${fmt(maxCross, 3)} across the track at s ${fmt(worstCross, 0)} m`);
  } else if (maxCross > 0.05) {
    add("R8", "warn", `the ground falls ${fmt(maxCross, 3)} across the track at s ${fmt(worstCross, 0)} m`);
  }

  // R9 — the kickers on the track: how many, how far apart, and that each
  // is a crest.
  if (trackKickers.length < R.kickers.on.count.min || trackKickers.length > R.kickers.on.count.max) {
    add("R9", "error", `${trackKickers.length} kicker(s) on the track (band ${bandText(R.kickers.on.count)})`);
  }
  for (let a = 0; a < trackKickers.length; a++) {
    const k = trackKickers[a];
    // A crest: the line's grade breaks downward across the lip, read off
    // the ground three metres either side of it along the loop.
    const s0 = k.s ?? 0;
    const at = (u: number): number => {
      const p = trackPointAt(level, s0 + u);
      return level.groundAt(p.x, p.z);
    };
    const lip = at(0);
    const kick = (lip - at(-3)) / 3 - (at(3) - lip) / 3;
    if (kick < KICK) add("R9", "warn", `${k.id} at s ${fmt(s0, 0)} m breaks only ${fmt(kick, 2)} over its lip`);
    for (let b = a + 1; b < trackKickers.length; b++) {
      const ds = Math.abs((k.s ?? 0) - (trackKickers[b].s ?? 0));
      if (Math.min(ds, L - ds) < R.kickers.on.spacing - 1) {
        add("R9", "error", `${k.id} and ${trackKickers[b].id} stand ${fmt(Math.min(ds, L - ds), 0)} m apart`);
      }
    }
  }
  const offKickers = level.kickers.filter((k) => !k.onTrack);
  for (const k of offKickers) {
    const hit = nearestTrackPoint(level, k.x, k.z);
    const reach = Math.max(k.ramp, k.landing) + k.width / 2 + R.kickers.edge;
    if (hit.distance - reach < R.track.width.max / 2 + R.kickers.off.clearance - 1) {
      add("R4", "error", `${k.id} stands ${fmt(hit.distance, 0)} m from the track`);
    }
  }
  if (offKickers.length < R.kickers.off.count.min) {
    add("R4", "warn", `only ${offKickers.length} kicker(s) off the track`);
  }

  // R10 — packed on the line, powder off it.
  let packedLow = 1;
  let packedHigh = 0;
  for (let i = 0; i < n; i += 5) {
    const p = pts[i];
    packedLow = Math.min(packedLow, level.packedAt(p.x, p.z));
    const off = p.width / 2 + R.track.shoulder.packed + 3;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    packedHigh = Math.max(packedHigh, level.packedAt(p.x + rx * off, p.z + rz * off));
  }
  if (packedLow < 0.98) add("R10", "error", `the centreline is only ${fmt(packedLow, 2)} packed`);
  if (packedHigh > 0.02) add("R10", "error", `powder beside the track is ${fmt(packedHigh, 2)} packed`);
  if (level.packedAt(level.spawn.x, level.spawn.z) > 0) add("R10", "error", "the spawn is on packed snow");

  // R11 — the checkpoints.
  const cps = level.checkpoints;
  let spacingMin = Infinity;
  let spacingMax = 0;
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i];
    const next = cps[(i + 1) % cps.length];
    const d = i + 1 < cps.length ? next.s - a.s : L - a.s + next.s;
    spacingMin = Math.min(spacingMin, d);
    spacingMax = Math.max(spacingMax, d);
    const hit = nearestTrackPoint(level, a.x, a.z);
    if (hit.distance > 0.5) add("R11", "error", `checkpoint ${i} stands ${fmt(hit.distance)} m off the line`);
  }
  if (cps.length < 2 || spacingMin < R.checkpoint.spacing.min - 0.5 || spacingMax > R.checkpoint.spacing.max + 0.5) {
    add("R11", "error", `checkpoints ${fmt(spacingMin, 0)}–${fmt(spacingMax, 0)} m apart`);
  }
  if (cps.length > 0 && Math.abs(cps[0].s) > 1e-6) add("R11", "error", "checkpoint 0 is not at arc length 0");
  let nearest = 0;
  let nearestD = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(pts[i].x - level.spawn.x, pts[i].z - level.spawn.z);
    if (d < nearestD) {
      nearestD = d;
      nearest = i;
    }
  }
  if (nearest !== 0 && nearestD < Math.hypot(pts[0].x - level.spawn.x, pts[0].z - level.spawn.z) - 0.01) {
    add("R11", "error", `the start line is not the track point nearest the spawn (that is point ${nearest})`);
  }

  // R12 — the spawn.
  const spawnHit = nearestTrackPoint(level, level.spawn.x, level.spawn.z);
  if (!withinBand(spawnHit.distance, R.spawn.distance)) {
    add("R12", "error", `the spawn stands ${fmt(spawnHit.distance)} m from the track (band ${bandText(R.spawn.distance, " m")})`);
  }
  const aim = Math.atan2(pts[0].x - level.spawn.x, pts[0].z - level.spawn.z);
  if (Math.abs(angleDiff(level.spawn.heading, aim)) > 0.02) {
    add("R12", "error", "the spawn does not face the start line");
  }
  const clear2 = R.spawn.clear * R.spawn.clear;
  let spawnTrees = 0;
  let laneTrees = 0;
  for (const t of level.trees) {
    if ((t.x - level.spawn.x) ** 2 + (t.z - level.spawn.z) ** 2 < clear2) spawnTrees++;
    else if (segmentDistance(t.x, t.z, level.spawn.x, level.spawn.z, pts[0].x, pts[0].z) < R.spawn.lane / 2 - 0.5) {
      laneTrees++;
    }
  }
  if (spawnTrees > 0) add("R12", "error", `${spawnTrees} tree(s) inside the spawn's clearing`);
  if (laneTrees > 0) add("R12", "error", `${laneTrees} tree(s) in the lane to the track`);

  // R13 — the grid.
  if (level.grid.length !== R.grid.slots) add("R13", "error", `${level.grid.length} grid slots`);
  for (let i = 1; i < level.grid.length; i++) {
    const d = Math.hypot(level.grid[i].x - level.grid[0].x, level.grid[i].z - level.grid[0].z);
    if (d < R.grid.spacing - 0.01) add("R13", "error", `grid slot ${i} stands ${fmt(d)} m from the player`);
  }

  // R14 — the forest.
  let treesOnCorridor = 0;
  const hit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
  for (const t of level.trees) {
    nearestWithin(level, t.x, t.z, R.track.width.max / 2 + R.forest.corridor, hit);
    if (hit.distance < pts[hit.index].width / 2 + R.forest.corridor - 0.5) treesOnCorridor++;
    if (!withinBand(t.height, R.forest.height)) add("R14", "error", `a tree ${fmt(t.height)} m tall`);
  }
  if (treesOnCorridor > 0) add("R14", "error", `${treesOnCorridor} tree(s) stand on the track's corridor`);
  if (level.trees.length < 1000) add("R14", "warn", `only ${level.trees.length} trees`);

  // R15 — the day.
  const sun = sunAt(level.sun.hour, level.sun.latitude, declinationOf(level.sun.dayOfYear));
  const elevation = (sun.elevation * 180) / Math.PI;
  if (
    !withinBand(level.sun.hour, R.sun.hour) ||
    !withinBand(level.sun.latitude, R.sun.latitude) ||
    !withinBand(level.sun.dayOfYear, R.sun.dayOfYear) ||
    elevation < R.sun.minElevation - 0.05
  ) {
    add("R15", "error", `the sun: ${fmt(level.sun.hour)} h on day ${level.sun.dayOfYear} at ${fmt(level.sun.latitude)}°N, ${fmt(elevation)}° up`);
  }

  // R16 — the race.
  if (!(level.laps >= 1)) add("R16", "error", `${level.laps} laps`);

  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    lo = Math.min(lo, p.y);
    hi = Math.max(hi, p.y);
  }
  return {
    seed: level.seed,
    ok: findings.every((f) => f.severity !== "error"),
    findings,
    stats: {
      length: L,
      points: n,
      widthMin,
      widthMax,
      minRadius: radius,
      minSeparation: separation,
      maxGrade,
      maxCrossSlope: maxCross,
      trackKickers: trackKickers.length,
      offKickers: offKickers.length,
      checkpoints: cps.length,
      spacingMin,
      spacingMax,
      spawnDistance: spawnHit.distance,
      trees: level.trees.length,
      treesOnCorridor,
      relief: hi - lo,
      sunElevation: elevation,
      attempt: level.attempt,
    },
  };
}
