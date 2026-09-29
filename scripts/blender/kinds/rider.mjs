// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RIDER in a grid slot's kit, as the Blender lab is handed him: his body,
// the pose he is bound in, the helmet's measured shell sampled on a grid,
// and every clip sampled off the game's own pose (`rider-rig.ts`).
export const kind = {
  ids: async () =>
    (await import("../../../pwa/src/game/sled-body.ts")).SLED_STYLES.map((_, i) => `rider${i}`),
  data: async (id) => {
    const { SLED_STYLES } = await import("../../../pwa/src/game/sled-body.ts");
    const { BODY, riderPose } = await import("../../../pwa/src/game/rider-pose.ts");
    const helmet = await import("../../../pwa/src/game/rider-helmet.ts");
    const { RIDING, riderBones, riderClips } = await import("../../../pwa/src/game/rider-rig.ts");
    const rest = riderPose(RIDING);
    // Fine enough that the port's and the cap's edges read clean in a
    // still; the game quality takes every other point.
    const [na, ne] = [144, 96];
    const around = (i) => -Math.PI + (2 * Math.PI * i) / na;
    const up = (j) => -Math.PI / 2 + (Math.PI * j) / ne;
    return {
      style: SLED_STYLES[Number(id.slice(5))].rider,
      body: BODY,
      rest: { pose: rest, bones: riderBones(rest) },
      helmet: {
        tilt: helmet.HELMET_TILT,
        sit: helmet.HELMET_SIT,
        around: na,
        up: ne,
        // The reach at every grid point (round from dead behind), and what
        // the shell is in every cell.
        reach: Array.from({ length: ne + 1 }, (_, j) =>
          Array.from({ length: na }, (_, i) => helmet.helmetReach(around(i), up(j))),
        ),
        part: Array.from({ length: ne }, (_, j) =>
          Array.from({ length: na }, (_, i) => helmet.helmetPart(around(i + 0.5), up(j + 0.5))),
        ),
      },
      clips: riderClips().map((c) => ({
        name: c.name,
        seconds: c.seconds,
        frames: c.poses.map(riderBones),
      })),
    };
  },
  builder: "rider.py",
  fallback: "rider0",
  help: "rider0…3, a grid slot's kit",
};
