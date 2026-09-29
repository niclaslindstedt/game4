// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SCREENSHOTS — the part of taking a picture that is this game's: the
// caption a picture is filed under and the file name it leaves the game as.
//
// The arithmetic under the shutter — the roll capped and newest first, the
// stamp a signature at every size, a picture never blown UP, the HUD layer
// as one SVG — is the framework's (`@niclaslindstedt/oss-game-framework/
// shots`), and its own suite holds it. What needs a canvas or a document is
// judged by LOOKING, with `make screenshots`.

import { describe, expect, it } from "vitest";

import { shotFileName } from "@niclaslindstedt/oss-game-framework/shots/shot-plan";

import { STRINGS } from "../pwa/src/game/strings.ts";

describe("the caption (run-news.ts's shotLabel, strings-gallery.ts)", () => {
  it("names the map, the lap, the speed and the sled", () => {
    const label = STRINGS.shotLabel({ seed: 38, lap: 2, laps: 3, kmh: 94.4, sled: "Trail" });
    expect(label).toBe("SEED 38 · LAP 2/3 · 94 KM/H · TRAIL");
  });

  it("says FREE RIDE where there is no lap to count", () => {
    const label = STRINGS.shotLabel({ seed: 7, lap: null, laps: 1, kmh: 12, sled: "Cross" });
    expect(label).toBe("SEED 7 · FREE RIDE · 12 KM/H · CROSS");
  });

  it("slugs into a file name that still reads", () => {
    const label = STRINGS.shotLabel({ seed: 38, lap: 1, laps: 3, kmh: 60, sled: "Mountain" });
    expect(shotFileName("PowderRun", label, Date.UTC(2026, 0, 1))).toBe(
      "powderrun-seed-38-lap-1-3-60-km-h-mountain-2026-01-01-00-00-00.png",
    );
  });
});
