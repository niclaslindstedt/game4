#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED LAB — every machine and its rider, built with the game's own
// builder and drawn on a labelled contact sheet: `previews/sled-<sheet>.png`.
//
// It exists because a machine and the man on it are judged by LOOKING, from
// exact sides, in exact poses — and neither the race (one frame of one
// camera) nor the world lab (a run the bot happened to ride) can hold either
// still. The page does the drawing (`pwa/src/tools/sled-harness.ts`, with
// `createSledModel` and the rider's own pose): orthographic elevations with
// a metre grid for the silhouettes, the three-quarter view, and the chase
// camera's own place, which is where the machine is judged from in a race.
// This script builds that page into a one-off bundle (never deployed),
// serves it, and photographs each sheet in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/sled-preview.mjs                      every sheet
//   node scripts/sled-preview.mjs --sheet=machines     the catalog, by view
//   node scripts/sled-preview.mjs --sheet=liveries     every machine in every livery
//   node scripts/sled-preview.mjs --sheet=poses --sled=ibex
//   node scripts/sled-preview.mjs --sheet=rider --slot=1   the rider close up
//   node scripts/sled-preview.mjs --sheet=head             the helmet alone, every kit
//   node scripts/sled-preview.mjs --sheet=landing --vy=8 --skip-build
//   node scripts/sled-preview.mjs --asset=previews/blender/fox-lod0.glb,previews/blender/fox-lod2.glb
//                                  the builder's machine beside modelled
//                                  versions of it (the `blender-assets` skill):
//                                  the asset sheet, the rig sheet (every one
//                                  posed at the same engine moments) and the
//                                  clips sheet (the first model's clips played)

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "./lib/chromium.mjs";
import { parseArgs } from "./lib/cli.mjs";
import { serveDir } from "./lib/serve-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".sled-preview");
const outDir = join(root, "previews");
const SHEETS = ["machines", "liveries", "poses", "rider", "head", "landing"];
/** The sheets that draw modelled versions (`--asset`, `--rider`). */
const ASSET_SHEETS = ["asset", "rig", "clips", "figure"];

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: `one sheet (${SHEETS.join(", ")}); every sheet when left out`,
    },
    sled: { kind: "string", default: "fox", help: "the machine the poses and landing sheets ride" },
    slot: {
      kind: "number",
      default: 0,
      help: "the grid slot whose colours it wears (0 the player's)",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views (side,front,rear,three,chase; the rider sheet: back,back3,near,front3)",
    },
    vy: { kind: "number", default: 6, help: "the landing sheet's sink rate, m/s" },
    asset: {
      kind: "string",
      default: "",
      help: "modelled versions of --sled as .glb files, comma-separated; draws the asset sheet",
    },
    rider: {
      kind: "string",
      default: "",
      help: "a modelled rider as a .glb (make blender KIND=rider); draws the figure sheet, and rides the models",
    },
    cell: { kind: "number", default: 300, help: "one cell's width, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/sled-preview.mjs [--sheet=machines|liveries|poses|rider|head|landing|asset|rig|clips] [--sled=id] [--views=a,b] [--asset=a.glb,b.glb] [--skip-build]",
);

const assets = args.asset
  .split(",")
  .filter(Boolean)
  .map((p) => resolve(p));
for (const a of assets) {
  if (!existsSync(a)) {
    console.error(`no such asset: ${a}`);
    process.exit(2);
  }
}
const rider = args.rider ? resolve(args.rider) : "";
if (rider && !existsSync(rider)) {
  console.error(`no such rider: ${rider}`);
  process.exit(2);
}
/** What each modelled sheet needs: a machine, a rider, or either. */
const NEEDS = { asset: [assets], rig: [assets], figure: [rider], clips: [assets, rider] };
const wanted = args.sheet
  ? args.sheet.split(",")
  : assets.length || rider
    ? ASSET_SHEETS.filter((s) => NEEDS[s].some((n) => n.length))
    : SHEETS;
for (const s of wanted) {
  if (NEEDS[s] && !NEEDS[s].some((n) => n.length)) {
    console.error(`the ${s} sheet needs ${s === "figure" ? "--rider" : "--asset"}=<file.glb>`);
    process.exit(2);
  }
}
for (const s of wanted) {
  if (![...SHEETS, ...ASSET_SHEETS].includes(s)) {
    console.error(`unknown sheet "${s}" (${[...SHEETS, ...ASSET_SHEETS].join(", ")})`);
    process.exit(2);
  }
}
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "sled-preview.html"))) {
  const { build } = await import("vite");
  await build({
    configFile: false,
    logLevel: "warn",
    root: join(root, "pwa"),
    base: "./",
    resolve: { alias: { "@engine": join(root, "engine", "index.ts") } },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
      rollupOptions: { input: join(root, "pwa", "sled-preview.html") },
    },
  });
}

// The modelled versions are served beside the page and never built into it.
assets.forEach((a, i) => copyFileSync(a, join(buildDir, `asset-${i}.glb`)));
if (rider) copyFileSync(rider, join(buildDir, "rider.glb"));

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let crashed = null;
for (const sheet of wanted) {
  // A viewport as big as any sheet, so the element photographed is never
  // clipped at the window's edge.
  const page = await browser.newPage({ viewport: { width: 3200, height: 3200 } });
  page.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.error(`[console] ${msg.text()}`);
    }
  });
  page.setDefaultTimeout(args.timeout * 1000);
  const query = new URLSearchParams({
    sheet,
    sled: args.sled,
    slot: String(args.slot),
    views: args.views,
    vy: String(args.vy),
    cell: String(args.cell),
    assets: assets.map((a) => basename(a, ".glb")).join(","),
    rider: rider ? basename(rider, ".glb") : "",
  }).toString();
  const t0 = Date.now();
  await page.goto(`${server.url}sled-preview.html?${query}`);
  await page.waitForFunction("window.__sled !== undefined");
  await page.evaluate("window.__sled.ready");
  if (crashed) process.exit(1);
  const drawn = await page.evaluate(() => globalThis.__sled.sheet());
  if (crashed) process.exit(1);
  const tag = ["machines", "liveries", "head"].includes(sheet) ? "" : `-${args.sled}`;
  const out = join(outDir, `sled-${sheet}${tag}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
  await page.close();
}

await browser.close();
await server.close();
