// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT MAKES SNOW LOOK LIKE SNOW — the terrain's shader, as the source
// grafted into a `MeshStandardMaterial` (`terrain.ts` does the grafting).
// The built-in material keeps what it is good at — the sun and its shadow
// map, the hemisphere light, a GGX sheen that brightens at a grazing angle
// the way a snowfield does looking toward the sun — and this adds what
// separates snow from white paint:
//
//   * THE GROUND IS READ PER PIXEL. The mesh (`terrain.ts`) is a camera-
//     centred clipmap, a quarter-metre a vertex at the lens and sixteen at
//     the rim, but its SHADING never sees that: the slope comes from the
//     ground's own gradient texture, the furrows from the trail map's own
//     finite differences, and fine noise on top. A mesh that coarse lit by
//     its own normals would put the clipmap's rings on every hillside.
//   * WRAP LIGHTING — light goes INTO snow and comes back out somewhere
//     else, so the terminator is soft and tinted blue (`SSS`).
//   * THE GLITTER — a crystal is a tiny mirror at a random angle, so the
//     world is hashed into cells, each given a random facet, and a facet
//     that lines the sun up with the eye flares. World-space, so the glints
//     sit still on the snow and twinkle as the LENS moves; faded out with
//     distance before a cell is smaller than a pixel.
//   * THE GROOMED TRACK is packed snow: a touch greyer, a touch shinier, no
//     glitter to speak of (the loose crystals are crushed), and the comb's
//     CORDUROY running along it.
//   * THE TRAIL — the depth the trail map holds lowers the snow in the
//     vertex shader (as far as the mesh can show it) and bends the normal
//     per pixel (all of it). Pressed snow is barely darker than fresh;
//     what makes a furrow read is its SHAPE — walls turned from the sun,
//     a floor that sees less sky — so the tint is small and the light does
//     the rest.
//
// SNOW IS BRIGHTER THAN ITS PAINT (`GLARE`): it returns nine tenths of
// what lands on it, and a white albedo under a low winter sun still arrives
// grey. So the tone is pushed past white and the tone mapper takes the lit
// side down to a bright, unclipped white.

import { LAMP_SLOTS } from "./haze.ts";
import { TRAIL_GLSL } from "./trail-map.ts";

/** How much brighter than white snow's albedo is painted. */
export const GLARE = 1.12;

/** How far loose powder stands over the groomed track, m. */
export const LOOSE = 0.1;

/** The vertex half's declarations: the height field, the clipmap level, the
 * rim of mountains past the map. */
export const SNOW_VERTEX_PARS = /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform vec2 uLevelCentre;
uniform float uSpacing;
uniform float uGridHalf;
uniform float uBaseSpacing;
uniform sampler2D uGround;
varying vec3 vSnowWorld;
varying vec3 vSnowNormal;
${TRAIL_GLSL}

float snowHash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float snowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash1(i), snowHash1(i + vec2(1, 0)), u.x),
             mix(snowHash1(i + vec2(0, 1)), snowHash1(i + vec2(1, 1)), u.x), u.y);
}

// THE MOUNTAINS PAST THE MAP. The generator's world ends at its edge, but
// the eye does not: a rim that stopped dead would stand the whole basin on
// a table. So past the edge the ground keeps climbing on noise of its own,
// steeper the further out, into peaks the haze takes.
float rimRise(vec2 p, vec2 q) {
  float beyond = length(p - q);
  if (beyond <= 0.0) return 0.0;
  float big = snowNoise(p * 0.0021) * 0.65 + snowNoise(p * 0.0057) * 0.35;
  float ridge = 1.0 - abs(snowNoise(p * 0.009) * 2.0 - 1.0);
  // Climbs steeply off the edge and saturates: a range of peaks a couple
  // of hundred metres over the rim, not a wall to the sky.
  float climb = 240.0 * (1.0 - exp(-beyond / 380.0)) * (0.45 + 0.9 * big);
  return climb + ridge * ridge * 45.0 * smoothstep(0.0, 250.0, beyond);
}

float heightTexel(ivec2 c) {
  ivec2 top = ivec2(uHeightCount) - 1;
  return texelFetch(uHeight, clamp(c, ivec2(0), top), 0).r;
}

float groundHeight(vec2 p) {
  vec2 lo = uHeightOrigin;
  vec2 hi = uHeightOrigin + (uHeightCount - 1.0) * uCell;
  vec2 q = clamp(p, lo, hi);
  vec2 f = (q - lo) / uCell;
  vec2 i = floor(f);
  vec2 t = f - i;
  ivec2 c = ivec2(i);
  float a = heightTexel(c);
  float b = heightTexel(c + ivec2(1, 0));
  float d = heightTexel(c + ivec2(0, 1));
  float e = heightTexel(c + ivec2(1, 1));
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y) + rimRise(p, q);
}
`;

/** Replaces `beginnormal_vertex`: place the vertex on the clipmap, morph it
 * toward the next level near this level's rim (so two levels meet with no
 * crack), and lift it onto the snow. */
export const SNOW_VERTEX_PLACE = /* glsl */ `
vec2 snowGrid = position.xz;
vec2 snowLocal = (snowGrid - uGridHalf) * uSpacing;
float snowEdge = max(abs(snowLocal.x), abs(snowLocal.y)) / (uGridHalf * uSpacing);
float snowMorph = clamp((snowEdge - 0.72) / 0.2, 0.0, 1.0);
vec2 snowXZ = uLevelCentre + snowLocal - mod(snowGrid, 2.0) * uSpacing * snowMorph;
// The furrow, low-passed to what the mesh can carry here. Close in, a tent
// filter over the fine map a vertex's spacing wide — enough for the tread's
// band to sink the mesh without the ski lines aliasing into a sawtooth;
// further out, the coarse map alone, which is already that blur. The
// per-pixel normal (fragment half) draws everything this leaves out. The
// filter's width is a function of the DISTANCE, not of the level, so two
// levels meeting at a vertex compute the same height there.
float snowR = max(uBaseSpacing, distance(snowXZ, cameraPosition.xz) / uGridHalf);
float snowRelief;
{
  vec2 t = textureLod(uTrailCoarse, snowXZ / uMapSize, 0.0).rg * uTrailScale;
  float coarseRelief = -t.x + t.y * (1.0 - clamp(t.x / 0.03, 0.0, 1.0));
  float nearW = 1.0 - smoothstep(0.35, 0.7, snowR);
  float fineRelief = 0.0;
  if (nearW > 0.0) {
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        float w = (i == 0 ? 0.5 : 0.25) * (j == 0 ? 0.5 : 0.25);
        fineRelief += w * trailRelief(snowXZ + vec2(float(i), float(j)) * snowR);
      }
    }
  }
  snowRelief = mix(coarseRelief, fineRelief, nearW);
}
// THE LOOSE COVER: powder stands a hand higher than the groomed track, so
// the track's shoulders are a real edge the light picks out. (The engine's
// ground is the track's graded surface; the sled drawn in powder is lowered
// by as much in renderer.ts.)
float snowPackedV = textureLod(uGround, (snowXZ - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell), 0.0).b;
float snowY = groundHeight(snowXZ) + snowRelief + ${LOOSE.toFixed(3)} * (1.0 - snowPackedV);
float snowE = max(uSpacing, uCell);
vec3 objectNormal = normalize(vec3(
  groundHeight(snowXZ - vec2(snowE, 0.0)) - groundHeight(snowXZ + vec2(snowE, 0.0)),
  2.0 * snowE,
  groundHeight(snowXZ - vec2(0.0, snowE)) - groundHeight(snowXZ + vec2(0.0, snowE))));
`;

/** Replaces `begin_vertex`. */
export const SNOW_VERTEX_BEGIN = /* glsl */ `
vec3 transformed = vec3(snowXZ.x, snowY, snowXZ.y);
vSnowWorld = transformed;
vSnowNormal = objectNormal;
`;

/** The fragment half's declarations. */
export const SNOW_FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uGround;
uniform sampler2D uTrackDir;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform vec4 uHole;
uniform float uFlat;
uniform float uGlitter;
uniform vec3 uLampPos[${LAMP_SLOTS}];
uniform vec3 uLampDir[${LAMP_SLOTS}];
uniform float uLampOn[${LAMP_SLOTS}];
uniform vec3 uLampCol;
varying vec3 vSnowWorld;
varying vec3 vSnowNormal;
${TRAIL_GLSL}

vec3 snowHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float snowHash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float snowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash1(i), snowHash1(i + vec2(1, 0)), u.x),
             mix(snowHash1(i + vec2(0, 1)), snowHash1(i + vec2(1, 1)), u.x), u.y);
}
// The gradient of value noise, by finite difference — cheap enough for the
// three octaves the micro-relief uses.
vec2 snowNoiseGrad(vec2 p, float e) {
  return vec2(snowNoise(p + vec2(e, 0.0)) - snowNoise(p - vec2(e, 0.0)),
              snowNoise(p + vec2(0.0, e)) - snowNoise(p - vec2(0.0, e))) / (2.0 * e);
}

// ONE LAYER OF CRYSTALS: a cell of world space holds at most one, at a
// random place in it with a random facet; it flares when that facet lines
// the sun up with the eye. Drawn as a POINT — a disc at least a pixel
// across, its brightness scaled down as it is widened — rather than as the
// whole cell, which reads as confetti.
float snowGlints(vec3 wp, float scale, float sharp, float keep, vec3 N, vec3 H, float seed) {
  vec3 q = wp * scale;
  vec3 cell = floor(q);
  vec3 r = snowHash3(cell + seed);
  if (r.z > keep) return 0.0;
  vec3 facet = normalize(N + (snowHash3(cell + seed + 7.13) * 2.0 - 1.0) * 0.6);
  float g = pow(max(dot(facet, H), 0.0), sharp);
  vec3 f = fract(q) - (0.2 + 0.6 * r);
  float rad = max(0.14, length(fwidth(q)) * 0.75);
  float spot = 1.0 - smoothstep(rad * 0.45, rad, length(f));
  float k = 0.14 / rad;
  return g * spot * k * k;
}

// Per-fragment state the later grafts read.
vec3 snowN;          // world normal
float snowDist;      // metres from the lens
float snowPacked;    // 0 powder .. 1 groomed
float snowPress;     // 0 untouched .. 1 a full furrow
float snowWall;      // how steep the furrow's wall is here
float snowForest;    // how wooded the ground round here is
`;

/** Straight after `clipping_planes_fragment`: throw away what the finer
 * level already covers, and work out everything about this bit of snow. */
export const SNOW_FRAGMENT_SAMPLE = /* glsl */ `
{
  vec2 p = vSnowWorld.xz;
  if (uHole.w > 0.5) {
    vec2 dh = abs(p - uHole.xy);
    if (max(dh.x, dh.y) < uHole.z) discard;
  }
  vec3 eye = vSnowWorld - cameraPosition;
  snowDist = length(eye);
  vec2 guv = (p - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
  vec4 g = texture2D(uGround, guv);
  snowPacked = g.b;
  snowForest = g.a;
  vec2 grad = g.rg;
  // The loose cover's step at the track's shoulders.
  {
    vec2 du = vec2(0.5 / uHeightCount.x, 0.0);
    vec2 dv = vec2(0.0, 0.5 / uHeightCount.y);
    vec2 pg = vec2(texture2D(uGround, guv + du).b - texture2D(uGround, guv - du).b,
                   texture2D(uGround, guv + dv).b - texture2D(uGround, guv - dv).b) / uCell;
    grad -= ${LOOSE.toFixed(3)} * pg;
  }
  // Past the map the ground's texture is clamped; the rim's slope is
  // steep and the lighting the vertex normal gives it is enough.
  vec2 inside = clamp(p, uHeightOrigin, uHeightOrigin + (uHeightCount - 1.0) * uCell);
  float past = length(p - inside);
  if (past > 0.0) {
    vec3 vn = normalize(vSnowNormal);
    grad = mix(grad, -vn.xz / max(vn.y, 0.2), smoothstep(0.0, 30.0, past));
  }

  // THE FURROWS, per pixel.
  vec2 tr = trailAt(p);
  snowPress = clamp(tr.x / 0.14, 0.0, 1.0);
  snowWall = 0.0;
  if (snowDist < 220.0) {
    float fineW = trailFineWeight(p);
    float e = mix(uCoarseTexel, uFineTexel * 1.25, fineW);
    vec2 tg = vec2(trailRelief(p + vec2(e, 0.0)) - trailRelief(p - vec2(e, 0.0)),
                   trailRelief(p + vec2(0.0, e)) - trailRelief(p - vec2(0.0, e))) / (2.0 * e);
    tg *= 1.0 - smoothstep(120.0, 220.0, snowDist);
    snowWall = clamp(length(tg), 0.0, 1.0);
    grad += tg;
  }

  // THE MICRO-RELIEF: wind-packed swells a few metres long, and a finer
  // grain, both faded out before they alias.
  float nearFade = 1.0 - smoothstep(20.0, 90.0, snowDist);
  float midFade = 1.0 - smoothstep(60.0, 400.0, snowDist);
  grad += snowNoiseGrad(p * 0.23, 0.35) * 0.23 * 0.35 * midFade * (1.0 - snowPacked);
  grad += snowNoiseGrad(p * 1.7, 0.3) * 1.7 * 0.025 * nearFade;
  grad += snowNoiseGrad(p * 7.0, 0.3) * 7.0 * 0.004 * nearFade * (1.0 - snowPress);

  // THE CORDUROY: the groomer's comb, running along the track.
  vec4 td = texture2D(uTrackDir, guv);
  float along = length(td.xy * 2.0 - 1.0);
  if (snowPacked > 0.05 && along > 0.05) {
    vec2 dd = td.xy * 2.0 - 1.0;
    float th = 0.5 * atan(dd.y, dd.x);
    vec2 across = vec2(cos(th), -sin(th));
    float phase = dot(p, across) * 6.2831853 / 0.14;
    float aa = 1.0 - smoothstep(0.35, 0.9, fwidth(phase));
    float k = snowPacked * min(along * 2.0, 1.0) * aa * (1.0 - snowPress * 0.7);
    grad += across * cos(phase) * 0.14 * k;
  }

  snowN = normalize(vec3(-grad.x, 1.0, -grad.y));
}
`;

/** After `color_fragment`: the albedo. */
export const SNOW_FRAGMENT_COLOUR = /* glsl */ `
{
  vec2 p = vSnowWorld.xz;
  vec3 fresh = vec3(0.95, 0.975, 1.0);
  vec3 shade = vec3(0.84, 0.9, 0.98);
  float drift = snowNoise(p * 0.018) * 0.6 + snowNoise(p * 0.07) * 0.4;
  vec3 alb = mix(fresh, shade, drift * 0.32);
  // Groomed: greyer and a touch warmer — worked snow on its way to ice.
  alb = mix(alb, vec3(0.7, 0.75, 0.82), snowPacked * 0.9);
  // Pressed snow is on its way to ice: a little less comes back.
  alb *= mix(vec3(1.0), vec3(0.9, 0.93, 0.97), snowPress);
  // The walls see less sky; a blue-grey the shading alone would not give.
  alb *= mix(vec3(1.0), vec3(0.8, 0.86, 0.95), snowWall * 0.8);
  // A wood seen from afar is a darker, greener ground — the trees past the
  // draw distance are still there in its colour.
  alb = mix(alb, vec3(0.32, 0.4, 0.38), snowForest * 0.55 * smoothstep(160.0, 520.0, snowDist));
  diffuseColor.rgb = alb * ${GLARE.toFixed(3)};
}
`;

/** After `roughnessmap_fragment`: groomed snow is glossier. */
export const SNOW_FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(0.85, 0.55, snowPacked) - 0.1 * snowPress;
`;

/** After `normal_fragment_maps`: the per-pixel normal replaces the mesh's. */
export const SNOW_FRAGMENT_NORMAL = /* glsl */ `
normal = normalize((viewMatrix * vec4(snowN, 0.0)).xyz);
`;

/** After `lights_fragment_end`: the light that went in and came back out,
 * the crystals, the flat light's last relief and the sleds' lamps.
 * `directLight` still holds the key as the loop left it — shadowed —
 * because there is one directional light and it is last.
 *
 * FLAT LIGHT (`uFlat`, `sky.ts`): under a lid the key is a glow and the
 * hemisphere is the same white above and below, so the snow loses its
 * shading and a bump reads as nothing — which is the weather, and is kept.
 * What is left is what a rider really sees in flat light: the lid is
 * brighter over where the sun is, so a slope facing it is a touch lighter
 * than one turned away. That is the one cue drawn, at a tenth of the
 * contrast a sun gives: readable, but hard.
 *
 * THE LAMPS (`uLamp*`): each sled's headlamp is a cone from its nose,
 * falling off with the square of the distance, with a little spill round
 * the pool; the snow in it glitters toward the lamp as it does toward the
 * sun, which is what makes a lit pool of snow read as snow at night. */
export const SNOW_FRAGMENT_LIGHT = /* glsl */ `
{
  vec3 lidDir = normalize(vec3(uSunPos.x, 2.2, uSunPos.z));
  float facing = clamp(dot(snowN, lidDir) / lidDir.y, 0.0, 1.3);
  reflectedLight.indirectDiffuse *= mix(1.0, 0.55 + 0.45 * facing, uFlat);
}
{
  vec3 V = normalize(cameraPosition - vSnowWorld);
  float loose = (1.0 - snowPacked * 0.8) * (1.0 - snowPress * 0.6);
  vec3 lampLit = vec3(0.0);
  float lampGlint = 0.0;
  for (int i = 0; i < ${LAMP_SLOTS}; i++) {
    if (uLampOn[i] <= 0.001) continue;
    vec3 L = uLampPos[i] - vSnowWorld;
    float d = length(L);
    L /= max(d, 1e-3);
    float axis = dot(-L, uLampDir[i]);
    float beam = smoothstep(0.86, 0.975, axis) + 0.1 * smoothstep(0.35, 0.86, axis);
    float e = uLampOn[i] * beam / (1.0 + 0.012 * d * d);
    lampLit += vec3(e * max(dot(snowN, L), 0.0));
    if (snowDist < 40.0) {
      vec3 H = normalize(L + V);
      lampGlint += e * snowGlints(vSnowWorld, 7.0, 600.0, 0.6, snowN, H, 57.0);
    }
  }
  reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * uLampCol * lampLit * 9.0;
  reflectedLight.directSpecular += uLampCol * lampGlint * loose
    * (1.0 - smoothstep(12.0, 40.0, snowDist)) * 12.0;
}
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunLit = directLight.color;
  float ndl = dot(snowN, uSunDir);
  // Wrap: what the terminator gains, tinted the blue of light that has been
  // through a few centimetres of ice.
  float wrap = (max(0.0, (ndl + 0.45) / 1.45) - max(ndl, 0.0)) * (1.0 - 0.7 * uFlat);
  reflectedLight.directDiffuse +=
    BRDF_Lambert(diffuseColor.rgb) * sunLit * wrap * vec3(0.55, 0.78, 1.0) * 0.9;

  // THE GLITTER, two sizes of crystal cell: the fine one close in, a
  // sparser, larger one carrying it a little further out.
  vec3 V = normalize(cameraPosition - vSnowWorld);
  vec3 H = normalize(uSunDir + V);
  float loose = (1.0 - snowPacked * 0.8) * (1.0 - snowPress * 0.6);
  float glint = snowGlints(vSnowWorld, 7.0, 600.0, 0.6, snowN, H, 0.0)
    * (1.0 - smoothstep(15.0, 45.0, snowDist));
  glint += snowGlints(vSnowWorld, 2.5, 900.0, 0.35, snowN, H, 31.0)
    * smoothstep(8.0, 25.0, snowDist) * (1.0 - smoothstep(50.0, 140.0, snowDist));
  reflectedLight.directSpecular += sunLit * glint * loose * 18.0 * uGlitter;
}
#endif
`;
