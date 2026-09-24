// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN'S SHELVES, and the six maps each of them runs. Every map is a
// SEED plus the laps it is ridden over and, where the ladder needs one, the
// sky it is ridden under — the maps are generated, not authored — so a shelf
// is a short table of them with the name the menu shows. Curating one is
// `make rate CAMPAIGN=1` and `make difficulty CAMPAIGN=1`'s job, and the
// numbers here are their output.
//
// EVERY MAP NAMES THE GENERATOR THAT BUILT IT (`engine/mapgen/versions.ts`)
// and carries the DIGEST of the map that came out, and both are written out
// on every map rather than shared from a constant on purpose: a shared
// version is a single edit that re-rolls the whole campaign, which is the
// implicit move the field exists to make impossible, and a digest is a claim
// about ONE map. `tests/generator_version_test.ts` rebuilds every map and
// holds it to its digest, so a rule moving under one of these is a red suite
// rather than a silent re-roll — and when it goes red, the question is which
// of the two it was: a map deliberately moved (write the new digest down,
// re-rate, re-time, re-name), or the rules moving out from under one (add a
// version row, keep the old behaviour on the old row).
//
// A MAP IS NAMED FOR WHAT IT IS LIKE, never for where it is: the snow, the
// light, the shape of the ask. There is one nature and no places in it.
//
// THE RUNG ORDER is a race, a time trial, two races, a time trial and a race
// — six rungs, so four races around two trials, and the race both OPENS and
// CLOSES a shelf. Nothing asks the same game three times running, and the
// field is met on the first rung and beaten on the last. The TRIALS are one
// lap on the first two shelves and three on the summit, where the clock is
// the thing being learned. The three shelves climb in the light as well as
// in the snow: the foothills are ridden by day, the timberline rides into a
// low sun and then the dark, and the summit is fog, falling snow and night.
// Every rung asks more than the one before it on `make rate CAMPAIGN=1`'s
// index, and the seeds were picked from a sweep of the first ninety-six
// (`make rate COUNT=96 ARGS=--sim`) on the brief the rating module's header
// states: climb without a wall, no two rungs the same map twice, and every
// kind of ask led on somewhere.
//
// EVERY MAP IS RIDDEN ON THE HOUR AND THE SEASON ITS SEED DEALT (R15), so
// the dark on the summit is the evenings R19 hands out and not a lamp turned
// off by hand. THE SKY IS PICKED: the campaign's maps are all version 1's,
// whose deal was a lid or a fall one day in three, so most rungs lay a
// `sky` over the dealt one (`withSky`) — the bright days, the flurries out
// of a sunny sky, a first snow, a storm on the summit — and a grey one is
// the exception. A sky
// moves nothing the generator builds and so nothing the digest reads, but
// the rating reads it (its sky axis), and a sky is picked to keep every
// shelf climbing on `make rate CAMPAIGN=1`'s index.
//
// THE MEDALS on a time trial are set against the bot's own run of it — the
// crossover ridden by the bot over the rung's laps, which is what the
// curation loop measures (`make rate CAMPAIGN=1` prints it beside them).
// SILVER IS THE BOT'S TIME and a few per cent; BRONZE is an eighth slower
// than the bot, because a medal is the DOOR to the next rung and nothing
// else; GOLD is two per cent under it, a clean run the bot does not ride.

import type { GeneratorVersion, SkyOverride, WeatherKind } from "@engine";

/** The two games a campaign map is played as. A free ride measures nothing,
 * so it is never a rung. */
export type CampaignMode = "race" | "timeTrial";

/** The three medals a time trial pays, worst first. */
export const MEDALS = ["bronze", "silver", "gold"] as const;
export type Medal = (typeof MEDALS)[number];

export type CampaignLevel = {
  id: string;
  name: string;
  /** One line of billing on the map's box. */
  blurb: string;
  seed: number;
  mode: CampaignMode;
  /** Laps to the flag: R16's three on a race, one or three on a trial. */
  laps: number;
  /** WHICH GENERATOR built this map (`mapgen/versions.ts`). Required on
   * every map rather than on the shelf, because it is the one thing about a
   * campaign map that a change somewhere else can take away. */
  version: GeneratorVersion;
  /** The fingerprint of the map this rung was curated on, as `levelDigest`
   * reads it — `make rate CAMPAIGN=1` prints the one that builds today. */
  digest: string;
  /** A sky or a start hour laid over the dealt day (see the header). */
  sky?: SkyOverride;
  /** THE DAY the map is ridden in — its sky and the solar hour the run
   * starts at, `sky` laid over the seed's own — quoted here so a box can
   * bill it without building the map, and held to the built map by
   * `tests/generator_version_test.ts`. */
  day: { weather: WeatherKind; hour: number };
  /** A time trial's three medals, seconds over its laps — lower is better. */
  medals?: Record<Medal, number>;
};

export type CampaignShelf = {
  id: "foothills" | "timberline" | "summit";
  name: string;
  blurb: string;
  levels: readonly CampaignLevel[];
};

/** THE FIRST SHELF — open to everyone: bright days, a gentle loop to learn on, then
 * the woods, the corners, the drifts and the biggest kickers of the three. */
const FOOTHILLS: CampaignShelf = {
  id: "foothills",
  name: "Foothills",
  blurb: "Bright days, open hills and a loop to learn",
  levels: [
    {
      id: "foothills-1",
      name: "First Tracks",
      blurb: "A long easy loop in the sun, and hills to learn it on",
      seed: 10,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "3f0fc5a0",
      day: { weather: "clear", hour: 13.73 },
    },
    {
      id: "foothills-2",
      name: "Short Hop",
      blurb: "One quick lap: three kickers and the woods close in",
      seed: 88,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "89e93724",
      day: { weather: "clear", hour: 12.38 },
      medals: { gold: 102, silver: 109, bronze: 116 },
    },
    {
      id: "foothills-3",
      name: "Snow Pines",
      blurb: "Snow falling on a loop walled by trees",
      seed: 55,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "50b394a6",
      sky: { weather: { kind: "snow", snowfall: 0.3 } },
      day: { weather: "snow", hour: 9.54 },
    },
    {
      id: "foothills-4",
      name: "Switchbacks",
      blurb: "Corner after corner, flakes glinting in the sun",
      seed: 34,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "d6a88afb",
      sky: { weather: { kind: "flurries", snowfall: 0.35 } },
      day: { weather: "flurries", hour: 12.08 },
    },
    {
      id: "foothills-5",
      name: "Fresh Fall",
      blurb: "One lap through the drifts, under a veil of high cloud",
      seed: 39,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "44b3c601",
      sky: { weather: "high" },
      day: { weather: "high", hour: 15.12 },
      medals: { gold: 115, silver: 123, bronze: 132 },
    },
    {
      id: "foothills-6",
      name: "High Kicks",
      blurb: "The biggest lips on the shelf, under fair-weather cloud",
      seed: 93,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "a06ea2b7",
      sky: { weather: "fair" },
      day: { weather: "fair", hour: 12.68 },
    },
  ],
};

/** THE SECOND SHELF — steeper country and the woods closing in, the light low on
 * its fifth rung and gone on its last: the first race under the lamps. */
const TIMBERLINE: CampaignShelf = {
  id: "timberline",
  name: "Timberline",
  blurb: "Steeper hills, closer woods, and the light going",
  levels: [
    {
      id: "timberline-1",
      name: "Ridge Line",
      blurb: "Up the hills and off their crests",
      seed: 4,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "90bf2031",
      day: { weather: "clear", hour: 12.04 },
    },
    {
      id: "timberline-2",
      name: "Timber Lap",
      blurb: "One lap in the woods, the powder beside it",
      seed: 54,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "5b19be42",
      sky: { weather: "fair" },
      day: { weather: "fair", hour: 12.54 },
      medals: { gold: 121, silver: 129, bronze: 138 },
    },
    {
      id: "timberline-3",
      name: "Tree Tunnel",
      blurb: "Kickers between walls of pine",
      seed: 52,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "2a387833",
      sky: { weather: "fair" },
      day: { weather: "fair", hour: 13.99 },
    },
    {
      id: "timberline-4",
      name: "Turn and Burn",
      blurb: "Corners and kickers under a grey sky",
      seed: 9,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "d3260382",
      day: { weather: "overcast", hour: 12.08 },
    },
    {
      id: "timberline-5",
      name: "Low Sun",
      blurb: "One lap under high cloud and a winter sun that barely clears the hills",
      seed: 91,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "0bc8ffe6",
      day: { weather: "high", hour: 12.49 },
      medals: { gold: 124, silver: 132, bronze: 142 },
    },
    {
      id: "timberline-6",
      name: "Moonrise",
      blurb: "The first race in the dark, snow drifting through the lamps",
      seed: 31,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "86bac2a5",
      sky: { weather: { kind: "flurries", snowfall: 0.3 } },
      day: { weather: "flurries", hour: 20.78 },
    },
  ],
};

/** THE THIRD SHELF — the ladder's own summit: fog in the basin, a three-lap climb,
 * a whiteout, the woods at night and a race home in fog after dark. */
const SUMMIT: CampaignShelf = {
  id: "summit",
  name: "Summit",
  blurb: "Fog, falling snow and the night",
  levels: [
    {
      id: "summit-1",
      name: "Valley Fog",
      blurb: "Fog lying in the basin, the sun low behind it",
      seed: 49,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "acef3d46",
      day: { weather: "fog", hour: 15.79 },
    },
    {
      id: "summit-2",
      name: "The Climb",
      blurb: "Three laps of the steepest loop on the ladder, deep in powder and more falling",
      seed: 47,
      mode: "timeTrial",
      laps: 3,
      version: 1,
      digest: "35374391",
      sky: { weather: { kind: "flurries", snowfall: 0.3 } },
      day: { weather: "flurries", hour: 12.08 },
      medals: { gold: 388, silver: 414, bronze: 444 },
    },
    {
      id: "summit-3",
      name: "Blue Hour",
      blurb: "Past sunset, the drifts across the line",
      seed: 13,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "a8cce085",
      day: { weather: "fair", hour: 16.58 },
    },
    {
      id: "summit-4",
      name: "Whiteout",
      blurb: "A storm under black cloud, and forty metres to see by",
      seed: 96,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "19975a4f",
      sky: { weather: { kind: "storm", snowfall: 0.9 } },
      day: { weather: "storm", hour: 13.77 },
    },
    {
      id: "summit-5",
      name: "Night Woods",
      blurb: "Three laps under the stars, the trees at the edge of the lamp",
      seed: 42,
      mode: "timeTrial",
      laps: 3,
      version: 1,
      digest: "d094907e",
      day: { weather: "clear", hour: 17.61 },
      medals: { gold: 364, silver: 388, bronze: 416 },
    },
    {
      id: "summit-6",
      name: "Black Fog",
      blurb: "Fog at night: the last race on the ladder",
      seed: 22,
      mode: "race",
      laps: 3,
      version: 1,
      digest: "5c85b1ca",
      day: { weather: "fog", hour: 19.0 },
    },
  ],
};

/** Every shelf, in the order the campaign climbs them. */
export const SHELVES: readonly CampaignShelf[] = [FOOTHILLS, TIMBERLINE, SUMMIT];

/** Every map, in ladder order. */
export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = SHELVES.flatMap((shelf) => shelf.levels);
