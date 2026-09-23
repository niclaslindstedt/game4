// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where the sun's shadow stands, and which trees cast into it
// (`pwa/src/game/shadow-box.ts`).

import { describe, expect, it } from "vitest";

import {
  aimShadow,
  castsInto,
  SHADOW_AHEAD,
  SHADOW_MARGIN,
  SHADOW_TAIL,
  shadowFade,
  shadowLength,
  type ShadowBox,
} from "../pwa/src/game/shadow-box.ts";
import { SHADOW_LEVELS, SHADOW_LOOK } from "../pwa/src/game/settings-video.ts";

/** A box at the origin, reach 60, the sun `elevation` rad up in the +x
 * quarter (so shadows fall toward −x). */
function boxAt(elevation: number, reach = 60): ShadowBox {
  return {
    x: 0,
    y: 0,
    z: 0,
    reach,
    sx: Math.cos(elevation),
    sy: Math.sin(elevation),
    sz: 0,
  };
}

describe("the shadow box (shadow-box.ts)", () => {
  it("stands ahead of the lens, along its look in plan", () => {
    const box = aimShadow(boxAt(0.3), 100, 50, 0, 2, 60);
    expect(box.x).toBeCloseTo(100);
    expect(box.z).toBeCloseTo(50 + SHADOW_AHEAD * 60);
    // A lens looking straight down keeps its own spot.
    const down = aimShadow(boxAt(0.3), 100, 50, 0, 0, 60);
    expect([down.x, down.z]).toEqual([100, 50]);
  });

  it("fades out over the rim, never before the lens", () => {
    for (const level of SHADOW_LEVELS) {
      const { reach } = SHADOW_LOOK[level];
      if (reach === 0) continue;
      const [inner, outer] = shadowFade(reach);
      expect(inner).toBeLessThan(outer);
      expect(outer).toBe(reach);
      // The lens stands SHADOW_AHEAD reaches behind the centre: whole there.
      expect(SHADOW_AHEAD * reach).toBeLessThan(inner);
      expect(SHADOW_MARGIN).toBeGreaterThan(0);
    }
  });

  it("throws a longer shadow the lower the sun, capped", () => {
    expect(shadowLength(boxAt(Math.PI / 4), 10)).toBeCloseTo(10);
    expect(shadowLength(boxAt(0.2), 10)).toBeGreaterThan(40);
    expect(shadowLength(boxAt(0.001), 10)).toBe(SHADOW_TAIL * 60);
    // A sun overhead throws none.
    expect(shadowLength({ ...boxAt(0), sx: 0, sy: 1 }, 10)).toBe(0);
  });

  it("casts every tree whose shadow reaches the circle, and no other", () => {
    const box = boxAt(Math.atan(1 / 2)); // shadows twice the tree's height
    // Inside the circle, whichever way.
    expect(castsInto(box, 30, 30, 10, 2)).toBe(true);
    // Up-sun past the rim, its 20 m shadow reaching back in.
    expect(castsInto(box, 75, 0, 10, 2)).toBe(true);
    // Up-sun too far for its shadow to arrive.
    expect(castsInto(box, 90, 0, 10, 2)).toBe(false);
    // Down-sun past the rim: its shadow falls away from the circle.
    expect(castsInto(box, -70, 0, 10, 2)).toBe(false);
    // Across the sun, past the rim.
    expect(castsInto(box, 0, 70, 10, 2)).toBe(false);
  });
});

describe("the shadow's fade, grafted into every world material (haze.ts)", () => {
  it("wraps the directional light's shadow, and only it, in shadowFaded", async () => {
    const { lightsWithFade } = await import("../pwa/src/game/haze.ts");
    const chunk = lightsWithFade();
    expect(chunk.match(/shadowFaded\(/g)?.length).toBe(1);
    expect(chunk).toContain("shadowFaded( getShadow( directionalShadowMap[ i ]");
  });
});
