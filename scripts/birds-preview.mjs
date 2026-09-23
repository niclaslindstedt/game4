#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WILDLIFE LAB — every bird over the woods and every animal in the snow,
// side by side, as one labelled contact sheet: `previews/birds.png`.
//
// A screenshot of a race cannot review a roster: a bird there is a dozen
// pixels forty metres up and an animal is whichever one that stretch of
// wood held, at whatever point of its round the frame caught. The roster is
// a ladder of silhouettes, and a ladder is judged side by side. Each cell
// draws its species three times through the game's own geometry and
// material — a bird gliding, mid-beat and folded; an animal stood, running
// and grazing — over a metre rule, labelled with its size and its rarity.
//
// The page does the drawing (`pwa/src/tools/birds-harness.ts`); this builds
// it into a one-off bundle (never deployed), serves it and photographs it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/birds-preview.mjs
//   node scripts/birds-preview.mjs --rows=raven,ptarmigan,reindeer
//   node scripts/birds-preview.mjs --skip-build      # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "./lib/chromium.mjs";
import { parseArgs } from "./lib/cli.mjs";
import { serveDir } from "./lib/serve-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".birds-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    rows: {
      kind: "string",
      default: "",
      help: "only these species, birds or animals (e.g. raven,ptarmigan,reindeer)",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: join(outDir, "birds.png"), help: "where the sheet is written" },
  },
  "usage: node scripts/birds-preview.mjs [--rows=a,b] [--skip-build] [--out=path]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "birds-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "birds-preview.html") },
    },
  });
}

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1360, height: 720 } });

// A PAGE ERROR IS FATAL, AND IT HAS TO SAY SO: the page signals it is done by
// setting `window.__done`, so a module that threw never sets it and the wait
// below would burn its whole timeout on a crash that reads as a slow machine.
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
});

const query = args.rows ? `?rows=${encodeURIComponent(args.rows)}` : "";
console.log(`birds — ${args.rows || "every bird and every animal"}`);
await page.goto(`${server.url}birds-preview.html${query}`);
await Promise.race([
  page.waitForFunction("window.__done === true", undefined, { timeout: args.timeout * 1000 }),
  new Promise((_, fail) => {
    const watch = setInterval(() => {
      if (crashed) {
        clearInterval(watch);
        fail(crashed);
      }
    }, 200);
    watch.unref();
  }),
]);

const stage = await page.$("canvas#stage");
const box = await stage.boundingBox();
await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
await page.screenshot({ path: args.out, fullPage: true });
console.log(args.out.replace(`${root}/`, ""));

await browser.close();
await server.close();
