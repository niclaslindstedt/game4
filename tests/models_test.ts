// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MACHINES AND RIDERS in the game (`sled-models.ts`, packed by
// `pwa/models-plugin.ts` when `VITE_MODEL_SLEDS` / `VITE_MODEL_RIDERS` ask):
// off by default, every machine packed under its id when on, and every
// material the Blender builders name dressed as the builder's own machine
// would be. The names are stated twice — in `scripts/blender/*.py`, which
// cannot import a module of the game, and in `dressOf` — so the builders
// are read here as TEXT, the way `tauri_test.ts` reads the Rust.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { SLEDS } from "@engine";

import { modelFiles } from "../pwa/models-plugin.ts";
import { dressOf, MODELS } from "../pwa/src/game/sled-models.ts";
import { SLED_STYLES } from "../pwa/src/game/sled-body.ts";

const root = join(import.meta.dirname, "..");
const matNames = (file: string): string[] =>
  [
    ...readFileSync(join(root, "scripts", "blender", file), "utf8").matchAll(/= mat\("([\w]+)"/g),
  ].map((m) => m[1]);

describe("the model switches", () => {
  it("are off unless a build turns them on", () => {
    expect(MODELS).toEqual({ sleds: false, riders: false });
    expect(modelFiles({ sleds: false, riders: false }, "x")).toEqual([]);
  });

  it("pack every machine under its id and one rider, from `make models`' output", () => {
    const files = modelFiles({ sleds: true, riders: true }, "previews/blender");
    expect(files.map((f) => f.name).sort()).toEqual(
      [...SLEDS.map((s) => `${s.id}.glb`), "rider.glb"].sort(),
    );
    for (const f of files) expect(f.path).toMatch(/-lod0\.glb$/);
  });
});

describe("a model's dress", () => {
  const style = SLED_STYLES[1];

  it("reads every name it dresses off the builders' own materials", () => {
    const sled = new Set(matNames("sled.py"));
    const rider = new Set(matNames("rider.py"));
    for (const n of ["paint", "white", "seat", "spring", "lamp", "taillight", "screen"]) {
      expect(sled.has(n), `sled.py names "${n}"`).toBe(true);
    }
    for (const n of ["jacket", "accent", "pants", "helmet", "peak", "lens"]) {
      expect(rider.has(n), `rider.py names "${n}"`).toBe(true);
    }
  });

  it("paints a machine in its style and lights it with the builder's lenses", () => {
    expect(dressOf("paint", style, null)).toEqual({ colour: style.body });
    expect(dressOf("white", style, null)).toEqual({ colour: style.accent });
    expect(dressOf("lamp", style, null)).toEqual({ shared: "lamp" });
    expect(dressOf("taillight", style, null)).toEqual({ shared: "tail" });
    expect(dressOf("screen", style, null)).toEqual({ shared: "glass" });
    expect(dressOf("rubber", style, null)).toBeNull();
  });

  it("dresses a rider in the slot's kit", () => {
    const kit = style.rider;
    expect(dressOf("jacket", null, kit)).toEqual({ colour: kit.jacket });
    expect(dressOf("pants", null, kit)).toEqual({ colour: kit.pants });
    expect(dressOf("helmet", null, kit)).toEqual({ colour: kit.helmet });
    expect(dressOf("lens", null, kit)).toEqual({ colour: kit.visor });
    expect(dressOf("paint", null, kit)).toBeNull();
  });
});
