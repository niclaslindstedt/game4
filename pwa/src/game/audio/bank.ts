// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE'S SOUND DESIGN — every discrete sound the sled and the course
// make, as data: a description and a list of voices.
//
// SNOW SWALLOWS TRANSIENTS. That is the rule every landing here is written
// to: a sled coming down in powder is a brown thump that opens over a few
// milliseconds with a pink puff of snow thrown up over it, and the only
// sharp edges in this bank belong to the things that are not snow — a trunk
// cracking, the chassis bottoming out, two machines meeting, the flags'
// chimes.
//
// Every voice is the synth's own vocabulary (`lib/voice.ts`); the id is what
// `route.ts` names, and the description is what the next retune is checked
// against — a def without one fails the test.
//
// COLOUR BEFORE FILTER, always: brown is mass and distance, pink is snow in
// the air and the wind, white is grit and the crack of wood. And `drive` on
// anything with a body behind it — a chassis thumping, a trunk — because a
// clean sine is a bell.

import type { SoundBank } from "./types.ts";

export const RUN_BANK: SoundBank = {
  land_soft: {
    description:
      "The sled coming back onto the snow: the suspension taking it — a " +
      "short low sine thump with a little drive, bending down — under a " +
      "brown settle and a pink puff of snow thrown up by the track, both " +
      "opening over a few milliseconds rather than cracking, because snow " +
      "has no transient.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 90,
        to: 55,
        durationMs: 150,
        volume: 0.05,
        drive: 0.3,
        attackMs: 4,
      },
      {
        call: "noise",
        durationMs: 220,
        volume: 0.04,
        color: "brown",
        attackMs: 6,
        filter: { type: "lowpass", frequency: 380, to: 180 },
      },
      {
        call: "noise",
        durationMs: 320,
        volume: 0.026,
        color: "pink",
        attackMs: 14,
        delayMs: 20,
        filter: { type: "bandpass", frequency: 1200, to: 3200, q: 0.7 },
      },
    ],
  },

  land_hard: {
    description:
      "A landing the suspension could not take: the chassis bottoming out " +
      "— a hard driven thump with a white knock on top of it, the one hard " +
      "edge a landing is allowed — then the same brown mass and a bigger " +
      "sheet of snow, longer, because the whole sled has gone into it.",
    voices: [
      {
        call: "noise",
        durationMs: 30,
        volume: 0.05,
        filter: { type: "bandpass", frequency: 700, q: 1.6 },
      },
      {
        call: "tone",
        type: "sine",
        from: 78,
        to: 42,
        durationMs: 240,
        volume: 0.07,
        drive: 0.6,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 320,
        volume: 0.05,
        color: "brown",
        attackMs: 5,
        filter: { type: "lowpass", frequency: 320, to: 140 },
      },
      {
        call: "noise",
        durationMs: 480,
        volume: 0.034,
        color: "pink",
        attackMs: 18,
        delayMs: 25,
        holdMs: 60,
        filter: { type: "bandpass", frequency: 900, to: 2800, q: 0.7 },
      },
    ],
  },

  hit_tree: {
    description:
      "A sled into a trunk. The CRACK of wood — broadband white gone inside " +
      "a fiftieth of a second — over the chassis's own hollow thump, a " +
      "driven sine barely moving off its note. Then the TREE ANSWERS: the " +
      "load on its branches shaken loose, a pink sheet of snow falling " +
      "through a lowpass a beat later and thinning out. The forest edge " +
      "echoes the crack and not the fall.",
    voices: [
      {
        call: "noise",
        durationMs: 18,
        volume: 0.06,
        filter: { type: "highpass", frequency: 300 },
        echo: 0.22,
      },
      {
        call: "tone",
        type: "sine",
        from: 130,
        to: 110,
        durationMs: 220,
        volume: 0.055,
        drive: 0.55,
        filter: { type: "lowpass", frequency: 800 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 240,
        to: 190,
        durationMs: 120,
        volume: 0.02,
        drive: 0.4,
        delayMs: 6,
        filter: { type: "bandpass", frequency: 600, q: 2 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.03,
        color: "pink",
        attackMs: 60,
        delayMs: 90,
        holdMs: 120,
        filter: { type: "lowpass", frequency: 2400, to: 700 },
      },
    ],
  },

  bump: {
    description:
      "A sled on a sled: two plastic hoods and two bumpers meeting — a short " +
      "driven triangle bending down for the body of it, a band of white for " +
      "the knock, no crack in it — with a thin pink spit of snow off both " +
      "tracks. Rounder than the tree, because nothing here is hard.",
    voices: [
      {
        call: "noise",
        durationMs: 60,
        volume: 0.03,
        filter: { type: "bandpass", frequency: 900, q: 3 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 170,
        to: 95,
        durationMs: 200,
        volume: 0.045,
        drive: 0.4,
        filter: { type: "lowpass", frequency: 1200, to: 400 },
      },
      {
        call: "noise",
        durationMs: 240,
        volume: 0.02,
        color: "pink",
        attackMs: 12,
        delayMs: 20,
        filter: { type: "bandpass", frequency: 1400, to: 2800, q: 0.9 },
      },
    ],
  },

  checkpoint: {
    description:
      "A checkpoint taken: the arcade's own note — two sines a fifth apart, " +
      "the second a beat behind the first, over a short triangle body so it " +
      "reads as a bell struck and not a beep. Quiet, and a touch of the " +
      "forest's echo so it sits in the same air as the engine.",
    voices: [
      { call: "tone", type: "sine", from: 880, durationMs: 160, volume: 0.03, echo: 0.1 },
      {
        call: "tone",
        type: "triangle",
        from: 440,
        durationMs: 120,
        volume: 0.012,
        filter: { type: "lowpass", frequency: 1800 },
      },
      {
        call: "tone",
        type: "sine",
        from: 1320,
        durationMs: 220,
        volume: 0.028,
        delayMs: 70,
        echo: 0.12,
      },
    ],
  },

  lap: {
    description:
      "A lap done: the checkpoint's chime made into a phrase — three sines " +
      "rising a third, a fifth, an octave, quick, on the echo bus — so the " +
      "line is heard as more than one more flag.",
    voices: [
      { call: "tone", type: "sine", from: 880, durationMs: 140, volume: 0.028, detuneCents: 5 },
      {
        call: "tone",
        type: "sine",
        from: 1108,
        durationMs: 140,
        volume: 0.028,
        delayMs: 90,
        detuneCents: 5,
      },
      {
        call: "tone",
        type: "sine",
        from: 1760,
        durationMs: 320,
        volume: 0.03,
        delayMs: 180,
        detuneCents: 5,
        echo: 0.18,
      },
    ],
  },

  missed: {
    description:
      "A checkpoint ridden past: the chime inverted — two driven squares " +
      "FALLING, the second lower and later, through a dark lowpass. Dry, " +
      "flat, and no echo: bad news does not ring.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 330,
        to: 260,
        durationMs: 180,
        volume: 0.03,
        drive: 0.4,
        filter: { type: "lowpass", frequency: 1200 },
      },
      {
        call: "tone",
        type: "square",
        from: 220,
        to: 175,
        durationMs: 240,
        volume: 0.028,
        drive: 0.4,
        delayMs: 130,
        filter: { type: "lowpass", frequency: 1000 },
      },
    ],
  },

  reset: {
    description:
      "The sled put back on the track at the last checkpoint: a soft " +
      "settle into the snow — a brown thump and a short pink sigh — and " +
      "nothing else, because the engine bed is already there at idle when " +
      "the picture lands.",
    voices: [
      {
        call: "noise",
        durationMs: 280,
        volume: 0.03,
        color: "brown",
        attackMs: 10,
        filter: { type: "lowpass", frequency: 320 },
      },
      {
        call: "noise",
        durationMs: 240,
        volume: 0.018,
        color: "pink",
        attackMs: 15,
        filter: { type: "bandpass", frequency: 1400, to: 2600, q: 0.8 },
      },
    ],
  },

  count: {
    description:
      "One light of the countdown: a single short sine, dry and plain, so " +
      "three of them a second apart read as a count and not as three " +
      "checkpoints taken.",
    voices: [{ call: "tone", type: "sine", from: 660, durationMs: 110, volume: 0.032 }],
  },

  go: {
    description:
      "The lights out: the count's note an octave up and held, with a " +
      "little chorus and the forest's echo under it, so the last beep is " +
      "heard as the one that was different before anybody has read the word.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 1320,
        durationMs: 420,
        volume: 0.034,
        holdMs: 100,
        detuneCents: 6,
        echo: 0.18,
      },
    ],
  },

  finish: {
    description:
      "The flag: three notes rising — a fifth, then an octave — each a sine " +
      "with a little chorus, on the echo bus, the last one held. The " +
      "checkpoint's chime made into a phrase, slower than a lap's.",
    voices: [
      { call: "tone", type: "sine", from: 660, durationMs: 200, volume: 0.032, detuneCents: 6 },
      {
        call: "tone",
        type: "sine",
        from: 880,
        durationMs: 220,
        volume: 0.034,
        delayMs: 140,
        detuneCents: 6,
        echo: 0.15,
      },
      {
        call: "tone",
        type: "sine",
        from: 1320,
        durationMs: 520,
        volume: 0.036,
        delayMs: 280,
        holdMs: 120,
        detuneCents: 6,
        echo: 0.2,
      },
    ],
  },
};
