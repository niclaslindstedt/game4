// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REV BAR — the instrument that is DRAWN rather than printed, in the
// corner the speed is read from. A snowmobile's CVT has no gears to shift
// and no dial to sweep a needle round: the clutch holds the engine near its
// power peak and the belt does the rest, so the revs are a BAR — idle at its
// left end, the limiter at its right, the last stretch red. Nothing here
// reads the game: it is handed a share and paints it.

/** The bar's box, in its own hundred-unit space. */
const BAR_W = 100;
const BAR_H = 14;
/** Where the red band starts, as a share of the redline. */
const RED_FROM = 0.9;

/** `rpm` and `idle` are shares of the redline, 0..1: the fill runs from
 * idle to the reading, so an engine ticking over shows nothing and the bar
 * is all headroom. `braking` paints the fill in the alarm colour — the one
 * the touch lever's brake throw fills with — because on the keys the brake
 * has no lever of its own to light. */
export function RevBar({ rpm, idle, braking }: { rpm: number; idle: number; braking: boolean }) {
  const span = Math.max(0.01, 1 - idle);
  const fill = Math.max(0, Math.min(1, (rpm - idle) / span));
  const redX = Math.max(0, (RED_FROM - idle) / span) * BAR_W;
  const hot = rpm >= RED_FROM;
  return (
    <svg
      class={`hud-revs ${hot ? "hud-revs-hot" : ""} ${braking ? "hud-revs-brake" : ""}`}
      viewBox={`0 0 ${BAR_W} ${BAR_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect class="hud-revs-track" x="0" y="0" width={BAR_W} height={BAR_H} rx="2" />
      <rect class="hud-revs-red" x={redX} y="0" width={BAR_W - redX} height={BAR_H} rx="2" />
      {/* The fill is scaled rather than re-sized so the browser can tween it
          between HUD snapshots and the bar reads smooth at 12 Hz. */}
      <rect
        class="hud-revs-fill"
        x="0"
        y="1.5"
        width={BAR_W}
        height={BAR_H - 3}
        rx="1.5"
        style={{ transform: `scaleX(${fill.toFixed(3)})` }}
      />
      {[0.25, 0.5, 0.75].map((tick) => (
        <path
          key={tick}
          class="hud-revs-tick"
          d={`M ${tick * BAR_W} 0 L ${tick * BAR_W} ${BAR_H}`}
        />
      ))}
    </svg>
  );
}
