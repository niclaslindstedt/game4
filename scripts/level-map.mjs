#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL MAP — a map drawn from above and described, from nothing but
// the engine.
//
// This is the tool for reasoning about a map WITHOUT riding it: "the second
// kicker on seed 38" is a claim, and this turns it into a picture with `K2`
// on it and a row in a table saying where K2 stands, how far along the
// loop, how high its lip and how long its ramp and landing. It loads the
// engine and nothing else — no three.js, no browser, no build — so it runs
// in a couple of seconds on any seed.
//
//   npm run level -- --seed 38               # previews/level-38.png + .txt
//   npm run level -- --seed 38 --scale 1     # one pixel a metre
//   npm run level -- --seed 38 --json        # the listing as data, too
//   npm run level -- --seed 38 --out plan    # previews/plan.png
//
// Writes previews/level-<seed>.png and previews/level-<seed>.txt (the same
// table the run prints).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { renderLevelMap } from "./lib/level-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The generator's own surface rather than `engine/index.ts`: this lab needs
// the map and its scoreboard and nothing of the rest of the engine.
const { generateLevel } = await import(join(root, "engine/mapgen/index.ts"));
const { analyzeLevel } = await import(join(root, "engine/analysis/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 1, help: "the map's seed" },
    scale: { kind: "number", default: 0.6, help: "pixels per metre" },
    out: { kind: "string", help: "file name under previews/ (no extension)" },
    json: { kind: "flag", help: "also print the listing as JSON" },
  },
  "usage: npm run level -- --seed n [--scale px/m] [--out name] [--json]",
);

// ── Build it ────────────────────────────────────────────────────────────
const t0 = performance.now();
const level = generateLevel(args.seed);
const built = performance.now() - t0;
const analysis = analyzeLevel(level);
const st = analysis.stats;
const deg = (rad) => ((((rad * 180) / Math.PI) % 360) + 360) % 360;
const f = (v, d = 1) => v.toFixed(d);

// ── The listing ─────────────────────────────────────────────────────────
const out = [];
out.push(
  `level ${level.seed} — built in ${f(built, 0)} ms (attempt ${level.attempt}), ${level.size} m square, cell ${level.cell} m`,
);
out.push(
  `track: ${f(st.length, 0)} m loop, ${st.points} points, width ${f(st.widthMin)}–${f(st.widthMax)} m, ` +
    `tightest turn ${f(st.minRadius, 0)} m, steepest grade ${f(st.maxGrade * 100, 1)} % off the kickers, ` +
    `${f(st.relief, 0)} m of climb, ${level.laps} laps`,
);
out.push(
  `spawn: (${f(level.spawn.x, 0)}, ${f(level.spawn.z, 0)}) facing ${f(deg(level.spawn.heading), 0)}°, ` +
    `on the track behind the start line, ${level.grid.length} slots`,
);
out.push(
  `forest: ${level.trees.length} trees; kickers: ${st.trackKickers} on the track, ${st.offKickers} off it`,
);
out.push(
  `sun: ${f(level.sun.hour, 2)} h solar on day ${level.sun.dayOfYear} at ${f(level.sun.latitude)}°N — ${f(st.sunElevation)}° up`,
);
out.push(
  `weather: ${level.weather.kind}${level.weather.evening ? " (evening)" : ""}, wind ${f(level.weather.wind)} m/s` +
    `${level.weather.snowfall > 0 ? `, fall ${f(level.weather.snowfall, 2)}` : ""}` +
    `${level.weather.fog > 0 ? `, fog ${f(level.weather.fog, 2)}` : ""}`,
);
out.push("");
out.push("  cp      s(m)      x      z      y   width  from last");
level.checkpoints.forEach((c, i) => {
  const prev =
    i === 0
      ? level.checkpoints[level.checkpoints.length - 1].s - level.track.length
      : level.checkpoints[i - 1].s;
  out.push(
    `  ${String(i === 0 ? "S/F" : i).padStart(3)} ${f(c.s, 0).padStart(8)} ${f(c.x, 0).padStart(6)} ${f(c.z, 0).padStart(6)} ` +
      `${f(c.y).padStart(6)} ${f(c.width).padStart(7)} ${f(c.s - prev, 0).padStart(10)}`,
  );
});
out.push("");
out.push("  kicker   s(m)      x      z   lip(m)  ramp  landing  width  heading");
for (const k of level.kickers) {
  out.push(
    `  ${k.id.padEnd(6)} ${(k.s === undefined ? "-" : f(k.s, 0)).padStart(6)} ${f(k.x, 0).padStart(6)} ${f(k.z, 0).padStart(6)} ` +
      `${f(k.height).padStart(8)} ${f(k.ramp, 0).padStart(5)} ${f(k.landing, 0).padStart(8)} ${f(k.width, 0).padStart(6)} ${f(deg(k.heading), 0).padStart(7)}°`,
  );
}
out.push("");
if (analysis.findings.length === 0) out.push("analysis: clean");
for (const fd of analysis.findings) out.push(`analysis: ${fd.severity} ${fd.rule} ${fd.message}`);
const text = out.join("\n");
console.log(text);
if (args.json) {
  console.log(
    JSON.stringify(
      {
        seed: level.seed,
        stats: st,
        checkpoints: level.checkpoints,
        kickers: level.kickers,
        spawn: level.spawn,
        grid: level.grid,
        sun: level.sun,
      },
      null,
      2,
    ),
  );
}

// ── The picture ─────────────────────────────────────────────────────────
const canvas = renderLevelMap({
  level,
  scale: args.scale,
  title: `LEVEL ${level.seed}  ${f(st.length / 1000, 2)} KM LOOP  ${level.checkpoints.length} CHECKPOINTS  ${st.trackKickers}+${st.offKickers} KICKERS`,
  lines: [
    `WIDTH ${f(st.widthMin)}-${f(st.widthMax)} M`,
    `TIGHTEST TURN ${f(st.minRadius, 0)} M`,
    `MAX GRADE ${f(st.maxGrade * 100)} %`,
    `CLIMB ${f(st.relief, 0)} M`,
    `TREES ${level.trees.length}`,
    `TREE GAP ${f(st.treeGap, 1)} M`,
    `SUN ${f(level.sun.hour, 1)} H DAY ${level.sun.dayOfYear}`,
    `LAT ${f(level.sun.latitude)} ELEV ${f(st.sunElevation)}`,
    analysis.ok ? "ANALYSIS CLEAN" : "ANALYSIS: ERRORS",
  ],
});
const dir = join(root, "previews");
mkdirSync(dir, { recursive: true });
const name = args.out ?? `level-${level.seed}`;
writeFileSync(join(dir, `${name}.png`), canvas.toPng());
writeFileSync(join(dir, `${name}.txt`), text + "\n");
console.log(`\nwrote previews/${name}.png and previews/${name}.txt`);
