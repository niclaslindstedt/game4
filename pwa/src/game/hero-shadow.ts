// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S OWN SHADOW: the player's machine and rider drawn into a
// shadow map of their own, a box in the key light's frame just round their
// bound (`shadow-box.ts`'s `heroFrame`), rendered every frame before the
// picture. The wide map's texel is centimetres across — wider than an arm —
// so a rider in it is a blur that swims as he crosses its grid; here a
// texel is a few millimetres and the box follows the model exactly, so the
// shadow keeps its shape frame to frame. The model is taken OUT of the wide
// map (`adopt`), so its coarse copy never shows round the sharp one; every
// world material takes the darker of the two (`haze.ts`'s `heroShadowed`).
//
// The pass is the main scene drawn from the rider's light with only his
// meshes on its layer, every one in a packed-depth material three's own
// shadow maps are written with — so the snow reads it back the way it
// reads the sun's.

import * as THREE from "three";

import type { HazeUniforms } from "./haze.ts";
import { HERO_BACK, HERO_DEPTH, heroFrame, type ShadowBox } from "./shadow-box.ts";
import type { SledModel } from "./sled-body.ts";

/** The layer only the rider's meshes are on, besides the picture's own. */
const HERO_LAYER = 7;

export type HeroShadow = {
  /** The map's texels a side; 0 is no map, and the uniforms say so. */
  setSize(size: number): void;
  /** Take a model's meshes out of the wide map and onto this one's layer. */
  adopt(model: SledModel): void;
  /** Draw `model` into the map from the key light `box` names (null while
   * there is no shadow), and point the world's materials at it. */
  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    model: SledModel,
    box: ShadowBox | null,
  ): void;
  dispose(): void;
};

export function createHeroShadow(haze: HazeUniforms, size: number): HeroShadow {
  let target: THREE.WebGLRenderTarget | null = null;
  let mapSize = 0;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, HERO_BACK + HERO_DEPTH);
  cam.layers.set(HERO_LAYER);
  const depth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  });
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const sphere = new THREE.Sphere();
  const clear = new THREE.Color();
  const off = (): void => {
    haze.uHero.value.x = 0;
  };

  const setSize = (next: number): void => {
    if (next === mapSize) return;
    mapSize = next;
    target?.dispose();
    target = null;
    haze.uHeroMap.value = null;
    off();
    if (next <= 0) return;
    // Nearest, as three's own maps are: the depths are packed into the
    // four channels, and a blend between two packed depths is no depth.
    target = new THREE.WebGLRenderTarget(next, next, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    target.texture.name = "hero.shadowMap";
    haze.uHeroMap.value = target.texture;
  };
  setSize(size);

  return {
    setSize,
    adopt(model) {
      for (const mesh of model.casters) {
        mesh.castShadow = false;
        mesh.layers.enable(HERO_LAYER);
      }
    },
    render(gl, scene, model, box) {
      if (!target || !box || !gl.shadowMap.enabled) return off();
      model.bound(sphere);
      const { half, normalBias, depthBias } = heroFrame(sphere.radius, mapSize);
      if (cam.right !== half) {
        cam.left = cam.bottom = -half;
        cam.right = cam.top = half;
        cam.updateProjectionMatrix();
      }
      const c = sphere.center;
      cam.position.set(
        c.x + box.sx * HERO_BACK,
        c.y + box.sy * HERO_BACK,
        c.z + box.sz * HERO_BACK,
      );
      // A sun straight overhead has no "up" of its own to be told apart from.
      cam.up.set(0, 1, 0);
      if (Math.abs(box.sy) > 0.99) cam.up.set(0, 0, 1);
      cam.lookAt(c);
      cam.updateMatrixWorld();
      haze.uHeroMatrix.value
        .multiplyMatrices(bias, cam.projectionMatrix)
        .multiply(cam.matrixWorldInverse);
      haze.uHero.value.set(1, 1 / mapSize, normalBias, depthBias);

      // The pass: nothing but the rider's layer, nothing but depth, and the
      // wide map left alone — the picture's own render draws that.
      const was = gl.getRenderTarget();
      const autoShadow = gl.shadowMap.autoUpdate;
      const autoMatrix = scene.matrixWorldAutoUpdate;
      const override = scene.overrideMaterial;
      gl.getClearColor(clear);
      const alpha = gl.getClearAlpha();
      gl.shadowMap.autoUpdate = false;
      scene.matrixWorldAutoUpdate = false;
      scene.overrideMaterial = depth;
      gl.setRenderTarget(target);
      // Packed white is the far plane: nothing in the way.
      gl.setClearColor(0xffffff, 1);
      gl.render(scene, cam);
      gl.setClearColor(clear, alpha);
      scene.overrideMaterial = override;
      scene.matrixWorldAutoUpdate = autoMatrix;
      gl.shadowMap.autoUpdate = autoShadow;
      gl.setRenderTarget(was);
    },
    dispose() {
      target?.dispose();
      depth.dispose();
    },
  };
}
