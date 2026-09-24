// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BENCHMARK RUNS — the plan, as data.
//
// Its own module because it is a TABLE and the thing that reads it is a
// render loop: `benchmark.ts` reaches for a canvas and a WebGL context, and
// this has to be readable without either — by the card that reports a run
// (`menu-bench.tsx`), by the rig that stands the race up (`bench-run.ts`),
// and above all by `tests/benchmark_test.ts`, which is where the choices
// below are held to something.
//
// Every field is PINNED rather than read off the rider: a measurement that
// moved with whichever sled somebody last rode, or whichever map the level
// card last picked, would be a number that only compares to itself. The one
// thing deliberately left free is OPTIONS ▸ PICTURE — the whole use of the
// tool is running it twice with one row moved — which is what obliges the
// map, the sky and the stretch below to be ones where every row can show.

import { CURRENT_GENERATOR_VERSION, type GameMode, type SkyOverride } from "@engine";

import type { CameraRung } from "./renderer-api.ts";

export type BenchmarkPlan = {
  /** THE MAP. Seed 37 on the current generator because of what its first
   * thirty seconds ride through: the loop runs out of the grid into the
   * WOODS — seventeen trunks within 40 m of the leader on the mean reading,
   * among the most of the twenty seeds (30–49) swept on generator v2 — and
   * the bot takes two KICKERS inside the stretch, so it carries the
   * forest's draw, flights, the landings' puffs and the furrows of four
   * sleds. `tests/benchmark_test.ts` rides it headlessly and holds both. A
   * generator version that moves the map owes the sweep again, and the
   * report names the version (`plannedRows`) so two runs either side of one
   * are never read as the same race. */
  seed: number;
  /** THE RACE, because it is the heaviest thing the game does: four sleds
   * drawn, and — the part no screenshot shows — four whole runs stepped at
   * 120 Hz, each ridden by the bot deciding on every step. A benchmark that
   * rode alone would be reporting the renderer and calling it the game. */
  mode: GameMode;
  /** The view. CHASE is what a rider actually rides, which makes the score a
   * statement about playing the game rather than about a camera nobody uses. */
  camera: CameraRung;
  /** THE SKY, pinned over whatever R19 dealt the seed: FAIR cumulus under a
   * late-morning sun. Daylight, because at night the woods go into the dark
   * and the haze and a row like FOREST would read as free; fair rather than
   * clear, because the dome's cloud is a per-pixel cost every frame pays;
   * and not falling snow or fog, which close the view before the far woods
   * and would make DISTANCE read as free. The hour is a start: an hour of
   * sun is ten minutes of riding (`clock.ts`), so thirty seconds moves it by
   * five minutes. */
  sky: Required<Pick<SkyOverride, "weather" | "hour">>;
  /** Seconds of game each rendered frame advances. A sixtieth divides the
   * engine's step exactly (`TUNING.physicsHz` is 120), so a frame is a whole
   * number of steps with nothing carried — the race is the same race every
   * time it is run. */
  step: number;
  /** Frames MEASURED, after the warm-up: thirty seconds of racing at the
   * step above — the grid, the woods, the kicker and the run out of it. */
  frames: number;
};

export const BENCHMARK: BenchmarkPlan = {
  seed: 37,
  mode: "race",
  camera: "chase",
  sky: { weather: "fair", hour: 11 },
  step: 1 / 60,
  frames: 1800,
};

/** How long the measured stretch is, s — the plan's own arithmetic, so the
 * developer page's row and the card's billing never disagree about it. */
export function benchmarkSeconds(plan: BenchmarkPlan = BENCHMARK): number {
  return plan.frames * plan.step;
}

/** The pinned dials, as the report and the history write them down: a run
 * from another build is only comparable if it says what it was pinned to. */
export function plannedRows(plan: BenchmarkPlan = BENCHMARK): { label: string; value: string }[] {
  return [
    { label: "seed", value: String(plan.seed) },
    { label: "generator", value: `v${CURRENT_GENERATOR_VERSION}` },
    { label: "mode", value: plan.mode },
    { label: "camera", value: plan.camera },
    { label: "sky", value: `${plan.sky.weather} ${plan.sky.hour}h` },
    { label: "frames", value: `${plan.frames} × ${Math.round(1 / plan.step)} Hz` },
  ];
}
