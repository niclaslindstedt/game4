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

import {
  botInput,
  createGame,
  isRegionId,
  NEUTRAL_INPUT,
  placeRun,
  step,
  type GameState,
  type RegionId,
} from "@engine";

import { beastById } from "../game/beast-defs.ts";
import { beastPlanFor, beastPose, freshBeastPose, roundAt } from "../game/beast-plan.ts";
import { birdPlanFor, birdPose, flightShare, freshBirdPose } from "../game/bird-plan.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import {
  DEFAULT_VIDEO,
  SHADOW_LEVELS,
  TIERS,
  withPreset,
  type ShadowLevel,
  type Tier,
} from "../game/settings-video.ts";
import { wildGround } from "../game/wild-ground.ts";

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
/** The kind of snow country (R21); the boreal unless named. */
const region = isRegionId(params.get("region")) ? (params.get("region") as RegionId) : undefined;
/** The picture, a preset at a time (`settings-video.ts`); HIGH unless named. */
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
/** The SHADOWS row over the preset, when one is named. */
const shadows = (SHADOW_LEVELS as readonly string[]).includes(params.get("shadows") ?? "")
  ? (params.get("shadows") as ShadowLevel)
  : null;
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const label = document.getElementById("label") as HTMLDivElement;

const renderer = createWorldRenderer(canvas, {
  video: { ...withPreset(DEFAULT_VIDEO, tier), ...(shadows ? { shadows } : {}) },
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const state: GameState = createGame({ seed, region });

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

/** The densest stand of trees, seen from `distance` m out over open snow
 * at head height. */
function forestView(distance = 34): LensPose {
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
  const ex = best.x + Math.sin(bestDir) * distance;
  const ez = best.z + Math.cos(bestDir) * distance;
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

/** A CLIFF (R22): the tallest the map has, from out on its landing looking
 * back up at the face, and from the shelf behind the edge looking over it. */
function cliffView(over: boolean): { pose: LensPose; note: string } | null {
  const cliffs = level.cliffs ?? [];
  if (cliffs.length === 0) return null;
  const c = cliffs.reduce((a, b) => (b.drop > a.drop ? b : a));
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const note = `${c.id}, a ${c.drop.toFixed(1)} m face`;
  if (over) {
    const ex = c.x - fx * 12;
    const ez = c.z - fz * 12;
    const tx = c.x + fx * 40;
    const tz = c.z + fz * 40;
    return {
      pose: {
        eye: { x: ex, y: level.groundAt(ex, ez) + 1.6, z: ez },
        target: { x: tx, y: level.groundAt(tx, tz), z: tz },
        fov: 60,
        roll: 0,
      },
      note: `${note}, from the shelf`,
    };
  }
  // Off to one side, far enough down the landing to take in the whole face.
  const back = c.face + c.landing + 10;
  const ex = c.x + fx * back + fz * c.width * 0.35;
  const ez = c.z + fz * back - fx * c.width * 0.35;
  return {
    pose: {
      eye: { x: ex, y: level.groundAt(ex, ez) + 1.8, z: ez },
      target: { x: c.x, y: c.y - c.drop * 0.4, z: c.z },
      fov: 55,
      roll: 0,
    },
    note: `${note}, from below`,
  };
}

/** THE WILDLIFE: the biggest kind of animal the map holds, from beside it
 * at head height — the herd at its wood's edge, the fox on its meadow. */
function herdView(): { pose: LensPose; note: string } | null {
  const ground = wildGround(level);
  const groups = beastPlanFor(level).groups;
  const g = ["moose", "reindeer", "lynx", "fox", "hare"]
    .map((id) => groups.find((x) => x.species === id))
    .find((x) => x !== undefined);
  if (!g) return null;
  const spec = beastById(g.species);
  const at = beastPose(g, 0, state.t, ground, freshBeastPose());
  const d = Math.max(7, spec.length * 6);
  const a = at.heading + Math.PI / 2;
  const ex = at.x + Math.sin(a) * d;
  const ez = at.z + Math.cos(a) * d;
  return {
    pose: {
      eye: { x: ex, y: ground.snowY(ex, ez) + 1.6, z: ez },
      target: { x: at.x, y: at.y + spec.height * 0.6, z: at.z },
      fov: 50,
      roll: 0,
    },
    note: `${spec.name.toLowerCase()} ×${g.count}, ${d.toFixed(0)} m off`,
  };
}

/** A bird over the wood: the flock most in the air at this moment, from
 * the snow thirty metres off, looking up at its leader. */
function birdView(): { pose: LensPose; note: string } | null {
  const plan = birdPlanFor(level);
  if (plan.flocks.length === 0) return null;
  const up = (f: (typeof plan.flocks)[number]) => flightShare(f, state.t);
  const flock = plan.flocks.reduce((a, b) => (up(b) > up(a) ? b : a));
  const bird = birdPose(flock, 0, state.t, freshBirdPose());
  const ground = wildGround(level);
  const ex = bird.x + 24;
  const ez = bird.z + 12;
  return {
    pose: {
      eye: { x: ex, y: ground.snowY(ex, ez) + 1.8, z: ez },
      target: { x: bird.x, y: bird.y, z: bird.z },
      fov: 40,
      roll: 0,
    },
    note: `${flock.species} ×${flock.count}, ${Math.round(up(flock) * 100)} % in the air`,
  };
}

let trackAt = -1;

/** How far out the approach views stand from the wood, m. */
const APPROACH = [140, 90, 60, 40];

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
  // Late in a flight, falling fast: where a lens that only trailed the sled
  // lost the rider out of the bottom of the frame.
  drop() {
    renderer.setCamera("chase", true);
    const found = rideUntil(() => state.sled.airborne && state.sled.vy < -8, state.t + 150);
    frame(true);
    return found
      ? `falling at ${(-state.sled.vy).toFixed(1)} m/s, in the air ${state.sled.airTime.toFixed(2)} s`
      : "no drop found";
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
  // THE APPROACH: the forest view's own line walked in toward the wood, so
  // what a shadow does as the lens closes on its tree is four pictures side
  // by side — one that appears between two of them was switched on by the
  // lens coming nearer.
  ...Object.fromEntries(
    APPROACH.map((d) => [
      `approach-${d}`,
      () => {
        renderer.setOverride(forestView(d));
        still();
        renderer.setOverride(null);
        return `the densest wood from ${d} m out`;
      },
    ]),
  ),
  orbit() {
    renderer.setCamera("orbit", true);
    settle(30);
    return "the menus' drone";
  },
  wipeout() {
    // THE WIPEOUT (`crash.ts`): the player's sled stood short of the trunk
    // nearest it and ridden into it flat out, drawn a moment after the
    // rider has left the saddle — the burst, and him in the air past it.
    const s = state.sled;
    let tree = level.trees[0];
    for (const t of level.trees) {
      if (Math.hypot(t.x - s.x, t.z - s.z) < Math.hypot(tree.x - s.x, tree.z - s.z)) tree = t;
    }
    const h = Math.atan2(s.x - tree.x, s.z - tree.z);
    placeRun(state, {
      x: tree.x + Math.sin(h) * 25,
      z: tree.z + Math.cos(h) * 25,
      heading: h + Math.PI,
      speed: 55 / 3.6,
    });
    renderer.setCamera("chase", true);
    const pinned = { ...NEUTRAL_INPUT, throttle: 1 };
    const on = (done: () => boolean, limit: number) => {
      while (state.t < limit && !done()) {
        for (let i = 0; i < 2; i++) step(state, pinned);
        renderer.draw(state, 0, FRAME, false);
      }
    };
    on(() => (state.sled.thrown?.t ?? 0) > 0.35, state.t + 6);
    still();
    const off = state.sled.thrown;
    return off ? `thrown (${off.cause}), ${off.t.toFixed(2)} s off` : "no wipeout";
  },
  "wipeout-lie"() {
    // ...and where he came to rest, from beside him: the sprawl and the
    // gouge his slide cut.
    const t0 = state.t;
    while (state.sled.thrown && state.sled.thrown.t < 1.7 && state.t < t0 + 3) {
      for (let i = 0; i < 2; i++) step(state, NEUTRAL_INPUT);
      renderer.draw(state, 0, FRAME, false);
    }
    const off = state.sled.thrown;
    if (!off) return "already stood back up";
    // Close enough to read the body: every limb where the ragdoll left it.
    const across = off.heading + Math.PI / 2;
    const ex = off.x + Math.sin(across) * 2.6;
    const ez = off.z + Math.cos(across) * 2.6;
    renderer.setOverride({
      eye: { x: ex, y: level.groundAt(ex, ez) + 1.6, z: ez },
      target: { x: off.x, y: off.y, z: off.z },
      fov: 55,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    return `lying ${off.t.toFixed(1)} s after, tumbled ${(off.tumble / (2 * Math.PI)).toFixed(1)} turns`;
  },
  cliff() {
    const view = cliffView(false);
    if (!view) return "no cliff on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  "cliff-edge"() {
    const view = cliffView(true);
    if (!view) return "no cliff on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  herd() {
    const view = herdView();
    if (!view) return "no animal on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  birds() {
    const view = birdView();
    if (!view) return "no bird on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  prints() {
    // Last night's prints across a meadow: the player stood fifty metres
    // off a fox's round (outside its fright), so the fine trail window is
    // over it, and the lens down on the line.
    const groups = beastPlanFor(level).groups;
    const g =
      groups.find((x) => x.species === "fox") ??
      groups.find((x) => x.species === "reindeer") ??
      groups[0];
    if (!g) return "no animal on this map";
    const p = { x: 0, z: 0, fx: 0, fz: 1 };
    roundAt(g.round, g.round.length * 0.25, p);
    placeRun(state, { x: p.x + p.fz * 50, z: p.z - p.fx * 50, heading: 0, speed: 0 });
    for (let i = 0; i < 6; i++) renderer.draw(state, 0, FRAME, false);
    const ground = wildGround(level);
    const ex = p.x - p.fx * 1.5 + p.fz * 2;
    const ez = p.z - p.fz * 1.5 - p.fx * 2;
    renderer.setOverride({
      eye: { x: ex, y: ground.snowY(ex, ez) + 2.4, z: ez },
      target: { x: p.x + p.fx * 2, y: ground.snowY(p.x, p.z), z: p.z + p.fz * 2 },
      fov: 55,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    return `${beastById(g.species).name.toLowerCase()}'s prints on its round`;
  },
};

window.__world = {
  ready: renderer.load(state),
  async shoot(name) {
    const run = shots[name];
    if (!run) throw new Error(`no view "${name}" — known: ${Object.keys(shots).join(", ")}`);
    const note = run();
    label.textContent = `${name.toUpperCase()} · seed ${seed}${region ? ` · ${region}` : ""} · ${note}`;
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
