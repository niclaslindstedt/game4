// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED CARD'S TURNTABLE: the real in-game machine, with the real rider
// on it, standing on its own little canvas and turning.
//
// It is `createSledModel` — the builder the race draws with — off the
// machine's own spec, in the livery the rider has picked for it, stood at rest on a disc of snow at its own ride
// height: the skis and the tread at the sag the springs settle at, so the
// mountain sled's long tail, the trail sled's stubby one and the cross
// sled's running gear hung further under its chassis are visible before a
// single bar beside it has been read. It wears the player's grid colours,
// because it is the player's machine.
//
// The eye line is a person standing beside the sled — a little above it,
// looking slightly DOWN — the angle a machine is admired from, and the one
// that shows the tunnel and the cowl at once.
//
// This module owns three.js, so it is loaded as its own chunk
// (`sled-picker.tsx` imports it dynamically): the entry script's critical
// path must not carry the render stack.

import * as THREE from "three";
import { freshSled, type SledSpec } from "@engine";

import { createSledModel, REST_SAG, SLED_STYLES, styleIn, type SledModel } from "./sled-body.ts";
import { liveryOf } from "./sled-liveries.ts";

/** WHERE THE VIEWER STANDS, as a direction: the eye is this high for every
 * metre it is back. How FAR back is worked out from the machine and the
 * canvas's shape (`frame`), so a phone's tall pane and a laptop's wide one
 * are both filled with sled rather than with backdrop. */
const EYE_RISE = 0.34;
/** The air left round the machine, as a multiple of the distance the sled
 * alone would need. */
const FRAME_MARGIN = 1.3;
/** Where on the machine's height the lens aims, as a share of it. Below the
 * middle, because the plates across the head and the foot of the pane are
 * not the same height: the billing under the machine is two lines on a
 * phone, and a sled framed about its middle has its skis under it. */
const AIM = 0.35;
/** One revolution every this many seconds — slow enough to read a tunnel. */
const SPIN_PERIOD = 16;
/** The pose's own heading, so a still frame (reduced motion, a screenshot)
 * shows the machine three-quarters on rather than nose to the lens. */
const START_ANGLE = 2.3;

export type SledTurntable = {
  /** Swap the machine on the stand; the spin carries on from where it was.
   * The model is built on the next frame, not inside this call, so a rider
   * rowing through the arrows builds only the one they stop on. */
  setSled: (spec: SledSpec, livery?: number) => void;
  /** Match the canvas to its box after a layout change. */
  resize: () => void;
  dispose: () => void;
};

/** The card's scene has no haze, so the builder's material hook is a
 * no-op here. */
const plain = <M extends THREE.Material>(m: M): M => m;

export function createSledTurntable(canvas: HTMLCanvasElement): SledTurntable {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  // No sky in this scene, so a rig of its own: a low winter key from over
  // one shoulder, and a hemisphere of sky blue over snow white.
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(0.5, 0.8, 0.6).normalize().multiplyScalar(10);
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xbcd8f2, 0xf4f8fb, 1.3));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

  // THE SNOW: a disc at y = 0, which is where the machine's own snow line
  // is stood (the model's origin is its CoG, `spec.cogHeight` up).
  const snow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.9 }),
  );
  snow.rotation.x = -Math.PI / 2;
  scene.add(snow);

  // The sled turns; the snow does not.
  const pivot = new THREE.Group();
  scene.add(pivot);

  let model: SledModel | null = null;
  let shown: string | null = null;
  let pending: { spec: SledSpec; livery: number } | null = null;
  /** How far the machine reaches from the spin axis, and how tall it
   * stands — measured off the model that was built. */
  let radius = 2;
  let top = 1.4;
  const box = new THREE.Box3();

  const clear = (): void => {
    if (!model) return;
    pivot.remove(model.root);
    model.dispose();
    model = null;
  };

  const frame = (): void => {
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const pitch = Math.atan(EYE_RISE);
    const middle = top / 2;
    const vNeed = middle * Math.cos(pitch) + radius * Math.sin(pitch);
    const dist = FRAME_MARGIN * Math.max(vNeed / Math.tan(vHalf), radius / Math.tan(hHalf));
    const back = dist / Math.hypot(1, EYE_RISE);
    const aim = top * AIM;
    camera.position.set(0, aim + back * EYE_RISE, -back);
    camera.lookAt(0, aim, 0);
  };

  const build = (spec: SledSpec, livery: number): void => {
    clear();
    shown = `${spec.id}:${livery}`;
    model = createSledModel(spec, styleIn(SLED_STYLES[0], liveryOf(spec.id, livery)), plain);
    const rest = freshSled(spec);
    rest.skiCompression[0] = REST_SAG;
    rest.skiCompression[1] = REST_SAG;
    rest.treadCompression = REST_SAG;
    model.pose(rest, { x: 0, y: spec.cogHeight, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } }, 0);
    pivot.add(model.root);
    // The pose moved the root; its world matrices are not refreshed until a
    // render, and a box measured off stale ones frames the machine where it
    // was built rather than where it stands.
    pivot.rotation.y = 0;
    pivot.updateMatrixWorld(true);
    box.setFromObject(model.root);
    // It TURNS, so what has to fit is the circle its plan sweeps, not the
    // box: the far corner is the constraint at every angle.
    radius = Math.max(
      Math.hypot(box.min.x, box.min.z),
      Math.hypot(box.min.x, box.max.z),
      Math.hypot(box.max.x, box.min.z),
      Math.hypot(box.max.x, box.max.z),
    );
    top = box.max.y;
    snow.scale.setScalar(radius * 1.2);
    frame();
  };

  const cut = new THREE.Vector2();
  /** Match the buffer to the canvas box, unless it already is — checked in
   * device pixels too, because a backing store a mobile browser reclaimed
   * still reports the size three last asked for. */
  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const ratio = renderer.getPixelRatio();
    renderer.getSize(cut);
    if (
      cut.x === w &&
      cut.y === h &&
      canvas.width === Math.floor(w * ratio) &&
      canvas.height === Math.floor(h * ratio)
    ) {
      return;
    }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frame();
    camera.updateProjectionMatrix();
  };

  const still =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let last = performance.now();
  let angle = START_ANGLE;
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick);
    // Every frame: a resize EVENT is not the only way a canvas changes size.
    resize();
    if (pending) {
      const { spec, livery } = pending;
      pending = null;
      build(spec, livery);
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!still) angle += (dt * Math.PI * 2) / SPIN_PERIOD;
    pivot.rotation.y = angle;
    renderer.render(scene, camera);
  };
  resize();
  raf = requestAnimationFrame(tick);

  return {
    setSled: (spec, livery = 0) => {
      pending = shown === `${spec.id}:${livery}` ? null : { spec, livery };
    },
    resize,
    dispose: () => {
      cancelAnimationFrame(raf);
      clear();
      snow.geometry.dispose();
      (snow.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };
}
