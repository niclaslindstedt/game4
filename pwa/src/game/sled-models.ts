// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MACHINES AND RIDERS the game draws: glTFs made in Blender off
// the game's own data (`make models`, committed in `pwa/models/` and held
// fresh against their sources by `tests/models_test.ts`) and packed by
// every build (`pwa/models-plugin.ts`) — unless a build is switched back to
// the code-built ones (`VITE_MODEL_SLEDS=0`, `VITE_MODEL_RIDERS=0`;
// `model-switch.ts`). Nothing else changes: the code machine is still
// built, still posed, still the one the lamps, the bound, the thrown rider
// and every reader of a `SledModel` know; its drawn parts are only
// collapsed out of the merged draw, and the model — skinned on the rig
// `make blender` gave it — is posed off the same readings beside it:
//
//   a machine   its rig (`sled-rig.ts`) posed off the engine's state, the
//               drawn furrow's sink and the belt's run; dressed in the
//               machine's style (the paint, the trim, the seat, the
//               springs) — the livery's pattern is the code machine's only;
//               its lenses the code machine's own lit lamps and glass, so
//               the lamps come up at dusk and the tail burns on the brake
//   a rider     his bones (`rider-rig.ts`) set to the pose the figure is
//               hung on — on the machine or thrown — in the slot's kit
//
// Loaded once, before the renderer's kit is handed out (`use-render-kit.ts`),
// so every builder finds them waiting; a model that fails to load leaves
// that machine or rider to the code.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SLEDS, type SledId, type SledSpec, type SledState } from "@engine";

import { rigRider } from "./rider-rig.ts";
import type { RiderPose } from "./rider-pose.ts";
import type { RiderStyle } from "./rider.ts";
import { modelSwitch } from "./model-switch.ts";
import { lookFrame } from "./sled-looks.ts";
import { rigAsset } from "./sled-rig.ts";

/** The build's environment — Vite's, where this runs in the app; none
 * where the suite reads the module (the root program knows no Vite). */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Which models this build draws (build-time switches, ON unless turned
 * off — `model-switch.ts`). */
export const MODELS = {
  sleds: modelSwitch(ENV.VITE_MODEL_SLEDS),
  riders: modelSwitch(ENV.VITE_MODEL_RIDERS),
};

const loaded: { sleds: Map<SledId, GLTF>; rider: GLTF | null } = {
  sleds: new Map(),
  rider: null,
};
let loading: Promise<void> | null = null;

/** Fetch every model this build draws, once; resolves when all are in (or
 * given up on — a missing one leaves its machine to the code). */
export function loadModels(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const at = (file: string) => `${String(ENV.BASE_URL ?? "/")}models/${file}`;
  const jobs: Promise<unknown>[] = [];
  if (MODELS.sleds) {
    for (const s of SLEDS) {
      jobs.push(
        loader.loadAsync(at(`${s.id}.glb`)).then(
          (g) => loaded.sleds.set(s.id, g),
          () => undefined,
        ),
      );
    }
  }
  if (MODELS.riders) {
    jobs.push(
      loader.loadAsync(at("rider.glb")).then(
        (g) => (loaded.rider = g),
        () => undefined,
      ),
    );
  }
  loading = Promise.all(jobs).then(() => undefined);
  return loading;
}

/** What a model's material is dressed as, by the name `make blender` gave
 * it: a colour off the style, one of the code machine's own materials, or
 * the model's own. Pure, so the suite reads it. */
export type Dress = { colour: number } | { shared: "lamp" | "tail" | "glass" } | null;

export type MachineStyle = { body: number; accent: number; seat?: number; spring?: number };

export function dressOf(
  name: string,
  machine: MachineStyle | null,
  rider: RiderStyle | null,
): Dress {
  if (machine) {
    if (name === "paint") return { colour: machine.body };
    if (name === "white") return { colour: machine.accent };
    if (name === "seat") return { colour: machine.seat ?? 0x2a2d33 };
    if (name === "spring") return { colour: machine.spring ?? machine.body };
    if (name === "lamp") return { shared: "lamp" };
    if (name === "taillight") return { shared: "tail" };
    if (name === "screen") return { shared: "glass" };
  }
  if (rider) {
    if (name === "jacket") return { colour: rider.jacket };
    if (name === "accent") return { colour: rider.accent ?? rider.jacket };
    if (name === "pants") return { colour: rider.pants };
    if (name === "helmet") return { colour: rider.helmet };
    if (name === "peak") return { colour: rider.peak ?? rider.helmet };
    if (name === "lens") return { colour: rider.visor };
  }
  return null;
}

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** A model's scene cloned (skeleton and all) and dressed; every material
 * through the world's wrap, as every drawn thing's is. */
function dressed(
  gltf: GLTF,
  machine: MachineStyle | null,
  rider: RiderStyle | null,
  shared: Record<"lamp" | "tail" | "glass", THREE.Material> | null,
  wrap: Wrap,
  mats: THREE.Material[],
): { scene: THREE.Object3D; meshes: THREE.Mesh[] } {
  const scene = cloneSkinned(gltf.scene);
  const meshes: THREE.Mesh[] = [];
  const done = new Map<THREE.Material, THREE.Material>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes.push(o);
    o.castShadow = true;
    o.receiveShadow = true;
    // A skinned mesh's bound is its rest pose's; the machine is small and
    // always on screen when it matters, so it is never culled by it.
    o.frustumCulled = false;
    const one = (m: THREE.Material): THREE.Material => {
      const known = done.get(m);
      if (known) return known;
      const d = dressOf(m.name, machine, rider);
      let out: THREE.Material;
      if (d && "shared" in d && shared) {
        out = shared[d.shared];
      } else {
        const own = m.clone() as THREE.MeshStandardMaterial;
        if (d && "colour" in d) own.color.setHex(d.colour);
        own.name = m.name;
        out = wrap(own, `model-${m.name}`);
        mats.push(out);
      }
      done.set(m, out);
      return out;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return { scene, meshes };
}

export type ModelParts = {
  /** Every mesh the models draw — what casts. */
  meshes: THREE.Mesh[];
  /** Whether each is drawn in place of the code's. */
  machine: boolean;
  rider: boolean;
  pose(sled: SledState, sink: number, dt: number): void;
  /** The rider at a pose, his holder where the figure's group stands. */
  poseRider(p: RiderPose, figure: THREE.Object3D): void;
  setRiderVisible(v: boolean): void;
  dispose(): void;
};

/** THE MODELS FOR ONE MACHINE, hung under its `root` in place of the
 * code's drawn parts (which the caller collapses when `machine` / `rider`
 * say so). Null when this build draws neither, or neither has loaded. */
export function attachModels(o: {
  spec: SledSpec;
  root: THREE.Object3D;
  machine: MachineStyle;
  rider: RiderStyle;
  shared: Record<"lamp" | "tail" | "glass", THREE.Material>;
  wrap: Wrap;
}): ModelParts | null {
  const sledGltf = MODELS.sleds ? loaded.sleds.get(o.spec.id) : undefined;
  const riderGltf = MODELS.riders ? loaded.rider : null;
  if (!sledGltf && !riderGltf) return null;
  const mats: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];

  // THE MACHINE: modelled in its trace's frame, forward on glTF's −z — so
  // turned a half turn, set on the spec as `lookFrame` sets a trace (the
  // snow at −cogHeight in the body frame), stretched as it stretches.
  let machineRig: ReturnType<typeof rigAsset> | null = null;
  if (sledGltf) {
    const F = lookFrame(o.spec);
    const { scene, meshes: m } = dressed(sledGltf, o.machine, null, o.shared, o.wrap, mats);
    scene.rotation.y = Math.PI;
    const holder = new THREE.Group();
    holder.name = "model-machine";
    holder.add(scene);
    holder.position.set(0, F.y(0), F.z(0));
    holder.scale.z = F.stretch;
    o.root.add(holder);
    machineRig = rigAsset(scene, sledGltf.animations);
    meshes.push(...m);
  }

  // THE RIDER: stated in the pose's frame, turned the same half turn; his
  // holder stands where the figure's group stands, on the seat or thrown.
  let riderHolder: THREE.Group | null = null;
  let riderRig: ReturnType<typeof rigRider> | null = null;
  if (riderGltf) {
    const { scene, meshes: m } = dressed(riderGltf, null, o.rider, null, o.wrap, mats);
    scene.rotation.y = Math.PI;
    riderHolder = new THREE.Group();
    riderHolder.name = "model-rider";
    riderHolder.add(scene);
    o.root.add(riderHolder);
    riderRig = rigRider(riderHolder, riderGltf.animations);
    meshes.push(...m);
  }

  let run = 0;
  return {
    meshes,
    machine: !!machineRig,
    rider: !!riderRig,
    pose(sled, sink, dt) {
      // The belt runs at the machine's own way forward.
      run += Math.max(0, sled.way) * dt;
      o.root.updateWorldMatrix(true, false);
      machineRig?.pose(sled, run, sink);
    },
    poseRider(p, figure) {
      if (!riderHolder || !riderRig) return;
      o.root.updateWorldMatrix(true, false);
      riderHolder.position.copy(figure.position);
      riderHolder.quaternion.copy(figure.quaternion);
      riderHolder.updateMatrixWorld(true);
      riderRig.pose(p);
    },
    setRiderVisible(v) {
      if (riderHolder) riderHolder.visible = v;
    },
    dispose() {
      for (const m of mats) m.dispose();
    },
  };
}
