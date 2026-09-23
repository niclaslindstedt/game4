// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR: the two lights, the dome and the haze, answering to one
// `SkyLook` (`sky.ts`) worked out again every frame off the run's own
// clock — ten minutes of riding is an hour of sun (`clock.ts`), so the
// shadows swing over a race. The key light is whichever of the sun and the
// moon the look names; under a lid it is a glow with no shadow worth the
// name, and the hemisphere carries the picture.
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
import { hazeFor, type Tier } from "./settings-video.ts";
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
  /** Apply a look, and aim the shadow box at (x, y, z); `drift` is how far
   * the wind has carried the cloud (`sky-dome.ts`). */
  update(
    look: SkyLook,
    camera: THREE.Camera,
    x: number,
    y: number,
    z: number,
    drift?: { x: number; z: number },
  ): void;
  /** The key light's shadow map, texels a side; 0 casts nothing (the
   * SHADOWS row). */
  setShadow(size: number): void;
  /** The DISTANCE row, whose haze is `hazeFor`'s. */
  setDistance(distance: Tier): void;
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
  scene.add(sun);
  scene.add(sun.target);

  /** The box's centre snaps to this, so shadow edges do not crawl. */
  let texel = 1;
  let distance: Tier = "high";
  const setShadow = (size: number): void => {
    sun.castShadow = size > 0;
    texel = (2 * SHADOW_HALF) / Math.max(size, 1);
    if (size > 0 && sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      // Three allocates the map on first use at the size it finds; a map
      // already standing at another size has to go for the new one to come.
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  setShadow(shadowSize);
  const lightSpace = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const at = new THREE.Vector3();

  return {
    haze,
    sun,
    dome,
    update(look, camera, x, y, z, drift) {
      writeHaze(haze, look);
      haze.uHaze.value = hazeFor(look.haze, distance);
      dome.update(look, drift?.x ?? 0, drift?.z ?? 0);
      // The key is the sun by day and the moon by night (`sky.ts`).
      sun.color.setRGB(...look.keyColour);
      sun.intensity = look.keyIntensity;
      hemi.color.setRGB(...look.skyLight);
      hemi.groundColor.setRGB(...look.groundLight);
      hemi.intensity = look.ambient;
      // Snap the box's centre to whole texels in the light's own frame.
      const dir = new THREE.Vector3(look.key.x, Math.max(look.key.y, 0.02), look.key.z).normalize();
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
    setShadow,
    setDistance(next) {
      distance = next;
    },
    dispose() {
      dome.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
