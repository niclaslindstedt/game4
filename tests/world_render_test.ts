// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD RENDERER'S ARITHMETIC — the three-free halves of the picture:
// the sky's colour model (`sky.ts`), what a sled leaves in the snow
// (`trail-stamp.ts`), the camera ladder (`camera-rigs.ts`), the rider's
// pose (`rider-pose.ts`) and the interpolation between two engine steps
// (`interp.ts`). The shaders and the meshes are judged by LOOKING
// (`make world`); what can be said in numbers is said here.

import { describe, expect, it } from "vitest";
import { createGame, step, NEUTRAL_INPUT, type SnowContact } from "@engine";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

import {
  blendLens,
  createBoomState,
  frameRig,
  PULL_MIN,
  RIGS,
  turn,
  type RigPose,
} from "../pwa/src/game/camera-rigs.ts";
import { createLineClear } from "../pwa/src/game/camera-clear.ts";
import { createTrack, nlerp, observe, sample } from "../pwa/src/game/interp.ts";
import { BODY, gripAt, riderPose, solveLimb, sprawlPose } from "../pwa/src/game/rider-pose.ts";
import { airMass, skyLookAt, skyLookFor, sunDirection, sunTint } from "../pwa/src/game/sky.ts";
import {
  bodyStampOf,
  createPen,
  drawnDepth,
  furrowProfile,
  recentre,
  stampsOf,
  TRAIL,
  type Stamp,
} from "../pwa/src/game/trail-stamp.ts";

const flat = () => 0;

function contact(over: Partial<SnowContact> = {}): SnowContact {
  return {
    kind: "ski",
    side: -1,
    x: 0,
    y: 0,
    z: 0,
    sink: 0.02,
    width: 0.15,
    compression: 0.08,
    load: 400,
    touching: true,
    ...over,
  };
}

describe("the sky", () => {
  it("points the sun where the engine's heading convention says", () => {
    const south = sunDirection(Math.PI, 0);
    expect(south.z).toBeCloseTo(-1, 6);
    const east = sunDirection(Math.PI / 2, 0);
    expect(east.x).toBeCloseTo(1, 6);
    const up = sunDirection(0, Math.PI / 2);
    expect(up.y).toBeCloseTo(1, 6);
  });

  it("puts more air in front of a low sun, and reddens it", () => {
    expect(airMass(Math.PI / 2)).toBeCloseTo(1, 2);
    expect(airMass(0.1)).toBeGreaterThan(5);
    const low = sunTint(0.08);
    const high = sunTint(1.0);
    expect(low[0]).toBe(1);
    expect(low[2]).toBeLessThan(high[2]);
    expect(high[2]).toBeGreaterThan(0.8);
  });

  it("is brighter overhead than at the horizon, and blue in its shade", () => {
    const look = skyLookFor(Math.PI, 0.4);
    const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    expect(lum(look.horizon)).toBeGreaterThan(lum(look.zenith));
    expect(look.skyLight[2]).toBeGreaterThan(look.skyLight[0]);
    expect(look.keyIntensity).toBeGreaterThan(skyLookFor(Math.PI, 0.05).keyIntensity);
  });

  it("reads the level's own sun off the run's clock", () => {
    const game = createGame({ seed: 38 });
    const look = skyLookAt(game.level);
    expect(look.elevation).toBeGreaterThan(0);
    expect(Math.hypot(look.sun.x, look.sun.y, look.sun.z)).toBeCloseTo(1, 6);
  });
});

describe("the trail a sled leaves", () => {
  it("draws a furrow in powder whatever the physics' sink, a scuff on the track", () => {
    const ski = contact({ sink: 0.01 });
    expect(drawnDepth(ski, 0)).toBeCloseTo(TRAIL.powderSki, 6);
    expect(drawnDepth(ski, 1)).toBeCloseTo(Math.max(0.01, TRAIL.packedDepth), 6);
    const tread = contact({ kind: "tread", sink: 0.01 });
    expect(drawnDepth(tread, 0)).toBeGreaterThan(drawnDepth(ski, 0));
    // A physics sink deeper than the furrow is drawn as it is.
    expect(drawnDepth(contact({ sink: 0.3 }), 0)).toBeCloseTo(0.3, 6);
    expect(drawnDepth(contact({ sink: 2 }), 0)).toBe(TRAIL.maxDepth);
  });

  it("lays one capsule per probe from where it was to where it is", () => {
    const pen = createPen(2);
    const out: Stamp[] = [];
    stampsOf(
      [contact({ x: 0, z: 0 }), contact({ x: 1, z: 0, touching: false })],
      pen,
      flat,
      400,
      out,
    );
    expect(out).toHaveLength(1);
    expect(out[0].ax).toBe(out[0].bx);
    out.length = 0;
    stampsOf([contact({ x: 0, z: 0.5 }), contact({ x: 1, z: 0.5 })], pen, flat, 400, out);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ ax: 0, az: 0, bx: 0, bz: 0.5 });
    // The second probe was in the air: its capsule starts where it landed.
    expect(out[1]).toMatchObject({ ax: 1, az: 0.5, bx: 1, bz: 0.5 });
    expect(out[0].half).toBeCloseTo(0.075, 6);
  });

  it("does not sweep a trail across the map after a reset", () => {
    const pen = createPen(1);
    const out: Stamp[] = [];
    stampsOf([contact({ x: 0, z: 0 })], pen, flat, 400, out);
    out.length = 0;
    stampsOf([contact({ x: 50, z: 0 })], pen, flat, 400, out);
    expect(out).toHaveLength(0);
  });

  it("gouges a thrown rider's slide into the snow, and nothing while he flies", () => {
    const pen = createPen(1);
    const out: Stamp[] = [];
    bodyStampOf({ x: 0, z: 0, touching: false }, pen, flat, out);
    expect(out).toHaveLength(0);
    bodyStampOf({ x: 0, z: 0, touching: true }, pen, flat, out);
    bodyStampOf({ x: 0, z: 1.5, touching: true }, pen, flat, out);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ ax: 0, az: 0, bx: 0, bz: 1.5, half: TRAIL.body / 2 });
    // A body is a wider mark than any probe.
    expect(TRAIL.body).toBeGreaterThan(2 * 0.3);
  });

  it("presses the centre deepest and throws a berm just outside it", () => {
    expect(furrowProfile(0, 0.1).press).toBe(1);
    expect(furrowProfile(0.05, 0.1).press).toBeGreaterThan(0.9);
    expect(furrowProfile(0.1, 0.1).press).toBe(0);
    expect(furrowProfile(0, 0.1).berm).toBe(0);
    const edge = furrowProfile(0.1 * (0.8 + TRAIL.bermReach / 2), 0.1);
    expect(edge.berm).toBeCloseTo(1, 6);
    expect(furrowProfile(0.3, 0.1).berm).toBe(0);
  });

  it("moves the fine window only when the rider has left its middle, onto whole texels", () => {
    expect(recentre(100, 100, 110, 95, 20, 0.08)).toBeNull();
    const moved = recentre(100, 100, 125.03, 100, 20, 0.08);
    expect(moved).not.toBeNull();
    expect(Math.abs(moved!.x / 0.08 - Math.round(moved!.x / 0.08))).toBeLessThan(1e-9);
    expect(moved!.x).toBeCloseTo(125.04, 6);
  });
});

function pose(over: Partial<RigPose> = {}): RigPose {
  return {
    x: 100,
    y: 10,
    z: 100,
    heading: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 10,
    speed: 10,
    airborne: false,
    q: { x: 0, y: 0, z: 0, w: 1 },
    ...over,
  };
}

describe("the camera ladder", () => {
  it("stands the chase boom behind the nose and aims it ahead", () => {
    const lens = frameRig(RIGS.chase, pose(), createBoomState(), 1 / 60, flat);
    expect(lens.eye.z).toBeLessThan(100);
    expect(lens.eye.y).toBeGreaterThan(10);
    expect(lens.target.z).toBeGreaterThan(100);
    expect(Math.abs(lens.eye.x - 100)).toBeLessThan(1e-9);
  });

  it("follows a turn rather than copying it", () => {
    const st = createBoomState();
    frameRig(RIGS.chase, pose(), st, 1 / 60, flat);
    frameRig(
      RIGS.chase,
      pose({ heading: 1, vx: Math.sin(1) * 10, vz: Math.cos(1) * 10 }),
      st,
      1 / 60,
      flat,
    );
    expect(st.yaw).toBeGreaterThan(0);
    expect(st.yaw).toBeLessThan(0.2);
  });

  it("keeps the lens out of the hill", () => {
    const lens = frameRig(RIGS.chase, pose(), createBoomState(), 1 / 60, () => 50);
    expect(lens.eye.y).toBeGreaterThanOrEqual(50 + (RIGS.chase as { clearance: number }).clearance);
  });

  it("bolts the hood camera to the machine and turns with it", () => {
    const h = Math.PI / 2;
    const q = { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) };
    const lens = frameRig(RIGS.hood, pose({ heading: h, q }), createBoomState(), 1 / 60, flat);
    // Heading a quarter clockwise points the nose along +x.
    expect(lens.target.x - lens.eye.x).toBeGreaterThan(10);
  });

  it("blends two lenses smoothly and lands on the second", () => {
    const a = frameRig(RIGS.chase, pose(), createBoomState(), 1 / 60, flat);
    const b = frameRig(RIGS.high, pose(), createBoomState(), 1 / 60, flat);
    expect(blendLens(a, b, 0).eye).toEqual(a.eye);
    expect(blendLens(a, b, 1).eye).toEqual(b.eye);
    const mid = blendLens(a, b, 0.5).eye.y;
    expect(mid).toBeGreaterThan(a.eye.y);
    expect(mid).toBeLessThan(b.eye.y);
    expect(turn(3, -3)).toBeCloseTo(2 * Math.PI - 6, 9);
  });
});

describe("the lens kept out of the woods", () => {
  const level = syntheticLevel();
  const clear = createLineClear(level);
  // Riding north (+z) four metres past the lone spruce: the boom's arm runs
  // straight back through its crown.
  const past = () =>
    pose({
      x: LONE_TREE.x,
      z: LONE_TREE.z + 4,
      y: level.groundAt(LONE_TREE.x, LONE_TREE.z + 4) + 0.5,
    });

  it("reads a line through a crown as blocked and one in the open as clear", () => {
    const y = level.groundAt(LONE_TREE.x, LONE_TREE.z) + 2;
    const from = { x: LONE_TREE.x, y, z: LONE_TREE.z + 5 };
    expect(clear(from, { x: LONE_TREE.x, y, z: LONE_TREE.z - 5 })).toBeLessThan(0.5);
    expect(clear(from, { x: LONE_TREE.x, y, z: LONE_TREE.z + 12 })).toBe(1);
  });

  it("pulls the chase arm in short of the tree, at once, and never onto the rider", () => {
    const p = past();
    const free = frameRig(RIGS.chase, p, createBoomState(), 1 / 60, level.groundAt);
    const st = createBoomState();
    const held = frameRig(RIGS.chase, p, st, 1 / 60, level.groundAt, clear);
    expect(st.pull).toBeLessThan(1);
    // In front of the trunk, not behind it.
    expect(held.eye.z).toBeGreaterThan(LONE_TREE.z);
    expect(free.eye.z).toBeLessThan(LONE_TREE.z);
    const arm = Math.hypot(held.eye.x - p.x, held.eye.z - p.z);
    expect(arm).toBeGreaterThan(PULL_MIN * 0.5);
  });

  it("leaves the ridden boom out at its length past a tree — a bough in the frame, never a jolt", () => {
    const p = past();
    const boomClear = createLineClear(level, { trees: false });
    const free = frameRig(RIGS.chase, p, createBoomState(), 1 / 60, level.groundAt);
    const st = createBoomState();
    const rode = frameRig(RIGS.chase, p, st, 1 / 60, level.groundAt, boomClear);
    expect(st.pull).toBe(1);
    expect(rode.eye).toEqual(free.eye);
  });

  it("lets the arm back out slowly once the tree is behind it", () => {
    const st = createBoomState();
    frameRig(RIGS.chase, past(), st, 1 / 60, level.groundAt, clear);
    const pulled = st.pull;
    const open = pose({ x: LONE_TREE.x, z: LONE_TREE.z + 40 });
    open.y = level.groundAt(open.x, open.z) + 0.5;
    frameRig(RIGS.chase, open, st, 1 / 60, level.groundAt, clear);
    expect(st.pull).toBeGreaterThan(pulled);
    expect(st.pull).toBeLessThan(1);
  });
});

describe("the rider's pose", () => {
  it("keeps every limb its own length", () => {
    const root = { x: 0, y: 0, z: 0 };
    const target = { x: 0.2, y: -0.5, z: 0.3 };
    const joint = solveLimb(root, target, 0.44, 0.46, { x: 0, y: 0, z: 1 });
    const d = (a: typeof root, b: typeof root) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(d(root, joint)).toBeCloseTo(0.44, 6);
    expect(d(joint, target)).toBeCloseTo(0.46, 6);
    // Bent toward the pole.
    expect(joint.z).toBeGreaterThan(0.15);
  });

  it("thrown, sprawls with every limb its own length, flailing and then still", () => {
    const d = (a: { x: number; y: number; z: number }, b: typeof a) =>
      Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const at = (phase: number, flail: number) => sprawlPose(phase, flail);
    for (const p of [at(0.2, 1), at(1.3, 0.6), at(3, 0)]) {
      for (let i = 0; i < 2; i++) {
        expect(d(p.shoulders[i], p.elbows[i])).toBeCloseTo(BODY.upperArm, 3);
        expect(d(p.elbows[i], p.hands[i])).toBeCloseTo(BODY.forearm, 2);
      }
      expect(d(p.hips, p.neck)).toBeCloseTo(BODY.spine, 6);
    }
    // Windmilling while flailing; the same whenever he is still.
    expect(at(0.2, 1).hands[0]).not.toEqual(at(0.4, 1).hands[0]);
    expect(at(2, 0).hands[0]).toEqual(at(3, 0).hands[0]);
  });

  it("keeps his hands on the grips as the bars turn", () => {
    const p = riderPose({
      riderRight: 0,
      riderAft: 0,
      lean: 0,
      steer: 0.8,
      airborne: false,
      landing: 5,
    });
    expect(p.hands[1]).toEqual(gripAt(1, p.bars));
    const straight = gripAt(1, 0);
    expect(gripAt(1, 0.4).z).toBeLessThan(straight.z);
  });

  it("hangs off into a turn and sits back for a lean", () => {
    const base = { riderRight: 0, riderAft: 0, lean: 0, steer: 0, airborne: false, landing: 5 };
    const hung = riderPose({ ...base, riderRight: 0.25 });
    expect(hung.hips.x).toBeGreaterThan(0.1);
    expect(hung.neck.x).toBeGreaterThan(hung.hips.x);
    const back = riderPose({ ...base, lean: 1 });
    expect(back.pitch).toBeLessThan(riderPose(base).pitch);
    expect(
      Math.hypot(back.neck.x - back.hips.x, back.neck.y - back.hips.y, back.neck.z - back.hips.z),
    ).toBeCloseTo(BODY.spine, 6);
  });
});

describe("drawing between two steps", () => {
  it("lands on the step before at alpha 0 and on the step at alpha 1", () => {
    const game = createGame({ seed: 38 });
    const track = createTrack();
    observe(track, game.sled, game.tick);
    for (let i = 0; i < 400; i++) step(game, { ...NEUTRAL_INPUT, throttle: 1 });
    observe(track, game.sled, game.tick);
    const x0 = game.sled.x;
    step(game, { ...NEUTRAL_INPUT, throttle: 1 });
    step(game, { ...NEUTRAL_INPUT, throttle: 1 });
    observe(track, game.sled, game.tick);
    const out = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
    expect(sample(track, 1, out).x).toBeCloseTo(game.sled.x, 9);
    const before = sample(track, 0, out).x;
    // One of the two steps back, on the line from the last frame's pose.
    expect(before).toBeCloseTo((x0 + game.sled.x) / 2, 9);
    expect(Math.hypot(out.q.x, out.q.y, out.q.z, out.q.w)).toBeCloseTo(1, 9);
  });

  it("blends quaternions the short way round", () => {
    const a = { x: 0, y: 0, z: 0, w: 1 };
    const b = { x: 0, y: 0, z: 0, w: -1 };
    const out = nlerp(a, b, 0.5, { x: 0, y: 0, z: 0, w: 0 });
    expect(Math.abs(out.w)).toBeCloseTo(1, 9);
  });
});
