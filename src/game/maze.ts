import { CELL, PALETTE, WALL_FILLS, WALL_H, WALL_T } from "./constants";
import { DIFFICULTIES, type DifficultyId } from "./difficulty";
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

export type PickupKind = "block" | "dash" | "reveal" | "compass" | "stamp";

export type PickupSpec = {
  id: number;
  cx: number;
  cz: number;
  x: number;
  z: number;
  kind: PickupKind;
};

export type Teleporter = {
  id: number;
  cx: number;
  cz: number;
  x: number;
  z: number;
  pair: number;
};

export type BoostPad = {
  cx: number;
  cz: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
};

export type DoorSpec = {
  id: number;
  cx: number;
  cz: number;
  dir: "e" | "s";
  x: number;
  z: number;
  sx: number;
  sz: number;
  aabb: Aabb;
  need: number;
};

export type Courtyard = { cx: number; cz: number; x: number; z: number };

export type PopOrb = { id: number; cx: number; cz: number; x: number; z: number };

export type MazeData = {
  cols: number;
  rows: number;
  seed: number;
  difficulty: DifficultyId;
  start: { cx: number; cz: number };
  exit: { cx: number; cz: number };
  cellWalls: CellWalls[][];
  walls: WallSpec[];
  aabbs: Aabb[];
  pickups: PickupSpec[];
  totalBlocks: number;
  totalStamps: number;
  exitNeedsAll: boolean;
  teleporters: Teleporter[];
  boosts: BoostPad[];
  doors: DoorSpec[];
  courtyards: Courtyard[];
  pops: PopOrb[];
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
  return WALL_FILLS[(n >>> 0) % WALL_FILLS.length] ?? PALETTE.paper;
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

function openCount(cell: CellWalls): number {
  return (
    (cell.n ? 0 : 1) + (cell.e ? 0 : 1) + (cell.s ? 0 : 1) + (cell.w ? 0 : 1)
  );
}

function clearEast(grid: CellWalls[][], x: number, z: number) {
  grid[z]![x]!.e = false;
  grid[z]![x + 1]!.w = false;
}

function clearSouth(grid: CellWalls[][], x: number, z: number) {
  grid[z]![x]!.s = false;
  grid[z + 1]![x]!.n = false;
}

export function generateMaze(seed: number, difficulty: DifficultyId = "hard"): MazeData {
  const spec = DIFFICULTIES[difficulty];
  const cols = spec.cols;
  const rows = spec.rows;
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

  const extra = Math.floor(cols * rows * spec.extraOpen);
  for (let i = 0; i < extra; i++) {
    const x = randInt(rng, 0, cols);
    const z = randInt(rng, 0, rows);
    if (rng() < 0.5 && x < cols - 1 && cellWalls[z]![x]!.e) {
      clearEast(cellWalls, x, z);
    } else if (z < rows - 1 && cellWalls[z]![x]!.s) {
      clearSouth(cellWalls, x, z);
    }
  }

  const start = { cx: sx0, cz: sz0 };
  const exit = farthestCell(cellWalls, start);

  const reserved = new Set<number>([start.cz * cols + start.cx, exit.cz * cols + exit.cx]);
  const courtyards = punchCourtyards(
    cellWalls,
    cols,
    rows,
    spec.courtyards,
    rng,
    reserved,
  );

  const kinds: PickupKind[] = [
    ...Array.from({ length: spec.blocks }, () => "block" as const),
    ...Array.from({ length: spec.dashes }, () => "dash" as const),
    ...Array.from({ length: spec.reveals }, () => "reveal" as const),
    ...Array.from({ length: spec.compasses }, () => "compass" as const),
    ...Array.from({ length: spec.stamps }, () => "stamp" as const),
  ];

  const candidates: { cx: number; cz: number }[] = [];
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const i = z * cols + x;
      if (reserved.has(i)) continue;
      candidates.push({ cx: x, cz: z });
    }
  }
  const picked = shuffle(rng, candidates).slice(0, kinds.length);
  const mix = shuffle(rng, kinds);
  const pickups: PickupSpec[] = picked.map((p, id) => {
    reserved.add(p.cz * cols + p.cx);
    const c = cellCenter(p.cx, p.cz);
    return {
      id,
      cx: p.cx,
      cz: p.cz,
      x: c.x,
      z: c.z,
      kind: mix[id] ?? "block",
    };
  });

  const teleporters = placeTeleporters(cellWalls, cols, rows, spec.warpPairs, rng, reserved);
  const boosts = placeBoosts(cellWalls, cols, rows, spec.boosts, rng, reserved);
  const doors = placeDoors(cellWalls, cols, rows, spec.doors, spec.doorNeed, rng);
  const pops = placePops(cellWalls, cols, rows, spec.pops, rng, reserved);
  const doorKeys = new Set(doors.map((d) => `${d.cx},${d.cz},${d.dir}`));

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
      if (cell.s && !doorKeys.has(`${x},${z},s`)) {
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
      if (cell.e && !doorKeys.has(`${x},${z},e`)) {
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

  for (const y of courtyards) {
    aabbs.push({
      minX: y.x - 0.58,
      maxX: y.x + 0.58,
      minZ: y.z - 0.58,
      maxZ: y.z + 0.58,
    });
  }

  return {
    cols,
    rows,
    seed,
    difficulty,
    start,
    exit,
    cellWalls,
    walls,
    aabbs,
    pickups,
    totalBlocks: spec.blocks,
    totalStamps: spec.stamps,
    exitNeedsAll: spec.exitNeedsAll,
    teleporters,
    boosts,
    doors,
    courtyards,
    pops,
  };
}

function punchCourtyards(
  grid: CellWalls[][],
  cols: number,
  rows: number,
  count: number,
  rng: () => number,
  reserved: Set<number>,
): Courtyard[] {
  const spots: { x: number; z: number }[] = [];
  for (let z = 1; z < rows - 2; z++) {
    for (let x = 1; x < cols - 2; x++) {
      spots.push({ x, z });
    }
  }
  const yards: Courtyard[] = [];
  for (const s of shuffle(rng, spots)) {
    if (yards.length >= count) break;
    const ids = [
      s.z * cols + s.x,
      s.z * cols + s.x + 1,
      (s.z + 1) * cols + s.x,
      (s.z + 1) * cols + s.x + 1,
    ];
    if (ids.some((i) => reserved.has(i))) continue;
    for (const i of ids) reserved.add(i);
    clearEast(grid, s.x, s.z);
    clearEast(grid, s.x, s.z + 1);
    clearSouth(grid, s.x, s.z);
    clearSouth(grid, s.x + 1, s.z);
    const c0 = cellCenter(s.x, s.z);
    const c1 = cellCenter(s.x + 1, s.z + 1);
    yards.push({
      cx: s.x,
      cz: s.z,
      x: (c0.x + c1.x) * 0.5,
      z: (c0.z + c1.z) * 0.5,
    });
  }
  return yards;
}

function placeTeleporters(
  grid: CellWalls[][],
  cols: number,
  rows: number,
  pairs: number,
  rng: () => number,
  reserved: Set<number>,
): Teleporter[] {
  const ends: { cx: number; cz: number }[] = [];
  const rest: { cx: number; cz: number }[] = [];
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const i = z * cols + x;
      if (reserved.has(i)) continue;
      const n = openCount(grid[z]![x]!);
      const cell = { cx: x, cz: z };
      if (n === 1) ends.push(cell);
      else rest.push(cell);
    }
  }
  const pool = [...shuffle(rng, ends), ...shuffle(rng, rest)];
  const need = pairs * 2;
  const chosen = pool.slice(0, need);
  const list: Teleporter[] = [];
  for (let i = 0; i + 1 < chosen.length; i += 2) {
    const a = chosen[i]!;
    const b = chosen[i + 1]!;
    reserved.add(a.cz * cols + a.cx);
    reserved.add(b.cz * cols + b.cx);
    const ca = cellCenter(a.cx, a.cz);
    const cb = cellCenter(b.cx, b.cz);
    const id = list.length;
    list.push({ id, cx: a.cx, cz: a.cz, x: ca.x, z: ca.z, pair: id + 1 });
    list.push({ id: id + 1, cx: b.cx, cz: b.cz, x: cb.x, z: cb.z, pair: id });
  }
  return list;
}

function placeBoosts(
  grid: CellWalls[][],
  cols: number,
  rows: number,
  count: number,
  rng: () => number,
  reserved: Set<number>,
): BoostPad[] {
  const spots: BoostPad[] = [];
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (reserved.has(z * cols + x)) continue;
      const cell = grid[z]![x]!;
      const ns = !cell.n && !cell.s && cell.e && cell.w;
      const ew = cell.n && cell.s && !cell.e && !cell.w;
      if (!ns && !ew) continue;
      const c = cellCenter(x, z);
      const dx = ew ? (rng() < 0.5 ? 1 : -1) : 0;
      const dz = ns ? (rng() < 0.5 ? 1 : -1) : 0;
      spots.push({ cx: x, cz: z, x: c.x, z: c.z, dx, dz });
    }
  }
  const picked = shuffle(rng, spots).slice(0, count);
  for (const p of picked) reserved.add(p.cz * cols + p.cx);
  return picked;
}

function placeDoors(
  grid: CellWalls[][],
  cols: number,
  rows: number,
  count: number,
  need: number,
  rng: () => number,
): DoorSpec[] {
  const spots: { cx: number; cz: number; dir: "e" | "s" }[] = [];
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (x === 0 && z === 0) continue;
      const cell = grid[z]![x]!;
      if (x < cols - 1 && cell.e) spots.push({ cx: x, cz: z, dir: "e" });
      if (z < rows - 1 && cell.s) spots.push({ cx: x, cz: z, dir: "s" });
    }
  }
  const picked = shuffle(rng, spots).slice(0, count);
  const overlap = WALL_T;
  return picked.map((p, id) => {
    const c = cellCenter(p.cx, p.cz);
    const x = p.dir === "e" ? c.x + CELL * 0.5 : c.x;
    const z = p.dir === "s" ? c.z + CELL * 0.5 : c.z;
    const sx = p.dir === "e" ? WALL_T : CELL + overlap;
    const sz = p.dir === "s" ? WALL_T : CELL + overlap;
    const hx = sx * 0.5;
    const hz = sz * 0.5;
    return {
      id,
      cx: p.cx,
      cz: p.cz,
      dir: p.dir,
      x,
      z,
      sx,
      sz,
      need,
      aabb: { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz },
    };
  });
}

function placePops(
  grid: CellWalls[][],
  cols: number,
  rows: number,
  count: number,
  rng: () => number,
  reserved: Set<number>,
): PopOrb[] {
  const spots: { cx: number; cz: number }[] = [];
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      if (reserved.has(z * cols + x)) continue;
      const n = openCount(grid[z]![x]!);
      if (n < 2) continue;
      spots.push({ cx: x, cz: z });
    }
  }
  const picked = shuffle(rng, spots).slice(0, count);
  return picked.map((p, id) => {
    reserved.add(p.cz * cols + p.cx);
    const c = cellCenter(p.cx, p.cz);
    return { id, cx: p.cx, cz: p.cz, x: c.x, z: c.z };
  });
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

export function openDoorsOf(cell: CellWalls): number {
  return openCount(cell);
}

export function isCourtyardCell(maze: MazeData, cx: number, cz: number): boolean {
  return maze.courtyards.some(
    (y) => cx >= y.cx && cx <= y.cx + 1 && cz >= y.cz && cz <= y.cz + 1,
  );
}
