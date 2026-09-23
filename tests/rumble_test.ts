// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE RIDER FEELS — the seam that carries a pulse out to the phone, and
// (once the app has one) the vibration table behind it.
//
// A pulse is named in THREE files that cannot import each other — the page's
// `shell-host.ts` (the event), the store app's injected bridge (the listener
// that posts it) and the store app's parser (the message it reads). A rename
// in one of them is a phone that silently stops buzzing, and on a desktop or
// in a simulator there is no haptic engine to notice with. So the bridge is
// RUN here, against a stub window, fed by the page's own `askShellRumble`,
// and what it posts goes through the shell's own parser: the whole trip from
// the page to the tap, with no device.
//
// No DOM: the window is an EventTarget and a postMessage that keeps a list.

import { describe, expect, it } from "vitest";

import { RUMBLE_BRIDGE } from "../native/src/injected.ts";
import { RUMBLE_KIND, parseRumble, rumbleBurst } from "../native/src/rumble.ts";
import { SHELL_RUMBLE, askShellRumble } from "../pwa/src/shell-host.ts";

/** Run the injected bridge the way a WebView does — as a PROGRAM against a
 * `window` — with the page's own dispatch wired to the same bus, and hand
 * back every message it posted to the shell. */
function postedBy(asks: [ms: number, strength: number][]): string[] {
  const posted: string[] = [];
  const bus = new EventTarget();
  const window = {
    addEventListener: bus.addEventListener.bind(bus),
    ReactNativeWebView: { postMessage: (message: string) => posted.push(message) },
  };
  new Function("window", RUMBLE_BRIDGE)(window);
  const globals = globalThis as unknown as Record<string, unknown>;
  const before = globals.dispatchEvent;
  globals.dispatchEvent = bus.dispatchEvent.bind(bus);
  try {
    for (const [ms, strength] of asks) askShellRumble(ms, strength);
  } finally {
    if (before === undefined) delete globals.dispatchEvent;
    else globals.dispatchEvent = before;
  }
  return posted;
}

describe("the seam out to the phone", () => {
  it("the bridge listens for the event the page dispatches", () => {
    expect(RUMBLE_BRIDGE).toContain(SHELL_RUMBLE);
  });

  it("the bridge posts what the shell's parser reads", () => {
    expect(RUMBLE_BRIDGE).toContain(`sh: "${RUMBLE_KIND}"`);
  });

  it("carries a pulse from the page to the parser, all the way through", () => {
    const posted = postedBy([
      [70, 0.5],
      [260, 1],
    ]);
    expect(posted.map(parseRumble)).toEqual([
      { ms: 70, strength: 0.5 },
      { ms: 260, strength: 1 },
    ]);
  });

  it("drops everything that is not a rumble, rather than throwing", () => {
    for (const raw of [
      "",
      "{",
      "null",
      "[]",
      JSON.stringify({ sh: "something-else", ms: 100, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: "100", strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: 0, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: Number.NaN, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: 100 }),
    ]) {
      expect(parseRumble(raw), raw).toBe(null);
    }
  });

  it("clamps a strength the page had no business sending", () => {
    expect(parseRumble(JSON.stringify({ sh: RUMBLE_KIND, ms: 50, strength: 4 }))?.strength).toBe(1);
    expect(parseRumble(JSON.stringify({ sh: RUMBLE_KIND, ms: 50, strength: -2 }))?.strength).toBe(
      0,
    );
  });

  it("spends a duration as a COUNT of taps, because a phone has no duration", () => {
    expect(rumbleBurst({ ms: 26, strength: 0.3 }).count).toBe(1);
    expect(rumbleBurst({ ms: 70, strength: 0.5 }).count).toBe(1);
    expect(rumbleBurst({ ms: 190, strength: 0.9 }).count).toBe(2);
    expect(rumbleBurst({ ms: 260, strength: 1 }).count).toBe(3);
    // …and never more, however long the page asks for.
    expect(rumbleBurst({ ms: 5000, strength: 1 }).count).toBe(3);
  });

  it("spends a strength as a STYLE, because that is the axis a phone has", () => {
    expect(rumbleBurst({ ms: 26, strength: 0.2 }).style).toBe("light");
    expect(rumbleBurst({ ms: 90, strength: 0.55 }).style).toBe("medium");
    expect(rumbleBurst({ ms: 200, strength: 0.95 }).style).toBe("heavy");
  });

  it("leaves the Taptic Engine time to re-arm between the taps in a burst", () => {
    // Under about 40 ms the second tap is simply dropped.
    expect(rumbleBurst({ ms: 260, strength: 1 }).gapMs).toBeGreaterThanOrEqual(40);
  });
});

// TODO(app): the VIBRATION TABLE is the website's, not the shell's — what is
// felt and how big, `pwa/src/game/rumble.ts` (a pure `rumbleForEvent(event)`
// → `{ ms, strength } | null`, and a one-motor ledger over it), with
// `pwa/src/game/haptics.ts` as the one `navigator.vibrate` that also calls
// `askShellRumble`. Neither exists in this tree yet. When they land, these
// become real cases (the sibling jet-ski game's `rumble_test.ts` is the shape)
// and the fixed durations above are read off the table's own constants.
describe("what an event is worth in the hands (waits for pwa/src/game/rumble.ts)", () => {
  it.todo("sizes a landing by how fast the sled was coming down");
  it.todo("sizes a tree by how fast the sled met it");
  it.todo("gives rolling over the whole of what the motor has, and nothing else reaches it");
  it.todo("leaves the news (a checkpoint, a lap, the finish) to the HUD and the sound");
  it.todo("never lets the chatter of a rough track truncate the landing it comes down into");
});
