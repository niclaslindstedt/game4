// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SLED THROWS — the snow in the air. Three sources, all read off the
// engine's state and never written back:
//
//   * THE ROOST: the tread's paddles fling snow up and back off the rear of
//     the tunnel, harder the more power is going through it and the more it
//     is spinning (`slip`), and much harder in powder than on the groomed
//     track, where there is little loose snow to throw.
//   * THE SKI SPRAY: a ski carving through powder throws a sheet off its
//     outside edge, sized by how hard it is turned and how fast.
//   * THE LANDING PUFF: a sled coming down out of the air sends a ring of
//     powder out from under it, sized by how hard it met the snow — read off
//     the airborne → grounded transition rather than the `land` event, so a
//     frame that ran two steps cannot swallow it, and a rival's landing
//     throws the same puff as the player's.
//
// One pool of soft sprites for every rider, simulated here in plain arrays
// (gravity, air drag, a little growth as the cloud disperses) and drawn as
// one `Points` draw. They are lit as the snow is — the sun's colour and the
// sky's blue — and fade into the same haze.

import * as THREE from "three";
import { rotate, type Level, type SledState } from "@engine";

import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";

const CAPACITY = 5000;

/** A tiny deterministic-enough stream for the look of the spray (the
 * engine's stream is the engine's; nothing drawn may draw from it). */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export type Spray = {
  points: THREE.Points;
  /** Emit for one rider over `dt`; `wasAirborne`/`airTime` are the rider's
   * state at the last frame, for the landing puff. */
  emit(sled: SledState, level: Level, dt: number, landed: number): void;
  update(dt: number, look: SkyLook, level: Level): void;
  /** Pixels per metre at one metre from the lens (the projection's scale). */
  setScale(pixelsPerMetre: number): void;
  /** The SPRAY row: the share, 0..1, of every emission rate and of the pool
   * the particles are flown from. */
  setBudget(share: number): void;
  clear(): void;
  dispose(): void;
};

export function createSpray(haze: HazeUniforms): Spray {
  const pos = new Float32Array(CAPACITY * 3);
  const vel = new Float32Array(CAPACITY * 3);
  const age = new Float32Array(CAPACITY);
  const life = new Float32Array(CAPACITY).fill(0);
  const size0 = new Float32Array(CAPACITY);
  const size = new Float32Array(CAPACITY);
  const alpha = new Float32Array(CAPACITY);
  let head = 0;
  /** The share of every rate thrown, and the slots in use (`setBudget`). */
  let share = 1;
  let cap = CAPACITY;
  const random = makeRandom(0x5eed);

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("aSize", sizeAttr);
  geometry.setAttribute("aAlpha", alphaAttr);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      uLit: { value: new THREE.Color(1, 1, 1) },
      uShade: { value: new THREE.Color(0.6, 0.7, 0.9) },
      uScale: { value: 600 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying float vAlpha;
      varying vec3 vWorld;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vWorld = position;
        vAlpha = aAlpha;
        gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      uniform vec3 uLit;
      uniform vec3 uShade;
      varying float vAlpha;
      varying vec3 vWorld;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = dot(c, c);
        if (r > 1.0) discard;
        float soft = (1.0 - r) * (1.0 - r);
        // The sunward side of a puff is brighter than its underside.
        float lit = clamp(0.55 - c.y * 0.45, 0.0, 1.0);
        vec3 col = mix(uShade, uLit, lit);
        gl_FragColor = vec4(col, soft * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 ray = vWorld - cameraPosition;
        float d = length(ray);
        vec3 hz = hazeColour(ray / max(d, 1e-3));
        #if defined(TONE_MAPPING)
          hz = toneMapping(hz);
        #endif
        hz = linearToOutputTexel(vec4(hz, 1.0)).rgb;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, hazeAmount(d, ray.y));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;

  function spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    lifetime: number,
    s: number,
  ) {
    const i = head;
    head = (head + 1) % cap;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    age[i] = 0;
    life[i] = lifetime;
    size0[i] = s;
  }

  // Emission carries fractions over from frame to frame, per rider.
  let debt = new WeakMap<SledState, number[]>();

  return {
    points,
    emit(sled, level, dt, landed) {
      let owed = debt.get(sled);
      if (!owed) {
        owed = [0, 0, 0];
        debt.set(sled, owed);
      }
      const powder = 1 - sled.packed;
      const treadDown = sled.contacts.some((c) => c.kind === "tread" && c.touching);
      // THE ROOST.
      if (treadDown && sled.treadSpeed > 1) {
        const drive = sled.throttle * (0.35 + Math.min(1, sled.slip / 4));
        const rate = drive * Math.min(1, sled.treadSpeed / 12) * (90 + 520 * powder) * share;
        owed[0] += rate * dt;
        while (owed[0] >= 1) {
          owed[0] -= 1;
          const across = (random() - 0.5) * 0.36;
          const at = rotate(sled.q, { x: across, y: -0.45, z: -1.45 });
          const kick = rotate(sled.q, {
            x: (random() - 0.5) * 2.2,
            y: 2.5 + random() * 3.5 * (0.5 + powder),
            z: -(3 + random() * 5 + sled.slip * 0.6),
          });
          spawn(
            sled.x + at.x,
            sled.y + at.y,
            sled.z + at.z,
            sled.vx * 0.55 + kick.x,
            sled.vy * 0.4 + kick.y,
            sled.vz * 0.55 + kick.z,
            0.5 + random() * 0.7 * (0.4 + powder),
            0.07 + random() * 0.12,
          );
        }
      }
      // THE SKI SPRAY.
      const carve = Math.abs(sled.skiAngle) * sled.speed;
      for (let k = 0; k < 2; k++) {
        const c = sled.contacts[k];
        if (!c || !c.touching) continue;
        const rate = (carve * 14 + sled.speed * 1.5) * (0.15 + powder) * share;
        owed[1 + k] += rate * dt;
        const side = c.side;
        while (owed[1 + k] >= 1) {
          owed[1 + k] -= 1;
          const out = Math.sign(sled.skiAngle || side) * -1;
          const kick = rotate(sled.q, {
            x: out * (1 + random() * 2.5),
            y: 1 + random() * 2.2,
            z: -1 - random() * 2,
          });
          spawn(
            c.x + (random() - 0.5) * 0.2,
            c.y + 0.05,
            c.z + (random() - 0.5) * 0.3,
            sled.vx * 0.6 + kick.x,
            sled.vy * 0.3 + kick.y,
            sled.vz * 0.6 + kick.z,
            0.45 + random() * 0.5,
            0.1 + random() * 0.12,
          );
        }
      }
      // THE LANDING PUFF.
      if (landed > 0) {
        const n = Math.round(Math.min(160, 24 + landed * 16 * (0.3 + powder)) * share);
        const ground = level.groundAt(sled.x, sled.z);
        for (let i = 0; i < n; i++) {
          const a = random() * Math.PI * 2;
          const sp = 2 + random() * (3 + landed * 0.8);
          spawn(
            sled.x + Math.cos(a) * 0.9,
            ground + 0.1 + random() * 0.3,
            sled.z + Math.sin(a) * 1.4,
            Math.cos(a) * sp + sled.vx * 0.4,
            1 + random() * (1.5 + landed * 0.3),
            Math.sin(a) * sp + sled.vz * 0.4,
            // Short: a puff is a burst that falls back into the snow, and
            // one that hangs for a second and a half reads as fog.
            0.3 + random() * 0.45,
            0.18 + random() * 0.22,
          );
        }
      }
    },
    update(dt, look, level) {
      const lit = material.uniforms.uLit.value as THREE.Color;
      const shade = material.uniforms.uShade.value as THREE.Color;
      const sun = look.keyIntensity * 0.34;
      const sky = look.ambient * 0.55;
      lit.setRGB(
        look.keyColour[0] * sun + look.skyLight[0] * sky,
        look.keyColour[1] * sun + look.skyLight[1] * sky,
        look.keyColour[2] * sun + look.skyLight[2] * sky,
      );
      shade.setRGB(
        look.skyLight[0] * sky * 1.2,
        look.skyLight[1] * sky * 1.2,
        look.skyLight[2] * sky * 1.25,
      );
      const drag = Math.exp(-2.4 * dt);
      for (let i = 0; i < cap; i++) {
        if (life[i] <= 0) {
          alpha[i] = 0;
          size[i] = 0;
          continue;
        }
        age[i] += dt;
        const t = age[i] / life[i];
        if (t >= 1) {
          life[i] = 0;
          alpha[i] = 0;
          size[i] = 0;
          continue;
        }
        const k = i * 3;
        vel[k] *= drag;
        vel[k + 1] = vel[k + 1] * drag - 6.5 * dt;
        vel[k + 2] *= drag;
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        // Settled onto the snow: it stops and fades where it lies.
        const g = level.groundAt(pos[k], pos[k + 2]);
        if (pos[k + 1] < g + 0.05) {
          pos[k + 1] = g + 0.05;
          vel[k] *= 0.5;
          vel[k + 1] = 0;
          vel[k + 2] *= 0.5;
          age[i] += dt * 5;
        }
        size[i] = size0[i] * (1 + 1.6 * t);
        alpha[i] = Math.min(1, t * 12) * (1 - t) * (1 - t) * 0.75;
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    },
    setScale(v) {
      material.uniforms.uScale.value = v;
    },
    setBudget(next) {
      share = Math.max(0, Math.min(1, next));
      cap = Math.max(1, Math.round(CAPACITY * share));
      head %= cap;
      // Whatever flew in the slots past the new pool is let go of at once,
      // and the draw stops at the pool's end.
      for (let i = cap; i < CAPACITY; i++) {
        life[i] = 0;
        alpha[i] = 0;
        size[i] = 0;
      }
      geometry.setDrawRange(0, cap);
      alphaAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    },
    clear() {
      life.fill(0);
      alpha.fill(0);
      size.fill(0);
      debt = new WeakMap();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
