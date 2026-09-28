// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MACHINES, RIDERS AND TREES the game ships (`pwa/models/`,
// made by `make models`, packed by `pwa/models-plugin.ts`, drawn by
// `sled-models.ts` and `tree-models.ts`): every one committed, none older
// than the sources it is made from, each within its budget; the switches on
// unless a build turns one back; and every material the Blender builders
// name dressed as the builder's own machine, or the region's tree, would
// be. The names are stated twice — in `scripts/blender/*.py`, which cannot
// import a module of the game, and in `dressOf` / `roleColours` — so the
// builders are read here as TEXT, the way `tauri_test.ts` reads the Rust.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { SLEDS, TREE_KINDS } from "@engine";

import { MODELS_DIR, TREE_SOURCES, modelFiles, sourcesHash } from "../pwa/models-plugin.ts";
import { modelSwitch } from "../pwa/src/game/model-switch.ts";
import { dressOf } from "../pwa/src/game/sled-models.ts";
import { SLED_STYLES } from "../pwa/src/game/sled-body.ts";

const root = join(import.meta.dirname, "..");
const matNames = (file: string): string[] =>
  [
    ...readFileSync(join(root, "scripts", "blender", file), "utf8").matchAll(/= mat\("([\w]+)"/g),
  ].map((m) => m[1]);

describe("the models the game ships", () => {
  const all = modelFiles({ sleds: true, riders: true, trees: true });

  it("are every machine under its id, one rider and every kind of tree", () => {
    expect([...all].sort()).toEqual(
      [
        ...SLEDS.map((s) => `${s.id}.glb`),
        "rider.glb",
        ...TREE_KINDS.map((k) => `trees/${k}.glb`),
      ].sort(),
    );
    expect(modelFiles({ sleds: false, riders: true, trees: false })).toEqual(["rider.glb"]);
    expect(modelFiles({ sleds: false, riders: false, trees: false })).toEqual([]);
  });

  it("are all committed, each within its budget", () => {
    for (const f of all) {
      const at = join(root, MODELS_DIR, f);
      expect(existsSync(at), `${MODELS_DIR}/${f} — run \`make models\``).toBe(true);
      // A machine's LOD0 is ~1.1 MB, the rider's ~0.5 MB, a kind of tree's
      // ten variants (packed) ~0.15 MB: a model grown past this is a
      // builder that lost its game budget.
      const budget = f.startsWith("trees/") ? 320_000 : f === "rider.glb" ? 900_000 : 1_600_000;
      expect(statSync(at).size, f).toBeLessThan(budget);
    }
  });

  it("are no older than the sources they are made from", () => {
    const stamp = JSON.parse(readFileSync(join(root, MODELS_DIR, "sources.json"), "utf8")) as {
      sources: string;
      trees: string;
    };
    expect(
      stamp.sources,
      "a source of the machines moved since they were made — run `make models` and commit pwa/models/",
    ).toBe(sourcesHash(root));
    expect(
      stamp.trees,
      "a source of the trees moved since they were made — run `make models SET=trees` and commit pwa/models/",
    ).toBe(sourcesHash(root, TREE_SOURCES));
  });
});

describe("the model switches", () => {
  it("are on unless a build turns one back", () => {
    for (const on of [undefined, "", "1", "on", "true", "yes"]) expect(modelSwitch(on)).toBe(true);
    for (const off of ["0", "off", "OFF", "false", "no", " 0 "])
      expect(modelSwitch(off)).toBe(false);
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
