// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRACK, ASKED: the two questions everything that rides, draws or
// measures a map puts to its loop — "where on the track is this point
// nearest?" and "where is the track this far along it?" — answered once,
// here, for the generator (the spawn, the forest), the analysis, the
// physics, the bot and the renderer alike.
//
// The loop is a few thousand two-metre segments, and the nearest-point
// question is asked every physics step for every rider, so it is answered
// off a spatial hash of the segments rather than by walking all of them.
// The hash is built lazily, the first time a loop is asked, and kept beside
// the points array it was built from (a WeakMap, so a dropped level takes
// its index with it). Everything here is read-only over the loop.

import { angleDiff, cellKey } from "../lib/math.ts";
import type { TrackHit, TrackPoint } from "./types.ts";

/** Anything carrying a closed loop: a finished `Level`, or the generator's
 * own loop before it is one. */
export type HasTrack = { readonly track: { readonly points: readonly TrackPoint[]; readonly length: number } };

/** Hash cell, m. Several segments to a cell and a handful of cells to a
 * query: the loop's own corridor fits inside one ring. */
const CELL = 24;

/** How many rings a query walks before it gives up on the hash and walks
 * the whole loop: past this the point is far off the map. */
const MAX_RINGS = 90;

type Index = { readonly cells: Map<number, number[]> };

const indices = new WeakMap<readonly TrackPoint[], Index>();

function indexOf(points: readonly TrackPoint[]): Index {
  let index = indices.get(points);
  if (index) return index;
  const cells = new Map<number, number[]>();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const c0 = Math.floor(Math.min(a.x, b.x) / CELL);
    const c1 = Math.floor(Math.max(a.x, b.x) / CELL);
    const r0 = Math.floor(Math.min(a.z, b.z) / CELL);
    const r1 = Math.floor(Math.max(a.z, b.z) / CELL);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const key = cellKey(c, r);
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  index = { cells };
  indices.set(points, index);
  return index;
}

/** Project (x, z) onto segment i → i+1, writing into `hit` if nearer. */
function trySegment(
  points: readonly TrackPoint[],
  length: number,
  i: number,
  x: number,
  z: number,
  hit: TrackHit,
): void {
  const n = points.length;
  const a = points[i];
  const b = points[(i + 1) % n];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = a.x + dx * t;
  const pz = a.z + dz * t;
  const d = Math.hypot(x - px, z - pz);
  if (d >= hit.distance) return;
  const sb = i + 1 === n ? length : b.s;
  const len = Math.sqrt(len2) || 1;
  // Right of travel is (cos h, −sin h) = (dz, −dx) / len.
  hit.index = i;
  hit.s = a.s + (sb - a.s) * t;
  hit.distance = d;
  hit.lateral = ((x - px) * dz - (z - pz) * dx) / len;
  hit.x = px;
  hit.z = pz;
}

/** WHERE ON THE TRACK IS THIS POINT NEAREST — the segment, the arc length,
 * the plan distance to the centreline and the signed lateral offset
 * (positive to the right of the direction of travel). Pass `out` to reuse
 * an object on a hot path. */
export function nearestTrackPoint(level: HasTrack, x: number, z: number, out?: TrackHit): TrackHit {
  const points = level.track.points;
  const length = level.track.length;
  const hit = out ?? { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
  hit.distance = Infinity;
  const { cells } = indexOf(points);
  const qc = Math.floor(x / CELL);
  const qr = Math.floor(z / CELL);
  for (let ring = 0; ring <= MAX_RINGS; ring++) {
    for (let dc = -ring; dc <= ring; dc++) {
      const edge = dc === -ring || dc === ring;
      for (let dr = -ring; dr <= ring; dr += edge ? 1 : 2 * ring) {
        const list = cells.get(cellKey(qc + dc, qr + dr));
        if (list) for (const i of list) trySegment(points, length, i, x, z, hit);
        if (ring === 0) break;
      }
    }
    // Every segment in the next ring out is at least `ring` whole cells
    // away, whatever corner of its own cell the query stands in.
    if (hit.distance <= ring * CELL) return hit;
  }
  for (let i = 0; i < points.length; i++) trySegment(points, length, i, x, z, hit);
  return hit;
}

/** WHERE IS THE TRACK `s` METRES ALONG IT: the centreline interpolated
 * between its two nearest points, the arc length wrapped onto the loop. */
export function trackPointAt(level: HasTrack, s: number, out?: TrackPoint): TrackPoint {
  const points = level.track.points;
  const length = level.track.length;
  const n = points.length;
  let u = s % length;
  if (u < 0) u += length;
  // Points are evenly spaced, so the guess is nearly always the answer.
  let i = Math.min(n - 1, Math.floor((u / length) * n));
  while (i > 0 && points[i].s > u) i--;
  while (i < n - 1 && points[i + 1].s <= u) i++;
  const a = points[i];
  const b = points[(i + 1) % n];
  const sb = i + 1 === n ? length : b.s;
  const t = sb > a.s ? (u - a.s) / (sb - a.s) : 0;
  const p = out ?? { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  p.x = a.x + (b.x - a.x) * t;
  p.z = a.z + (b.z - a.z) * t;
  p.y = a.y + (b.y - a.y) * t;
  p.s = u;
  p.heading = a.heading + angleDiff(a.heading, b.heading) * t;
  p.width = a.width + (b.width - a.width) * t;
  return p;
}

/** Arc distance from `a` to `b` going FORWARD round the loop, m (0..length). */
export function arcAhead(level: HasTrack, a: number, b: number): number {
  const L = level.track.length;
  const d = (b - a) % L;
  return d < 0 ? d + L : d;
}

/** Shortest arc distance between two stations either way round, m. */
export function arcBetween(level: HasTrack, a: number, b: number): number {
  const d = arcAhead(level, a, b);
  return Math.min(d, level.track.length - d);
}
