// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS A BUILD PACKS, when it is asked to (`VITE_MODEL_SLEDS=1`,
// `VITE_MODEL_RIDERS=1` — in the environment or the root `.env`): every
// machine's game-quality glTF as `models/<id>.glb` and the rider's as
// `models/rider.glb`, emitted into the bundle (so the service worker
// precaches them with everything else) and served the same way by the dev
// server. They are made by `make models` into the gitignored
// `previews/blender/` and are never committed; a build that asks for one
// that has not been made FAILS, naming the make target, rather than
// shipping a game that quietly draws the code's machine.
//
// Off (the default), this plugin does nothing and the build is the one the
// game always had: no asset files at all.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

import { SLEDS } from "../engine/game/defs/sled.ts";

export type ModelSwitches = { sleds: boolean; riders: boolean };

/** Every file a build with these switches packs: its published name and
 * where `make models` leaves it. */
export function modelFiles(on: ModelSwitches, from: string): { name: string; path: string }[] {
  const files: { name: string; path: string }[] = [];
  if (on.sleds) {
    for (const s of SLEDS)
      files.push({ name: `${s.id}.glb`, path: join(from, `${s.id}-lod0.glb`) });
  }
  if (on.riders) files.push({ name: "rider.glb", path: join(from, "rider0-lod0.glb") });
  return files;
}

export function sledModels(on: ModelSwitches, from: string): Plugin {
  const files = modelFiles(on, from);
  const missing = () => files.filter((f) => !existsSync(f.path));
  return {
    name: "sled-models",
    buildStart() {
      const gone = missing();
      if (gone.length) {
        this.error(
          `${gone.map((f) => f.path).join(", ")} has not been made, and this build is asked to ` +
            "draw it (VITE_MODEL_SLEDS / VITE_MODEL_RIDERS) — run `make models` (it needs Blender), " +
            "or turn the switch off",
        );
      }
    },
    generateBundle() {
      for (const f of files) {
        this.emitFile({
          type: "asset",
          fileName: `models/${f.name}`,
          source: readFileSync(f.path),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = /\/models\/([\w-]+\.glb)$/.exec(req.url ?? "")?.[1];
        const f = name && files.find((x) => x.name === name);
        if (!f || !existsSync(f.path)) return next();
        res.setHeader("Content-Type", "model/gltf-binary");
        res.end(readFileSync(f.path));
      });
    },
  };
}
