#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EAR — the review surface for everything the game makes a noise with.
//
// A sound cannot be judged from a diff, so this builds a single
// self-contained page that plays the ACTUAL shipped audio: the same synth,
// the same bank, the same beds. Three sections:
//
//   THE SLED   the engine and the drive under sliders — revs, throttle, the
//              track's speed, how far it is spinning over the snow — and a
//              switch for the air, because a free-revving jump is the
//              engine's own sound, and a row of SEATS, because the mix moves
//              with the camera.
//   THE SNOW   the skis and the track on the snow and the wind over them:
//              the pace, how PACKED the snow is (the hiss crossfading into
//              the powder's rush), the lock, the wind at the rider's head.
//   THE BANK   every discrete sound in the game, one button each, with the
//              description it was written against printed beside it.
//
// The page carries no scripts of its own beyond the wiring: the audio code
// is the repo's own TypeScript, compiled by `tsc` and inlined, so this can
// never drift from what ships.
//
// And because a session cannot listen, `--meter` drives the page it just
// wrote in a headless Chromium, taps what reaches the destination with an
// analyser, and prints a LEVEL for every bed preset and every sound in the
// bank, dBFS — not a judgement, but the honest half of one.
//
//   make audition                       # previews/audition.html
//   make audition ARGS=--meter          # ...and the level table (Chromium)
//   make audition ARGS="--meter --seat high"
//   npm run audition -- --out other.html

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { findChromium } from "./lib/chromium.mjs";
import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    out: {
      kind: "string",
      default: join("previews", "audition.html"),
      help: "where to write the page",
    },
    meter: {
      kind: "flag",
      default: false,
      help: "drive the page in a headless Chromium and print every level, dBFS",
    },
    seat: { kind: "string", default: "chase", help: "which camera the meter listens from" },
  },
  "usage: npm run audition -- [--out previews/audition.html] [--meter [--seat chase]]",
);
const out = join(root, args.out);

// The modules the page needs at RUNTIME, in dependency order — and the order
// is load-bearing: concatenation is all the linking there is, so a module has
// to be listed BEFORE the ones that call into it.
//
// `voice.ts` is mostly types, which is exactly the trap: it also holds
// `envelopeShape`, `safeCutoff` and the shaper's arithmetic, which every
// voice the synth plays goes through. Leave it out and `tsc` erases the
// import, the page builds clean, and the first button anyone presses throws.
// `ride-bed.ts` is NOT here: it reads a `GameState`, and the page has none —
// the sliders stand in for it, which is the point of the page.
const RUNTIME = [
  "pwa/src/lib/voice.ts",
  "pwa/src/lib/synth.ts",
  "pwa/src/game/audio/play.ts",
  "pwa/src/game/audio/rack.ts",
  "pwa/src/game/audio/listener.ts",
  "pwa/src/game/audio/engine-voice.ts",
  "pwa/src/game/audio/snow-voice.ts",
];

/** Compile the runtime modules to plain JS and return one concatenated blob. */
function compileRuntime() {
  const dir = mkdtempSync(join(tmpdir(), "audition-"));
  try {
    // Run from the temp directory with absolute paths: `tsc` refuses to load a
    // tsconfig.json that sits in the working directory when files are named on
    // the command line (TS5112), and the repo root has one.
    try {
      execFileSync(
        join(root, "node_modules", ".bin", "tsc"),
        [
          ...RUNTIME.map((rel) => join(root, rel)),
          "--outDir",
          dir,
          "--rootDir",
          root,
          "--target",
          "es2022",
          "--module",
          "esnext",
          "--moduleResolution",
          "bundler",
          // The repo writes its imports with explicit `.ts` extensions; this is
          // the emit-time flag that rewrites them, and the only one compatible
          // with actually producing JavaScript.
          "--rewriteRelativeImportExtensions",
          // Emit only. The modules are typechecked by `make lint`; here the
          // `@engine` and `../renderer-api.ts` type imports would fail to resolve
          // without the repo's tsconfig, and they are erased from the emit.
          "--noCheck",
          "--skipLibCheck",
        ],
        { cwd: dir, stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (err) {
      // tsc writes its diagnostics to stdout, which a thrown ExecFileSync
      // error buries under a hex dump of the buffer.
      process.stderr.write(String(err.stdout ?? "") + String(err.stderr ?? ""));
      throw new Error("tsc failed to compile the audio runtime", { cause: err });
    }
    // EACH MODULE GETS ITS OWN SCOPE, wrapped in an IIFE that returns its
    // exports; those are destructured into the shared scope for the modules
    // that follow. Private names stay private, which is what the module
    // system was doing.
    return RUNTIME.map((rel) => {
      const js = readFileSync(join(dir, rel.replace(/\.ts$/, ".js")), "utf8");
      const names = [
        ...js.matchAll(/^export (?:async )?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm),
      ].map((m) => m[1]);
      const body = js
        .split("\n")
        .filter((line) => !/^\s*import[\s{]/.test(line))
        .map((line) => line.replace(/^export (?!default)/, ""))
        .join("\n");
      return `const { ${names.join(", ")} } = (() => {\n${body}\nreturn { ${names.join(", ")} };\n})();`;
    }).join("\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const { RUN_BANK } = await import(join(root, "pwa/src/game/audio/bank.ts"));
const { ENGINE_LAYERS } = await import(join(root, "pwa/src/game/audio/engine-voice.ts"));
const { SNOW_LAYERS } = await import(join(root, "pwa/src/game/audio/snow-voice.ts"));
const { SLED, topSpeedOf } = await import(join(root, "engine/index.ts"));
const spec = SLED;

const runtime = compileRuntime();
const data = JSON.stringify({
  bank: RUN_BANK,
  sled: { name: spec.name, idleRpm: spec.idleRpm, maxRpm: spec.maxRpm, top: topSpeedOf(spec) },
});

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Powder Run — the ear</title>
<style>
  /* ONE LOOK, DELIBERATELY: a trailhead hut at dusk. Deep pine-night blue,
     snow-white ink, and the red of a checkpoint flag. It does not follow the
     viewer's theme because the thing it stands in for only exists in one
     light at a time. */
  :root {
    color-scheme: dark;
    --ground: #0d1a24;
    --panel: #132433;
    --panel-2: #1a2f41;
    --line: #27425a;
    --ink: #e9f1f5;
    --dim: #8fa6b6;
    --buoy: #e8412c;
    --live: #5fd3a6;
    --display: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif;
    --body: "Barlow", system-ui, -apple-system, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 400 16px/1.6 var(--body);
    padding: 0 20px 72px;
  }
  .wrap { max-width: 1100px; margin: 0 auto; }
  header { padding: 40px 0 22px; border-bottom: 2px solid var(--buoy); }
  h1 {
    font: 700 clamp(30px, 6vw, 52px)/0.98 var(--display);
    letter-spacing: 0.02em; text-transform: uppercase; text-wrap: balance; margin: 0;
  }
  h1 small {
    display: block; font: 600 13px/1.4 var(--display); letter-spacing: 0.34em;
    color: var(--buoy); margin-bottom: 10px;
  }
  header p { color: var(--dim); max-width: 62ch; margin: 14px 0 0; }
  h2 {
    font: 600 13px/1 var(--display); letter-spacing: 0.3em; text-transform: uppercase;
    color: var(--dim); margin: 46px 0 4px;
  }
  h2 + .sub { color: var(--dim); font-size: 14px; margin: 0 0 16px; max-width: 62ch; }
  .transport {
    position: sticky; top: 0; z-index: 5;
    display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
    background: color-mix(in srgb, var(--ground) 92%, transparent);
    backdrop-filter: blur(6px); border-bottom: 1px solid var(--line);
    padding: 12px 0; margin-top: 6px;
  }
  .status {
    font: 500 12px/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase;
    display: inline-flex; align-items: center; gap: 8px; color: var(--dim);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dim); }
  .status.live { color: var(--live); }
  .status.live .dot { background: var(--live); box-shadow: 0 0 0 3px color-mix(in srgb, var(--live) 22%, transparent); }
  button {
    font: 600 13px/1 var(--display); letter-spacing: 0.16em; text-transform: uppercase;
    background: var(--panel-2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 3px; padding: 9px 16px; cursor: pointer;
    transition: border-color 120ms, color 120ms, background 120ms;
  }
  button:hover { border-color: var(--buoy); color: var(--buoy); }
  button:focus-visible { outline: 2px solid var(--buoy); outline-offset: 2px; }
  button.on { background: var(--buoy); border-color: var(--buoy); color: #14181d; }
  button.primary { border-color: var(--buoy); color: var(--buoy); }
  button.primary.on { color: #14181d; }
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 16px; }
  .sound { display: grid; gap: 10px; align-content: start; }
  .sound .top { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
  .id { font: 500 13px/1 var(--mono); letter-spacing: 0.02em; color: var(--ink); }
  .layers { display: flex; gap: 4px; flex-wrap: wrap; }
  .chip {
    font: 500 10px/1 var(--mono); letter-spacing: 0.06em; text-transform: uppercase;
    padding: 4px 7px; border-radius: 2px; border: 1px solid var(--line); color: var(--dim);
  }
  .chip.tone { border-color: color-mix(in srgb, var(--buoy) 45%, var(--line)); color: var(--buoy); }
  .desc { color: var(--dim); font-size: 14px; line-height: 1.55; margin: 0; }
  .sl { display: grid; grid-template-columns: 128px 1fr 64px; gap: 14px; align-items: center; margin: 10px 0; }
  .sl .k { font: 600 11px/1 var(--display); letter-spacing: 0.22em; text-transform: uppercase; color: var(--dim); }
  .sl .v { font: 500 14px/1 var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
  input[type="range"] { width: 100%; accent-color: var(--buoy); }
  input[type="range"]:focus-visible { outline: 2px solid var(--buoy); outline-offset: 3px; }
  .switches { display: flex; gap: 6px; flex-wrap: wrap; margin: 16px 0 4px; align-items: center; }
  .switches .k { font: 600 11px/1 var(--display); letter-spacing: 0.22em; text-transform: uppercase; color: var(--dim); margin-right: 6px; }
  footer { color: var(--dim); font-size: 13px; margin-top: 52px; border-top: 1px solid var(--line); padding-top: 16px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1><small>Powder Run</small>The ear</h1>
    <p>
      Everything the game makes a noise with, played by the game's own code. Nothing here is a
      recording — every layer and every landing is synthesized from a handful of numbers, which is
      why it can all be read as well as heard. A browser will not make a sound until you press
      the button below.
    </p>
  </header>

  <div class="transport">
    <button id="unlock" class="primary" type="button">Start audio</button>
    <span class="status" id="state"><span class="dot"></span><span id="stateText">Waiting for a gesture</span></span>
  </div>

  <h2>The sled</h2>
  <p class="sub">
    The engine and the drive: every layer built once and STEERED by the numbers below.
    <b>Revs</b> is the crank, <b>throttle</b> what the thumb is asking for, <b>track</b> the
    tread's own speed — which is the belt's whine, and the one that climbs while a CVT holds the
    revs still — and <b>slip</b> how far the tread is outrunning the snow. <b>In the air</b>
    takes the load away: the same throttle, nothing to push against. The <b>seat</b> moves the
    whole mix.
  </p>
  <div class="panel">
    <div class="switches"><button id="sled" class="primary" type="button">Start the engine</button></div>
    <div id="sledSliders"></div>
  </div>

  <h2>The snow</h2>
  <p class="sub">
    The skis and the track on the snow, and the wind: five layers. <b>Pace</b> is the share of
    top speed, <b>packed</b> how much of the machine is on the groomed loop (the hiss) rather
    than in powder (the rush), <b>lock</b> the bars, <b>wind</b> the air at the rider's head.
    Take the sled into the air and only the wind is left.
  </p>
  <div class="panel">
    <div class="switches"><button id="snow" class="primary" type="button">Start the snow</button></div>
    <div id="snowSliders"></div>
  </div>

  <div id="bank"></div>

  <footer>
    Built by <span class="id">make audition</span> from the repository's own synth, bank and beds.
    If it sounds right here, it sounds right in the game.
  </footer>
</div>

<script type="module">
${runtime}

const DATA = ${data};
const synth = createSynth();

const stateEl = document.getElementById("state");
const stateText = document.getElementById("stateText");
function refreshState() {
  const live = synth.now() !== null;
  stateEl.className = live ? "status live" : "status";
  stateText.textContent = live ? "Audio running" : "Still locked — press again";
}
document.getElementById("unlock").addEventListener("click", () => {
  synth.unlock();
  refreshState();
});

/** Build an element in one call — the page is all DOM, no innerHTML. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A row of exclusive switches; \`onPick\` gets the chosen value. */
function switchRow(parent, label, choices, initial, onPick) {
  const row = el("div", "switches");
  row.append(el("span", "k", label));
  const buttons = [];
  for (const choice of choices) {
    const b = el("button", choice === initial ? "on" : null, choice);
    b.type = "button";
    b.addEventListener("click", () => {
      for (const other of buttons) other.className = "";
      b.className = "on";
      onPick(choice);
    });
    buttons.push(b);
    row.append(b);
  }
  parent.append(row);
}

/** A slider row bound to \`store[id]\`, over \`min..max\` with a unit. */
function sliderRow(parent, store, id, label, initial, min = 0, max = 1, unit = "") {
  store[id] = initial;
  const row = el("label", "sl");
  const input = document.createElement("input");
  const step = (max - min) / 100;
  Object.assign(input, { type: "range", min, max, step, value: initial });
  const show = (v) => (max - min > 10 ? v.toFixed(0) : v.toFixed(2)) + unit;
  const read = el("span", "v", show(initial));
  input.addEventListener("input", () => {
    store[id] = Number(input.value);
    read.textContent = show(store[id]);
  });
  row.append(el("span", "k", label), input, read);
  parent.append(row);
}

/** A switch that flips \`store[id]\`. */
function toggle(parent, store, id, label) {
  const row = el("div", "switches");
  const b = el("button", store[id] ? "on" : null, label);
  b.type = "button";
  b.addEventListener("click", () => {
    store[id] = !store[id];
    b.className = store[id] ? "on" : "";
  });
  row.append(b);
  parent.append(row);
}

const seat = { view: "chase" };
// THE TOOLING'S HANDLE: the three stores the sliders write, so a headless
// meter (\`--meter\`) can set a preset without finding a slider.
window.__ear = { seat };

// ── The sled ───────────────────────────────────────────────────────────────
const sled = { airborne: false };
window.__ear.sled = sled;
const sledSliders = document.getElementById("sledSliders");
sliderRow(sledSliders, sled, "rev", "Revs", 0.3);
sliderRow(sledSliders, sled, "throttle", "Throttle", 0.5);
sliderRow(sledSliders, sled, "tread", "Track", 12, 0, 40, " m/s");
sliderRow(sledSliders, sled, "slip", "Slip", 0, 0, 10, " m/s");
toggle(sledSliders, sled, "airborne", "In the air");
switchRow(sledSliders, "Seat", Object.keys(LISTENERS), "chase", (s) => (seat.view = s));
sledSliders.append(el("p", "sub", "The rev band is the " + DATA.sled.name + " sled's: " +
  DATA.sled.idleRpm + " to " + DATA.sled.maxRpm + " rpm."));

let engineRack = null;
const sledBtn = document.getElementById("sled");
sledBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (engineRack !== null) {
    clearInterval(engineRack.timer);
    engineRack.rack.stop();
    engineRack = null;
    sledBtn.className = "primary";
    sledBtn.textContent = "Start the engine";
    return;
  }
  sledBtn.className = "primary on";
  sledBtn.textContent = "Stop the engine";
  const rack = createRack(synth, ENGINE_LAYERS, ENGINE_GLIDE);
  // Steered thirty times a second, exactly as the game's frame does it: the
  // layers hold between calls, so nothing here is booked ahead. (No
  // backticks in here: this whole script is one template literal.)
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    rack.apply(
      engineTargets(
        {
          rpm: rpmAt(sled.rev, DATA.sled.idleRpm, DATA.sled.maxRpm),
          rev: sled.rev,
          throttle: sled.throttle,
          load: sled.airborne ? 0 : sled.throttle,
          treadSpeed: sled.tread,
          slip: sled.slip,
        },
        { engine: ear.engine, exhaust: ear.exhaust, tone: ear.tone },
      ),
    );
  }, 33);
  engineRack = { timer, rack };
});

// ── The snow ───────────────────────────────────────────────────────────────
const snow = { airborne: false };
window.__ear.snow = snow;
const snowSliders = document.getElementById("snowSliders");
sliderRow(snowSliders, snow, "pace", "Pace", 0.5);
sliderRow(snowSliders, snow, "packed", "Packed", 1);
sliderRow(snowSliders, snow, "steer", "Lock", 0);
sliderRow(snowSliders, snow, "wind", "Wind", 16, 0, 40, " m/s");
toggle(snowSliders, snow, "airborne", "In the air");

let snowRack = null;
const snowBtn = document.getElementById("snow");
snowBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (snowRack !== null) {
    clearInterval(snowRack.timer);
    snowRack.rack.stop();
    snowRack = null;
    snowBtn.className = "primary";
    snowBtn.textContent = "Start the snow";
    return;
  }
  snowBtn.className = "primary on";
  snowBtn.textContent = "Stop the snow";
  const rack = createRack(synth, SNOW_LAYERS, SNOW_GLIDE);
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    const speed = snow.pace * DATA.sled.top;
    rack.apply(
      snowTargets(
        {
          speed,
          pace: snow.pace,
          packed: snow.packed,
          grounded: snow.airborne ? 0 : 1,
          steer: snow.steer,
          treadSpeed: speed * 1.05,
          wind: snow.wind,
          airborne: snow.airborne,
        },
        { snow: ear.snow, wind: ear.wind },
      ),
    );
  }, 33);
  snowRack = { timer, rack };
});

// ── The bank ───────────────────────────────────────────────────────────────
const bank = document.getElementById("bank");
bank.append(el("h2", null, "The bank"));
bank.append(
  el(
    "p",
    "sub",
    "Every voice is listed before you press it: what a sound is MADE of is most of what it is.",
  ),
);
const grid = el("div", "grid");
for (const [id, def] of Object.entries(DATA.bank)) {
  const card = el("div", "panel sound");
  const top = el("div", "top");
  const play = el("button", null, "Play");
  play.type = "button";
  play.addEventListener("click", () => {
    synth.unlock();
    refreshState();
    playDef(synth, def);
  });
  top.append(el("span", "id", id), play);
  const layers = el("div", "layers");
  for (const voice of def.voices) {
    const kind = voice.call === "tone" ? voice.type || "square" : (voice.color || "white") + " noise";
    layers.append(el("span", voice.call === "tone" ? "chip tone" : "chip", kind));
  }
  card.append(top, layers, el("p", "desc", def.description));
  grid.append(card);
}
bank.append(grid);
</script>
</body>
</html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(
  `wrote ${out} — ${Object.keys(RUN_BANK).length} sounds, ` +
    `the ${spec.name} sled's rev band (${spec.idleRpm}–${spec.maxRpm} rpm), the engine's ` +
    `${Object.keys(ENGINE_LAYERS).length} layers and the snow's ` +
    `${Object.keys(SNOW_LAYERS).length} under sliders`,
);

// ── THE METER ───────────────────────────────────────────────────────────────

/* global window, document, AudioNode, AudioDestinationNode -- the functions
   handed to `page.addInitScript` and `page.evaluate` run in the PAGE, not in
   Node; these are the page's globals, named so the linter knows. */

/** The moments the beds are metered at — a ladder from a sled idling on the
 * grid to the whole mix flat out, and the two the ear finds faults at: the
 * launch in powder and the air. */
const PRESETS = [
  {
    name: "idle on the grid",
    sled: { rev: 0, throttle: 0, tread: 0, slip: 0, airborne: false },
    snow: { pace: 0, packed: 0.2, steer: 0, wind: 0, airborne: false },
  },
  {
    name: "launch from rest, powder",
    sled: { rev: 0.85, throttle: 1, tread: 8, slip: 6, airborne: false },
    snow: { pace: 0.08, packed: 0, steer: 0, wind: 3, airborne: false },
  },
  {
    name: "cruise on the loop",
    sled: { rev: 0.75, throttle: 0.6, tread: 20, slip: 0.5, airborne: false },
    snow: { pace: 0.55, packed: 1, steer: 0.2, wind: 18, airborne: false },
  },
  {
    name: "flat out, carving",
    sled: { rev: 0.95, throttle: 1, tread: 33, slip: 0.8, airborne: false },
    snow: { pace: 1, packed: 1, steer: 0.7, wind: 34, airborne: false },
  },
  {
    name: "in the air",
    sled: { rev: 1.06, throttle: 1, tread: 38, slip: 0, airborne: true },
    snow: { pace: 0.9, packed: 1, steer: 0, wind: 30, airborne: true },
  },
];

/** How long a bed is given to reach its targets before it is read, ms, and
 * how long it is then read for. The glides run to a sixth of a second. */
const SETTLE_MS = 800;
const READ_MS = 2000;
const READ_STEP_MS = 40;

/** The longest one-shot in the bank, ms. */
const SOUND_MS = 1500;

const db = (rms) => (20 * Math.log10(Math.max(1e-6, rms))).toFixed(1).padStart(6) + " dBFS";

async function meter() {
  const found = await findChromium();
  if (!found) {
    console.error("the page is written; only the meter is skipped");
    return;
  }
  const browser = await found.chromium.launch({
    executablePath: found.executablePath,
    // No gesture in a headless page: the context has to be allowed to start
    // on the button the script presses.
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  // THE TAP: everything that connects to the destination — which is the
  // master limiter, so this hears what the player hears — also feeds an
  // analyser, and the page reads its RMS on demand.
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    const taps = [];
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        const ctx = dest.context;
        if (!ctx.__tap) {
          ctx.__tap = ctx.createAnalyser();
          ctx.__tap.fftSize = 2048;
          taps.push(ctx.__tap);
        }
        connect.call(this, ctx.__tap);
      }
      return connect.call(this, dest, ...rest);
    };
    window.__rms = () => {
      let peak = 0;
      for (const tap of taps) {
        const buf = new Float32Array(tap.fftSize);
        tap.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        peak = Math.max(peak, Math.sqrt(sum / buf.length));
      }
      return peak;
    };
  });
  await page.goto(pathToFileURL(out).href);
  await page.click("#unlock");
  await page.waitForTimeout(300);
  const running = await page.evaluate(() => document.getElementById("stateText").textContent);
  console.log(`\nmeter: ${running}, listening from the ${args.seat} seat`);
  /** Mean and peak RMS over a read window. */
  const read = async (ms) => {
    let sum = 0;
    let n = 0;
    let peak = 0;
    for (let t = 0; t < ms; t += READ_STEP_MS) {
      await page.waitForTimeout(READ_STEP_MS);
      const rms = await page.evaluate(() => window.__rms());
      sum += rms;
      n++;
      peak = Math.max(peak, rms);
    }
    return { mean: sum / n, peak };
  };
  await page.evaluate((seat) => {
    window.__ear.seat.view = seat;
  }, args.seat);

  console.log("\nTHE BEDS (mean / peak)");
  await page.click("#sled");
  await page.click("#snow");
  for (const preset of PRESETS) {
    await page.evaluate((p) => {
      Object.assign(window.__ear.sled, p.sled);
      Object.assign(window.__ear.snow, p.snow);
    }, preset);
    await page.waitForTimeout(SETTLE_MS);
    const { mean, peak } = await read(READ_MS);
    console.log(`  ${preset.name.padEnd(26)} ${db(mean)}   ${db(peak)}`);
  }
  await page.click("#sled");
  await page.click("#snow");
  await page.waitForTimeout(400);

  console.log("\nTHE BANK (peak)");
  for (const button of await page.$$("#bank button")) {
    const id = await button.evaluate((b) => b.parentElement.querySelector(".id").textContent);
    await button.click();
    const { peak } = await read(SOUND_MS);
    console.log(`  ${id.padEnd(26)} ${db(peak)}`);
  }
  await browser.close();
  if (errors.length > 0) {
    console.error(`\nthe page threw:\n  ${errors.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log("\nthe page threw nothing");
  }
}

if (args.meter) await meter();
