// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED CARD — what can be read of it without a browser: the spec sheet
// beside the machine (`sled-stats.ts`), the pick it writes into what the
// game remembers (`settings.ts`), and the link that names a machine for a
// visit (`url-params.ts`).

import { describe, expect, it } from "vitest";

import { SLED, SLEDS, sledById } from "@engine";

import { mergeSettings, freshSettings } from "../pwa/src/game/settings.ts";
import { powderOf, sledBars, sledFacts } from "../pwa/src/game/sled-stats.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

describe("the spec sheet", () => {
  it("quotes the catalog's own documented expectations as its figures", () => {
    for (const spec of SLEDS) {
      const facts = Object.fromEntries(sledFacts(spec).map((f) => [f.key, f.value]));
      expect(facts.top).toBe(spec.topSpeed);
      expect(facts.sprint).toBe(spec.accel0to100);
      expect(facts.power).toBeCloseTo(spec.powerKw * 1.341, 6);
    }
  });

  it("draws every bar between the floor and full, and fills it for the best machine", () => {
    const keys = sledBars(SLED).map((b) => b.key);
    for (const key of keys) {
      const values = SLEDS.map((s) => sledBars(s).find((b) => b.key === key)!.value);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0.3);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...values)).toBe(1);
      expect(Math.min(...values)).toBeCloseTo(0.3, 9);
    }
  });

  it("has no machine best everywhere, every specialist best at something, and the crossover in the middle of every band", () => {
    const keys = sledBars(SLED).map((b) => b.key);
    for (const spec of SLEDS) {
      const bars = sledBars(spec);
      const wins = bars.filter((b) => b.value === 1).length;
      const losses = bars.filter((b) => b.value < 0.3 + 1e-9).length;
      expect(wins, `${spec.id} is best at everything`).toBeLessThan(keys.length);
      if (spec.id === SLED.id) {
        expect(wins + losses, "the crossover is the middle of every band").toBe(0);
      } else {
        expect(wins, `${spec.id} is best at nothing`).toBeGreaterThan(0);
      }
    }
  });

  it("bills the mountain sled best in powder and the trail sled worst — the catalog's own claim", () => {
    const order = [...SLEDS].sort((a, b) => powderOf(b) - powderOf(a)).map((s) => s.id);
    expect(order[0]).toBe("mountain");
    expect(order[order.length - 1]).toBe("trail");
    expect(powderOf(SLED)).toBeCloseTo(1, 9);
  });
});

describe("the pick", () => {
  it("rides the crossover on a first visit", () => {
    expect(freshSettings().sled).toBe("crossover");
  });

  it("keeps a stored machine the catalog carries, and drops one it does not", () => {
    expect(mergeSettings({ sled: "mountain" }).sled).toBe("mountain");
    expect(mergeSettings({ sled: "hovercraft" }).sled).toBe(SLED.id);
    expect(mergeSettings({ sled: 3 }).sled).toBe(SLED.id);
  });

  it("names a machine the catalog can hand back", () => {
    for (const spec of SLEDS) expect(sledById(spec.id)).toBe(spec);
  });
});

describe("the link", () => {
  it("reads ?sled= for the visit, and nothing it does not carry", () => {
    expect(readParams("?sled=cross").sled).toBe("cross");
    expect(readParams("?sled=snowcat").sled).toBe(null);
    expect(readParams("").sled).toBe(null);
  });

  it("opens on the sled card with ?menu=sled", () => {
    expect(readParams("?menu=sled")).toMatchObject({ menu: true, page: "sled" });
  });
});
