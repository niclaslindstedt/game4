// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S OUTER LOOP: a seed in, a clean map out, or a thrown
// error that names what could not be made clean.
//
// A map is a pure function of its seed. Each ATTEMPT draws everything from
// a sub-seed derived from the seed and the attempt number — the country,
// the loop, the kickers, the spawn, the forest, the day — compiles it, and
// asks the analysis (the same rule book, re-checked on the finished map
// rather than on the plan) whether it is clean. An attempt the search
// itself gives up on, or one the analysis finds a fault in, is rejected and
// the next sub-seed is tried; the attempts are bounded, the order is fixed,
// and so the map a seed produces is the same on every machine, and the
// reason it took three tries is in the log.
//
// THE ORDER inside an attempt is the dependency order, and it matters:
//
//   1. the country (R2, R3), baked once onto the grid
//   2. the loop (R5–R7), drawn again until one fits the basin, and graded
//      against that country (R8)
//   3. the track's kickers (R9), added to the graded line
//   4. the corridor pressed into the ground, and the packed field (R8, R10)
//   5. the kickers off the track (R4), stamped where the corridor is not
//   6. the start line (R12), the loop re-indexed to begin there, the
//      checkpoints from it (R11) and the grid behind it on the track (R13)
//   6b the drifts across the finished loop (R17) — off a stream of their
//      own, so they thin the packed field and move nothing else
//   7. the forest (R14), which keeps clear of everything above
//   8. the day (R15)
//   9. the weather (R19) — off a stream of its own, last, so it moves
//      nothing above; an evening it deals moves only the day's start hour

import { createRng } from "../lib/prng.ts";
import { sampleField } from "../lib/heightfield.ts";
import { analyzeLevel } from "../analysis/index.ts";
import { debug } from "../output.ts";
import { compileLevel } from "./compile.ts";
import { dealDrifts, stampDrifts } from "./drift.ts";
import { growForest } from "./forest.ts";
import { layOffKickers, layTrackKickers, publishTrackKickers } from "./kickers.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { chooseStart, gridOnTrack, layCheckpoints } from "./spawn.ts";
import { dealSun } from "./sun.ts";
import { bakeCountry, planTerrain } from "./terrain.ts";
import { dealWeather, withSky } from "./weather.ts";
import {
  drawLoop,
  gradeLoop,
  rotateLoop,
  setHeadings,
  stampCorridor,
  trackOf,
  type Loop,
} from "./track.ts";
import type { GenerateOptions, GeneratedLevel } from "./types.ts";

/** How many loops an attempt draws before it gives up on its country. */
const DRAWS = 40;

/** The sub-seed of an attempt: the golden-ratio stride keeps successive
 * attempts far apart in the generator's state space. */
export function subSeed(seed: number, attempt: number): number {
  return (seed + attempt * 0x9e3779b9) >>> 0;
}

/** One attempt: a level, or the reason this sub-seed could not make one. */
function attemptLevel(seed: number, attempt: number, laps: number): GeneratedLevel | string {
  const rng = createRng(subSeed(seed, attempt));
  const plan = planTerrain(rng);
  const ground = bakeCountry(plan);

  let loop: Loop | null = null;
  let why = "";
  for (let d = 0; d < DRAWS && !loop; d++) {
    const drawn = drawLoop(rng, plan);
    if (typeof drawn === "string") {
      why = drawn;
      continue;
    }
    const graded = gradeLoop(drawn, ground);
    if (graded) {
      why = graded;
      continue;
    }
    loop = drawn;
  }
  if (!loop) return `no loop fits this country (last: ${why})`;

  const trackKickers = layTrackKickers(rng, loop);
  const { packed, near, along } = stampCorridor(loop, ground);
  const offKickers = layOffKickers(rng, plan, ground, loop);

  const start = chooseStart(rng, loop, trackKickers);
  if (typeof start === "string") return start;
  rotateLoop(loop, start);
  setHeadings(loop.points);
  // Publish the heights the ground actually carries, so a reader of a track
  // point and a reader of `groundAt` under it read the same number.
  for (const p of loop.points) p.y = sampleField(ground, p.x, p.z);
  const kickers = publishTrackKickers(loop, trackKickers, start).concat(offKickers);
  for (const k of kickers) k.y = sampleField(ground, k.x, k.z);
  const checkpoints = layCheckpoints(trackOf(loop));
  const { spawn, grid } = gridOnTrack(trackOf(loop));
  const drifts = dealDrifts(subSeed(seed, attempt), loop.length, kickers);
  const n = loop.points.length;
  stampDrifts(packed, near, along, drifts, start, n, loop.length / n);

  const trees = growForest(rng, plan, ground, trackOf(loop), kickers);
  const day = dealSun(rng);
  const { weather, hour } = dealWeather(subSeed(seed, attempt), day);
  const sun = { ...day, hour };

  return compileLevel({
    seed,
    size: R.world.size,
    ground,
    packed,
    points: loop.points,
    length: loop.length,
    checkpoints,
    spawn,
    grid,
    trees,
    kickers,
    sun,
    laps,
    basin: { x: plan.cx, z: plan.cz, rim: R.basin.rim.inner },
    attempt,
    drifts,
    weather,
  });
}

/** Generate the map for a seed: the first attempt the analysis passes. */
export function generateLevel(seed: number, opts: GenerateOptions = {}): GeneratedLevel {
  const attempts = opts.attempts ?? 16;
  const laps = opts.laps ?? R.race.laps;
  const reasons: string[] = [];
  for (let a = 0; a < attempts; a++) {
    const built = attemptLevel(seed, a, laps);
    if (typeof built === "string") {
      reasons.push(`#${a}: ${built}`);
      continue;
    }
    const analysis = analyzeLevel(built);
    if (analysis.ok) {
      if (reasons.length > 0)
        debug(`level ${seed}: accepted attempt ${a} after ${reasons.join("; ")}`);
      return opts.sky ? withSky(built, opts.sky) : built;
    }
    const errors = analysis.findings.filter((f) => f.severity === "error");
    reasons.push(`#${a}: ${errors.map((f) => `${f.rule} ${f.message}`).join(", ")}`);
  }
  throw new Error(`level ${seed}: no clean map in ${attempts} attempts — ${reasons.join("; ")}`);
}
