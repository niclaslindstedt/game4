// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB's page (driven by `scripts/world-preview.mjs`): one seed
// stood up and ridden by the bot — the player's sled and the field's — and
// drawn through the game's own renderer at a list of named moments. It
// exposes `window.__world.shoot(name)`, which rides the run on to that
// moment and draws it; the script photographs the canvas after each.
//
// ONE CONTINUOUS RUN, so the trails the views show are the trails that run
// actually cut. Between two shots the run is fast-forwarded at the display's
// own pace with `present` off (`renderer.ts`): every frame still stamps its
// furrows and flies its spray, it only skips drawing the picture — which in a
// software rasterizer is most of the cost.

import { botInput, createGame, step, type GameState } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Shot = { name: string; note: string };

declare global {
  interface Window {
    __world?: {
      ready: Promise<void>;
      shoot(name: string): Promise<Shot>;
      frameMs(frames: number): Promise<{ ms: number; calls: number; triangles: number }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
/** The picture, a preset at a time (`settings-video.ts`); HIGH unless named. */
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const label = document.getElementById("label") as HTMLDivElement;

const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const state: GameState = createGame({ seed });

const FRAME = 1 / 60;

/** One display frame: two engine steps, then a frame drawn (or not). */
function frame(present: boolean) {
  for (let i = 0; i < 2; i++) step(state, botInput(state));
  renderer.draw(state, 0, FRAME, present);
}

/** Ride on until `done` holds or the clock reaches `limit`. */
function rideUntil(done: () => boolean, limit: number): boolean {
  while (state.t < limit) {
    if (done()) return true;
    frame(false);
  }
  return done();
}

/** Let the lens settle, then draw. */
function settle(frames: number) {
  for (let i = 0; i < frames; i++) frame(false);
  frame(true);
}

/** Draw the current moment without moving the run on. */
function still() {
  renderer.draw(state, 0, FRAME, true);
}

const level = state.level;

/** The highest point inside the basin's rim, looking in over it. */
function vista(): LensPose {
  const c = level.basin ?? { x: level.size / 2, z: level.size / 2, rim: level.size * 0.4 };
  let best = { x: c.x, z: c.z, y: -Infinity };
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 48) {
    for (const f of [0.55, 0.7, 0.85]) {
      const x = c.x + Math.sin(a) * c.rim * f;
      const z = c.z + Math.cos(a) * c.rim * f;
      const y = level.groundAt(x, z);
      if (y > best.y) best = { x, z, y };
    }
  }
  return {
    eye: { x: best.x, y: best.y + 6, z: best.z },
    target: { x: c.x, y: level.groundAt(c.x, c.z) + 10, z: c.z },
    fov: 60,
    roll: 0,
  };
}

/** The densest stand of trees, seen from its edge at head height. */
function forestView(): LensPose {
  const trees = level.trees;
  let best = trees[0];
  let most = -1;
  for (let i = 0; i < trees.length; i += 7) {
    const t = trees[i];
    let n = 0;
    for (let j = 0; j < trees.length; j += 3) {
      const u = trees[j];
      if ((u.x - t.x) ** 2 + (u.z - t.z) ** 2 < 400) n++;
    }
    if (n > most) {
      most = n;
      best = t;
    }
  }
  // Back off from the stand toward open snow: the direction with the fewest
  // trees within forty metres.
  let bestDir = 0;
  let fewest = Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const x = best.x + Math.sin(a) * 40;
    const z = best.z + Math.cos(a) * 40;
    let n = 0;
    for (const u of trees) if ((u.x - x) ** 2 + (u.z - z) ** 2 < 400) n++;
    if (n < fewest) {
      fewest = n;
      bestDir = a;
    }
  }
  const ex = best.x + Math.sin(bestDir) * 34;
  const ez = best.z + Math.cos(bestDir) * 34;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 2.2, z: ez },
    target: { x: best.x, y: best.y + 5, z: best.z },
    fov: 62,
    roll: 0,
  };
}

/** Ahead of the player looking back down the furrows he has cut — from
 * whichever side has no tree standing where the lens would be. */
function lookBack(): LensPose {
  const s = state.sled;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const clear = (x: number, z: number) =>
    Math.min(...level.trees.map((t) => Math.hypot(t.x - x, t.z - z) - t.crown));
  let ex = 0;
  let ez = 0;
  let room = -Infinity;
  for (const side of [2.5, -2.5, 5, -5]) {
    const x = s.x + fx * 7 + fz * side;
    const z = s.z + fz * 7 - fx * side;
    const c = clear(x, z);
    if (c > room) {
      room = c;
      ex = x;
      ez = z;
    }
  }
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 2.6, z: ez },
    target: { x: s.x - fx * 8, y: s.y - 0.5, z: s.z - fz * 8 },
    fov: 60,
    roll: 0,
  };
}

/** Down on the furrows just behind the player, from a couple of metres up
 * and off to one side — the trough's walls, its floor and its berm. */
function furrow(): LensPose {
  const s = state.sled;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const ex = s.x - fx * 3 + fz * 2.2;
  const ez = s.z - fz * 3 - fx * 2.2;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 1.8, z: ez },
    target: { x: s.x - fx * 9, y: level.groundAt(s.x - fx * 9, s.z - fz * 9), z: s.z - fz * 9 },
    fov: 55,
    roll: 0,
  };
}

let trackAt = -1;

const shots: Record<string, () => string> = {
  spawn() {
    rideUntil(() => state.t >= 1.5, 3);
    renderer.setCamera("chase", true);
    settle(20);
    return `on the grid behind the start line, t ${state.t.toFixed(1)} s`;
  },
  powder() {
    // The grid is on the groomer, so the first powder the race rides is its
    // first drift across the track (R17) — ridden to, for as long as it
    // takes, on a map that has one.
    rideUntil(() => state.t >= 10 && state.sled.packed < 0.4, 150);
    renderer.setCamera("chase", true);
    settle(4);
    return `chase in the first drift, t ${state.t.toFixed(1)} s, packed ${state.sled.packed.toFixed(2)}`;
  },
  "powder-high"() {
    renderer.setCamera("high", true);
    settle(30);
    return "the high boom over the furrows";
  },
  lookback() {
    renderer.setOverride(lookBack());
    still();
    renderer.setOverride(null);
    return "ahead of the sled, looking back down its trail";
  },
  furrow() {
    renderer.setOverride(furrow());
    still();
    renderer.setOverride(null);
    return "close on the furrows behind the sled";
  },
  track() {
    renderer.setCamera("chase", true);
    rideUntil(() => state.t > 16 && state.sled.packed > 0.9 && !state.sled.airborne, 120);
    trackAt = state.t;
    settle(60);
    return `on the groomed track, t ${state.t.toFixed(1)} s`;
  },
  hood() {
    renderer.setCamera("hood", true);
    settle(2);
    return "the hood camera";
  },
  bars() {
    renderer.setCamera("bars", true);
    settle(2);
    return "the bars camera";
  },
  far() {
    renderer.setCamera("far", true);
    settle(30);
    return "the far boom";
  },
  jump() {
    renderer.setCamera("chase", true);
    const found = rideUntil(() => state.sled.airborne && state.sled.airTime > 0.25, trackAt + 240);
    frame(true);
    return found
      ? `in the air ${state.sled.airTime.toFixed(2)} s, t ${state.t.toFixed(1)} s`
      : "no flight found";
  },
  landing() {
    rideUntil(() => !state.sled.airborne, state.t + 5);
    for (let i = 0; i < 8; i++) frame(false);
    frame(true);
    return "the landing puff";
  },
  vista() {
    renderer.setOverride(vista());
    still();
    renderer.setOverride(null);
    return "over the basin from the rim";
  },
  forest() {
    renderer.setOverride(forestView());
    still();
    renderer.setOverride(null);
    return "the edge of the densest wood";
  },
  orbit() {
    renderer.setCamera("orbit", true);
    settle(30);
    return "the menus' drone";
  },
};

window.__world = {
  ready: renderer.load(state),
  async shoot(name) {
    const run = shots[name];
    if (!run) throw new Error(`no view "${name}" — known: ${Object.keys(shots).join(", ")}`);
    const note = run();
    label.textContent = `${name.toUpperCase()} · seed ${seed} · ${note}`;
    return { name, note };
  },
  async frameMs(frames) {
    renderer.setCamera("chase", true);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) frame(true);
    renderer.gl.getContext().finish();
    const ms = (performance.now() - t0) / frames;
    const info = renderer.info();
    return { ms, calls: info.calls, triangles: info.triangles };
  },
};
