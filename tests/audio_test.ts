// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIO GUARDS — the faults in this subsystem that are invisible without
// a test, because every one of them is a SILENCE rather than a crash:
//
//   * AN EVENT NOTHING ANSWERS. A `GameEvent` the race should be heard for
//     arrives and simply makes no noise; nothing anywhere reports it.
//   * A MIX THAT CREEPS. Every retune nudges one sound up to be heard over
//     the last one, until the limiter is doing all the work.
//   * A BED THAT SAYS NOTHING. An engine that does not change in the air, a
//     hiss as loud at rest as at pace — a bed whose numbers are constants is
//     the loudest thing in the mix for the whole race.
//   * A BED THAT HOLDS. The pause card up and the engine note playing on
//     behind it — a layer that is not told to stop does not.
//   * A CUTOFF PAST NYQUIST. Fine on a laptop, a torn speaker on the 16 kHz
//     session iOS hands a Bluetooth headset.
//
// No DOM: the synth is replaced with a recorder, which is also the only way
// to assert what a sound actually asked the instrument for.

import { describe, expect, it } from "vitest";

import { createGame, placeRun, type GameEvent, type GameState } from "@engine";

import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import {
  ENGINE_LAYERS,
  FIRINGS_PER_REV,
  beltHz,
  engineTargets,
  noteHz,
  revOf,
  rpmAt,
  type EngineLayer,
  type EngineVoice,
} from "../pwa/src/game/audio/engine-voice.ts";
import { LISTENERS, listenerFor } from "../pwa/src/game/audio/listener.ts";
import { DEFAULT_VOLUME, playDef } from "../pwa/src/game/audio/play.ts";
import { createRideBed } from "../pwa/src/game/audio/ride-bed.ts";
import { heardFrom, soundForEvent, soundsForStep } from "../pwa/src/game/audio/route.ts";
import {
  SNOW_LAYERS,
  snowTargets,
  type SnowLayer,
  type SnowVoice,
} from "../pwa/src/game/audio/snow-voice.ts";
import { RUN_CAMERAS } from "../pwa/src/game/settings.ts";
import {
  safeCutoff,
  type LayerSpec,
  type LayerTarget,
  type NoiseOptions,
  type Synth,
  type ToneOptions,
} from "../pwa/src/lib/voice.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** One layer the recorder built: what it was made of, every target it was
 * steered to, and whether it is still standing. */
type RecordedLayer = { spec: LayerSpec; sets: LayerTarget[]; stopped: boolean };

/** A synth that plays nothing and remembers everything, with a lock the test
 * can throw. */
function recorder(): Synth & {
  tones: ToneOptions[];
  noises: NoiseOptions[];
  layers: RecordedLayer[];
  locked: boolean;
} {
  const rec = {
    tones: [] as ToneOptions[],
    noises: [] as NoiseOptions[],
    layers: [] as RecordedLayer[],
    locked: false,
    unlock: () => {},
    resume: () => {},
    now: () => (rec.locked ? null : 0),
    tone: (o: ToneOptions) => void rec.tones.push(o),
    noise: (o: NoiseOptions) => void rec.noises.push(o),
    layer(spec: LayerSpec) {
      if (rec.locked) return null;
      const layer: RecordedLayer = { spec, sets: [], stopped: false };
      rec.layers.push(layer);
      return {
        set: (target: LayerTarget) => void layer.sets.push(target),
        stop: () => {
          layer.stopped = true;
        },
        alive: () => !layer.stopped,
      };
    },
  };
  return rec;
}

/** One sample of every event the engine can emit, keyed by kind so the TYPE
 * keeps the list complete: a new `GameEvent` does not compile until a
 * sample for it is written here. */
const EVERY_EVENT_BY_KIND: { [K in GameEvent["kind"]]: Extract<GameEvent, { kind: K }> } = {
  count: { kind: "count", t: 1, left: 3 },
  go: { kind: "go", t: 3 },
  air: { kind: "air", t: 1, vy: 4, speed: 20 },
  land: { kind: "land", t: 1, airTime: 0.9, impact: 5, speed: 20, harsh: false, lost: 0 },
  hit: { kind: "hit", t: 1, speed: 9, x: 0, z: 0 },
  bump: { kind: "bump", t: 1, rival: 1, speed: 6 },
  checkpoint: { kind: "checkpoint", t: 1, index: 3, lap: 0, split: 30 },
  missed: { kind: "missed", t: 1, index: 3 },
  lap: { kind: "lap", t: 1, lap: 1, time: 60 },
  finish: { kind: "finish", t: 1, time: 180, place: 1 },
  reset: { kind: "reset", t: 1, checkpoint: 2, auto: false },
};

/** The kinds the bank says nothing about, with the reason: the lip is the
 * engine's moment — it unloads and screams — not a one-shot's. */
const SILENT_KINDS: GameEvent["kind"][] = ["air"];

/** The ceiling a context at 16 kHz holds a cutoff under. */
const HEADSET = safeCutoff(1e9, 16000);

describe("the bank and the route (bank.ts, route.ts)", () => {
  it("answers every event the race should be heard for, from a def that exists", () => {
    for (const event of Object.values(EVERY_EVENT_BY_KIND)) {
      const hit = soundForEvent(event);
      if (SILENT_KINDS.includes(event.kind)) {
        expect(hit, event.kind).toBe(null);
        continue;
      }
      expect(hit, event.kind).not.toBe(null);
      expect(RUN_BANK[hit!.id], `${event.kind} → ${hit!.id}`).toBeDefined();
    }
  });

  it("describes every sound, and keeps every voice under the mixing ceiling", () => {
    for (const [id, def] of Object.entries(RUN_BANK)) {
      expect(def.description.length, id).toBeGreaterThan(60);
      expect(def.voices.length, id).toBeGreaterThan(0);
      for (const v of def.voices) {
        expect(v.volume ?? DEFAULT_VOLUME[v.call], id).toBeLessThanOrEqual(0.08);
        if (v.filter) {
          expect(v.filter.frequency, id).toBeLessThanOrEqual(HEADSET);
          if (v.filter.to !== undefined) expect(v.filter.to, id).toBeLessThanOrEqual(HEADSET);
        }
      }
    }
  });

  it("picks the hard landing for a harsh one, and sizes both by the impact", () => {
    const soft = soundForEvent({ ...EVERY_EVENT_BY_KIND.land, impact: 2 })!;
    const big = soundForEvent({ ...EVERY_EVENT_BY_KIND.land, impact: 10 })!;
    expect(soft.id).toBe("land_soft");
    expect(big.shape!.gain!).toBeGreaterThan(soft.shape!.gain!);
    expect(soundForEvent({ ...EVERY_EVENT_BY_KIND.land, harsh: true })!.id).toBe("land_hard");
    // A skip over a mogul is the bed's, not a landing.
    expect(soundForEvent({ ...EVERY_EVENT_BY_KIND.land, airTime: 0.1 })).toBe(null);
  });

  it("plays one sound once per step, and lets the flag stand over the lap it closes", () => {
    const step: GameEvent[] = [
      EVERY_EVENT_BY_KIND.checkpoint,
      { ...EVERY_EVENT_BY_KIND.checkpoint, index: 4 },
      EVERY_EVENT_BY_KIND.lap,
      EVERY_EVENT_BY_KIND.finish,
    ];
    expect(soundsForStep(step).map((s) => s.id)).toEqual(["checkpoint", "finish"]);
  });

  it("shapes a one-shot by the seat it is heard from, filters and all", () => {
    const rec = recorder();
    const shape = heardFrom({ gain: 1, pitch: 1 }, LISTENERS.high);
    playDef(rec, RUN_BANK.hit_tree, shape);
    const crack = rec.noises[0];
    expect(crack.volume!).toBeLessThan(RUN_BANK.hit_tree.voices[0].volume!);
    expect(crack.filter!.frequency).toBeLessThan(RUN_BANK.hit_tree.voices[0].filter!.frequency);
  });
});

describe("the engine bed (engine-voice.ts)", () => {
  const mix = { engine: 1, exhaust: 1, tone: 1 };
  const voice = (o: Partial<EngineVoice>): EngineVoice => ({
    rpm: 6000,
    rev: revOf(6000, 1500, 8400),
    throttle: 1,
    load: 1,
    treadSpeed: 20,
    slip: 0,
    ...o,
  });

  it("pitches the note off the crank — a twin two-stroke fires twice a revolution", () => {
    expect(FIRINGS_PER_REV).toBe(2);
    expect(noteHz(6000)).toBe(200);
    const t = engineTargets(voice({ rpm: 6000 }), mix);
    expect(t.hum.hz).toBe(200);
    expect(engineTargets(voice({ rpm: 8000 }), mix).hum.hz!).toBeGreaterThan(t.hum.hz!);
  });

  it("pitches the belt off the TRACK, not the crank — a CVT's whole story", () => {
    const slow = engineTargets(voice({ treadSpeed: 5 }), mix);
    const fast = engineTargets(voice({ treadSpeed: 30 }), mix);
    expect(fast.belt.hz!).toBeCloseTo(beltHz(30));
    expect(fast.belt.hz!).toBeGreaterThan(slow.belt.hz!);
    expect(fast.hum.hz).toBe(slow.hum.hz);
    expect(engineTargets(voice({ treadSpeed: 0 }), mix).belt.level).toBe(0);
  });

  it("sounds thinner off the snow: no load, less body at the same revs", () => {
    const working = engineTargets(voice({ load: 1 }), mix);
    const free = engineTargets(voice({ load: 0 }), mix);
    expect(free.hum.level).toBeLessThan(working.hum.level);
    expect(free.bass.level).toBeLessThan(working.bass.level);
  });

  it("comes on the pipe only up the band", () => {
    expect(engineTargets(voice({ rev: 0.2 }), mix).rasp.level).toBe(0);
    expect(engineTargets(voice({ rev: 0.9 }), mix).rasp.level).toBeGreaterThan(0);
  });

  it("keeps every cutoff under the headset's Nyquist and every level non-negative", () => {
    for (let rev = 0; rev <= 1.06; rev += 0.106) {
      for (const throttle of [0, 0.5, 1]) {
        for (const treadSpeed of [0, 15, 40]) {
          const t = engineTargets(
            voice({
              rpm: rpmAt(rev, 1500, 8400),
              rev,
              throttle,
              load: throttle,
              treadSpeed,
              slip: 8,
            }),
            mix,
          );
          for (const name of Object.keys(t) as EngineLayer[]) {
            if (t[name].cutoff !== undefined)
              expect(t[name].cutoff!, name).toBeLessThanOrEqual(HEADSET);
            expect(t[name].level, name).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
    expect(Object.keys(ENGINE_LAYERS).sort()).toEqual(
      Object.keys(engineTargets(voice({}), mix)).sort(),
    );
  });
});

describe("the snow bed (snow-voice.ts)", () => {
  const mix = { snow: 1, wind: 1 };
  const voice = (o: Partial<SnowVoice>): SnowVoice => ({
    speed: 20,
    pace: 0.6,
    packed: 1,
    grounded: 1,
    steer: 0,
    treadSpeed: 22,
    wind: 20,
    airborne: false,
    ...o,
  });

  it("crossfades the hiss of the packed track into the rush of powder", () => {
    const track = snowTargets(voice({ packed: 1 }), mix);
    const powder = snowTargets(voice({ packed: 0 }), mix);
    expect(track.hiss.level).toBeGreaterThan(0);
    expect(track.powder.level).toBe(0);
    expect(powder.powder.level).toBeGreaterThan(0);
    expect(powder.hiss.level).toBe(0);
  });

  it("is silent at rest and says nothing of the snow in the air — but the wind comes up", () => {
    const rest = snowTargets(voice({ speed: 0, pace: 0, treadSpeed: 0, wind: 0 }), mix);
    for (const name of Object.keys(rest) as SnowLayer[]) expect(rest[name].level, name).toBe(0);
    const air = snowTargets(voice({ airborne: true }), mix);
    const ground = snowTargets(voice({}), mix);
    expect(air.hiss.level).toBe(0);
    expect(air.tread.level).toBe(0);
    expect(air.wind.level).toBeGreaterThan(ground.wind.level);
  });

  it("carves with the lock on the hardpack, and keeps its cutoffs under the headset", () => {
    expect(snowTargets(voice({ steer: 0 }), mix).carve.level).toBe(0);
    expect(snowTargets(voice({ steer: 1 }), mix).carve.level).toBeGreaterThan(0);
    for (const pace of [0, 0.5, 1.2]) {
      const t = snowTargets(voice({ pace, speed: pace * 33, treadSpeed: 60, wind: 80 }), mix);
      for (const name of Object.keys(t) as SnowLayer[]) {
        expect(t[name].cutoff!, name).toBeLessThanOrEqual(HEADSET);
      }
    }
    expect(Object.keys(SNOW_LAYERS).sort()).toEqual(
      Object.keys(snowTargets(voice({}), mix)).sort(),
    );
  });
});

describe("the listener (listener.ts)", () => {
  it("has a seat for every rung of the ladder and the cards' orbit", () => {
    for (const rung of [...RUN_CAMERAS, "orbit" as const])
      expect(LISTENERS[rung], rung).toBeDefined();
    expect(listenerFor("nowhere")).toBe(LISTENERS.chase);
  });

  it("thins the machine as the camera stands back", () => {
    expect(LISTENERS.high.engine).toBeLessThan(LISTENERS.chase.engine);
    expect(LISTENERS.orbit.engine).toBeLessThan(LISTENERS.high.engine);
    expect(LISTENERS.hood.snow).toBeGreaterThan(LISTENERS.chase.snow);
  });
});

describe("the ride bed (ride-bed.ts)", () => {
  /** A sled on the stadium's straight, going. */
  function going(speed: number): GameState {
    const state = createGame({
      level: syntheticLevel(),
      seed: 3,
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 400, z: 400, heading: Math.PI / 2, speed });
    return state;
  }
  const LAYERS = Object.keys(ENGINE_LAYERS).length + Object.keys(SNOW_LAYERS).length;

  it("builds every layer once and steers it every frame, booking nothing ahead", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = going(20);
    for (let i = 0; i < 30; i++) bed.update(state, 1 / 60);
    expect(rec.layers.length).toBe(LAYERS);
    expect(bed.live()).toBe(LAYERS);
    for (const layer of rec.layers) expect(layer.sets.length).toBe(30);
    expect(rec.tones.length + rec.noises.length).toBe(0);
  });

  it("is silent while the context is locked and builds the moment it is back", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    rec.locked = true;
    bed.update(going(10), 1 / 60);
    expect(rec.layers.length).toBe(0);
    rec.locked = false;
    bed.update(going(10), 1 / 60);
    expect(bed.live()).toBe(LAYERS);
  });

  it("says its silence: every layer comes down, and comes back on the next frame", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = going(15);
    bed.update(state, 1 / 60);
    bed.silence();
    expect(bed.live()).toBe(0);
    expect(rec.layers.every((l) => l.stopped)).toBe(true);
    bed.update(state, 1 / 60);
    expect(bed.live()).toBe(LAYERS);
  });

  it("scales the whole bed by the duck under a card", () => {
    const loud = recorder();
    const quiet = recorder();
    const state = going(20);
    createRideBed(loud).update(state, 1 / 60, 1);
    createRideBed(quiet).update(state, 1 / 60, 0.5);
    const sum = (r: ReturnType<typeof recorder>) =>
      r.layers.reduce((acc, l) => acc + (l.sets[0]?.level ?? 0), 0);
    expect(sum(quiet)).toBeCloseTo(sum(loud) / 2, 6);
  });
});
