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
    /** The closest two trunks stand, m (R14). */
    treeGap: number;
    trees: number;
    /** Trees standing within R14's corridor. */
    treesOnCorridor: number;
    /** Climb from the lowest to the highest point of the loop, m. */
    relief: number;
    sunElevation: number;
    attempt: number;
    /** Share of the loop lying under a drift's core (R17). */
    drifted: number;
  };
};

/** R9 — the least break in grade across a track kicker's lip that still
 * throws a sled. A kicker's own ramp and landing break at least 2/11 + 2/20
 * at the lip itself; read over three metres either side, a little less. */
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
    add(
      "R5",
      "error",
      `two stretches pass ${fmt(separation)} m apart (least ${R.track.separation.plan} m)`,
    );
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
    add(
      "R7",
      "error",
      `width runs ${fmt(widthMin)}–${fmt(widthMax)} m (band ${bandText(R.track.width, " m")})`,
    );
  }

  // R8 — the grade along, outside the kickers, and the ground across.
  const kickers = level.kickers ?? [];
  const trackKickers = kickers.filter((k) => k.onTrack);
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
    add(
      "R8",
      "error",
      `the ground falls ${fmt(maxCross, 3)} across the track at s ${fmt(worstCross, 0)} m`,
    );
  } else if (maxCross > 0.05) {
    add(
      "R8",
      "warn",
      `the ground falls ${fmt(maxCross, 3)} across the track at s ${fmt(worstCross, 0)} m`,
    );
  }

  // R9 — the kickers on the track: how many, how far apart, and that each
  // is a crest.
  if (
    trackKickers.length < R.kickers.on.count.min ||
    trackKickers.length > R.kickers.on.count.max
  ) {
    add(
      "R9",
      "error",
      `${trackKickers.length} kicker(s) on the track (band ${bandText(R.kickers.on.count)})`,
    );
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
    if (kick < KICK)
      add("R9", "warn", `${k.id} at s ${fmt(s0, 0)} m breaks only ${fmt(kick, 2)} over its lip`);
    for (let b = a + 1; b < trackKickers.length; b++) {
      const ds = Math.abs((k.s ?? 0) - (trackKickers[b].s ?? 0));
      if (Math.min(ds, L - ds) < R.kickers.on.spacing - 1) {
        add(
          "R9",
          "error",
          `${k.id} and ${trackKickers[b].id} stand ${fmt(Math.min(ds, L - ds), 0)} m apart`,
        );
      }
    }
  }
  const offKickers = kickers.filter((k) => !k.onTrack);
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

  // R10 — packed on the line, powder off it — outside the drifts (R17),
  // each read with its ease either side, which is what they published.
  const drifts = level.drifts ?? [];
  const F = R.drift.fade;
  const drifted = (s: number): boolean => drifts.some((d) => s > d.from - F && s < d.to + F);
  let packedLow = 1;
  let packedHigh = 0;
  for (let i = 0; i < n; i += 5) {
    const p = pts[i];
    if (!drifted(p.s)) packedLow = Math.min(packedLow, level.packedAt(p.x, p.z));
    const off = p.width / 2 + R.track.shoulder.packed + 3;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    packedHigh = Math.max(packedHigh, level.packedAt(p.x + rx * off, p.z + rz * off));
  }
  if (packedLow < 0.98) add("R10", "error", `the centreline is only ${fmt(packedLow, 2)} packed`);
  if (packedHigh > 0.02)
    add("R10", "error", `powder beside the track is ${fmt(packedHigh, 2)} packed`);

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
    if (hit.distance > 0.5)
      add("R11", "error", `checkpoint ${i} stands ${fmt(hit.distance)} m off the line`);
  }
  if (
    cps.length < 2 ||
    spacingMin < R.checkpoint.spacing.min - 0.5 ||
    spacingMax > R.checkpoint.spacing.max + 0.5
  ) {
    add("R11", "error", `checkpoints ${fmt(spacingMin, 0)}–${fmt(spacingMax, 0)} m apart`);
  }
  if (cps.length > 0 && Math.abs(cps[0].s) > 1e-6)
    add("R11", "error", "checkpoint 0 is not at arc length 0");

  // R12 — the start line: clear of every kicker, on a straight and gentle
  // stretch the grid can stand on.
  for (const k of trackKickers) {
    const ds = Math.abs(k.s ?? 0);
    if (Math.min(ds, L - ds) < R.spawn.kickerGap - 1) {
      add("R12", "error", `${k.id} stands ${fmt(Math.min(ds, L - ds), 0)} m from the start line`);
    }
  }
  const line = pts[0];
  let bend = 0;
  let steepest = 0;
  for (let u = 0; u <= R.spawn.run; u += step) {
    const a = trackPointAt(level, L - u);
    const b = trackPointAt(level, L - u - step);
    bend = Math.max(bend, Math.abs(angleDiff(b.heading, line.heading)));
    steepest = Math.max(steepest, Math.abs(a.y - b.y) / step);
  }
  if (bend > R.spawn.straight + 0.02) {
    add("R12", "error", `the grid's stretch turns ${fmt(bend, 2)} rad before the line`);
  }
  if (steepest > R.spawn.maxSlope + 0.02) {
    add("R12", "error", `the grid's stretch is ${fmt(steepest * 100, 0)} % steep`);
  }

  // R13 — the grid: on the groomer, behind the line, facing along the loop,
  // and no two riders on top of each other.
  if (level.grid.length !== R.grid.slots) add("R13", "error", `${level.grid.length} grid slots`);
  const grid = [level.spawn, ...level.grid];
  grid.forEach((g, i) => {
    const hit = nearestTrackPoint(level, g.x, g.z);
    const p = pts[hit.index];
    const who = i === 0 ? "the spawn" : `grid slot ${i - 1}`;
    if (hit.distance > p.width / 2 - 1) add("R13", "error", `${who} stands off the track`);
    if (level.packedAt(g.x, g.z) < 0.98) add("R13", "error", `${who} is not on packed snow`);
    const behind = L - hit.s;
    if (behind < R.grid.back - 1 || behind > R.spawn.run + 1) {
      add("R13", "error", `${who} stands ${fmt(behind)} m behind the line`);
    }
    if (Math.abs(angleDiff(g.heading, p.heading)) > 0.05) {
      add("R13", "error", `${who} does not face along the loop`);
    }
  });
  const least = Math.min(R.grid.spacing, R.grid.row);
  for (let a = 0; a < level.grid.length; a++) {
    for (let b = a + 1; b < level.grid.length; b++) {
      const d = Math.hypot(level.grid[a].x - level.grid[b].x, level.grid[a].z - level.grid[b].z);
      if (d < least - 0.05) add("R13", "error", `grid slots ${a} and ${b} stand ${fmt(d)} m apart`);
    }
  }

  // R14 — the forest.
  let treesOnCorridor = 0;
  const hit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
  for (const t of level.trees) {
    nearestWithin(level, t.x, t.z, R.track.width.max / 2 + R.forest.corridor, hit);
    if (hit.distance < pts[hit.index].width / 2 + R.forest.corridor - 0.5) treesOnCorridor++;
    if (!withinBand(t.height, R.forest.height))
      add("R14", "error", `a tree ${fmt(t.height)} m tall`);
  }
  if (treesOnCorridor > 0)
    add("R14", "error", `${treesOnCorridor} tree(s) stand on the track's corridor`);
  // ...and room to ride between them: the closest two trunks, read off a
  // hash of gap-sized buckets.
  const buckets = new Map<number, { x: number; z: number }[]>();
  let treeGap = Infinity;
  for (const t of level.trees) {
    const bx = Math.floor(t.x / R.forest.gap);
    const bz = Math.floor(t.z / R.forest.gap);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const u of buckets.get((bx + dx) * 8192 + bz + dz) ?? []) {
          treeGap = Math.min(treeGap, Math.hypot(u.x - t.x, u.z - t.z));
        }
      }
    }
    const key = bx * 8192 + bz;
    const list = buckets.get(key);
    if (list) list.push(t);
    else buckets.set(key, [t]);
    if (t.crown > R.forest.crownMax + 1e-9) add("R14", "error", `a crown ${fmt(t.crown)} m wide`);
  }
  if (treeGap < R.forest.gap - 0.01) {
    add("R14", "error", `two trunks stand ${fmt(treeGap)} m apart (least ${R.forest.gap} m)`);
  }
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
    add(
      "R15",
      "error",
      `the sun: ${fmt(level.sun.hour)} h on day ${level.sun.dayOfYear} at ${fmt(level.sun.latitude)}°N, ${fmt(elevation)}° up`,
    );
  }

  // R16 — the race.
  if (!(level.laps >= 1)) add("R16", "error", `${level.laps} laps`);

  // R17 — the drifts: their length, their spacing, clear of the line and of
  // every kicker, and the groomer under their cores actually drifted over.
  let driftLength = 0;
  for (let i = 0; i < drifts.length; i++) {
    const d = drifts[i];
    const len = d.to - d.from;
    driftLength += len;
    if (len < R.drift.length.min - 1 || len > R.drift.length.max + 1) {
      add("R17", "error", `a drift at s ${fmt(d.from, 0)} m is ${fmt(len, 0)} m long`);
    }
    if (d.from - F < R.drift.clear - 1 || d.to + F > L - R.drift.clear + 1) {
      add("R17", "error", `a drift at s ${fmt(d.from, 0)} m lies on the start line's approach`);
    }
    const next = drifts[i + 1];
    if (next && next.from - d.to < R.drift.gap + 2 * F - 1) {
      add("R17", "error", `two drifts stand ${fmt(next.from - d.to, 0)} m apart`);
    }
    for (const k of trackKickers) {
      const s0 = k.s ?? 0;
      if (d.from - F < s0 + k.landing && d.to + F > s0 - k.ramp) {
        add("R17", "error", `a drift at s ${fmt(d.from, 0)} m lies over ${k.id}`);
      }
    }
    let deepest = 0;
    for (let s = d.from; s <= d.to; s += 5) {
      const p = trackPointAt(level, s);
      deepest = Math.max(deepest, level.packedAt(p.x, p.z));
    }
    if (deepest > R.drift.packed + 0.05) {
      add("R17", "error", `the drift at s ${fmt(d.from, 0)} m is ${fmt(deepest, 2)} packed`);
    }
  }
  if (driftLength / L > R.drift.share.max + R.drift.length.min / L + 0.01) {
    add("R17", "warn", `${fmt((100 * driftLength) / L, 0)} % of the loop is drifted`);
  }

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
      treeGap,
      trees: level.trees.length,
      treesOnCorridor,
      relief: hi - lo,
      sunElevation: elevation,
      attempt: level.attempt ?? 0,
      drifted: driftLength / L,
    },
  };
}
