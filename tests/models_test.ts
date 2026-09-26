// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MACHINES AND RIDERS the game ships (`pwa/models/`, made by
// `make models`, packed by `pwa/models-plugin.ts`, drawn by
// `sled-models.ts`): every one committed, none older than the sources it is
// made from, each within its budget; the switches on unless a build turns
// one back; and every material the Blender builders name dressed as the
// builder's own machine would be. The names are stated twice — in
// `scripts/blender/*.py`, which cannot import a module of the game, and in
// `dressOf` — so the builders are read here as TEXT, the way
// `tauri_test.ts` reads the Rust.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { SLEDS } from "@engine";

import { MODELS_DIR, modelFiles, sourcesHash } from "../pwa/models-plugin.ts";
import { modelSwitch } from "../pwa/src/game/model-switch.ts";
import { dressOf } from "../pwa/src/game/sled-models.ts";
import { SLED_STYLES } from "../pwa/src/game/sled-body.ts";

const root = join(import.meta.dirname, "..");
const matNames = (file: string): string[] =>
  [
    ...readFileSync(join(root, "scripts", "blender", file), "utf8").matchAll(/= mat\("([\w]+)"/g),
  ].map((m) => m[1]);

describe("the models the game ships", () => {
  const all = modelFiles({ sleds: true, riders: true });

  it("are every machine under its id and one rider", () => {
    expect([...all].sort()).toEqual([...SLEDS.map((s) => `${s.id}.glb`), "rider.glb"].sort());
    expect(modelFiles({ sleds: false, riders: true })).toEqual(["rider.glb"]);
    expect(modelFiles({ sleds: false, riders: false })).toEqual([]);
  });

  it("are all committed, each within its budget", () => {
    for (const f of all) {
      const at = join(root, MODELS_DIR, f);
      expect(existsSync(at), `${MODELS_DIR}/${f} — run \`make models\``).toBe(true);
      // A machine's LOD0 is ~1.1 MB, the rider's ~0.5 MB: a model grown
      // past this is a builder that lost its game budget.
      expect(statSync(at).size, f).toBeLessThan(f === "rider.glb" ? 900_000 : 1_600_000);
    }
  });

  it("are no older than the sources they are made from", () => {
    const stamp = JSON.parse(readFileSync(join(root, MODELS_DIR, "sources.json"), "utf8")) as {
      sources: string;
    };
    expect(
      stamp.sources,
      "a source of the models moved since they were made — run `make models` and commit pwa/models/",
    ).toBe(sourcesHash(root));
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
