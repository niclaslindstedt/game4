// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD RENDERER — the one thing `renderer-api.ts` promises the shell,
// built here out of the modules that each own a part of the picture:
//
//   environment.ts  the sun, the sky's light, the dome and the haze
//   terrain.ts      the ground: a clipmap round the lens, shaded as snow
//   trail-map.ts    every furrow any rider has cut, lowering that snow
//   forest.ts       the snow-loaded conifers, in three bands of distance
//   gates.ts        the checkpoints' poles and flags, the start banner
//   sled-body.ts    the four machines and their riders
//   spray.ts        the roost, the ski spray and the landing puff
//   camera.ts       the ladder of lenses and the hand-over between them
//
// It READS `GameState` and never writes it. Everything that depends on the
// map is built in `load`; `draw` only moves things. Every rider — the player
// and each rival — is drawn at `alpha` of a step on from the step before
// (`interp.ts`), since the engine keeps no previous pose of its own.

import * as THREE from "three";
import { SLED, TUNING, totalMass, type GameState, type Level, type SledState } from "@engine";

import { createLens, type Lens } from "./camera.ts";
import { createLineClear } from "./camera-clear.ts";
import type { LensPose, LineClear, RigPose } from "./camera-rigs.ts";
import { createEnvironment, type Environment } from "./environment.ts";
import { createForest, FOREST_QUALITY, type Forest } from "./forest.ts";
import { createGates, type Gates } from "./gates.ts";
import { hazeMaterial } from "./haze.ts";
import { createTrack, observe, sample, type Pose, type PoseTrack } from "./interp.ts";
import type { CameraRung, WorldRenderer } from "./renderer-api.ts";
import { createSledModel, SLED_STYLES, type SledModel } from "./sled-body.ts";
import { skyLookAt } from "./sky.ts";
import { LOOSE } from "./snow-glsl.ts";
import { createSpray, type Spray } from "./spray.ts";
import { createTerrain, TERRAIN_QUALITY, type Terrain } from "./terrain.ts";
import { createTrailMap, TRAIL_QUALITY, type TrailMap } from "./trail-map.ts";
import { createPen, drawnDepth, stampsOf, type Stamp, type TrailPen } from "./trail-stamp.ts";

export type Quality = "high" | "low";

export type RendererOptions = {
  quality?: Quality;
  /** Keep the last frame in the canvas after it is shown (a lab that reads
   * the pixels back). */
  preserveDrawingBuffer?: boolean;
};

/** What the renderer can say about its own last frame. */
export type FrameInfo = { calls: number; triangles: number; points: number };

/** The seam, plus what a lab or a debug overlay may also ask. */
export type WorldRendererExt = WorldRenderer & {
  /** Change rung; `cut` skips the flown hand-over. */
  setCamera(rung: CameraRung, cut?: boolean): void;
  /** `present` false does everything a frame does — the trails stamped,
   * the spray flown, the lens moved — except draw the picture: how a lab
   * fast-forwards a run without losing the furrows it cut. */
  draw(state: GameState, alpha: number, dt: number, present?: boolean): void;
  /** Stand the lens at a fixed place instead of the ladder (a lab's view);
   * null hands it back. */
  setOverride(view: LensPose | null): void;
  info(): FrameInfo;
  /** The three.js renderer, for a lab that needs to read pixels. */
  readonly gl: THREE.WebGLRenderer;
};

const NEAR = 0.1;
const FAR = 6000;

type Rider = {
  model: SledModel;
  track: PoseTrack;
  pen: TrailPen;
  drawn: Pose;
  /** The drawn furrow's depth past the physics' own, smoothed, m. */
  sink: number;
  wasAirborne: boolean;
  vy: number;
  airTime: number;
};

/** The runs a frame draws: the player's first, then the field's. */
function runsOf(state: GameState): GameState[] {
  return [state, ...state.rivals.map((r) => r.run)];
}

export function createWorldRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions = {},
): WorldRendererExt {
  const quality = options.quality ?? "high";
  const gl = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.05;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const lens: Lens = createLens(NEAR, FAR);
  scene.add(lens.camera);
  const env: Environment = createEnvironment(scene, quality === "high" ? 2048 : 1024, FAR * 0.9);
  const wrap = <M extends THREE.Material>(m: M, name: string): M => hazeMaterial(m, env.haze, name);

  let level: Level | null = null;
  let terrain: Terrain | null = null;
  let forest: Forest | null = null;
  let gates: Gates | null = null;
  let trail: TrailMap | null = null;
  let spray: Spray | null = null;
  let clear: LineClear | undefined;
  let riders: Rider[] = [];
  const stamps: Stamp[] = [];
  let lastTick = -1;
  let lastState: GameState | null = null;
  let override: LensPose | null = null;
  const rigPose: RigPose = {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    speed: 0,
    airborne: false,
    q: { x: 0, y: 0, z: 0, w: 1 },
  };
  const nominalLoad = (totalMass(SLED) * 9.81) / 10;

  function unload() {
    terrain?.dispose();
    forest?.dispose();
    gates?.dispose();
    trail?.dispose();
    spray?.dispose();
    for (const r of riders) r.model.dispose();
    for (const o of [terrain?.group, forest?.group, gates?.group, spray?.points]) {
      if (o) scene.remove(o);
    }
    for (const r of riders) scene.remove(r.model.root);
    terrain = forest = gates = trail = spray = null;
    clear = undefined;
    riders = [];
    level = null;
  }

  const breathe = () => new Promise<void>((done) => setTimeout(done, 0));

  function riderFor(i: number): Rider {
    const model = createSledModel(SLED_STYLES[i % SLED_STYLES.length], wrap);
    scene.add(model.root);
    return {
      model,
      track: createTrack(),
      pen: createPen(16),
      drawn: { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } },
      sink: 0,
      wasAirborne: false,
      vy: 0,
      airTime: 0,
    };
  }

  /** How much deeper the drawn furrow is than the physics' sink under the
   * tread — the machine is drawn that much lower, so it sits IN the trough
   * it is cutting rather than hovering over it. */
  function extraSink(sled: SledState): number {
    if (!level) return 0;
    let sum = 0;
    let n = 0;
    for (const c of sled.contacts) {
      if (c.kind !== "tread" || !c.touching) continue;
      const packed = level.packedAt(c.x, c.z);
      // The drawn surface under the probe is the loose cover's height over
      // the ground less the furrow; the physics has it at the ground less
      // its own sink.
      sum += drawnDepth(c, packed) - c.sink - LOOSE * (1 - packed);
      n++;
    }
    return n > 0 ? Math.max(-0.1, Math.min(0.2, (sum / n) * 0.85)) : 0;
  }

  const api: WorldRendererExt = {
    gl,
    async load(state) {
      unload();
      level = state.level;
      const lv = level;
      trail = createTrailMap(lv.size, TRAIL_QUALITY[quality]);
      trail.clear(gl);
      await breathe();
      terrain = createTerrain(lv, env.haze, trail.uniforms, TERRAIN_QUALITY[quality]);
      scene.add(terrain.group);
      await breathe();
      forest = createForest(lv, env.haze, FOREST_QUALITY[quality]);
      scene.add(forest.group);
      gates = createGates(lv, env.haze);
      clear = createLineClear(lv);
      scene.add(gates.group);
      spray = createSpray(env.haze);
      scene.add(spray.points);
      riders = runsOf(state).map((_, i) => riderFor(i));
      lastTick = -1;
      lastState = null;
      lens.snap();
      await breathe();
      // Compile every program now rather than on the first frame of the run.
      const sled = state.sled;
      lens.camera.position.set(sled.x, sled.y + 3, sled.z - 6);
      lens.camera.lookAt(sled.x, sled.y, sled.z);
      terrain.follow(sled.x, sled.z);
      // Asynchronously where the driver can; three warns and falls back to
      // a blocking compile anyway where it cannot, so ask first.
      if (gl.extensions.has("KHR_parallel_shader_compile")) {
        await gl.compileAsync(scene, lens.camera);
      } else {
        gl.compile(scene, lens.camera);
      }
    },

    draw(state: GameState, alpha: number, dt: number, present = true) {
      if (!level || state.level !== level || !terrain || !trail || !spray) return;
      const runs = runsOf(state);
      while (riders.length < runs.length) riders.push(riderFor(riders.length));
      const fresh = state !== lastState || state.tick < lastTick;
      if (fresh) {
        // A new run on the same map: the trails and the spray start clean.
        if (lastState !== null) {
          trail.clear(gl);
          spray.clear();
        }
        for (const r of riders) {
          r.track = createTrack();
          r.pen = createPen(16);
        }
        lens.snap();
        lastTick = -1;
        lastState = state;
      }
      const stepped = lastTick < 0 ? 0 : Math.max(0, state.tick - lastTick);
      const simDt = Math.min(stepped * TUNING.dt, 0.25);

      stamps.length = 0;
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        const r = riders[i];
        const sled = run.sled;
        observe(r.track, sled, run.tick);
        sample(r.track, alpha, r.drawn);
        const want = extraSink(sled);
        r.sink += (want - r.sink) * (1 - Math.exp(-dt * 10));
        r.model.pose(sled, r.drawn, r.sink);
        if (stepped > 0 || lastTick < 0) {
          stampsOf(sled.contacts, r.pen, level.packedAt, nominalLoad, stamps);
        }
        // The landing puff: grounded now, in the air at the last frame.
        let landed = 0;
        if (r.wasAirborne && !sled.airborne && r.airTime > 0.25) {
          landed = Math.abs(r.vy) + r.airTime * 2;
        }
        if (simDt > 0 || landed > 0) spray.emit(sled, level, simDt, landed);
        r.wasAirborne = sled.airborne;
        r.airTime = sled.airborne ? sled.airTime : r.airTime * (sled.airborne ? 1 : 0);
        if (sled.airborne) r.vy = sled.vy;
      }
      lastTick = state.tick;

      const player = riders[0];
      const sled = state.sled;
      const d = player.drawn;
      rigPose.x = d.x;
      rigPose.y = d.y - player.sink;
      rigPose.z = d.z;
      rigPose.q = d.q;
      rigPose.heading = sled.heading;
      rigPose.pitch = sled.pitch;
      rigPose.roll = sled.roll;
      rigPose.vx = sled.vx;
      rigPose.vy = sled.vy;
      rigPose.vz = sled.vz;
      rigPose.speed = sled.speed;
      rigPose.airborne = sled.airborne;
      const inside = lens.rung() === "hood" || lens.rung() === "bars";
      player.model.setRiderVisible(!inside);
      lens.frame(rigPose, Math.min(dt, 0.1), level.groundAt, clear);
      if (override) {
        const cam = lens.camera;
        cam.position.set(override.eye.x, override.eye.y, override.eye.z);
        cam.lookAt(override.target.x, override.target.y, override.target.z);
        cam.fov = override.fov;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        player.model.setRiderVisible(true);
      }

      trail.update(gl, stamps, sled.x, sled.z);
      terrain.follow(lens.camera.position.x, lens.camera.position.z);
      if (present) forest?.update(lens.camera);
      gates?.update(state.progress.nextCheckpoint, state.t);

      const look = skyLookAt(level, state.t);
      env.update(look, lens.camera, d.x, d.y, d.z);
      const h = gl.domElement.height;
      spray.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(lens.camera.fov) / 2)));
      spray.update(Math.min(dt, 0.1), look, level);

      if (present) gl.render(scene, lens.camera);
    },

    setOverride(view) {
      override = view;
    },

    setCamera(rung: CameraRung, cut: boolean = false) {
      lens.set(rung, cut);
    },
    camera() {
      return lens.rung();
    },
    resize(width, height, pixelRatio) {
      gl.setPixelRatio(pixelRatio);
      gl.setSize(width, height, false);
      lens.camera.aspect = width / Math.max(1, height);
      lens.camera.updateProjectionMatrix();
      forest?.invalidate();
    },
    info() {
      const r = gl.info.render;
      return { calls: r.calls, triangles: r.triangles, points: r.points };
    },
    dispose() {
      unload();
      env.dispose();
      gl.dispose();
    },
  };
  return api;
}
