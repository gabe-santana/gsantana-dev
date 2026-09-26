// Room generation and map constants for the 404 dungeon game. Pure logic,
// no browser or Next.js APIs, so it can be unit-tested.

export const SHEET = "/games/tiny-dungeon/tilemap_packed.png";
export const SHEET_COLS = 12;
export const T = 16; // tile size in art pixels
export const COLS = 20;
export const ROWS = 12;
export const W = COLS * T; // 320 logical px
export const H = ROWS * T; // 192 logical px
export const SCALE = 3; // canvas backing resolution; CSS scales it to fit

// Sprite indices in the Tiny Dungeon sheet.
export const SPR = {
  floors: [48, 48, 48, 48, 49, 50, 51],
  wall: 40,
  pillars: [57, 58, 59],
  obstacles: [63, 72, 74, 82, 64, 65],
  player: 96,
  slime: 108,
  bat: 120,
  spider: 122,
  mimic: 92,
  chest: 89,
  chestOpen: 91,
  sword: 104,
  shield: 102,
} as const;

export const CHESTS = 7; // real chests (plus one mimic)

export interface Chest {
  c: number;
  r: number;
  open: boolean;
  mimic: boolean;
}

export const rand = (n: number) => Math.floor(Math.random() * n);
export const pick = <X>(list: readonly X[]): X => list[rand(list.length)]!;

// Tile map: 0 = floor, 1 = solid. `ground` is the floor art under every tile,
// `sprite` the wall/obstacle drawn on top (0 = nothing).
export function generateRoom() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const solid: number[][] = [];
    const sprite: number[][] = [];
    const ground: number[][] = [];
    for (let r = 0; r < ROWS; r++) {
      solid.push([]);
      sprite.push([]);
      ground.push([]);
      for (let c = 0; c < COLS; c++) {
        const border = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
        solid[r]!.push(border ? 1 : 0);
        sprite[r]!.push(border ? SPR.wall : 0);
        ground[r]!.push(pick(SPR.floors));
      }
    }

    const start = { c: 2 + rand(3), r: 2 + rand(ROWS - 4) };
    const nearStart = (c: number, r: number) =>
      Math.abs(c - start.c) <= 2 && Math.abs(r - start.r) <= 2;

    // Short wall runs and scattered obstacles give each room its shape.
    for (let i = 0; i < 5; i++) {
      const horizontal = Math.random() < 0.5;
      const len = 2 + rand(3);
      const c0 = 2 + rand(COLS - 6);
      const r0 = 2 + rand(ROWS - 5);
      for (let k = 0; k < len; k++) {
        const c = horizontal ? c0 + k : c0;
        const r = horizontal ? r0 : r0 + k;
        if (nearStart(c, r)) continue;
        solid[r]![c] = 1;
        sprite[r]![c] = pick(SPR.pillars);
      }
    }
    for (let i = 0; i < 14; i++) {
      const c = 1 + rand(COLS - 2);
      const r = 1 + rand(ROWS - 2);
      if (nearStart(c, r)) continue;
      solid[r]![c] = 1;
      sprite[r]![c] = pick(SPR.obstacles);
    }

    // Everything walkable must be reachable from the start.
    const reach = flood(solid, start.c, start.r);
    let floors = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (!solid[r]![c]) floors++;
    if (reach.size < floors * 0.95) continue;

    // Chests sit on open ground (3+ open neighbours), apart from each other
    // and from the start, so they never seal off part of the room.
    const open = [...reach]
      .map((key) => ({ c: key % COLS, r: Math.floor(key / COLS) }))
      .filter(({ c, r }) => !nearStart(c, r))
      .filter(
        ({ c, r }) =>
          neighbours(c, r).filter(([nc, nr]) => !solid[nr]![nc]).length >= 3,
      )
      .sort(() => Math.random() - 0.5);

    const chests: Chest[] = [];
    for (const spot of open) {
      if (chests.length === CHESTS + 1) break;
      if (
        chests.some(
          (ch) => Math.abs(ch.c - spot.c) + Math.abs(ch.r - spot.r) < 3,
        )
      )
        continue;
      chests.push({ ...spot, open: false, mimic: false });
    }
    if (chests.length < CHESTS + 1) continue;
    chests[rand(chests.length)]!.mimic = true;

    // Re-check reachability with chests as solid tiles.
    const withChests = solid.map((row) => [...row]);
    for (const ch of chests) withChests[ch.r]![ch.c] = 1;
    const reach2 = flood(withChests, start.c, start.r);
    const allReachable = chests.every((ch) =>
      neighbours(ch.c, ch.r).some(([nc, nr]) => reach2.has(nr * COLS + nc)),
    );
    if (!allReachable) continue;

    return { solid, sprite, ground, chests, start, reachable: [...reach2] };
  }
  throw new Error("could not generate a room");
}

function neighbours(c: number, r: number): [number, number][] {
  return [
    [c + 1, r],
    [c - 1, r],
    [c, r + 1],
    [c, r - 1],
  ];
}

function flood(solid: number[][], c0: number, r0: number): Set<number> {
  const seen = new Set<number>([r0 * COLS + c0]);
  const queue: [number, number][] = [[c0, r0]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [nc, nr] of neighbours(c, r)) {
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const key = nr * COLS + nc;
      if (solid[nr]![nc] || seen.has(key)) continue;
      seen.add(key);
      queue.push([nc, nr]);
    }
  }
  return seen;
}
