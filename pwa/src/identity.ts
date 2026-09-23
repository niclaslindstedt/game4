// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's identity — name, copy, colors, URLs — in one module. Imported by
// the browser app AND by the build plumbing (pwa-plugin.ts, the icon
// generator's palette is held to it by tests/identity_test.ts), so a rename
// or a palette change happens here once.
// Keep this file free of browser- and Node-only imports.

export const APP_NAME = "Powder Run";
/** The house, on the studio card the app will open on. Drawn upper-cased, so
 * write it however it is written everywhere else. */
export const PUBLISHER = "Agilator Games";
/** What the browser tab and the installed app are called. Just the name: a
 * tab shows about thirty characters before it cuts, so a tagline bolted on
 * after a dash is a tagline nobody finishes reading. */
export const APP_TITLE = APP_NAME;
/** The home-screen name: a launcher gives it about twelve characters before
 * it starts cutting, and this is nine. Both words survive, run together so
 * the launcher never breaks them onto two lines. */
export const APP_SHORT_NAME = "PowderRun";
export const APP_DESCRIPTION =
  "A snowmobile racing game that runs in your browser. Race a sled round a " +
  "packed-snow loop over generated hills and through snow-loaded forest, " +
  "cutting your own trail through the deep powder between — on your phone or " +
  "desktop, offline once loaded. No account, no download.";
export const SITE_URL = "https://game4.niclaslindstedt.se";
/** Where the source lives — the HUD's build label will link a build's commit
 * here, so the running app can always say exactly what it is. */
export const REPO_URL = "https://github.com/niclaslindstedt/game4";

/** A clear winter day: fresh snow in the sun and blue in the shade, a pale
 * sky deepening overhead, dark pine at the edge of the fields, the grey of
 * a packed track, and a red checkpoint flag to aim at. */
export const PALETTE = {
  /** Brand + boot background: the high sky. */
  skyHigh: "#6fa8dc",
  sky: "#cfe6f7",
  snow: "#f4f8fb",
  snowShadow: "#b9cde0",
  pine: "#1f4a36",
  pineDark: "#143326",
  track: "#dfe7ee",
  flag: "#e8412c",
  hudInk: "#ffffff",
  hudShadow: "#0d2233",
  hudBad: "#ff5a4e",
} as const;

/** The one colour the boot screen, the manifest and the browser chrome are
 * painted — named once so none of them has to know which palette entry it
 * is. */
export const BRAND_COLOR = PALETTE.skyHigh;
