// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SLED, as the Blender lab is handed it (`scripts/blender.mjs`): the
// spec and its class's traced look — the very tables `sled-body.ts` and
// `sled-gear.ts` build the code's machine from — and the drawn travel and
// bar turn its clips run.
export const kind = {
  ids: async () => (await import("../../../engine/index.ts")).SLEDS.map((s) => s.id),
  data: async (id) => {
    const { SLEDS } = await import("../../../engine/index.ts");
    const { SLED_LOOKS } = await import("../../../pwa/src/game/sled-looks.ts");
    const { TRAVEL, BAR_TURN } = await import("../../../pwa/src/game/sled-gear.ts");
    return {
      spec: SLEDS.find((s) => s.id === id),
      look: SLED_LOOKS[id],
      gear: { travel: TRAVEL, barTurn: BAR_TURN },
    };
  },
  builder: "sled.py",
  fallback: "fox",
  help: "a sled's id",
};
