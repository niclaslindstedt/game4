// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MODELLED SLED POSED AS THE GAME POSES ITS OWN. A machine made by
// `make blender` is one skinned mesh on a rig (`scripts/blender/lib.py`):
// DRIVERS the game sets off the engine's readings, LINKAGES that follow,
// and the lugs' belt-run morph. This is the game's side of that contract,
// written once for the sled lab (and for the day a model is shipped):
//
//   bars           turned about its own axis (the post) by `steer × BAR_TURN`
//   ski_l, ski_r   lifted by their compression (`gearLift`), turned about
//                  the up axis by `skiAngle` — matched to the engine's skis
//                  by which side of the machine they stand on
//   track          lifted by the rear's compression
//   wheel_*        rolled by the belt's run (their `radius` in the extras)
//   a linkage      any bone whose extras name an `aim`: turned so it points
//                  at that bone's head, and stretched to reach it where
//                  `stretch` is set — the game's struts re-laid (`sled-gear.ts`)
//
// And the CLIPS the model carries, played at a moment. Three only: the
// asset's frame is the loader's business (`sled-harness.ts` turns it).

import * as THREE from "three";
import type { SledState } from "@engine";

import { BAR_TURN, gearLift } from "../game/sled-gear.ts";

type Rest = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
type Aim = {
  node: THREE.Object3D;
  target: THREE.Object3D;
  stretch: boolean;
  dir: THREE.Vector3;
  length: number;
};

export type AssetRig = {
  /** The clips the model carries, by name, with their lengths, s. */
  clips: { name: string; seconds: number }[];
  /** Back to the rest pose, every clip stopped. */
  rest(): void;
  /** Posed off the engine's state; `run` is how far the belt has run, m. */
  pose(sled: SledState, run?: number): void;
  /** Clip `name` at `t` s. */
  play(name: string, t: number): void;
};

const UP = new THREE.Vector3(0, 1, 0);
const Y = new THREE.Vector3(0, 1, 0);

export function rigAsset(root: THREE.Object3D, animations: THREE.AnimationClip[]): AssetRig {
  root.updateMatrixWorld(true);
  const rest = new Map<THREE.Object3D, Rest>();
  const named = new Map<string, THREE.Object3D>();
  const morphs: THREE.Mesh[] = [];
  root.traverse((o) => {
    rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
    named.set(o.name, o);
    if ((o as THREE.Mesh).morphTargetInfluences) morphs.push(o as THREE.Mesh);
  });
  const extras = (o: THREE.Object3D) =>
    o.userData as { aim?: string; stretch?: number; radius?: number };

  const aims: Aim[] = [];
  const tmp = new THREE.Vector3();
  for (const node of named.values()) {
    const aim = extras(node).aim;
    const target = aim ? named.get(aim) : undefined;
    if (!target || !node.parent) continue;
    const d = node.parent
      .worldToLocal(target.getWorldPosition(tmp.set(0, 0, 0)))
      .sub(node.position);
    aims.push({
      node,
      target,
      stretch: extras(node).stretch === 1,
      dir: d.clone().normalize(),
      length: d.length(),
    });
  }
  const wheels = [...named.values()].filter((o) => /^wheel_\d+$/.test(o.name));
  const skis = ["ski_l", "ski_r"].map((n) => named.get(n)).filter((o): o is THREE.Object3D => !!o);
  const bars = named.get("bars");
  const track = named.get("track");

  const mixer = new THREE.AnimationMixer(root);

  function reset(): void {
    mixer.stopAllAction();
    for (const [o, r] of rest) {
      o.position.copy(r.p);
      o.quaternion.copy(r.q);
      o.scale.copy(r.s);
    }
    for (const m of morphs) m.morphTargetInfluences!.fill(0);
    root.updateMatrixWorld(true);
  }

  const w = new THREE.Vector3();
  const pq = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  /** Move `o` by `lift` up the world and turn it by `angle` about the world's up. */
  function drive(o: THREE.Object3D, lift: number, angle = 0): void {
    const parent = o.parent!;
    o.getWorldPosition(w);
    const at = parent.worldToLocal(w.clone().addScaledVector(UP, lift));
    o.position.copy(at);
    if (angle) {
      parent.getWorldQuaternion(pq);
      q.setFromAxisAngle(UP, angle);
      o.quaternion.premultiply(pq.clone().invert().multiply(q).multiply(pq));
    }
  }
  /** Turn `o` about its own axis by `angle`, in the sense a turn about the world's up has. */
  function spin(o: THREE.Object3D, angle: number): void {
    const axis = Y.clone().applyQuaternion(o.getWorldQuaternion(pq));
    o.quaternion.multiply(q.setFromAxisAngle(Y, angle * Math.sign(axis.dot(UP) || 1)));
  }

  return {
    clips: animations.map((c) => ({ name: c.name, seconds: c.duration })),
    rest: reset,
    pose(sled, run = 0) {
      reset();
      const lift = gearLift(sled);
      // The engine's ski 0 stands at x negative in the body frame.
      const bySide = [...skis].sort((a, b) => a.getWorldPosition(w).x - b.getWorldPosition(tmp).x);
      bySide.forEach((o, i) => drive(o, lift.ski[i], sled.skiAngle));
      if (track) drive(track, lift.tread);
      if (bars) spin(bars, sled.steer * BAR_TURN);
      const beltRun = (root.userData.beltRunMetres as number | undefined) ?? 0;
      if (run && beltRun) {
        for (const m of morphs) m.morphTargetInfluences![0] = (run / beltRun) % 1;
        for (const o of wheels) {
          const r = extras(o).radius;
          if (r) o.quaternion.multiply(q.setFromAxisAngle(Y, -run / r));
        }
      }
      root.updateMatrixWorld(true);
      for (const a of aims) {
        const d = a.node.parent!.worldToLocal(a.target.getWorldPosition(w)).sub(a.node.position);
        const r = rest.get(a.node)!;
        a.node.quaternion.setFromUnitVectors(a.dir, d.clone().normalize()).multiply(r.q);
        if (a.stretch) a.node.scale.y = (r.s.y * d.length()) / a.length;
      }
      root.updateMatrixWorld(true);
    },
    play(name, t) {
      reset();
      const clip = animations.find((c) => c.name === name);
      if (!clip) return;
      const action = mixer.clipAction(clip).reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; // its last frame, not its first again
      action.play();
      mixer.setTime(t);
      root.updateMatrixWorld(true);
    },
  };
}
