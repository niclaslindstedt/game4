// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIVERIES AND THE TRACED LOOKS — the data the machines are dressed and
// drawn from (`sled-liveries.ts`, `sled-looks.ts`), held to what the builder
// and the card assume: every machine sold in a handful of liveries, each
// pattern's decals inside the cowl's flank, the pick remembered per machine
// and nothing but a real one; and every traced look carried onto its spec
// without a stretch, its grips where the rider's hands can reach them.

import { describe, expect, it } from "vitest";
import { SLEDS, isSledId } from "@engine";

import { mergeSettings, withLivery, freshSettings } from "../pwa/src/game/settings.ts";
import { LIVERIES, PATTERNS, liveryOf } from "../pwa/src/game/sled-liveries.ts";
import { SLED_LOOKS, lookFrame } from "../pwa/src/game/sled-looks.ts";
import { MOUNTS } from "../pwa/src/game/rider-pose.ts";

describe("the liveries", () => {
  it("dress every machine in its own handful, no two alike", () => {
    for (const s of SLEDS) {
      const list = LIVERIES[s.id];
      expect(list.length).toBeGreaterThanOrEqual(3);
      const looks = new Set(list.map((l) => `${l.body}:${l.pattern}`));
      expect(looks.size).toBe(list.length);
      expect(new Set(list.map((l) => l.name)).size).toBe(list.length);
    }
    expect(Object.keys(LIVERIES).every(isSledId)).toBe(true);
  });

  it("lays every decal inside the cowl's flank", () => {
    for (const p of Object.values(PATTERNS)) {
      for (const decal of p.cowl) {
        expect(decal.length).toBeGreaterThanOrEqual(3);
        for (const [u, v] of decal) {
          expect(u).toBeGreaterThanOrEqual(-0.1);
          expect(u).toBeLessThanOrEqual(1.1);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1.1);
        }
      }
    }
  });

  it("hands back the machine's own livery for a pick out of range", () => {
    expect(liveryOf("fox", undefined)).toBe(LIVERIES.fox[0]);
    expect(liveryOf("fox", 99)).toBe(LIVERIES.fox[0]);
    expect(liveryOf("fox", 1)).toBe(LIVERIES.fox[1]);
  });

  it("remembers a pick per machine, and nothing but a real one", () => {
    expect(freshSettings().liveries).toEqual({});
    const s = withLivery(withLivery(freshSettings(), "hare", 2), "ibex", 1);
    expect(s.liveries).toEqual({ hare: 2, ibex: 1 });
    expect(mergeSettings(JSON.parse(JSON.stringify(s))).liveries).toEqual({ hare: 2, ibex: 1 });
    expect(
      mergeSettings({ liveries: { hare: 9, snowcat: 1, fox: 1.5, ibex: "2", stoat: 3 } }).liveries,
    ).toEqual({ stoat: 3 });
  });
});

describe("the traced looks", () => {
  it("carry every class's trace onto its machine without a stretch", () => {
    for (const s of SLEDS) {
      const F = lookFrame(s);
      expect(F.stretch, s.id).toBeGreaterThan(0.97);
      expect(F.stretch, s.id).toBeLessThan(1.03);
      // The traced ski centre lands on the physics' ski line, the idler on
      // the tread's end.
      expect(F.z(SLED_LOOKS[s.id].spindle[0][0])).toBeCloseTo(s.skiForward, 6);
      expect(F.z(SLED_LOOKS[s.id].idler.at[0])).toBeCloseTo(s.treadRear, 6);
    }
  });

  it("stand the grips where the rider's hands can reach them", () => {
    for (const s of SLEDS) {
      const [z, y] = lookFrame(s).point(SLED_LOOKS[s.id].grip);
      // The figure is carried by the difference; a big one is a rider
      // sitting off the seat.
      expect(Math.abs(z - MOUNTS.grip.z), s.id).toBeLessThan(0.4);
      expect(Math.abs(y - MOUNTS.grip.y), s.id).toBeLessThan(0.2);
    }
  });

  it("run the belt from its traced idler to past its traced front contact", () => {
    for (const s of SLEDS) {
      const look = SLED_LOOKS[s.id];
      const F = lookFrame(s);
      expect(s.treadFront).toBeGreaterThan(F.z(look.contact[1]));
      expect(s.treadFront).toBeLessThan(F.z(look.contact[1]) + 0.15);
    }
  });
});
