// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR BETWEEN THE LENS AND THE HILLS — one sky function in GLSL, and
// the haze every material fades into drawn from it.
//
// The dome (`sky-dome.ts`) is `skyColour(dir)`; the haze a far slope fades
// into is the same function read along that slope's own direction, flattened
// toward the horizon. So a ridge two kilometres off dissolves into exactly
// the colour of the sky behind it — warmer toward the sun, bluer away — and
// no fog colour stands in the picture as a flat grey band. Three's own fog
// is one colour for the whole frame and cannot do that, so this replaces
// its `fog_fragment` in every material that stands in the world
// (`hazeMaterial`), and the uniforms are ONE object shared by reference, so
// the frame the sun moves every surface hears it at once.
//
// Three applies fog AFTER tone mapping and the output conversion, so the
// haze colour goes through `toneMapping` and `linearToOutputTexel` first —
// which is what the dome's own pixels go through, and why the far rim meets
// the sky with no seam.

import * as THREE from "three";

import type { SkyLook } from "./sky.ts";

/** How many sleds' lamps the snow is lit by: the player and the field. */
export const LAMP_SLOTS = 4;

export type HazeUniforms = {
  /** Toward the KEY light — the sun by day, the moon by night: what the
   * snow's wrap and glitter answer to. */
  uSunDir: { value: THREE.Vector3 };
  /** Toward the sun itself, wherever it is: the aureole and the disc. */
  uSunPos: { value: THREE.Vector3 };
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uGlow: { value: THREE.Color };
  uSunCol: { value: THREE.Color };
  uHaze: { value: number };
  /** Where the sun's shadow stands (`shadow-box.ts`): the circle's centre
   * in plan, and the plan distances the fade runs between. Written by
   * `environment.ts`; not the sky's, but it rides the same shared object
   * because every world material already carries it. */
  uShadowFade: { value: THREE.Vector4 };
  /** The haze's thinning height, m, and the share of it left up there. */
  uHazeLift: { value: number };
  uHazeFloor: { value: number };
  /** The snow's cues: how flat the light is, how much it glitters. */
  uFlat: { value: number };
  uGlitter: { value: number };
  /** THE LAMPS: each sled's headlamp — where it is, where it points, how
   * far on (0 for a slot with no sled) — and the colour of the beam. */
  uLampPos: { value: THREE.Vector3[] };
  uLampDir: { value: THREE.Vector3[] };
  uLampOn: { value: number[] };
  uLampCol: { value: THREE.Color };
};

export function createHazeUniforms(): HazeUniforms {
  const vectors = (): THREE.Vector3[] =>
    Array.from({ length: LAMP_SLOTS }, () => new THREE.Vector3(0, 0, 1));
  return {
    uSunDir: { value: new THREE.Vector3(0, 0.4, -1).normalize() },
    uSunPos: { value: new THREE.Vector3(0, 0.4, -1).normalize() },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() },
    uHaze: { value: 1 / 1500 },
    uShadowFade: { value: new THREE.Vector4(0, 0, 1e9, 2e9) },
    uHazeLift: { value: 700 },
    uHazeFloor: { value: 0.55 },
    uFlat: { value: 0 },
    uGlitter: { value: 1 },
    uLampPos: { value: vectors() },
    uLampDir: { value: vectors() },
    uLampOn: { value: new Array<number>(LAMP_SLOTS).fill(0) },
    // A halogen's warm white, in linear light.
    uLampCol: { value: new THREE.Color().setRGB(1.0, 0.86, 0.66) },
  };
}

/** Write a `SkyLook` into the shared uniforms. Colours are LINEAR, so they
 * are set channel by channel rather than through `Color.set`, which would
 * treat them as sRGB. */
export function writeHaze(u: HazeUniforms, look: SkyLook): void {
  u.uSunDir.value.set(look.key.x, look.key.y, look.key.z);
  u.uSunPos.value.set(look.sun.x, look.sun.y, look.sun.z);
  u.uZenith.value.setRGB(...look.zenith);
  u.uHorizon.value.setRGB(...look.horizon);
  u.uGlow.value.setRGB(...look.glow);
  u.uSunCol.value.setRGB(...look.sunColour);
  u.uHaze.value = look.haze;
  u.uHazeLift.value = look.hazeLift;
  // A valley fog is thick at the floor and gone over the peaks.
  u.uHazeFloor.value = look.fog > 0 ? 0.12 : 0.55;
  u.uFlat.value = look.flat;
  u.uGlitter.value = look.glitter;
}

/** The sky along a direction, in linear light — the dome's own colour. */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunPos;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunCol;
uniform float uHaze;
uniform float uHazeLift;
uniform float uHazeFloor;

vec3 skyColour(vec3 dir) {
  float up = clamp(dir.y, 0.0, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(up, 0.5));
  float mu = max(dot(normalize(dir), uSunPos), 0.0);
  // The aureole round the sun, strongest low on the dome.
  c += uGlow * (0.22 * pow(mu, 6.0) + 0.5 * pow(mu, 48.0)) * (1.0 - 0.6 * up);
  // Under the horizon the dome is the far snow's glare in the air.
  if (dir.y < 0.0) c = mix(c, uHorizon * 1.04, clamp(-dir.y * 6.0, 0.0, 1.0));
  return c;
}

// The colour a far surface fades into along \`dir\`: the sky just over the
// horizon on that bearing.
vec3 hazeColour(vec3 dir) {
  vec3 d = normalize(vec3(dir.x, clamp(dir.y, -0.02, 0.06), dir.z));
  return skyColour(d);
}

// How much of that colour stands between the lens and a point \`dist\` m
// away whose height over the lens is \`rise\` m: exponential, thinning with
// altitude so the peaks keep their shape a little longer than the valleys.
float hazeAmount(float dist, float rise) {
  float thin = exp(-max(rise, 0.0) / uHazeLift);
  return 1.0 - exp(-dist * uHaze * mix(uHazeFloor, 1.0, thin));
}
`;

const HAZE_VERTEX = /* glsl */ `
varying vec3 vHazeWorld;
`;

const HAZE_VERTEX_MAIN = /* glsl */ `
{
  vec4 hzw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    hzw = instanceMatrix * hzw;
  #endif
  vHazeWorld = (modelMatrix * hzw).xyz;
}
`;

/** The fog chunk's replacement: `vHazeWorld` must be in scope. */
export const HAZE_FRAGMENT = /* glsl */ `
{
  vec3 hzRay = vHazeWorld - cameraPosition;
  float hzDist = length(hzRay);
  vec3 hzCol = hazeColour(hzRay / max(hzDist, 1e-3));
  #if defined(TONE_MAPPING)
    hzCol = toneMapping(hzCol);
  #endif
  hzCol = linearToOutputTexel(vec4(hzCol, 1.0)).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hzCol, hazeAmount(hzDist, hzRay.y));
}
`;

/** The sun's shadow faded out over the rim of the circle it is drawn in
 * (`shadow-box.ts`), so the edge of the shadow map is a gradient that
 * travels with the lens rather than a line shadows pop across. */
const SHADOW_FADE_GLSL = /* glsl */ `
uniform vec4 uShadowFade;
float shadowFaded(float shadow) {
  float d = length(vHazeWorld.xz - uShadowFade.xy);
  return mix(shadow, 1.0, smoothstep(uShadowFade.z, uShadowFade.w, d));
}
`;

const DIR_SHADOW_OPEN = "? getShadow( directionalShadowMap[ i ]";
const DIR_SHADOW_CLOSE = "vDirectionalShadowCoord[ i ] ) : 1.0;";

/** Three's `lights_fragment_begin` with the directional light's shadow
 * passed through `shadowFaded`. Built once, and loudly: a three that moved
 * the line would otherwise leave the rim a hard edge with nothing said. */
let fadedLights: string | null = null;
export function lightsWithFade(): string {
  if (fadedLights !== null) return fadedLights;
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (!chunk.includes(DIR_SHADOW_OPEN) || !chunk.includes(DIR_SHADOW_CLOSE)) {
    throw new Error("haze.ts: three's directional shadow line moved; re-graft shadowFaded");
  }
  fadedLights = chunk
    .replace(DIR_SHADOW_OPEN, "? shadowFaded( getShadow( directionalShadowMap[ i ]")
    .replace(DIR_SHADOW_CLOSE, "vDirectionalShadowCoord[ i ] ) ) : 1.0;");
  return fadedLights;
}

/** Hook the shared uniforms into a compiled shader. */
export function bindHaze(
  shader: { uniforms: Record<string, THREE.IUniform> },
  u: HazeUniforms,
): void {
  Object.assign(shader.uniforms, u);
}

/**
 * Put the haze into a built-in material. `extra` runs after it with the
 * same shader, for a caller with its own graft (the trees' snow). The
 * `name` goes into the program's cache key: two materials whose
 * `onBeforeCompile` differ must never be handed each other's program.
 */
export function hazeMaterial<M extends THREE.Material>(
  material: M,
  u: HazeUniforms,
  name: string,
  extra?: (shader: THREE.WebGLProgramParametersWithUniforms) => void,
): M {
  material.customProgramCacheKey = (): string => `haze:${name}`;
  material.onBeforeCompile = (shader) => {
    bindHaze(shader, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${HAZE_VERTEX}`)
      .replace("#include <fog_vertex>", `#include <fog_vertex>\n${HAZE_VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${SKY_GLSL}\n${HAZE_VERTEX}\n${SHADOW_FADE_GLSL}`,
      )
      .replace("#include <lights_fragment_begin>", lightsWithFade())
      .replace("#include <fog_fragment>", HAZE_FRAGMENT);
    extra?.(shader);
  };
  return material;
}
