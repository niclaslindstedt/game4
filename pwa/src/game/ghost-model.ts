// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST AS DRAWN: the recording's sled and rider (`ghost-run.ts`), built
// by the very builder every machine on the grid is (`sled-body.ts`) off the
// recording's own spec, in a pale livery and SEE-THROUGH — every material
// the builder asks for is handed back translucent — casting no shadow, and
// leaving NO TRAIL: the renderer stamps the trail map from the runs it is
// racing and never from this one, since a picture of a run that already
// happened may not mark the snow of the one being ridden. It throws no
// spray for the same reason.
//
// Posed between two steps the way every rider is (`interp.ts`), off the
// ghost's own `GameState`, which the rig steps beside the player's.

import * as THREE from "three";
import type { GameState, SledSpec } from "@engine";

import { createTrack, observe, sample, type Pose, type PoseTrack } from "./interp.ts";
import { createSledModel, type SledModel, type SledStyle } from "./sled-body.ts";

/** How much of the ghost is drawn: enough to read at chase range, little
 * enough that it never reads as a rival. */
export const GHOST_OPACITY = 0.38;

/** A pale machine and a pale rider: a ghost is a shape, not a livery. */
const GHOST_STYLE: SledStyle = {
  body: 0xcfe6ff,
  accent: 0xffffff,
  rider: { jacket: 0xdcecff, pants: 0xb8cce0, helmet: 0xffffff, visor: 0x8aa4c0 },
};

export type GhostModel = {
  /** Draw `run` at `alpha` of a step on — or nothing, for null. */
  draw(run: GameState | null, alpha: number): void;
  dispose(): void;
};

export function createGhostModel(
  scene: THREE.Scene,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): GhostModel {
  let model: SledModel | null = null;
  let spec: SledSpec | null = null;
  let shown: GameState | null = null;
  let track: PoseTrack = createTrack();
  const drawn: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };

  const see = <M extends THREE.Material>(m: M, name: string): M => {
    m.transparent = true;
    m.opacity *= GHOST_OPACITY;
    return wrap(m, `ghost-${name}`);
  };

  const drop = (): void => {
    if (!model) return;
    scene.remove(model.root);
    model.dispose();
    model = null;
    spec = null;
  };

  return {
    draw(run, alpha) {
      if (!run) {
        if (model) model.root.visible = false;
        shown = null;
        return;
      }
      if (spec !== run.sled.spec) {
        drop();
        spec = run.sled.spec;
        model = createSledModel(spec, GHOST_STYLE, see);
        model.root.name = "ghost";
        model.root.traverse((o) => {
          o.castShadow = false;
          o.receiveShadow = false;
        });
        scene.add(model.root);
      }
      if (run !== shown || run.tick === 0) track = createTrack();
      shown = run;
      const m = model!;
      m.root.visible = true;
      observe(track, run.sled, run.tick);
      sample(track, alpha, drawn);
      m.pose(run.sled, drawn, 0, null, 1 / 60);
    },
    dispose: drop,
  };
}
