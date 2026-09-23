// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A HEADLESS CHROMIUM for the browser-driven labs, found the same way by all
// of them. The driver is DELIBERATELY not a dependency of this repository —
// a browser driver is a hundred megabytes nobody needs to build or test the
// game — so it is looked for in two places: `playwright-core` installed
// beside the tree (`npm install --no-save playwright-core@1`), and a
// `playwright` installed globally next to the running Node, which is what a
// Claude web session ships with. The browser itself is CHROMIUM_PATH, or
// /opt/pw-browsers/chromium.
//
// Returns null — never throws — when either half is missing, so a lab can
// say what it needs and exit cleanly rather than stack-trace.

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";

/** The driver's `chromium`, or null. */
async function driver() {
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    /* not beside the tree — try the global one */
  }
  const globalRoot = join(dirname(process.execPath), "..", "lib", "node_modules");
  for (const name of ["playwright-core", "playwright"]) {
    try {
      const require = createRequire(join(globalRoot, name, "package.json"));
      return require(join(globalRoot, name)).chromium;
    } catch {
      /* next */
    }
  }
  return null;
}

/** `{ chromium, executablePath }`, or null with the reason printed. */
export async function findChromium() {
  const chromium = await driver();
  if (!chromium) {
    console.error(
      "no browser driver: `npm install --no-save playwright-core@1` (it is deliberately not a dependency)",
    );
    return null;
  }
  const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
  if (!existsSync(executablePath)) {
    console.error(`no Chromium at ${executablePath} — set CHROMIUM_PATH`);
    return null;
  }
  return { chromium, executablePath };
}
