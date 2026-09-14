import { CELL, EYE } from "./constants";
import type { DifficultyId } from "./difficulty";
import type { Aabb, MazeData } from "./maze";
import { cellCenter, spawnYaw, worldToCell } from "./maze";
import type { ToastTone } from "./pickups";

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
  blocks: number;
  stamps: number;
  popped: Set<number>;
  openDoors: Set<number>;
  aabbs: Aabb[];
  lastWarp: number;
  lastBoostKey: string;
  padBoostUntil: number;
  visited: Uint8Array;
  time: number;
  keys: Set<string>;
  injectedKeys: string[] | null;
  touchX: number;
  touchY: number;
  touchSprint: boolean;
  touchActive: boolean;
  lookAX: number;
  lookAY: number;
  lookSens: number;
  pointerLocked: boolean;
  muted: boolean;
  trauma: number;
  walkDist: number;
  bob: number;
  bobPhase: number;
  reducedMotion: boolean;
  lastBump: number;
  lastFoot: number;
  lastLockNudge: number;
  lastDoorBump: number;
  lastTarSfx: number;
  boostUntil: number;
  revealUntil: number;
  compassUntil: number;
  lockHintUntil: number;
  doorHintUntil: number;
  hop: number;
  fovKick: number;
  hitstop: number;
  onTar: boolean;
  toastLabel: string;
  toastTone: ToastTone;
  toastUntil: number;
  flashTone: ToastTone | "ink";
  flashUntil: number;
  difficulty: DifficultyId;
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
  blocks: 0,
  stamps: 0,
  popped: new Set(),
  openDoors: new Set(),
  aabbs: [],
  lastWarp: -1,
  lastBoostKey: "",
  padBoostUntil: 0,
  visited: new Uint8Array(0),
  time: 0,
  keys: new Set(),
  injectedKeys: null,
  touchX: 0,
  touchY: 0,
  touchSprint: false,
  touchActive: false,
  lookAX: 0,
  lookAY: 0,
  lookSens: 1,
  pointerLocked: false,
  muted: false,
  trauma: 0,
  walkDist: 0,
  bob: 0,
  bobPhase: 0,
  reducedMotion: false,
  lastBump: 0,
  lastFoot: 0,
  lastLockNudge: 0,
  lastDoorBump: 0,
  lastTarSfx: 0,
  boostUntil: 0,
  revealUntil: 0,
  compassUntil: 0,
  lockHintUntil: 0,
  doorHintUntil: 0,
  hop: 0,
  fovKick: 0,
  hitstop: 0,
  onTar: false,
  toastLabel: "",
  toastTone: "sun",
  toastUntil: 0,
  flashTone: "sun",
  flashUntil: 0,
  difficulty: "hard",
};

export function isTouchPreferred(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

export function pushToast(label: string, tone: ToastTone, flash = true): void {
  runtime.toastLabel = label;
  runtime.toastTone = tone;
  runtime.toastUntil = runtime.time + 1.55;
  if (flash) {
    runtime.flashTone = tone;
    runtime.flashUntil = runtime.time + 0.28;
  }
}

export function loadRuntime(maze: MazeData): void {
  const spawn = cellCenter(maze.start.cx, maze.start.cz);
  runtime.maze = maze;
  runtime.difficulty = maze.difficulty;
  runtime.x = spawn.x;
  runtime.y = EYE;
  runtime.z = spawn.z;
  runtime.yaw = spawnYaw(maze);
  runtime.pitch = 0;
  runtime.vx = 0;
  runtime.vz = 0;
  runtime.speed = 0;
  runtime.collected = new Set();
  runtime.blocks = 0;
  runtime.stamps = 0;
  runtime.popped = new Set();
  runtime.openDoors = new Set();
  runtime.lastWarp = -1;
  runtime.lastBoostKey = "";
  runtime.padBoostUntil = 0;
  runtime.visited = new Uint8Array(maze.cols * maze.rows);
  runtime.time = 0;
  runtime.injectedKeys = null;
  runtime.touchX = 0;
  runtime.touchY = 0;
  runtime.touchSprint = false;
  runtime.lookAX = 0;
  runtime.lookAY = 0;
  runtime.trauma = 0;
  runtime.walkDist = 0;
  runtime.bob = 0;
  runtime.bobPhase = 0;
  runtime.lastBump = 0;
  runtime.lastFoot = 0;
  runtime.lastLockNudge = 0;
  runtime.lastDoorBump = 0;
  runtime.lastTarSfx = 0;
  runtime.boostUntil = 0;
  runtime.revealUntil = 0;
  runtime.compassUntil = 0;
  runtime.lockHintUntil = 0;
  runtime.doorHintUntil = 0;
  runtime.hop = 0;
  runtime.fovKick = 0;
  runtime.hitstop = 0;
  runtime.onTar = false;
  runtime.toastLabel = "";
  runtime.toastUntil = 0;
  runtime.flashUntil = 0;
  runtime.reducedMotion =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  rebuildCollision();
  markExplore(maze.start.cx, maze.start.cz);
}

export function rebuildCollision(): void {
  const maze = runtime.maze;
  if (!maze) {
    runtime.aabbs = [];
    return;
  }
  const boxes = maze.aabbs.slice();
  for (const d of maze.doors) {
    if (!runtime.openDoors.has(d.id)) boxes.push(d.aabb);
  }
  runtime.aabbs = boxes;
}

export function tryOpenDoors(): boolean {
  const maze = runtime.maze;
  if (!maze) return false;
  let opened = false;
  for (const d of maze.doors) {
    if (runtime.openDoors.has(d.id)) continue;
    if (runtime.stamps < d.need) continue;
    runtime.openDoors.add(d.id);
    opened = true;
  }
  if (opened) rebuildCollision();
  return opened;
}

export function nextDoorNeed(): number {
  const maze = runtime.maze;
  if (!maze) return 0;
  const next = maze.doors.find((d) => !runtime.openDoors.has(d.id));
  return next?.need ?? 0;
}

export function exitIsLocked(): boolean {
  const maze = runtime.maze;
  if (!maze || !maze.exitNeedsAll) return false;
  return runtime.blocks < maze.totalBlocks;
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
