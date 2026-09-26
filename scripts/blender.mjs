#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLENDER LAB — a game asset MODELLED in Blender off the game's own
// data, for the day the game ships authored assets (a desktop build, say):
// `previews/blender/<id>-*.png` (studio renders), `<id>-lod{0,1,2}.glb` (the
// game budget) and the `.blend` files to open by hand.
//
// It never restates the game: it hands Blender the SAME numbers the game's
// builder reads, as one JSON file, and a builder under `scripts/blender/`
// models the asset from them in the data's own frame. A modelled sled, so,
// stands on the physics' ski line and belt run to the centimetre, and
// `make sled ARGS=--asset=…` sets it beside the builder's. Nothing it
// writes is committed: the game ships no asset files, and every output
// lands in the gitignored `previews/`. The `blender-assets` skill owns the
// loop, and says how a new KIND (a tree, an animal, the rider) is added:
// a row in `KINDS` and a builder beside `sled.py`.
//
//   node scripts/blender.mjs                                the Fox, both qualities
//   node scripts/blender.mjs --id=ibex --quality=game
//   node scripts/blender.mjs --id=all --quality=game   every sled, one after another
//   node scripts/blender.mjs --quality=render --views=three,side --samples=32
//
// Blender is looked for at `BLENDER`, then the macOS app, then `blender` on
// the PATH. It is run with `--python-use-system-env` and
// `PYTHONDONTWRITEBYTECODE=1`: an app copied without its files' times has
// stale bytecode, and on macOS the rewrite inside the signed bundle blocks
// Python's start for ever.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITIES = ["render", "game"];

/** THE KINDS OF ASSET: what the game's data for one is, and its builder. */
const KINDS = {
  sled: {
    ids: async () => (await import("../engine/index.ts")).SLEDS.map((s) => s.id),
    data: async (id) => {
      const { SLEDS } = await import("../engine/index.ts");
      const { SLED_LOOKS } = await import("../pwa/src/game/sled-looks.ts");
      const { TRAVEL, BAR_TURN } = await import("../pwa/src/game/sled-gear.ts");
      return {
        spec: SLEDS.find((s) => s.id === id),
        look: SLED_LOOKS[id],
        gear: { travel: TRAVEL, barTurn: BAR_TURN },
      };
    },
    builder: "sled.py",
    fallback: "fox",
  },
  // A rider in a grid slot's kit: his body, the pose he is bound in, the
  // helmet's measured shell sampled on a grid, and every clip sampled off
  // the game's own pose (`rider-rig.ts`).
  rider: {
    ids: async () =>
      (await import("../pwa/src/game/sled-body.ts")).SLED_STYLES.map((_, i) => `rider${i}`),
    data: async (id) => {
      const { SLED_STYLES } = await import("../pwa/src/game/sled-body.ts");
      const { BODY, riderPose } = await import("../pwa/src/game/rider-pose.ts");
      const helmet = await import("../pwa/src/game/rider-helmet.ts");
      const { RIDING, riderBones, riderClips } = await import("../pwa/src/game/rider-rig.ts");
      const rest = riderPose(RIDING);
      // Fine enough that the port's and the cap's edges read clean in a
      // still; the game quality takes every other point.
      const [na, ne] = [144, 96];
      const around = (i) => -Math.PI + (2 * Math.PI * i) / na;
      const up = (j) => -Math.PI / 2 + (Math.PI * j) / ne;
      return {
        style: SLED_STYLES[Number(id.slice(5))].rider,
        body: BODY,
        rest: { pose: rest, bones: riderBones(rest) },
        helmet: {
          tilt: helmet.HELMET_TILT,
          sit: helmet.HELMET_SIT,
          around: na,
          up: ne,
          // The reach at every grid point (round from dead behind), and what
          // the shell is in every cell.
          reach: Array.from({ length: ne + 1 }, (_, j) =>
            Array.from({ length: na }, (_, i) => helmet.helmetReach(around(i), up(j))),
          ),
          part: Array.from({ length: ne }, (_, j) =>
            Array.from({ length: na }, (_, i) => helmet.helmetPart(around(i + 0.5), up(j + 0.5))),
          ),
        },
        clips: riderClips().map((c) => ({
          name: c.name,
          seconds: c.seconds,
          frames: c.poses.map(riderBones),
        })),
      };
    },
    builder: "rider.py",
    fallback: "rider0",
  },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    kind: {
      kind: "string",
      default: "sled",
      help: `the kind of asset (${Object.keys(KINDS).join(", ")})`,
    },
    id: {
      kind: "string",
      default: "",
      help: "which one (a sled's id), or all; the kind's default (fox) when left out",
    },
    quality: {
      kind: "string",
      default: "both",
      help: "render (studio stills, subdivided), game (the triangle budget and its LODs), or both",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these cameras (side,three,rear3,chase,detail); every one when left out",
    },
    samples: { kind: "number", default: 64, help: "Cycles samples a still" },
    out: { kind: "string", default: "previews/blender", help: "where everything is written" },
  },
  "usage: node scripts/blender.mjs [--kind=sled] [--id=fox] [--quality=render|game|both] [--views=a,b] [--samples=n]",
);

const kind = KINDS[args.kind];
if (!kind) {
  console.error(`unknown kind "${args.kind}" (${Object.keys(KINDS).join(", ")})`);
  process.exit(2);
}
const qualities = args.quality === "both" ? QUALITIES : [args.quality];
if (!qualities.every((q) => QUALITIES.includes(q))) {
  console.error(`unknown quality "${args.quality}" (render, game, both)`);
  process.exit(2);
}

aliasEngine(root);
const ids = await kind.ids();
const wanted = args.id === "all" ? ids : [args.id || kind.fallback];
const unknown = wanted.find((id) => !ids.includes(id));
if (unknown) {
  console.error(`unknown ${args.kind} "${unknown}" (${ids.join(", ")}, all)`);
  process.exit(2);
}

const outDir = join(root, args.out);
mkdirSync(outDir, { recursive: true });

const blender =
  [process.env.BLENDER, "/Applications/Blender.app/Contents/MacOS/Blender"].find(
    (c) => c && existsSync(c),
  ) ?? "blender";

for (const id of wanted) {
  const data = join(outDir, `${id}.json`);
  writeFileSync(data, JSON.stringify(await kind.data(id), null, 2));
  for (const quality of qualities) await model(id, data, quality);
}

/** One builder pass over one asset at one quality; a Python error ends the run. */
async function model(id, data, quality) {
  const t0 = Date.now();
  const code = await new Promise((done) => {
    const child = spawn(
      blender,
      [
        "-b",
        "--factory-startup",
        "--python-use-system-env",
        "--python-exit-code",
        "1",
        "-P",
        join(root, "scripts", "blender", kind.builder),
        "--",
        data,
        outDir,
        String(args.samples),
      ],
      {
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", QUALITY: quality, VIEWS: args.views },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.on("error", (err) => {
      console.error(`no Blender (${err.message}): install it, or point BLENDER at its executable`);
      done(1);
    });
    // Blender is loud; what is worth a line is what the builder prints,
    // what was saved, and anything that went wrong.
    const echo = (buf) => {
      for (const line of buf.toString().split("\n")) {
        if (/^(BONES|CLIPS|TRIANGLES)|Saved: '|Error|Traceback|File "/.test(line)) {
          console.log(line.replace(/^.*Saved: '(.*)'.*$/, "saved $1").replace(`${root}/`, ""));
        }
      }
    };
    child.stdout.on("data", echo);
    child.stderr.on("data", echo);
    child.on("close", done);
  });
  if (code !== 0) {
    console.error(`blender exited ${code} on the ${quality} pass`);
    process.exit(1);
  }
  console.log(`${args.kind} ${id} · ${quality}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
