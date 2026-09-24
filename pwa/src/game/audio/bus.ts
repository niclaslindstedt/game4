// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's single audio surface: ONE underlying synth (one AudioContext),
// wrapped into two volume-scaled VIEWS — the machine's own voice (the engine
// and the belt) and every other sound — each under its OPTIONS fader, with
// the master and the SOUND switch folded into both (`mixOf` in
// `settings.ts`, which remembers all of it).
// Unlocking on any user gesture unlocks everything, because there is only
// ever one context to unlock.
//
// One synth rather than one per subsystem is not a saving, it is the
// requirement: a browser gives a page one usable AudioContext's worth of
// goodwill, and the echo bus and the master limiter only do their jobs if
// every voice in the game — the engine, a landing, a chime — passes
// through the same pair.

import { createSynth } from "../../lib/synth.ts";
import type { Layer, Synth } from "../../lib/voice.ts";

const raw = createSynth();

let engineVolume = 1;
let effectsVolume = 1;

/** Clamp to the 0–1 the fader promises. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Set the two 0–1 volumes, the master and the switch already folded in. */
export function setAudioVolumes(v: { engine: number; effects: number }): void {
  engineVolume = clamp01(v.engine);
  effectsVolume = clamp01(v.effects);
}

/**
 * A synth view whose every sound is scaled by a live master volume.
 *
 * The defaults mirror the synth's own, because a voice that leaves `volume`
 * off still has to be scaled by the fader — and the only way to scale a
 * default is to know it. A one-shot scaled to nothing is skipped outright
 * rather than played at zero. A LAYER is steered every frame, so the switch
 * is read every frame and one thrown mid-race is heard at once.
 */
function scaledView(volume: () => number): Synth {
  return {
    unlock: () => raw.unlock(),
    resume: () => raw.resume(),
    now: () => raw.now(),
    tone(options) {
      const scaled = (options.volume ?? 0.06) * volume();
      if (scaled < 0.001) return;
      raw.tone({ ...options, volume: scaled });
    },
    noise(options) {
      const scaled = (options.volume ?? 0.05) * volume();
      if (scaled < 0.001) return;
      raw.noise({ ...options, volume: scaled });
    },
    layer(spec): Layer | null {
      const inner = raw.layer(spec);
      if (!inner) return null;
      return {
        set: (target, glideS) => inner.set({ ...target, level: target.level * volume() }, glideS),
        stop: () => inner.stop(),
        alive: () => inner.alive(),
      };
    },
  };
}

/** Every sound but the machine's own voice routes through this view. */
export const sfx: Synth = scaledView(() => effectsVolume);

/** The engine and the belt route through this one. */
export const engineSfx: Synth = scaledView(() => engineVolume);

/** Start (or revive) audio from a real user gesture. Safe to call on every
 * pointer down — it is a no-op once the context is running. */
export function unlockAudio(): void {
  raw.unlock();
}
