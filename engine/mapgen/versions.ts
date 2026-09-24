// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH GENERATOR BUILT THIS MAP — the world generator's versions, and the
// contract that lets a campaign map outlive a change to the rules.
//
// The problem this exists for: a map is generated fresh from its seed, so
// the rules ARE the map. Move a checkpoint spacing, a kicker's height band,
// a draw in the seeded stream, and seed 38 stops being the map that was
// rated, timed and named — silently, everywhere, at once. The campaign is
// the one part of the game where that is not acceptable: its maps were
// CURATED, and a ladder that re-rolls under its own rungs is a ladder
// nobody chose — and every best time and every medal on it is a result on
// a loop that no longer exists.
//
// So a campaign map names the version it was curated under, and that
// version keeps building it. Nothing else does: the free ride, the menu's
// backdrop, every lab, every sweep and every test take
// `CURRENT_GENERATOR_VERSION` and move with the rules, which is the whole
// point of having a generator.
//
// THE CONTRACT, in four lines:
//
//   1. A change that moves what a seed builds gets a NEW version — a row
//      here, with a note saying what moved.
//   2. The old row keeps the old behaviour, through a TRAIT read at the one
//      place the behaviour differs (see `GeneratorTraits` below).
//   3. A campaign map moves to the new version DELIBERATELY: re-rated,
//      re-timed, re-named if the loop no longer earns its name — the
//      `campaign-levels.ts` header says how. Bumping every map in one commit
//      because the suite went red is the exact move this exists to prevent.
//   4. A version no campaign map names any more is DELETED — the row, and
//      every trait branch that only existed for it.
//      `tests/generator_version_test.ts` refuses to let one linger.
//
// Rule 4 is the half people forget, and it is what keeps this from becoming
// a museum of every generator the game ever had. Backward compatibility is
// owed to the committed maps and to nothing else.
//
// HOW A RE-ROLL IS NOTICED. The generator has no way to know its output
// moved, so the campaign carries a DIGEST of every map it pins
// (`levelDigest`, `digest.ts`) and the suite rebuilds each one and compares.
// A red `generator_version_test` is then one of two things with opposite
// fixes: a map deliberately moved (a new seed — the digest was meant to
// change: re-curate and write the new one down), or the RULES moving under
// a map that did not (add a version here, keep the old behaviour on the old
// row, and leave the map's digest alone).

import { LEVEL_RULES as R, type Band } from "./rules.ts";

/** A generator version — a whole number that only ever counts up. */
export type GeneratorVersion = number;

/** How much a version throws a sled: the rollers in the country (R3), the
 * cliffs (R22) and how many kickers it lays on the loop and off it (R9,
 * R4). The one trait the generator has had to keep so far. */
export type JumpTraits = {
  /** Whether the country carries R3's rollers. */
  readonly rollers: boolean;
  /** Whether the country carries R22's cliffs. */
  readonly cliffs: boolean;
  /** R9's count and least spacing between two lips, m. */
  readonly onCount: Band;
  readonly onSpacing: number;
  /** R4's count, before the region's multiple. */
  readonly offCount: Band;
};

/** One version of the generator: what it is, and every way it differs from
 * the current rules.
 *
 * `version` and `note` are the whole of the current row, which has nothing
 * to be different from. A LEGACY trait is added
 * here as an OPTIONAL field the moment a change first re-rolls a pinned map
 * — `{ narrowKickers?: boolean }`, `{ checkpointSpacing?: Band }` — set on
 * the old rows and absent from the current one, so the code reads
 *
 *     const traits = generatorTraits(opts.version);
 *     const spacing = traits.checkpointSpacing ?? R.checkpoint.spacing;
 *
 * at the ONE place the behaviour differs and nowhere else. Absent means
 * "build it the way the rules say", which is what makes the current row's
 * branch the one the reader sees first.
 *
 * A trait is never a dial. Dials are `GenerateOptions` and a rider turns
 * them on a free ride; a trait is a fossil kept alive for as long as a
 * curated map stands on it, and it goes in the ground with its version. */
export type GeneratorTraits = {
  version: GeneratorVersion;
  /** One line on what this version of the generator is. On a legacy row,
   * what the version AFTER it changed — which is what tells the next
   * session whether the row is still earning its keep. */
  note: string;
  /** LEGACY (v1): a quieter country — no rollers, no cliffs, one to three
   * kickers on the loop at least 450 m apart and five to ten off it. */
  fewerJumps?: JumpTraits;
  /** LEGACY (v1): R14 as it grew then — every trunk `forest.gap` from every
   * other, no clumps, no lanes, the woods at their whole density
   * (`engine/mapgen/forest.ts`). */
  scatteredForest?: boolean;
};

/** Every version the generator can still build, oldest first.
 *
 * The last row is the rules as they stand in this tree; everything above it
 * is a fossil, alive only because a campaign map still names it. */
export const GENERATOR_VERSIONS: readonly GeneratorTraits[] = [
  {
    version: 1,
    note:
      "The generator as the campaign's pinned maps were curated on it (R1–R21). " +
      "v2 filled the country with rollers and cliffs and doubled the kickers; v3 grew " +
      "the woods in clumps with lanes cut through them (R14).",
    fewerJumps: {
      rollers: false,
      cliffs: false,
      onCount: { min: 1, max: 3 },
      onSpacing: 450,
      offCount: { min: 5, max: 10 },
    },
    scatteredForest: true,
  },
  // Version 2 (air everywhere: the rollers, the cliffs, more kickers) was
  // current until version 3 and no campaign map named it, so its row went
  // in the ground with it; everything it built, version 3 builds too.
  {
    version: 3,
    note:
      "Air everywhere — R3's rollers, R22's cliffs, more kickers on the loop and off it " +
      "(R4, R9) — and R14's woods in clumps, thinner between, with lanes cut through them.",
  },
];

/** What a map is built by unless something pins it to an older set of
 * rules. Every entry point that is not a campaign map lands here. */
export const CURRENT_GENERATOR_VERSION: GeneratorVersion =
  GENERATOR_VERSIONS[GENERATOR_VERSIONS.length - 1].version;

/** The versions this build can still be asked for — the check a campaign
 * map's row is held to, and the list a test walks. */
export const GENERATOR_VERSION_IDS: readonly GeneratorVersion[] = GENERATOR_VERSIONS.map(
  (row) => row.version,
);

export function isGeneratorVersion(value: unknown): value is GeneratorVersion {
  return typeof value === "number" && GENERATOR_VERSION_IDS.includes(value);
}

/** The rules a version builds by. A version this build has never heard of —
 * a stale link, a save from a tree where the row still existed — is the
 * CURRENT one rather than an error: the map will not be the one that save
 * remembers, and there is no version of this code that could make it be. */
export function generatorTraits(version: GeneratorVersion | undefined): GeneratorTraits {
  return (
    GENERATOR_VERSIONS.find((row) => row.version === version) ??
    GENERATOR_VERSIONS[GENERATOR_VERSIONS.length - 1]
  );
}

/** What a version throws a sled with (`JumpTraits`): a legacy row's own
 * numbers, or the rules as they stand. The ONE place the generator and the
 * analysis ask it. */
export function jumpsOf(version: GeneratorVersion | undefined): JumpTraits {
  return (
    generatorTraits(version).fewerJumps ?? {
      rollers: true,
      cliffs: true,
      onCount: R.kickers.on.count,
      onSpacing: R.kickers.on.spacing,
      offCount: R.kickers.off.count,
    }
  );
}
