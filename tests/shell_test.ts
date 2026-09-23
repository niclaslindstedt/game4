// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STORE APP'S SEAM WITH THE PAGE — the word the shell writes on the one
// global, how it classifies a URL before letting the WebView follow it, and
// the menu words a shell presses the game's own buttons with.
//
// Each half is stated twice in files that cannot import each other (the
// page's `shell-host.ts` and the shell's injected script), which is exactly
// the kind of pair that drifts silently: a renamed global is an app that
// quietly runs the PWA update lifecycle it was built to turn off. This file
// is the only thing holding them together.
//
// `isExternalUrl` is worth a test of its own for a sharper reason: the app has
// no address bar and no back button, so a URL judged INTERNAL when it is not
// replaces the game with a page nobody can leave without killing the app.

import { describe, expect, it } from "vitest";

import { NATIVE_FLAG, RUMBLE_BRIDGE, VIEWPORT_HARDENING } from "../native/src/injected.ts";
import { isExternalUrl } from "../native/src/navigation.ts";
import {
  SHELL_COMMAND,
  SHELL_COMMANDS,
  SHELL_GLOBAL,
  onShellCommand,
  shellHost,
  type ShellCommand,
} from "../pwa/src/shell-host.ts";

const HOME = "http://localhost:9033";

describe("the shell's word", () => {
  it("writes the global the page reads, under the name the page reads it by", () => {
    expect(NATIVE_FLAG).toContain(SHELL_GLOBAL);
    expect(NATIVE_FLAG).toContain('value: "native"');
  });

  it("freezes it, so nothing on the page can later claim to be a browser", () => {
    expect(NATIVE_FLAG).toContain("writable: false");
    expect(NATIVE_FLAG).toContain("configurable: false");
  });

  it("is a script iOS will accept: an IIFE ending in a primitive", () => {
    for (const script of [NATIVE_FLAG, RUMBLE_BRIDGE, VIEWPORT_HARDENING]) {
      expect(script.trimEnd().endsWith("})();")).toBe(true);
      expect(script).toContain("true;");
    }
  });

  it("is the value shellHost() names", () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = globals[SHELL_GLOBAL];
    try {
      globals[SHELL_GLOBAL] = "native";
      expect(shellHost()).toBe("native");
      globals[SHELL_GLOBAL] = "tauri";
      expect(shellHost()).toBe("tauri");
      globals[SHELL_GLOBAL] = "chrome";
      expect(shellHost()).toBe(null);
    } finally {
      if (before === undefined) delete globals[SHELL_GLOBAL];
      else globals[SHELL_GLOBAL] = before;
    }
  });

  it("really defines the global when run as the WebView runs it", () => {
    // Evaluated as a PROGRAM against a `window`, because asserting on the
    // source would pass on a script that defines nothing.
    const window = {} as Record<string, unknown>;
    new Function("window", NATIVE_FLAG)(window);
    expect(window[SHELL_GLOBAL]).toBe("native");
    // Strict code (this file) throws on the write; the page's sloppy code
    // would fail silently. Either way the word does not change.
    expect(() => {
      window[SHELL_GLOBAL] = "browser";
    }).toThrow(TypeError);
    expect(window[SHELL_GLOBAL]).toBe("native");
  });
});

describe("a menu row, pressed", () => {
  /** Stand the page's listener up over a stub event bus, run `body`, and
   * put the globals back however it ends. */
  function withBus(body: (bus: EventTarget) => void): void {
    const globals = globalThis as unknown as Record<string, unknown>;
    const bus = new EventTarget();
    const before = [globals.addEventListener, globals.removeEventListener];
    globals.addEventListener = bus.addEventListener.bind(bus);
    globals.removeEventListener = bus.removeEventListener.bind(bus);
    try {
      body(bus);
    } finally {
      if (before[0] === undefined) delete globals.addEventListener;
      else globals.addEventListener = before[0];
      if (before[1] === undefined) delete globals.removeEventListener;
      else globals.removeEventListener = before[1];
    }
  }

  const press = (bus: EventTarget, command: unknown): void => {
    bus.dispatchEvent(new CustomEvent(SHELL_COMMAND, { detail: { command } }));
  };

  it("hears every word a shell may send, and only until the hand-back", () => {
    withBus((bus) => {
      const heard: ShellCommand[] = [];
      const stop = onShellCommand((command) => heard.push(command));
      for (const word of SHELL_COMMANDS) press(bus, word);
      stop();
      // …and nothing after it, which is what a WebView reloading the page
      // must not leave behind.
      press(bus, "restart");
      expect(heard).toEqual([...SHELL_COMMANDS]);
    });
  });

  it("drops a word the game has no button for, rather than guessing", () => {
    withBus((bus) => {
      const heard: ShellCommand[] = [];
      const stop = onShellCommand((command) => heard.push(command));
      // `shot` is the sibling game's shutter; this game has no gallery.
      for (const word of ["shot", "gallery", "", 3, null]) press(bus, word);
      stop();
      expect(heard).toEqual([]);
    });
  });
});

describe("isExternalUrl", () => {
  it("keeps the game's own origin inside the WebView, path and query and all", () => {
    expect(isExternalUrl(`${HOME}/`, HOME)).toBe(false);
    expect(isExternalUrl(`${HOME}/?seed=38`, HOME)).toBe(false);
    expect(isExternalUrl(`${HOME}/assets/index-a1b2c3.js`, HOME)).toBe(false);
  });

  it("hands an off-site link to the system browser", () => {
    // The HUD's build label links the commit on GitHub — the one link in the
    // game that leaves the site.
    expect(isExternalUrl("https://github.com/niclaslindstedt/game4", HOME)).toBe(true);
    expect(isExternalUrl("https://game4.niclaslindstedt.se/", HOME)).toBe(true);
  });

  it("judges by ORIGIN, so a lookalike host cannot pass by starting with ours", () => {
    expect(isExternalUrl("http://localhost:9033.evil.test/", HOME)).toBe(true);
    expect(isExternalUrl("http://localhost:9034/", HOME)).toBe(true);
  });

  it("leaves every non-http scheme alone — those are the WebView's own loads", () => {
    expect(isExternalUrl("about:blank", HOME)).toBe(false);
    expect(isExternalUrl("blob:http://localhost:9033/abc", HOME)).toBe(false);
    expect(isExternalUrl("data:text/html,<p>hi", HOME)).toBe(false);
  });

  it("has nothing to be outside of before the source resolves", () => {
    expect(isExternalUrl("https://example.test/", null)).toBe(false);
  });
});
