// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MARKS THE CARDS ARE READ BY — one 24×24 box per idea, stroked in
// `currentColor`, so a mark takes the colour of whatever it sits in. A card
// a player has to READ to find the press they came for is a card that has
// failed; a mark is found without reading.
//
// Only the marks this slice's cards use: the flag on RACE, the speaker on
// the sound switch, and the three the pause card is read by — carry on,
// start again, leave.

import type { JSX } from "preact";

export const GLYPH_NAMES = ["flag", "speaker", "mute", "play", "restart", "exit"] as const;

export type GlyphName = (typeof GLYPH_NAMES)[number];

/** The 24x24 body of each mark. Stroke geometry only — the wrapper below
 * sets the paint. */
const GLYPHS: Record<GlyphName, JSX.Element> = {
  // THE CHEQUERED FLAG: the race — the one mark every player already knows.
  flag: (
    <>
      <path d="M5 3.5v17.5" />
      <path d="M5 4.5h14v9H5z" />
      <path
        d="M5 4.5h3.5v4.5H5zM12 4.5h3.5v4.5H12zM8.5 9H12v4.5H8.5zM15.5 9H19v4.5h-3.5z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  // A CONE AND TWO ARCS: the sound, on. Only two arcs — a third is a hair's
  // width from the second at the small end and turns the pair into a smudge.
  speaker: (
    <>
      <path d="M3.4 9.2h3.5L12.2 5v14L6.9 14.8H3.4z" />
      <path d="M15.8 9.7a3.6 3.6 0 0 1 0 4.6M18.6 7.2a7.3 7.3 0 0 1 0 9.6" />
    </>
  ),
  // ...and off: the same cone with a cross where the sound was.
  mute: (
    <>
      <path d="M3.4 9.2h3.5L12.2 5v14L6.9 14.8H3.4z" />
      <path d="M15.6 9.2l5.6 5.6M21.2 9.2l-5.6 5.6" />
    </>
  ),
  // A PLAY TRIANGLE: back onto the snow, on the very frame the race was
  // left on.
  play: <path d="M8.2 4.8 19.6 12 8.2 19.2Z" fill="currentColor" stroke="none" />,
  // A BAR AND A WEDGE BACK TO IT: the race again, from the grid.
  restart: (
    <>
      <path d="M5.2 5.8v12.4" />
      <path d="M19 6.2v11.6L8.4 12Z" fill="currentColor" stroke="none" />
    </>
  ),
  // A DOOR WITH THE WAY OUT THROUGH IT: the front door, and the one press on
  // the pause card that ends the race.
  exit: (
    <>
      <path d="M13.2 3.4H5.6a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h7.6" />
      <path d="M9.8 12h10.6" />
      <path d="M16.9 8.5 20.4 12l-3.5 3.5" />
    </>
  ),
};

/** One mark, sized by whatever it sits in. Always decorative: every glyph
 * in the menus stands beside a word that names the same thing. */
export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg
      class={`menu-glyph ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {GLYPHS[name]}
    </svg>
  );
}
