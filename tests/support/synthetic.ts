// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SYNTHETIC maps for the rule suites and the ride lab — the §23.8 sequel
// test: the physics, the course, the bot and the simulator are all held to
// maps no generator built, so the rule suite passes with the generator
// deleted. Anything that needs a GENERATED map calls the generator itself.
//
// `syntheticLevel()` is a STADIUM: a packed loop of two 500 m straights
// joined by two 100 m-radius bends, laid flat on flat snow and ridden
// anticlockwise from the west end of the south straight. On the north
// straight stands a KICKER across the track — a ramp rising 1.8 m over 6 m
// to a lip, then dropping away — and north of the loop gentle hills roll.
// A few trees stand in the infield and ONE stands alone in the powder south
// of the loop, at `LONE_TREE`, for the collision tests. The grid stands in
// the powder 50 m south of the start line, facing it.
//
// `flatLevel()` is a drag strip: a huge flat square, all packed or all
// powder, with a square loop round it only so the Level is whole.

import {
  createHeightfield,
  fillField,
  sampleField,
  type Checkpoint,
  type Heightfield,
  type Level,
  type Spawn,
  type TrackPoint,
  type TreeDef,
} from "@engine";

/** The stadium's geometry, m. */
export const STADIUM = {
  size: 1000,
  cell: 2,
  /** The straights run from x0 to x1 along z = zSouth and z = zNorth. */
  x0: 250,
  x1: 750,
  zMid: 500,
  radius: 100,
  width: 12,
  /** The kicker's lip on the north straight (ridden westward), and its
   * shape: rise over the ramp, the ramp's length, the drop behind the lip. */
  kickerX: 520,
  kickerRise: 1.8,
  kickerRamp: 6,
  kickerDrop: 3,
};

/** The lone tree in the powder south of the loop. */
export const LONE_TREE = { x: 600, z: 300 };

/** Signed distance from the stadium's centreline, m (0 on it). */
function stadiumDistance(x: number, z: number): number {
  const S = STADIUM;
  const cx = Math.min(Math.max(x, S.x0), S.x1);
  return Math.abs(Math.hypot(x - cx, z - S.zMid) - S.radius);
}

/** The kicker's height at (x, z): a ramp rising westward to the lip, then a
 * drop, across the north straight. */
function kickerAt(x: number, z: number): number {
  const S = STADIUM;
  const zn = S.zMid + S.radius;
  const across = Math.abs(z - zn);
  const halfW = S.width / 2 + 2;
  if (across > halfW + 3) return 0;
  const side = across <= halfW ? 1 : 1 - (across - halfW) / 3;
  // u runs along the direction of travel (westward): the ramp's foot at
  // u = 0, the lip at u = ramp, the drop's foot at ramp + drop.
  const u = S.kickerX + S.kickerRamp - x;
  let h = 0;
  if (u >= 0 && u <= S.kickerRamp) h = S.kickerRise * (u / S.kickerRamp);
  else if (u > S.kickerRamp && u <= S.kickerRamp + S.kickerDrop)
    h = S.kickerRise * (1 - (u - S.kickerRamp) / S.kickerDrop);
  return h * side;
}

/** Gentle hills north of the loop, flat everywhere the loop and the tests
 * run. */
function hillsAt(x: number, z: number): number {
  if (z < 640) return 0;
  const fade = Math.min(1, (z - 640) / 60);
  return fade * (6 + 5 * Math.sin(x / 70) * Math.cos(z / 55));
}

function levelFrom(
  seed: number,
  size: number,
  cell: number,
  height: (x: number, z: number) => number,
  packed: (x: number, z: number) => number,
  points: TrackPoint[],
  length: number,
  checkpointEvery: number,
  startS: number,
  spawn: Spawn,
  trees: TreeDef[],
): Level {
  const n = Math.round(size / cell) + 1;
  const ground: Heightfield = createHeightfield(0, 0, cell, n, n);
  fillField(ground, height);
  const groundAt = (x: number, z: number): number => sampleField(ground, x, z);
  const normalAt = (x: number, z: number, out: { x: number; y: number; z: number }): void => {
    const h = cell;
    const gx = (groundAt(x + h, z) - groundAt(x - h, z)) / (2 * h);
    const gz = (groundAt(x, z + h) - groundAt(x, z - h)) / (2 * h);
    const l = Math.hypot(gx, 1, gz);
    out.x = -gx / l;
    out.y = 1 / l;
    out.z = -gz / l;
  };
  for (const p of points) p.y = groundAt(p.x, p.z);
  const checkpoints: Checkpoint[] = [];
  const count = Math.max(3, Math.round(length / checkpointEvery));
  for (let i = 0; i < count; i++) {
    const s = (startS + (i * length) / count) % length;
    const k = Math.min(points.length - 1, Math.round((s / length) * points.length));
    const p = points[k];
    checkpoints.push({ x: p.x, z: p.z, y: p.y, heading: p.heading, width: p.width, s: p.s });
  }
  const fx = Math.sin(spawn.heading);
  const fz = Math.cos(spawn.heading);
  const grid: Spawn[] = [0, 1, 2, 3].map((i) => {
    const lane = (i - 1.5) * 4;
    return { x: spawn.x + fz * lane, z: spawn.z - fx * lane, heading: spawn.heading };
  });
  for (const t of trees) t.y = groundAt(t.x, t.z);
  return {
    seed,
    size,
    cell,
    ground,
    groundAt,
    normalAt,
    packedAt: packed,
    track: { points, length, closed: true },
    checkpoints,
    spawn,
    grid,
    trees,
    sun: { hour: 13, dayOfYear: 60, latitude: 62 },
    laps: 3,
  };
}

/** The stadium's centreline as points every ~2 m, from the west end of the
 * south straight, anticlockwise (east along the south straight first). */
function stadiumPoints(): { points: TrackPoint[]; length: number } {
  const S = STADIUM;
  const straight = S.x1 - S.x0;
  const bend = Math.PI * S.radius;
  const length = 2 * straight + 2 * bend;
  const n = Math.round(length / 2);
  const points: TrackPoint[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i * length) / n;
    let x: number;
    let z: number;
    let heading: number;
    if (s < straight) {
      x = S.x0 + s;
      z = S.zMid - S.radius;
      heading = Math.PI / 2;
    } else if (s < straight + bend) {
      const a = (s - straight) / S.radius; // 0..π round the east end
      x = S.x1 + S.radius * Math.sin(a);
      z = S.zMid - S.radius * Math.cos(a);
      heading = Math.PI / 2 - a;
    } else if (s < 2 * straight + bend) {
      x = S.x1 - (s - straight - bend);
      z = S.zMid + S.radius;
      heading = -Math.PI / 2;
    } else {
      const a = (s - 2 * straight - bend) / S.radius;
      x = S.x0 - S.radius * Math.sin(a);
      z = S.zMid + S.radius * Math.cos(a);
      heading = -Math.PI / 2 - a;
    }
    points.push({ x, z, y: 0, s, heading, width: S.width });
  }
  return { points, length };
}

/** The packed corridor: 1 across the track's width, fading to 0 over a
 * 3 m shoulder. */
function corridor(d: number, width: number): number {
  const half = width / 2;
  if (d <= half) return 1;
  if (d >= half + 3) return 0;
  return 1 - (d - half) / 3;
}

export type SyntheticOptions = {
  /** Leave the trees out. */
  noTrees?: boolean;
  /** Leave the kicker out. */
  noKicker?: boolean;
  /** Laps. */
  laps?: number;
};

/** THE STADIUM (see the header). */
export function syntheticLevel(options: SyntheticOptions = {}): Level {
  const S = STADIUM;
  const { points, length } = stadiumPoints();
  const height = (x: number, z: number): number =>
    hillsAt(x, z) + (options.noKicker ? 0 : kickerAt(x, z));
  const packed = (x: number, z: number): number => corridor(stadiumDistance(x, z), S.width);
  const trees: TreeDef[] = [];
  if (!options.noTrees) {
    for (let i = 0; i < 8; i++) {
      trees.push({
        x: 380 + i * 35,
        z: 470 + (i % 2) * 50,
        y: 0,
        height: 10 + (i % 3),
        radius: 0.3,
        crown: 2.5,
      });
    }
    trees.push({ x: LONE_TREE.x, z: LONE_TREE.z, y: 0, height: 12, radius: 0.35, crown: 2.8 });
  }
  // The start line 50 m along the south straight; the grid 50 m south of
  // it in the powder, facing it.
  const spawn: Spawn = { x: S.x0 + 50, z: S.zMid - S.radius - 50, heading: 0 };
  const level = levelFrom(1, S.size, S.cell, height, packed, points, length, 160, 50, spawn, trees);
  if (options.laps !== undefined) level.laps = options.laps;
  return level;
}

/** THE DRAG STRIP: flat snow `size` m square, packed everywhere (`packed`
 * 1) or powder everywhere (0), with an optional slope rising along +z at
 * `grade` (m/m) north of z = `slopeFrom`. */
export function flatLevel(
  options: { packed?: number; size?: number; grade?: number; slopeFrom?: number } = {},
): Level {
  const size = options.size ?? 3000;
  const packedShare = options.packed ?? 1;
  const grade = options.grade ?? 0;
  const from = options.slopeFrom ?? size;
  const height = (_x: number, z: number): number => (z > from ? (z - from) * grade : 0);
  const m = 100;
  const side = size - 2 * m;
  const length = 4 * side;
  const n = Math.round(length / 2);
  const points: TrackPoint[] = [];
  for (let i = 0; i < n; i++) {
    const s = (i * length) / n;
    const leg = Math.floor(s / side);
    const u = s - leg * side;
    const [x, z, heading] =
      leg === 0
        ? [m + u, m, Math.PI / 2]
        : leg === 1
          ? [size - m, m + u, 0]
          : leg === 2
            ? [size - m - u, size - m, -Math.PI / 2]
            : [m, size - m - u, Math.PI];
    points.push({ x, z, y: 0, s, heading, width: 12 });
  }
  return levelFrom(
    2,
    size,
    10,
    height,
    () => packedShare,
    points,
    length,
    400,
    0,
    { x: size / 2, z: 200, heading: 0 },
    [],
  );
}
