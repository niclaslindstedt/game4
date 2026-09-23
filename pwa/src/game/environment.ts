// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR: the two lights, the dome and the haze, answering to one
// `SkyLook` (`sky.ts`) worked out again every frame off the run's own
// clock — ten minutes of riding is an hour of sun (`clock.ts`), so the
// shadows swing over a race.
//
// THE KEY LIGHT'S SHADOW IS TIGHT. A directional light's shadow map has a
// fixed number of texels, and spread over the whole basin a sled's shadow
// would be one of them. So the shadow camera is a box a few dozen metres
// across that FOLLOWS the lens's aim point, snapped to whole shadow texels
// so the edges of a tree's shadow do not crawl as the rider moves. Far trees
// cast nothing; the haze and the forest tint carry the woods out there.

import * as THREE from "three";

import { createHazeUniforms, writeHaze, type HazeUniforms } from "./haze.ts";
import { createSkyDome, type SkyDome } from "./sky-dome.ts";
import type { SkyLook } from "./sky.ts";

/** Half the side of the shadow box, m. */
const SHADOW_HALF = 40;
/** Where the key light is parked along the sun, m (it is directional; the
 * distance only has to clear anything that casts). */
const KEY_DISTANCE = 300;

export type Environment = {
  haze: HazeUniforms;
  sun: THREE.DirectionalLight;
  dome: SkyDome;
  /** Apply a look, and aim the shadow box at (x, y, z). */
  update(look: SkyLook, camera: THREE.Camera, x: number, y: number, z: number): void;
  dispose(): void;
};

export function createEnvironment(
  scene: THREE.Scene,
  shadowSize: number,
  domeRadius: number,
): Environment {
  const haze = createHazeUniforms();
  const dome = createSkyDome(haze, domeRadius);
  scene.add(dome.mesh);

  const hemi = new THREE.HemisphereLight(0x88aaff, 0xffffff, 1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = shadowSize > 0;
  if (shadowSize > 0) {
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = sun.shadow.camera;
    cam.left = -SHADOW_HALF;
    cam.right = SHADOW_HALF;
    cam.top = SHADOW_HALF;
    cam.bottom = -SHADOW_HALF;
    cam.near = 1;
    cam.far = KEY_DISTANCE * 2;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 2;
  }
  scene.add(sun);
  scene.add(sun.target);

  const texel = (2 * SHADOW_HALF) / Math.max(shadowSize, 1);
  const lightSpace = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const at = new THREE.Vector3();

  return {
    haze,
    sun,
    dome,
    update(look, camera, x, y, z) {
      writeHaze(haze, look);
      sun.color.setRGB(...look.sunColour);
      sun.intensity = look.sunIntensity;
      hemi.color.setRGB(...look.skyLight);
      hemi.groundColor.setRGB(...look.groundLight);
      hemi.intensity = look.ambient;
      // Snap the box's centre to whole texels in the light's own frame.
      const dir = new THREE.Vector3(look.sun.x, look.sun.y, look.sun.z);
      lightSpace.lookAt(dir, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
      inv.copy(lightSpace).invert();
      at.set(x, y, z).applyMatrix4(inv);
      at.x = Math.round(at.x / texel) * texel;
      at.y = Math.round(at.y / texel) * texel;
      at.applyMatrix4(lightSpace);
      sun.target.position.copy(at);
      sun.position.copy(at).addScaledVector(dir, KEY_DISTANCE);
      sun.target.updateMatrixWorld();
      dome.follow(camera);
    },
    dispose() {
      dome.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
