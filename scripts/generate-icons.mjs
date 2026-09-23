#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Generates the PWA install icons and the favicon from the same geometry
// as pwa/public/icons/icon.svg — a sled's two trails curving over a hill: a
// snowfield under a clear sky with a shadowed ridge behind it, the two
// parallel trails climbing from the lower left over the crest and down into
// the dip, and a red checkpoint flag on the hill. Pure Node (the shared
// lib/png.mjs encoder), so the pipeline needs no native image dependencies.
// Rerun with `npm run icons` / `make icons` after changing the mark, and keep
// icon.svg and pwa/src/game/app-mark.ts in lockstep.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { encodePng } from "./lib/png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "pwa", "public", "icons");
mkdirSync(iconsDir, { recursive: true });

// Palette — mirrors PALETTE in pwa/src/identity.ts and the SVG's fills.
const SKY_TOP = [111, 168, 220]; // #6fa8dc skyHigh
const SKY_BOT = [207, 230, 247]; // #cfe6f7 sky
const SNOW = [244, 248, 251]; // #f4f8fb snow
const RIDGE = [185, 205, 224]; // #b9cde0 snowShadow
const TRAIL = [111, 168, 220]; // #6fa8dc skyHigh
const FLAG = [232, 65, 44]; // #e8412c flag
const INK = [13, 34, 51]; // #0d2233 hudShadow

// --- geometry in the SVG's 512-unit space -----------------------------------
// The ground: the ridge behind and the hill in front, each a circle whose
// top edge is the skyline.
const RIDGE_HILL = { cx: 420, cy: 520, r: 330 };
const HILL = { cx: 256, cy: 560, r: 330 };

// Each trail is two circular arcs joined tangentially where the crest gives
// way to the dip (356, 286.79 on the outer trail). The turn REVERSES there —
// the dip's centre is on the crest's radial through that point but on the
// far side of it — so a trail at radius +d on the crest is at −d on the dip.
const TRAIL_W = 11; // half width of one trail
const ARCS = [
  { cx: 256, cy: 460, r: 200, from: 205, to: 300 },
  { cx: 416, cy: 182.87, r: 120, from: 80, to: 120 },
];
// The two trails: the outer one on the spine, the inner one 36 in from it on
// the crest — and so 36 OUT from it on the dip.
const LINES = [
  { offsets: [0, 0], color: TRAIL },
  { offsets: [-36, 36], color: TRAIL },
];
// Round caps at each trail's two ends, so a stroke does not end on a chisel.
const CAPS = [
  { arc: 0, deg: 205 },
  { arc: 1, deg: 80 },
];

// The flag: a pole and a pennant, as the SVG's rect and polygon.
const POLE = { x0: 144, y0: 126, x1: 154, y1: 252 };
const PENNANT = [
  [154, 128],
  [226, 152],
  [154, 176],
];

function skyAt(v) {
  const t = Math.max(0, Math.min(1, v));
  return [
    SKY_TOP[0] + (SKY_BOT[0] - SKY_TOP[0]) * t,
    SKY_TOP[1] + (SKY_BOT[1] - SKY_TOP[1]) * t,
    SKY_TOP[2] + (SKY_BOT[2] - SKY_TOP[2]) * t,
  ];
}

/** Is 512-space point (x, y) inside the triangle `tri`? */
function inTriangle(tri, x, y) {
  let sign = 0;
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = tri[i];
    const [bx, by] = tri[(i + 1) % 3];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Is 512-space point (x, y) on one of the trails? Returns its colour. */
function trailAt(x, y) {
  for (let a = 0; a < ARCS.length; a++) {
    const arc = ARCS[a];
    const r = Math.hypot(x - arc.cx, y - arc.cy);
    let deg = (Math.atan2(y - arc.cy, x - arc.cx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (deg < arc.from || deg > arc.to) continue;
    for (const line of LINES) {
      if (Math.abs(r - (arc.r + line.offsets[a])) <= TRAIL_W) return line.color;
    }
  }
  for (const cap of CAPS) {
    const arc = ARCS[cap.arc];
    const a = (cap.deg * Math.PI) / 180;
    for (const line of LINES) {
      const rr = arc.r + line.offsets[cap.arc];
      const cx = arc.cx + rr * Math.cos(a);
      const cy = arc.cy + rr * Math.sin(a);
      if (Math.hypot(x - cx, y - cy) <= TRAIL_W) return line.color;
    }
  }
  return null;
}

/** Color of the mark at 512-space point (x, y), or null for the sky. */
function markAt(x, y) {
  // Top to bottom of the SVG's painting order, read backwards: the flag over
  // the trails over the hill over the ridge.
  if (inTriangle(PENNANT, x, y)) return FLAG;
  if (x >= POLE.x0 && x <= POLE.x1 && y >= POLE.y0 && y <= POLE.y1) return INK;
  const trail = trailAt(x, y);
  if (trail) return trail;
  if (Math.hypot(x - HILL.cx, y - HILL.cy) <= HILL.r) return SNOW;
  if (Math.hypot(x - RIDGE_HILL.cx, y - RIDGE_HILL.cy) <= RIDGE_HILL.r) return RIDGE;
  return null;
}

/** Where inside a pixel the renderers sample — a 2x2 supersample, for edges
 * that are soft rather than staircased. */
const SAMPLES = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

/** Render the mark at `size`, with the geometry scaled by `inset` toward the
 * center (maskable icons keep the mark inside the safe zone). */
function renderIcon(size, inset = 1) {
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [ox, oy] of SAMPLES) {
        const u = ((x + ox) / size - 0.5) / inset + 0.5;
        const v = ((y + oy) / size - 0.5) / inset + 0.5;
        const px = u * 512;
        const py = v * 512;
        const mark = px >= 0 && px < 512 && py >= 0 && py < 512 ? markAt(px, py) : null;
        const c = mark ?? skyAt(v);
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const o = (y * size + x) * 3;
      rgb[o] = r / 4;
      rgb[o + 1] = g / 4;
      rgb[o + 2] = b / 4;
    }
  }
  return encodePng(size, size, rgb);
}

/** Wrap one PNG in an ICO container (valid since Vista). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header[6] = size < 256 ? size : 0;
  header[7] = size < 256 ? size : 0;
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

// THE MASTER RASTER — the mark at the largest size any store asks for, and
// the one file the SHELLS will derive their own icon sets from when they
// arrive (a shell imports the core, never another shell, so the
// full-resolution mark lives here, in the website's own icon directory,
// where both of them will look). Not in the manifest: nothing serves it to a
// browser, and an install icon above 512 buys nothing.
writeFileSync(join(iconsDir, "icon-1024.png"), renderIcon(1024));
writeFileSync(join(iconsDir, "pwa-192.png"), renderIcon(192));
writeFileSync(join(iconsDir, "pwa-512.png"), renderIcon(512));
writeFileSync(join(iconsDir, "pwa-512-maskable.png"), renderIcon(512, 0.78));
writeFileSync(join(iconsDir, "apple-touch-icon-180.png"), renderIcon(180));
writeFileSync(join(root, "pwa", "public", "favicon.ico"), pngToIco(renderIcon(32), 32));

console.log("icons: icon-1024, pwa-192, pwa-512, pwa-512-maskable, apple-touch-180, favicon.ico");
