// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A REGION IS GRADED — the cast over the WHOLE picture, per kind of
// snow country (R21). The sibling jet-ski game's per-coast grade, ported.
//
// Every other per-region table in this app paints one thing: the ground's
// tones (`region-look.ts`), the trees'. This one paints none of them and all
// of them: it is the grade laid over the finished frame, the way a
// television series is graded rather than lit — one pass at the end, on the
// picture as a whole, after every material in it has been shaded by a sky
// that knows nothing about it. The high country wants its shadows a deep
// altitude blue under a hard white sun; the tundra wants the colour drained
// out of a flat steel-grey world; the birch valley wants the low gold of a
// late-winter afternoon over grey-green darks.
//
// THE BOREAL IS NEUTRAL. The boreal forest is the country every material,
// every sky and every tone in this game was authored against, so its row is
// the identity and the renderer draws no pass at all for it (`isNeutral`):
// the map everybody has always ridden looks and costs exactly what it did.
//
// THE GRADE IS APPLIED TO THE TONE-MAPPED PICTURE (`grade-pass.ts` is the
// GLSL half): the scene is drawn in linear HDR, the pass tone-maps it with
// the renderer's own curve and then grades it — a colourist grades the
// display image, not the light that made it. The CONTRAST and the LIFT are
// applied in a PERCEPTUAL coordinate (sqrt, gamma 2 against sRGB's 2.2 —
// close enough that the difference is not a colour anybody can name),
// because in linear light a straight contrast is not one: mid grey sits at
// 0.18, and a gain about it crushes the darks and runs the glare away.
//
// THE THREE COLOURS ARE NORMALISED BY THEIR OWN LUMINANCE, so a grade shifts
// the picture's BALANCE and never its exposure: `#e4e8f2` says "cool and a
// little steel", and how bright the hex is says nothing at all.
//
// Kept free of three.js so the suite reads it: `gradeTone` IS the model, and
// `grade-pass.ts`'s fragment shader restates the same five steps in GLSL.
// Change one, change both — `tests/region_test.ts` holds the shader to the
// model as text.

import type { RegionId } from "@engine";

/** ONE REGION'S GRADE — seven dials, in the order they are applied. The
 * three colours are sRGB hexes whose HUE is what is authored. */
export type ColourGrade = {
  /** How hard the picture is about mid grey, perceptual: 1 untouched. */
  readonly contrast: number;
  /** How far off the floor the blacks sit, 0..1 — the air in the shadows. */
  readonly lift: number;
  /** How much colour is left, 1 untouched. */
  readonly saturation: number;
  /** The cast over everything. */
  readonly tint: string;
  /** What the darks and the lights are pulled toward, and how far (0..1
   * each, `split`) — the split tone. */
  readonly shade: string;
  readonly glow: string;
  readonly split: readonly [number, number];
};

/** Mid grey in the perceptual coordinate — `sqrt(0.18)`. */
export const MID_P = Math.sqrt(0.18);

/** The grade that changes nothing. */
export const NEUTRAL_GRADE: ColourGrade = {
  contrast: 1,
  lift: 0,
  saturation: 1,
  tint: "#ffffff",
  shade: "#ffffff",
  glow: "#ffffff",
  split: [0, 0],
};

/** Every region's grade. */
export const COLOUR_GRADES: Readonly<Record<RegionId, ColourGrade>> = {
  // THE BOREAL FOREST: the picture as authored.
  boreal: NEUTRAL_GRADE,
  // THE HIGH ALPINE, graded the way thin air photographs: hard and bright,
  // the blacks on the floor (there is no air up there to lift them with),
  // a deep altitude blue in every shadow a cornice or a bowl throws, and a
  // clean warm white on what the sun is on. The snow must stay WHITE: the
  // glow is barely off neutral, or a sunlit face reads as sand.
  alpine: {
    contrast: 1.08,
    lift: 0,
    saturation: 1.06,
    tint: "#fbfcff",
    shade: "#3a66ae",
    glow: "#fff3e0",
    split: [0.13, 0.08],
  },
  // THE TUNDRA PLATEAU, graded flat and drained: a world with no midtones
  // in it — white ground, white sky, a line of grey hills — pulled toward a
  // cold steel with the shadows lifted by the blowing snow in the air. The
  // flattest and the most drained of the four; the sleds' own colours are
  // what survive it, which is what a rider reads the field by out there.
  tundra: {
    contrast: 0.93,
    lift: 0.028,
    saturation: 0.72,
    tint: "#e6eaf3",
    shade: "#66748f",
    glow: "#eef0f6",
    split: [0.24, 0.1],
  },
  // THE BIRCH VALLEY, graded soft and warm: a late-winter afternoon down a
  // river valley — gold in the lights, the pale bark and the low sun on the
  // ice, and a grey-green in the darks under the birches. Softer than the
  // boreal's authored picture, a touch drained so the gold reads as light
  // rather than as paint.
  birch: {
    contrast: 0.97,
    lift: 0.014,
    saturation: 0.92,
    tint: "#fcf9f3",
    shade: "#5c7470",
    glow: "#ffe6c0",
    split: [0.18, 0.17],
  },
};

/** The grade for a region. */
export function gradeOf(region: RegionId): ColourGrade {
  return COLOUR_GRADES[region] ?? NEUTRAL_GRADE;
}

/** Whether a grade changes nothing — the renderer then draws no pass. */
export function isNeutral(grade: ColourGrade): boolean {
  const white = (hex: string): boolean => hex.toLowerCase() === "#ffffff";
  return (
    grade.contrast === 1 &&
    grade.lift === 0 &&
    grade.saturation === 1 &&
    white(grade.tint) &&
    (grade.split[0] === 0 || white(grade.shade)) &&
    (grade.split[1] === 0 || white(grade.glow))
  );
}

/** One sRGB channel, 0..1, to linear light. */
function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** One linear channel back to sRGB, 0..1, clamped. */
function toSrgb(c: number): number {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** Rec. 709 luminance of three linear channels — the shader's weights. */
function lumaOf(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A packed sRGB colour as three linear channels. */
function unpack(hex: number, out: [number, number, number]): [number, number, number] {
  out[0] = toLinear(((hex >> 16) & 0xff) / 255);
  out[1] = toLinear(((hex >> 8) & 0xff) / 255);
  out[2] = toLinear((hex & 0xff) / 255);
  return out;
}

/** A GRADE'S COLOUR with its brightness divided out — the three linear
 * channels the shader multiplies by. Pure black, which cannot be
 * normalised, comes back as white: the identity. */
export function gradeColour(hex: string, out: [number, number, number]): [number, number, number] {
  unpack(Number.parseInt(hex.replace("#", ""), 16), out);
  const l = lumaOf(out[0], out[1], out[2]);
  if (l <= 0) {
    out[0] = out[1] = out[2] = 1;
    return out;
  }
  out[0] /= l;
  out[1] /= l;
  out[2] /= l;
  return out;
}

/** ONE TONE-MAPPED PIXEL, GRADED — linear channels in (0..1, as they leave
 * the tone mapper), linear channels out. The model the pass restates. */
export function gradeLinear(
  grade: ColourGrade,
  rgb: readonly [number, number, number],
): [number, number, number] {
  const c: [number, number, number] = [rgb[0], rgb[1], rgb[2]];
  const tint = gradeColour(grade.tint, [0, 0, 0]);
  const shadeC = gradeColour(grade.shade, [0, 0, 0]);
  const glowC = gradeColour(grade.glow, [0, 0, 0]);
  // THE CONTRAST, then THE LIFT, perceptual; clamped, because a contrast
  // over 1 takes the coordinate negative in the darks and squaring a
  // negative lifts the black it was meant to crush.
  for (let i = 0; i < 3; i++) {
    const s = MID_P + (Math.sqrt(Math.max(c[i], 0)) - MID_P) * grade.contrast;
    const lifted = Math.max(s + grade.lift * (1 - s), 0);
    c[i] = lifted * lifted;
  }
  // THE SATURATION about the pixel's own light, clamped.
  const l = lumaOf(c[0], c[1], c[2]);
  for (let i = 0; i < 3; i++) c[i] = Math.max(l + (c[i] - l) * grade.saturation, 0);
  // THE CAST.
  for (let i = 0; i < 3; i++) c[i] *= tint[i];
  // THE SPLIT, weighted by the graded pixel's light, perceptual.
  const w = Math.min(1, Math.max(0, Math.sqrt(Math.max(lumaOf(c[0], c[1], c[2]), 0))));
  const shade = grade.split[0] * (1 - w);
  const glow = grade.split[1] * w;
  for (let i = 0; i < 3; i++) {
    c[i] *= 1 - shade + shade * shadeC[i];
    c[i] *= 1 - glow + glow * glowC[i];
  }
  return c;
}

/** The model on a hex: a packed sRGB colour in, a packed sRGB colour out —
 * how a grade is argued about in a test. */
export function gradeTone(grade: ColourGrade, hex: number): number {
  const c = gradeLinear(grade, unpack(hex, [0, 0, 0]));
  const byte = (v: number): number => Math.round(toSrgb(v) * 255);
  return (byte(c[0]) << 16) | (byte(c[1]) << 8) | byte(c[2]);
}
