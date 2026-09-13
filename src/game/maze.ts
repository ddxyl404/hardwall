import {
  CELL,
  COLS,
  PALETTE,
  PICKUP_COUNT,
  ROWS,
  WALL_H,
  WALL_T,
} from "./constants";
import { mulberry32, randInt, shuffle } from "./rng";

export type CellWalls = { n: boolean; e: boolean; s: boolean; w: boolean };

export type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number };

export type WallSpec = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
};

export type PickupSpec = {
  id: number;
  cx: number;
  cz: number;
  x: number;
  z: number;
  kind: 0 | 1 | 2;
};

export type MazeData = {
  cols: number;
  rows: number;
  seed: number;
  start: { cx: number; cz: number };
  exit: { cx: number; cz: number };
  cellWalls: CellWalls[][];
  walls: WallSpec[];
  aabbs: Aabb[];
  pickups: PickupSpec[];
};

const DIRS = [
  { dx: 0, dz: -1, a: "n" as const, b: "s" as const },
  { dx: 1, dz: 0, a: "e" as const, b: "w" as const },
  { dx: 0, dz: 1, a: "s" as const, b: "n" as const },
  { dx: -1, dz: 0, a: "w" as const, b: "e" as const },
];

export function cellCenter(cx: number, cz: number): { x: number; z: number } {
  return { x: cx * CELL, z: cz * CELL };
}

export function worldToCell(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.round(x / CELL), cz: Math.round(z / CELL) };
}

function makeCell(): CellWalls {
  return { n: true, e: true, s: true, w: true };
}

function wallColor(ix: number, iz: number, axis: number, seed: number): number {
  const n =
    Math.imul(ix + 3, 374761393) ^
    Math.imul(iz + 1, 668265263) ^
    Math.imul(axis + 2, (seed | 1) >>> 0);
  const v = (n >>> 0) % 11;
  if (v === 0) return PALETTE.sun;
  if (v === 1) return PALETTE.cyan;
  if (v === 2) return PALETTE.pink;
  if (v === 3) return PALETTE.lime;
  return PALETTE.white;
}

function addWall(
  walls: WallSpec[],
  aabbs: Aabb[],
  x: number,
  z: number,
  sx: number,
  sz: number,
  color: number,
) {
  walls.push({ x, y: WALL_H * 0.5, z, sx, sy: WALL_H, sz, color });
  const hx = sx * 0.5;
  const hz = sz * 0.5;
  aabbs.push({
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz,
  });
}

export function generateMaze(
  cols = COLS,
  rows = ROWS,
  seed = 1,
): MazeData {
  const rng = mulberry32(seed >>> 0);
  const cellWalls: CellWalls[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, makeCell),
  );
  const vis: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false),
  );

  const sx0 = 0;
  const sz0 = 0;
  vis[sz0]![sx0] = true;
  const stack: { x: number; z: number }[] = [{ x: sx0, z: sz0 }];

  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const options: (typeof DIRS)[number][] = [];
    for (const d of DIRS) {
      const nx = cur.x + d.dx;
      const nz = cur.z + d.dz;
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      if (vis[nz]![nx]) continue;
      options.push(d);
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = options[randInt(rng, 0, options.length)]!;
    const nx = cur.x + d.dx;
    const nz = cur.z + d.dz;
    cellWalls[cur.z]![cur.x]![d.a] = false;
    cellWalls[nz]![nx]![d.b] = false;
    vis[nz]![nx] = true;
    stack.push({ x: nx, z: nz });
  }

  const extra = Math.floor(cols * rows * 0.09);
  for (let i = 0; i < extra; i++) {
    const x = randInt(rng, 0, cols);
    const z = randInt(rng, 0, rows);
    if (rng() < 0.5 && x < cols - 1 && cellWalls[z]![x]!.e) {
      cellWalls[z]![x]!.e = false;
      cellWalls[z]![x + 1]!.w = false;
    } else if (z < rows - 1 && cellWalls[z]![x]!.s) {
      cellWalls[z]![x]!.s = false;
      cellWalls[z + 1]![x]!.n = false;
    }
  }

  const start = { cx: sx0, cz: sz0 };
  const exit = farthestCell(cellWalls, start);

  const candidates: { cx: number; cz: number }[] = [];
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if ((x === start.cx && z === start.cz) || (x === exit.cx && z === exit.cz)) {
        continue;
      }
      candidates.push({ cx: x, cz: z });
    }
  }
  const picked = shuffle(rng, candidates).slice(0, PICKUP_COUNT);
  const pickups: PickupSpec[] = picked.map((p, id) => {
    const c = cellCenter(p.cx, p.cz);
    return {
      id,
      cx: p.cx,
      cz: p.cz,
      x: c.x,
      z: c.z,
      kind: (id % 3) as 0 | 1 | 2,
    };
  });

  const walls: WallSpec[] = [];
  const aabbs: Aabb[] = [];
  const overlap = WALL_T;

  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const cell = cellWalls[z]![x]!;
      const c = cellCenter(x, z);
      if (z === 0 && cell.n) {
        addWall(
          walls,
          aabbs,
          c.x,
          c.z - CELL * 0.5,
          CELL + overlap,
          WALL_T,
          wallColor(x, z, 0, seed),
        );
      }
      if (x === 0 && cell.w) {
        addWall(
          walls,
          aabbs,
          c.x - CELL * 0.5,
          c.z,
          WALL_T,
          CELL + overlap,
          wallColor(x, z, 1, seed),
        );
      }
      if (cell.s) {
        addWall(
          walls,
          aabbs,
          c.x,
          c.z + CELL * 0.5,
          CELL + overlap,
          WALL_T,
          wallColor(x, z, 2, seed),
        );
      }
      if (cell.e) {
        addWall(
          walls,
          aabbs,
          c.x + CELL * 0.5,
          c.z,
          WALL_T,
          CELL + overlap,
          wallColor(x, z, 3, seed),
        );
      }
    }
  }

  return {
    cols,
    rows,
    seed,
    start,
    exit,
    cellWalls,
    walls,
    aabbs,
    pickups,
  };
}

function farthestCell(
  grid: CellWalls[][],
  start: { cx: number; cz: number },
): { cx: number; cz: number } {
  const rows = grid.length;
  const cols = grid[0]!.length;
  const seen = new Uint8Array(cols * rows);
  const q: number[] = [start.cx, start.cz];
  seen[start.cz * cols + start.cx] = 1;
  let farX = start.cx;
  let farZ = start.cz;
  let head = 0;
  while (head < q.length) {
    const x = q[head]!;
    const z = q[head + 1]!;
    head += 2;
    farX = x;
    farZ = z;
    const cell = grid[z]![x]!;
    for (const d of DIRS) {
      if (cell[d.a]) continue;
      const nx = x + d.dx;
      const nz = z + d.dz;
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      const i = nz * cols + nx;
      if (seen[i]) continue;
      seen[i] = 1;
      q.push(nx, nz);
    }
  }
  return { cx: farX, cz: farZ };
}

/** Yaw that faces an open neighbor from the start cell. yaw=0 faces −Z. */
export function spawnYaw(maze: MazeData): number {
  const cell = maze.cellWalls[maze.start.cz]![maze.start.cx]!;
  if (!cell.s) return Math.PI;
  if (!cell.e) return -Math.PI / 2;
  if (!cell.n) return 0;
  if (!cell.w) return Math.PI / 2;
  return 0;
}
