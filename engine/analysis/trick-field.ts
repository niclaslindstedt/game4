// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 — THE TRICK FIELD, held on the finished map: read off the kickers the
// level publishes (`Kicker.trick`), never off the plan that laid them. A map
// with no field is not a fault — only a map built for a tricks run carries
// one — so every check here is of a field that is there.

import { trackPointAt } from "../mapgen/query.ts";
import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import type { Kicker, Level } from "../mapgen/types.ts";
import type { Severity } from "./index.ts";

type Add = (rule: string, severity: Severity, message: string) => void;

/** How much of a built landing's drop the two-metre grid may shave off. */
const DROP_KEPT = 0.85;

/** Hold the field's kickers to R20: how many, each built to its size, the landing slope really dug, the lead either side of
 * the start line, and the gap between one and the next and between any of
 * them and R9's. `onTrack` is every kicker on the loop. */
export function checkTrickField(level: Level, onTrack: readonly Kicker[], add: Add): void {
  const F = R.trick;
  const field = onTrack.filter((k) => k.trick).sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
  if (field.length === 0) return;
  const L = level.track.length;
  if (!withinBand(field.length, F.count)) {
    add("R20", "error", `${field.length} trick kicker(s) (band ${F.count.min}–${F.count.max})`);
  }
  const span = (k: Kicker): [number, number] => [(k.s ?? 0) - k.ramp, (k.s ?? 0) + k.landing];
  const groundOn = (s: number): number => {
    const p = trackPointAt(level, s);
    return level.groundAt(p.x, p.z);
  };
  field.forEach((k, i) => {
    const z = k.size !== undefined ? F.sizes[k.size] : undefined;
    const built =
      z !== undefined &&
      k.shape !== undefined &&
      Math.abs(k.height - z.height) < 1e-6 &&
      Math.abs(k.ramp - z.height * z.ramp) < 1e-6 &&
      Math.abs(k.landing - (z.deck + z.fall + z.runout)) < 1e-6 &&
      k.shape.deck === z.deck &&
      k.shape.fall === z.fall &&
      k.shape.dig === z.dig;
    if (!built) {
      add("R20", "error", `${k.id} is not built as a ${k.size ?? "sized"} kicker`);
    } else {
      // The landing slope is there: the ground at its foot lies the lip's
      // height and the dig under the lip, less what the line may climb.
      const s0 = k.s ?? 0;
      const run = z.deck + z.fall;
      const drop = groundOn(s0) - groundOn(s0 + run);
      const least = DROP_KEPT * (z.height + z.dig) - F.landingGrade * run;
      if (drop < least) {
        add(
          "R20",
          "error",
          `${k.id}'s landing falls ${drop.toFixed(1)} m (least ${least.toFixed(1)})`,
        );
      }
    }
    const [from, to] = span(k);
    if (from < F.lead - 1 || to > L - F.lead + 1) {
      add("R20", "error", `${k.id} stands inside the lead either side of the start line`);
    }
    const next = field[i + 1];
    if (next && span(next)[0] - to < F.gap - 1) {
      add("R20", "error", `${k.id} and ${next.id} leave ${(span(next)[0] - to).toFixed(0)} m`);
    }
    for (const c of onTrack) {
      if (c.trick) continue;
      const [a, b] = span(c);
      if (from < b + F.gap - 1 && to > a - F.gap + 1) {
        add("R20", "error", `${k.id} crowds ${c.id}`);
      }
    }
  });
}
