// A small isometric scene for iso-game, which has no screenshots yet. Drawn
// with the site tokens, so it follows the theme like the diagrams do.
const TILE_W = 40;
const TILE_H = 20;
const GRID = 6;
// Block heights per tile (0 = floor), a little terrain with a tower.
const HEIGHTS = [
  [0, 0, 1, 1, 0, 0],
  [0, 1, 2, 1, 0, 0],
  [0, 1, 3, 2, 1, 0],
  [0, 0, 1, 1, 0, 0],
  [0, 0, 0, 1, 2, 0],
  [0, 0, 0, 0, 1, 0],
];

function point(x: number, y: number, z: number): string {
  const px = 200 + (x - y) * (TILE_W / 2);
  const py = 40 + (x + y) * (TILE_H / 2) - z * 18;
  return `${px},${py}`;
}

export function IsometricArt() {
  const faces: React.ReactNode[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const h = HEIGHTS[y]?.[x] ?? 0;
      const top = [point(x, y, h), point(x + 1, y, h), point(x + 1, y + 1, h), point(x, y + 1, h)].join(" ");
      if (h > 0) {
        const left = [point(x, y + 1, h), point(x + 1, y + 1, h), point(x + 1, y + 1, 0), point(x, y + 1, 0)].join(" ");
        const right = [point(x + 1, y, h), point(x + 1, y + 1, h), point(x + 1, y + 1, 0), point(x + 1, y, 0)].join(" ");
        faces.push(<polygon key={`l${x}${y}`} points={left} className="fill-accent/25 stroke-accent/40" />);
        faces.push(<polygon key={`r${x}${y}`} points={right} className="fill-accent/40 stroke-accent/50" />);
      }
      faces.push(
        <polygon
          key={`t${x}${y}`}
          points={top}
          className={h > 0 ? "fill-accent/60 stroke-accent" : "fill-surface stroke-border"}
        />
      );
    }
  }
  return (
    <svg viewBox="0 0 400 220" aria-hidden className="h-auto w-full" strokeWidth={1}>
      {faces}
    </svg>
  );
}
