// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED'S SPEC SHEET — what the sled card tells a rider about the machine
// they are about to take out.
//
// Every number here is DERIVED from the catalog (`engine/game/defs/sled.ts`)
// and the engine's own models rather than authored beside them, so a sled
// retuned in the catalog reads correctly on the card without anyone
// remembering a second table exists. The figures are the catalog's own
// documented expectations (`topSpeed`, `accel0to100` — the pair
// `tests/sled_test.ts` holds the physics to) and its power, and the bars the catalog
// cannot put a number on are the engine's own answers: `cornerGrip` on the
// groomer, the footprint's float and paddle in powder (`footprintOf`), and
// the hardest landing a machine takes whole (`harshSpeedOf`) — the same
// arithmetic the physics and the bot run at 120 Hz.
//
// FIVE AXES, because the catalog is four answers to a kind of snow and the
// snow has two kinds: what it does on the GROOMER (pick-up, top end, the
// bend) and what it does OFF it (the powder, the landing). Every machine is
// best at something on this sheet and none is best at everything, which is
// the card's whole argument.
//
// The bars are RELATIVE TO THE ROSTER, not absolute: four sleds within a few
// percent of each other on an axis scaled from zero are four identical full
// bars, which is a picture of nothing. The roster's own spread is the scale,
// and `BAR_FLOOR` keeps the worst machine's bar a bar rather than an empty
// slot.
//
// DOM-free: `tests/sled_card_test.ts` reads it on plain Node.

import { SLEDS, cornerGrip, footprintOf, harshSpeedOf, type SledSpec } from "@engine";

import { STRINGS } from "./strings.ts";

/** Mechanical horsepower in a kilowatt — the unit a sled's engine is sold in. */
const HP_PER_KW = 1.341;

/** How much of the bar the roster's WORST machine on an axis still fills. */
const BAR_FLOOR = 0.3;

/** HOW WELL IT GOES IN POWDER, dimensionless: the lugs' paddle over the
 * footprint's sink. A tread that sinks less has less snow to push aside,
 * and one that paddles harder drives what it does push through — the two
 * multipliers `snow.ts` applies to the tread off the groomer, and exactly
 * 1 on the crossover. */
export function powderOf(spec: SledSpec): number {
  const fit = footprintOf(spec);
  return fit.powderDrive / fit.sink;
}

type AxisKey = keyof typeof STRINGS.sledBars;
type Axis = { key: AxisKey; of: (spec: SledSpec) => number };

/** The axes a sled is billed on, in the order they are drawn: the groomer
 * first, then what is off it. */
const AXES: readonly Axis[] = [
  // Quicker is better, so the bar reads the reciprocal of the time.
  { key: "accel", of: (spec) => 1 / spec.accel0to100 },
  { key: "top", of: (spec) => spec.topSpeed },
  { key: "corner", of: (spec) => cornerGrip(spec, 1) },
  { key: "powder", of: powderOf },
  { key: "landing", of: harshSpeedOf },
];

export type SledBar = {
  key: string;
  label: string;
  /** BAR_FLOOR..1 — where this machine sits between the roster's worst and
   * best on the axis. Never 0: an empty bar reads as a missing value. */
  value: number;
};

/** Where every axis of one machine sits against the rest of the roster. */
export function sledBars(spec: SledSpec): SledBar[] {
  return AXES.map((axis) => {
    const all = SLEDS.map(axis.of);
    const low = Math.min(...all);
    const high = Math.max(...all);
    // A roster of one, or an axis every machine shares, is a full bar
    // rather than a division by zero.
    const share = high > low ? (axis.of(spec) - low) / (high - low) : 1;
    return {
      key: axis.key,
      label: STRINGS.sledBars[axis.key],
      value: BAR_FLOOR + (1 - BAR_FLOOR) * share,
    };
  });
}

export type SledFact = {
  key: string;
  label: string;
  /** The figure ITSELF, not a rendered string: the card counts to it when
   * the machine changes (`lib/count.ts`), and a counter cannot interpolate
   * "160 KM/H". */
  value: number;
  /** How many decimals it is read to. */
  places: number;
  unit: string;
};

/** The hard numbers, as figures rather than bars — the documented
 * expectations the physics is held to, so the card and the suite quote one
 * source, and the engine's power, which is the one figure a rider reads off
 * a snowmobile before any other. */
export function sledFacts(spec: SledSpec): SledFact[] {
  const F = STRINGS.sledFacts;
  const U = STRINGS.sledUnits;
  return [
    { key: "top", label: F.top, value: spec.topSpeed, places: 0, unit: U.speed },
    { key: "sprint", label: F.sprint, value: spec.accel0to100, places: 1, unit: U.seconds },
    { key: "power", label: F.power, value: spec.powerKw * HP_PER_KW, places: 0, unit: U.power },
  ];
}
