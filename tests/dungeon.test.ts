import { describe, expect, it } from "vitest";
import { generateRoom } from "@/lib/dungeon-map";

describe("dungeon room generator", () => {
  it("always produces a playable room (500 random rooms)", () => {
    for (let i = 0; i < 500; i++) {
      const room = generateRoom();
      const { solid, chests, start, reachable } = room;
      const reach = new Set(reachable);

      expect(solid[start.r]![start.c], "start is on the floor").toBe(0);
      expect(chests).toHaveLength(8);
      expect(chests.filter((c) => c.mimic)).toHaveLength(1);

      for (const chest of chests) {
        // Every chest can be opened from some reachable floor tile next to it.
        const touching = [
          [chest.c + 1, chest.r],
          [chest.c - 1, chest.r],
          [chest.c, chest.r + 1],
          [chest.c, chest.r - 1],
        ].some(([c, r]) => reach.has(r! * 20 + c!));
        expect(touching, `chest at ${chest.c},${chest.r} is reachable`).toBe(true);
      }
    }
  });
});
