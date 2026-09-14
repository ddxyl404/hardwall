import { Navigation, Pause, Volume2, VolumeX } from "lucide-react";
import { CELL } from "./constants";
import { DIFFICULTIES } from "./difficulty";
import { Minimap } from "./Minimap";
import { runtime } from "./runtime";
import { formatTime, useGame } from "./store";

export function Hud() {
  const time = useGame((s) => s.time);
  const collected = useGame((s) => s.collected);
  const total = useGame((s) => s.total);
  const stamps = useGame((s) => s.stamps);
  const stampTotal = useGame((s) => s.stampTotal);
  const doorNeed = useGame((s) => s.doorNeed);
  const muted = useGame((s) => s.muted);
  const locked = useGame((s) => s.pointerLocked);
  const phase = useGame((s) => s.phase);
  const difficulty = useGame((s) => s.difficulty);
  const boostLeft = useGame((s) => s.boostLeft);
  const revealLeft = useGame((s) => s.revealLeft);
  const compassLeft = useGame((s) => s.compassLeft);
  const lockHint = useGame((s) => s.lockHint);
  const doorHint = useGame((s) => s.doorHint);
  const pause = useGame((s) => s.pause);
  const toggleMute = useGame((s) => s.toggleMute);
  const spec = DIFFICULTIES[difficulty];

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-4">
        <div className="flex flex-col gap-2">
          <div className="chip-brutal bg-sun">
            <span className="font-display text-[10px] tracking-[0.18em] text-ink/70">
              TIME
            </span>
            <span className="font-mono text-lg font-semibold tabular-nums leading-none md:text-xl">
              {formatTime(time)}
            </span>
          </div>
          <div className="chip-brutal bg-cyan">
            <span className="font-display text-[10px] tracking-[0.18em] text-ink/70">
              BLOCKS
            </span>
            <span className="font-mono text-lg font-semibold tabular-nums leading-none md:text-xl">
              {collected}/{total}
            </span>
          </div>
          {stampTotal > 0 && (
            <div className="chip-brutal bg-paper">
              <span className="font-display text-[10px] tracking-[0.18em] text-ink/70">
                STAMP
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums leading-none md:text-xl">
                {stamps}/{stampTotal}
              </span>
            </div>
          )}
          <div className={`chip-brutal ${toneBg(spec.tone)}`}>
            <span className="font-display text-[10px] tracking-[0.18em] text-ink/70">
              {spec.name}
            </span>
            <span className="font-display text-sm leading-none">{spec.nameZh}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            className="icon-brutal bg-paper"
            onClick={toggleMute}
            aria-label={muted ? "打开声音" : "静音"}
          >
            {muted ? (
              <VolumeX className="size-5" strokeWidth={2.6} />
            ) : (
              <Volume2 className="size-5" strokeWidth={2.6} />
            )}
          </button>
          {phase === "playing" && (
            <button
              type="button"
              className="icon-brutal bg-paper"
              onClick={pause}
              aria-label="暂停"
            >
              <Pause className="size-5" strokeWidth={2.6} />
            </button>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-3 z-20 flex flex-col gap-2 md:bottom-4 md:left-4">
        {boostLeft > 0 && <EffectChip tone="cyan" label="DASH" value={boostLeft} />}
        {revealLeft > 0 && <EffectChip tone="pink" label="MAP" value={revealLeft} />}
        {compassLeft > 0 && <EffectChip tone="lime" label="EXIT" value={compassLeft} />}
        {lockHint && (
          <div className="chip-brutal bg-pink">
            <span className="font-display text-[10px] tracking-[0.18em]">LOCKED</span>
            <span className="text-sm">先收齐色块</span>
          </div>
        )}
        {doorHint && stamps < doorNeed && (
          <div className="chip-brutal bg-pink">
            <span className="font-display text-[10px] tracking-[0.18em]">GATE</span>
            <span className="text-sm">
              贴章 {stamps}/{doorNeed}
            </span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-20 md:right-4 md:bottom-4">
        <Minimap />
      </div>

      {compassLeft > 0 && <CompassArrow />}

      {phase === "playing" && !locked && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-20 hidden -translate-x-1/2 -translate-y-[4.5rem] md:block">
          <div className="border-3 border-ink bg-paper px-3 py-1.5 shadow-brutal-sm">
            <p className="font-display text-[11px] tracking-widest text-ink">
              点击画面锁定鼠标
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function toneBg(tone: "sun" | "cyan" | "pink") {
  if (tone === "sun") return "bg-sun";
  if (tone === "pink") return "bg-pink";
  return "bg-cyan";
}

function EffectChip({
  tone,
  label,
  value,
}: {
  tone: "cyan" | "pink" | "lime";
  label: string;
  value: number;
}) {
  const bg = tone === "cyan" ? "bg-cyan" : tone === "pink" ? "bg-pink" : "bg-lime";
  return (
    <div className={`chip-brutal ${bg}`}>
      <span className="font-display text-[10px] tracking-[0.18em] text-ink/70">
        {label}
      </span>
      <span className="font-mono text-lg tabular-nums leading-none">
        {value.toFixed(1)}s
      </span>
    </div>
  );
}

function CompassArrow() {
  const maze = runtime.maze;
  let rot = 0;
  if (maze) {
    const dx = maze.exit.cx * CELL - runtime.x;
    const dz = maze.exit.cz * CELL - runtime.z;
    const target = Math.atan2(-dx, -dz);
    rot = target - runtime.yaw;
  }
  return (
    <div className="pointer-events-none absolute bottom-[max(1.2rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2">
      <div className="border-3 border-ink bg-lime px-3 py-2 shadow-brutal-sm">
        <p className="text-center font-display text-[10px] tracking-widest">EXIT</p>
        <div
          className="mx-auto mt-1 grid size-8 place-items-center"
          style={{ transform: `rotate(${rot}rad)` }}
        >
          <Navigation className="size-7" strokeWidth={2.8} />
        </div>
      </div>
    </div>
  );
}

export function Crosshair() {
  return (
    <div
      className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    >
      <div className="relative size-5">
        <span className="absolute top-1/2 left-0 h-[3px] w-full -translate-y-1/2 bg-ink" />
        <span className="absolute top-0 left-1/2 h-full w-[3px] -translate-x-1/2 bg-ink" />
        <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 bg-sun outline outline-2 outline-ink" />
      </div>
    </div>
  );
}
