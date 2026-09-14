import { create } from "zustand";
import { LOOK_KEY, LOOK_KEY_LEGACY, SETTINGS_KEY } from "./constants";
import type { DifficultyId } from "./difficulty";
import { runtime } from "./runtime";
import { setMuted as setAudioMuted } from "./audio";

export function formatTime(s: number): string {
  const clamped = Math.max(0, s);
  const m = Math.floor(clamped / 60);
  const r = clamped - m * 60;
  const whole = Math.floor(r);
  const tenth = Math.floor((r - whole) * 10);
  return `${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${tenth}`;
}

export type Bests = Record<DifficultyId, number | null>;

const EMPTY_BESTS: Bests = { soft: null, hard: null, brutal: null };

function readBests(): Bests {
  const next = { ...EMPTY_BESTS };
  try {
    const raw = localStorage.getItem(LOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Bests>;
      for (const k of ["soft", "hard", "brutal"] as const) {
        const n = parsed[k];
        if (typeof n === "number" && Number.isFinite(n)) next[k] = n;
      }
    }
    const legacy = localStorage.getItem(LOOK_KEY_LEGACY);
    if (legacy && next.hard === null) {
      const n = Number(legacy);
      if (Number.isFinite(n)) next.hard = n;
    }
  } catch {
    /* ignore */
  }
  return next;
}

function writeBests(bests: Bests): void {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(bests));
  } catch {
    /* ignore quota */
  }
}

type PersistSettings = { muted: boolean; lookSens: number; difficulty: DifficultyId };

function readSettings(): PersistSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { muted: false, lookSens: 1, difficulty: "hard" };
    const parsed = JSON.parse(raw) as Partial<PersistSettings>;
    const lookSens =
      typeof parsed.lookSens === "number" && Number.isFinite(parsed.lookSens)
        ? Math.min(1.8, Math.max(0.5, parsed.lookSens))
        : 1;
    const difficulty =
      parsed.difficulty === "soft" ||
      parsed.difficulty === "hard" ||
      parsed.difficulty === "brutal"
        ? parsed.difficulty
        : "hard";
    return { muted: Boolean(parsed.muted), lookSens, difficulty };
  } catch {
    return { muted: false, lookSens: 1, difficulty: "hard" };
  }
}

function writeSettings(s: PersistSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export type GamePhase = "menu" | "playing" | "paused" | "won";
export type MenuPage = "home" | "how" | "settings";
export type PausePage = "main" | "settings";

type GameState = {
  phase: GamePhase;
  menuPage: MenuPage;
  pausePage: PausePage;
  time: number;
  collected: number;
  total: number;
  stamps: number;
  stampTotal: number;
  doorNeed: number;
  bests: Bests;
  winTime: number;
  winCollected: number;
  winStamps: number;
  muted: boolean;
  lookSens: number;
  pointerLocked: boolean;
  seed: number;
  difficulty: DifficultyId;
  boostLeft: number;
  revealLeft: number;
  compassLeft: number;
  lockHint: boolean;
  doorHint: boolean;
  setMenuPage: (page: MenuPage) => void;
  setPausePage: (page: PausePage) => void;
  setDifficulty: (id: DifficultyId) => void;
  setLookSens: (v: number) => void;
  startGame: (total: number, seed: number, difficulty: DifficultyId) => void;
  pause: () => void;
  resume: () => void;
  win: () => void;
  toMenu: () => void;
  collectOne: () => void;
  syncHud: () => void;
  toggleMute: () => void;
  setPointerLocked: (v: boolean) => void;
  hydrate: () => void;
};

function persistFrom(get: () => GameState) {
  writeSettings({
    muted: get().muted,
    lookSens: get().lookSens,
    difficulty: get().difficulty,
  });
}

export const useGame = create<GameState>((set, get) => ({
  phase: "menu",
  menuPage: "home",
  pausePage: "main",
  time: 0,
  collected: 0,
  total: 8,
  stamps: 0,
  stampTotal: 0,
  doorNeed: 0,
  bests: { ...EMPTY_BESTS },
  winTime: 0,
  winCollected: 0,
  winStamps: 0,
  muted: false,
  lookSens: 1,
  pointerLocked: false,
  seed: 0,
  difficulty: "hard",
  boostLeft: 0,
  revealLeft: 0,
  compassLeft: 0,
  lockHint: false,
  doorHint: false,
  setMenuPage: (page) => set({ menuPage: page }),
  setPausePage: (page) => set({ pausePage: page }),
  setDifficulty: (id) => {
    set({ difficulty: id });
    persistFrom(get);
  },
  setLookSens: (v) => {
    const lookSens = Math.min(1.8, Math.max(0.5, v));
    runtime.lookSens = lookSens;
    set({ lookSens });
    persistFrom(get);
  },
  startGame: (total, seed, difficulty) => {
    runtime.phase = "playing";
    const maze = runtime.maze;
    set({
      phase: "playing",
      pausePage: "main",
      time: 0,
      collected: 0,
      total,
      stamps: 0,
      stampTotal: maze?.totalStamps ?? 0,
      doorNeed: maze?.doors[0]?.need ?? 0,
      seed,
      difficulty,
      pointerLocked: false,
      boostLeft: 0,
      revealLeft: 0,
      compassLeft: 0,
      lockHint: false,
      doorHint: false,
    });
    persistFrom(get);
  },
  pause: () => {
    if (get().phase !== "playing") return;
    runtime.phase = "paused";
    set({ phase: "paused", pausePage: "main" });
  },
  resume: () => {
    if (get().phase !== "paused") return;
    runtime.phase = "playing";
    set({ phase: "playing", pausePage: "main" });
  },
  win: () => {
    if (get().phase === "won") return;
    const t = runtime.time;
    const collected = runtime.blocks;
    const stamps = runtime.stamps;
    const difficulty = get().difficulty;
    const bests = { ...get().bests };
    const prev = bests[difficulty];
    if (prev === null || t < prev) {
      bests[difficulty] = t;
      writeBests(bests);
    }
    runtime.phase = "won";
    set({
      phase: "won",
      winTime: t,
      winCollected: collected,
      winStamps: stamps,
      bests,
      time: t,
      collected,
      stamps,
    });
  },
  toMenu: () => {
    runtime.phase = "menu";
    set({
      phase: "menu",
      menuPage: "home",
      pausePage: "main",
      pointerLocked: false,
    });
  },
  collectOne: () => {
    set({ collected: runtime.blocks, stamps: runtime.stamps });
  },
  syncHud: () => {
    const now = runtime.time;
    set({
      time: now,
      collected: runtime.blocks,
      stamps: runtime.stamps,
      pointerLocked: runtime.pointerLocked,
      boostLeft: Math.max(0, runtime.boostUntil - now),
      revealLeft: Math.max(0, runtime.revealUntil - now),
      compassLeft: Math.max(0, runtime.compassUntil - now),
      lockHint: now < runtime.lockHintUntil,
      doorHint: now < runtime.doorHintUntil,
    });
  },
  toggleMute: () => {
    const next = !get().muted;
    runtime.muted = next;
    setAudioMuted(next);
    set({ muted: next });
    persistFrom(get);
  },
  setPointerLocked: (v) => set({ pointerLocked: v }),
  hydrate: () => {
    const s = readSettings();
    runtime.muted = s.muted;
    runtime.lookSens = s.lookSens;
    setAudioMuted(s.muted);
    set({
      bests: readBests(),
      muted: s.muted,
      lookSens: s.lookSens,
      difficulty: s.difficulty,
    });
  },
}));
