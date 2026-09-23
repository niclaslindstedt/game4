#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ BENCHMARK, from the command line: the BUILT site (`make build`
// first) opened on `?bench=1` in headless Chromium, the pinned race run to
// its end, and the report COPY DEBUG REPORT would put on the clipboard
// printed here (`window.__SH_BENCH__`, `benchmark-report.ts`).
//
// It is the same run a person starts on a phone from the developer page —
// the same plan, the same pump, the same report — so a score from here and
// one pasted off a device are two readings of one instrument. What differs
// is the machine: headless Chromium draws through a SOFTWARE rasteriser
// (SwiftShader) unless `--gpu` asks for the host's own, so a score from here
// is a statement about this build's CPU cost and a regression's shape, and
// never a figure to hold a phone to.

import process from "node:process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findChromium } from "./lib/chromium.mjs";
import { parseArgs } from "./lib/cli.mjs";
import { serveDir } from "./lib/serve-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    width: { kind: "number", default: 1280, help: "viewport width, CSS px" },
    height: { kind: "number", default: 720, help: "viewport height, CSS px" },
    video: { kind: "string", help: "picture preset for the visit (low, medium, high)" },
    gpu: { kind: "flag", help: "draw on the host's GPU rather than SwiftShader" },
    timeout: { kind: "number", default: 3600, help: "seconds to wait for the run to finish" },
    out: { kind: "string", default: "previews/benchmark.txt", help: "where the report is written" },
  },
  "make bench [ARGS=...] — run DEVELOPER ▸ BENCHMARK on the built site and print its report",
);

const dist = join(root, "pwa", "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error(`no built site at ${dist} — run \`make build\` first`);
  process.exit(2);
}
const found = await findChromium();
if (!found) process.exit(2);

const site = await serveDir(dist);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: args.gpu
    ? ["--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });
page.on("pageerror", (err) => console.error(`pageerror: ${err.message}`));
const query = new URLSearchParams({ bench: "1", splash: "0", probe: "0" });
if (args.video) query.set("video", args.video);
const url = `${site.url}?${query}`;
console.log(`benchmark — ${url} at ${args.width}×${args.height}${args.gpu ? " (gpu)" : ""}`);

let report = null;
try {
  await page.goto(url);
  await page.waitForFunction(() => typeof globalThis.__SH_BENCH__ === "string", null, {
    timeout: args.timeout * 1000,
    polling: 1000,
  });
  report = await page.evaluate(() => globalThis.__SH_BENCH__);
} catch (e) {
  console.error(`the benchmark did not finish: ${e instanceof Error ? e.message : String(e)}`);
}
await browser.close();
site.close();
if (report === null) process.exit(1);

console.log(report);
const out = join(root, args.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${report}\n`);
console.log(`\nwrote ${args.out}`);
