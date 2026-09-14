type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: "interactive" });
  master = ctx.createGain();
  sfx = ctx.createGain();
  sfx.gain.value = 0.7;
  sfx.connect(master);
  master.connect(ctx.destination);
  applyMute();
  return ctx;
}

function applyMute() {
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
}

export function unlockAudio(): void {
  const c = ensure();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

export function setMuted(next: boolean): void {
  muted = next;
  applyMute();
}

export function isMuted(): boolean {
  return muted;
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.08,
  slide?: number,
) {
  const c = ensure();
  if (!c || !sfx || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) {
    o.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq * slide),
      c.currentTime + dur,
    );
  }
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(sfx);
  o.start();
  o.stop(c.currentTime + dur + 0.03);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

export function sfxPickup(): void {
  beep(523.25, 0.07, "square", 0.05);
  beep(659.25, 0.09, "square", 0.045);
  beep(783.99, 0.14, "triangle", 0.05);
}

export function sfxDash(): void {
  beep(220, 0.08, "square", 0.06, 2.2);
  beep(440, 0.16, "triangle", 0.05, 1.8);
  beep(880, 0.1, "square", 0.03, 1.6);
}

export function sfxReveal(): void {
  beep(392, 0.1, "triangle", 0.045);
  beep(988, 0.18, "square", 0.04);
  beep(1318, 0.22, "triangle", 0.03);
}

export function sfxCompass(): void {
  beep(523.25, 0.1, "triangle", 0.045);
  beep(784, 0.2, "square", 0.04, 0.7);
}

export function sfxStamp(): void {
  beep(349.23, 0.07, "square", 0.05);
  beep(440, 0.12, "triangle", 0.045, 1.4);
}

export function sfxWarp(): void {
  beep(180, 0.08, "sawtooth", 0.045, 3.4);
  beep(720, 0.22, "triangle", 0.055, 0.35);
  beep(90, 0.16, "sine", 0.05, 0.4);
}

export function sfxDoor(): void {
  beep(140, 0.12, "square", 0.05, 1.8);
  beep(220, 0.2, "triangle", 0.04, 2.2);
}

export function sfxPad(): void {
  beep(260, 0.06, "square", 0.05, 2.6);
  beep(520, 0.12, "triangle", 0.04, 1.7);
  beep(1040, 0.08, "square", 0.025, 1.4);
}

export function sfxPop(): void {
  beep(640, 0.05, "square", 0.05, 0.4);
  beep(180, 0.12, "sine", 0.05, 0.35);
}

export function sfxBounce(): void {
  beep(220, 0.07, "square", 0.05, 2.8);
  beep(640, 0.05, "square", 0.045, 0.4);
  beep(980, 0.1, "triangle", 0.04, 1.5);
}

export function sfxTar(): void {
  beep(70, 0.14, "sine", 0.05, 0.45);
  beep(110, 0.18, "triangle", 0.03, 0.5);
}

export function sfxLock(): void {
  beep(180, 0.09, "square", 0.05, 0.45);
  beep(110, 0.14, "sine", 0.05, 0.5);
}

export function sfxWin(): void {
  beep(392, 0.16, "square", 0.05);
  window.setTimeout(() => beep(523.25, 0.16, "square", 0.05), 90);
  window.setTimeout(() => beep(659.25, 0.22, "square", 0.055), 180);
  window.setTimeout(() => beep(783.99, 0.4, "triangle", 0.06), 280);
}

export function sfxFoot(rate = 1): void {
  beep(90 * rate, 0.05, "sine", 0.045, 0.6);
}

export function sfxBump(): void {
  beep(70, 0.07, "sine", 0.05, 0.5);
}

export function sfxClick(): void {
  beep(880, 0.04, "square", 0.03);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}
