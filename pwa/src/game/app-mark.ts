// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK'S TRAILS, as paths anything in the app can draw.
//
// The mark is a sled's two trails curving over a hill: a snowfield under a
// clear sky, the two parallel trails climbing from the lower left, running
// over the crest and swinging down into the dip on the right, with a red
// checkpoint flag standing on the hill. The flag and the hill belong to the
// ICON and stay there; the TRAILS are the part worth reusing, because a
// trail is a thing that is LAID, and a pair of them drawing themselves from
// the tail to the far end is the app's own mark saying it is working.
//
// THE GEOMETRY IS STATED THREE TIMES and they must agree: here, as the two
// `d` strings; in `pwa/public/icons/icon.svg`, as the same two; and in
// `scripts/generate-icons.mjs`, as the arc centres and radii the raster icons
// are drawn from. None can import either of the others, so that is not a
// comment anybody has to remember — `tests/app_mark_test.ts` reads the SVG
// and holds these to it.
//
// The two arcs of each trail are TANGENT where the crest gives way to the
// dip — the dip's centre sits on the crest's radial through that point, on
// the far side of it — so a trail runs continuously through the inflection
// instead of stepping. Because the turn reverses there, a trail that runs
// OUTSIDE the crest runs INSIDE the dip: the outer trail is radius +0 on the
// crest and +0 on the dip, the inner one −36 on the crest and +36 on the dip.

/** The box the two trails actually ink, stroke and round caps included. NOT
 * the icon's own 512-square: the trails cross the middle of it with the sky
 * and the flag above, so a trails-only drawing framed on the square is a
 * thin pair of lines adrift in a lot of empty snow. */
export const MARK_TRAIL_VIEWBOX = "60 245 400 160";

/** The outer trail and the inner one, tail first: every path runs from the
 * lower left, up over the crest, into the dip. Drawn in that direction the
 * trails are being LAID; reversed, they are being swept away. */
export const MARK_TRAILS = [
  "M 74.74 375.48 A 200 200 0 0 1 356 286.79 A 120 120 0 0 0 436.84 301.05",
  "M 107.37 390.69 A 164 164 0 0 1 338 317.97 A 156 156 0 0 0 443.09 336.5",
] as const;

/** How wide a trail is drawn in the icon's space. */
export const MARK_WIDTH = 22;
