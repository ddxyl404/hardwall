import { CELL, EYE } from "./constants";
import type { MazeData } from "./maze";
import { cellCenter, spawnYaw, worldToCell } from "./maze";

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getPosition: () => { x: number; z: number };
  setKeys: (codes: string[]) => void;
  setYaw?: (v: number) => void;
  setPosition?: (x: number, z: number) => void;
  getExit?: () => { x: number; z: number } | null;
  getPickup?: () => { x: number; z: number; id: number } | null;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export type Runtime = {
  maze: MazeData | null;
  phase: "menu" | "playing" | "paused" | "won";
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  speed: number;
  collected: Set<number>;
  visited: Uint8Array;
  time: number;
  keys: Set<string>;
  injectedKeys: string[] | null;
  touchX: number;
  touchY: number;
  lookAX: number;
  lookAY: number;
  pointerLocked: boolean;
  muted: boolean;
  trauma: number;
  walkDist: number;
  bob: number;
  bobPhase: number;
  reducedMotion: boolean;
  lastBump: number;
  lastFoot: number;
};

export const runtime: Runtime = {
  maze: null,
  phase: "menu",
  x: 0,
  y: EYE,
  z: 0,
  yaw: 0,
  pitch: 0,
  vx: 0,
  vz: 0,
  speed: 0,
  collected: new Set(),
  visited: new Uint8Array(0),
  time: 0,
  keys: new Set(),
  injectedKeys: null,
  touchX: 0,
  touchY: 0,
  lookAX: 0,
  lookAY: 0,
  pointerLocked: false,
  muted: false,
  trauma: 0,
  walkDist: 0,
  bob: 0,
  bobPhase: 0,
  reducedMotion: false,
  lastBump: 0,
  lastFoot: 0,
};

export function loadRuntime(maze: MazeData): void {
  const spawn = cellCenter(maze.start.cx, maze.start.cz);
  runtime.maze = maze;
  runtime.x = spawn.x;
  runtime.y = EYE;
  runtime.z = spawn.z;
  runtime.yaw = spawnYaw(maze);
  runtime.pitch = 0;
  runtime.vx = 0;
  runtime.vz = 0;
  runtime.speed = 0;
  runtime.collected = new Set();
  runtime.visited = new Uint8Array(maze.cols * maze.rows);
  runtime.time = 0;
  runtime.injectedKeys = null;
  runtime.touchX = 0;
  runtime.touchY = 0;
  runtime.lookAX = 0;
  runtime.lookAY = 0;
  runtime.trauma = 0;
  runtime.walkDist = 0;
  runtime.bob = 0;
  runtime.bobPhase = 0;
  runtime.lastBump = 0;
  runtime.lastFoot = 0;
  runtime.reducedMotion =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  markExplore(maze.start.cx, maze.start.cz);
}

export function markExplore(cx: number, cz: number): void {
  const maze = runtime.maze;
  if (!maze) return;
  const { cols, rows, cellWalls } = maze;
  const paint = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= cols || z >= rows) return;
    runtime.visited[z * cols + x] = 1;
  };
  paint(cx, cz);
  const cell = cellWalls[cz]?.[cx];
  if (!cell) return;
  if (!cell.n) paint(cx, cz - 1);
  if (!cell.s) paint(cx, cz + 1);
  if (!cell.e) paint(cx + 1, cz);
  if (!cell.w) paint(cx - 1, cz);
}

export function exploreAtPlayer(): void {
  const maze = runtime.maze;
  if (!maze) return;
  const { cx, cz } = worldToCell(runtime.x, runtime.z);
  if (cx < 0 || cz < 0 || cx >= maze.cols || cz >= maze.rows) return;
  markExplore(cx, cz);
}

export function held(code: string): boolean {
  if (runtime.injectedKeys) return runtime.injectedKeys.includes(code);
  return runtime.keys.has(code);
}

export function installControlsProbe(): void {
  if (typeof window === "undefined") return;
  window.__controlsTest = {
    getYaw: () => runtime.yaw,
    getSpeed: () => runtime.speed,
    getPosition: () => ({ x: runtime.x, z: runtime.z }),
    setKeys: (codes: string[]) => {
      runtime.injectedKeys = codes;
    },
    setYaw: (v: number) => {
      runtime.yaw = v;
    },
    setPosition: (x: number, z: number) => {
      runtime.x = x;
      runtime.z = z;
    },
    getExit: () => {
      const m = runtime.maze;
      if (!m) return null;
      return { x: m.exit.cx * CELL, z: m.exit.cz * CELL };
    },
    getPickup: () => {
      const m = runtime.maze;
      if (!m) return null;
      const p = m.pickups.find((item) => !runtime.collected.has(item.id));
      if (!p) return null;
      return { x: p.x, z: p.z, id: p.id };
    },
  };
}

export function countVisited(): number {
  let n = 0;
  for (const v of runtime.visited) if (v) n++;
  return n;
}
