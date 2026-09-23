// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOME — a sphere round the lens painted with `skyColour` (haze.ts),
// the sun's disc on it, and nothing else: this slice's sky is always
// clear. It goes through the same tone mapping and output conversion as
// every lit surface, which is what lets the haze meet it without a seam.

import * as THREE from "three";

import { SKY_GLSL, type HazeUniforms } from "./haze.ts";

/** The sun's apparent radius, rad — a touch over the real 0.27° so the disc
 * is more than a pixel on a phone. */
const SUN_RADIUS = 0.0085;

export type SkyDome = {
  mesh: THREE.Mesh;
  /** Keep the dome centred on the lens. */
  follow(camera: THREE.Camera): void;
  dispose(): void;
};

export function createSkyDome(haze: HazeUniforms, radius: number): SkyDome {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const material = new THREE.ShaderMaterial({
    uniforms: { ...haze },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Pinned to the far plane so nothing is ever clipped by the sky.
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColour(d);
        float mu = dot(d, uSunDir);
        float edge = cos(${SUN_RADIUS.toFixed(5)});
        float disc = smoothstep(edge - 0.00002, edge + 0.00001, mu);
        c += uSunCol * disc * 30.0;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    follow(camera) {
      mesh.position.copy(camera.position);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
