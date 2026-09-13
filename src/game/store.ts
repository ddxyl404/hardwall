import { create } from "zustand";
import { LOOK_KEY } from "./constants";
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

function readBest(): number | null {
  try {
    const v = localStorage.getItem(LOOK_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeBest(t: number): void {
  try {
    localStorage.setItem(LOOK_KEY, String(t));
  } catch {
    /* ignore quota */
  }
}

export type GamePhase = "menu" | "playing" | "paused" | "won";

type GameState = {
  phase: GamePhase;
  time: number;
  collected: number;
  total: number;
  bestTime: number | null;
  winTime: number;
  winCollected: number;
  muted: boolean;
  pointerLocked: boolean;
  seed: number;
  startGame: (total: number, seed: number) => void;
  pause: () => void;
  resume: () => void;
  win: () => void;
  toMenu: () => void;
  collectOne: () => void;
  syncHud: () => void;
  toggleMute: () => void;
  setPointerLocked: (v: boolean) => void;
  hydrateBest: () => void;
};

export const useGame = create<GameState>((set, get) => ({
  phase: "menu",
  time: 0,
  collected: 0,
  total: 8,
  bestTime: null,
  winTime: 0,
  winCollected: 0,
  muted: false,
  pointerLocked: false,
  seed: 0,
  startGame: (total, seed) => {
    runtime.phase = "playing";
    set({
      phase: "playing",
      time: 0,
      collected: 0,
      total,
      seed,
      pointerLocked: false,
    });
  },
  pause: () => {
    if (get().phase !== "playing") return;
    runtime.phase = "paused";
    set({ phase: "paused" });
  },
  resume: () => {
    if (get().phase !== "paused") return;
    runtime.phase = "playing";
    set({ phase: "playing" });
  },
  win: () => {
    if (get().phase === "won") return;
    const t = runtime.time;
    const collected = runtime.collected.size;
    let best = get().bestTime;
    if (best === null || t < best) {
      best = t;
      writeBest(t);
    }
    runtime.phase = "won";
    set({
      phase: "won",
      winTime: t,
      winCollected: collected,
      bestTime: best,
      time: t,
      collected,
    });
  },
  toMenu: () => {
    runtime.phase = "menu";
    set({ phase: "menu", pointerLocked: false });
  },
  collectOne: () => {
    set({ collected: runtime.collected.size });
  },
  syncHud: () => {
    set({
      time: runtime.time,
      collected: runtime.collected.size,
      pointerLocked: runtime.pointerLocked,
    });
  },
  toggleMute: () => {
    const next = !get().muted;
    runtime.muted = next;
    setAudioMuted(next);
    set({ muted: next });
  },
  setPointerLocked: (v) => set({ pointerLocked: v }),
  hydrateBest: () => {
    set({ bestTime: readBest() });
  },
}));
