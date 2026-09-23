#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB — the sled on the snow, in sequence, drawn as a diagram.
//
// `npm run sim` counts jumps and tree hits and a screenshot shows one frame
// of one; neither answers what the machine was DOING at each moment — how it
// sat, how fast it got going, when it came up onto the powder, at what angle
// it left the lip and how hard it came down. So this stages one scenario
// (`lib/ride-scenarios.mjs`) on a SYNTHETIC map with `placeRun`, rides it
// with a scripted input through the real engine at 120 Hz (no renderer, no
// browser — the engine and a PNG canvas), prints the numbers that decide the
// feel, and draws the run (`lib/ride-draw.mjs`).
//
//   npm run ride                       every scenario, one table
//   npm run ride -- kicker             one scenario
//   npm run ride -- accel --seconds 30
//   npm run ride -- --sled mountain    one machine of the catalog
//   npm run ride -- --sled all         every scenario on every machine, one table
//
// Writes previews/ride-<scenario>.png. Required before and after any change
// to the suspension, the snow, the drive, the steering or the air.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";
import { drawRun } from "./lib/ride-draw.mjs";
import { SCENARIOS, SCENARIO_IDS } from "./lib/ride-scenarios.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    scenario: { kind: "string", help: `which (${SCENARIO_IDS.join(", ")}); a bare word works too` },
    seconds: { kind: "number", help: "how long to ride (the scenario's own when left out)" },
    sled: {
      kind: "string",
      default: "crossover",
      help: `the machine (${E.SLEDS.map((s) => s.id).join(", ")}), or all`,
    },
    "no-png": { kind: "flag", help: "print the numbers, draw nothing" },
    out: { kind: "string", default: "previews", help: "where the pictures go" },
  },
  "usage: npm run ride -- [scenario] [--sled id|all] [--seconds s] [--no-png] [--out dir]",
);

if (args.sled !== "all" && !E.isSledId(args.sled)) {
  console.error(`unknown sled "${args.sled}" (${E.SLEDS.map((s) => s.id).join(", ")}, all)`);
  process.exit(2);
}
const roster = args.sled === "all" ? E.SLEDS : [E.sledById(args.sled)];

const wanted = args.scenario ?? args._[0];
if (wanted && !SCENARIO_IDS.includes(wanted)) {
  console.error(`unknown scenario "${wanted}" (${SCENARIO_IDS.join(", ")})`);
  process.exit(2);
}
const chosen = wanted ? SCENARIOS.filter((s) => s.id === wanted) : SCENARIOS;

/** Ride a scenario and keep a frame every step. */
function record(scenario, spec) {
  const level = scenario.level(S);
  const state = E.createGame({ level, rivals: 0, countdown: 0, spec, quiet: true });
  E.placeRun(state, scenario.place(S));
  const seconds = args.seconds ?? scenario.seconds;
  const frames = [];
  const events = [];
  const c = state.sled;
  let dist = 0;
  const t0 = state.t;
  const steps = Math.round(seconds * E.TUNING.physicsHz);
  const probe = c.contacts.length - 1;
  for (let i = 0; i <= steps; i++) {
    const t = state.t - t0;
    if (i > 0) {
      const x0 = c.x;
      const z0 = c.z;
      E.step(state, scenario.input(t, state));
      dist += Math.hypot(c.x - x0, c.z - z0);
      for (const e of state.events) events.push({ ...e, t: e.t - t0 });
    }
    frames.push({
      t: state.t - t0,
      x: c.x,
      y: c.y,
      z: c.z,
      dist,
      ground: level.groundAt(c.x, c.z),
      sink: c.sinks[probe],
      speed: c.speed,
      tread: c.treadSpeed,
      slip: c.slip,
      rpm: c.rpm,
      heading: c.heading,
      pitch: c.pitch,
      roll: c.roll,
      airborne: c.airborne,
      skiComp: (c.skiCompression[0] + c.skiCompression[1]) / 2,
      treadComp: c.treadCompression,
      trench: c.trench,
      // The rider, once he is off it (`crash.ts`).
      thrown: c.thrown !== null,
      rx: c.thrown ? c.thrown.x : c.x,
      ry: c.thrown ? c.thrown.y : c.y,
      rz: c.thrown ? c.thrown.z : c.z,
      tumble: c.thrown ? c.thrown.tumble : 0,
    });
  }
  return { frames, events, trees: level.trees };
}

console.log(`ride lab — engine ${E.engineVersion} at ${E.TUNING.physicsHz} Hz · sled ${args.sled}`);
if (!args["no-png"]) mkdirSync(join(root, args.out), { recursive: true });
for (const scenario of chosen) {
  console.log(`\n${scenario.id.padEnd(13)} ${scenario.title}`);
  for (const spec of roster) {
    const run = record(scenario, spec);
    const lines = scenario.measure(run);
    const who = roster.length > 1 ? `${spec.id.padEnd(10)} ` : "";
    console.log("  " + who + lines.map(([k, v]) => `${k} ${v}`).join(" · "));
    if (!args["no-png"]) {
      const tag = roster.length > 1 || spec.id !== "crossover" ? `-${spec.id}` : "";
      const file = join(root, args.out, `ride-${scenario.id}${tag}.png`);
      writeFileSync(file, drawRun(run, scenario, lines));
    }
  }
}
if (!args["no-png"]) console.log(`\nwrote ${args.out}/ride-*.png`);
