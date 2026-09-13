import { Pause, Volume2, VolumeX } from "lucide-react";
import { Minimap } from "./Minimap";
import { formatTime, useGame } from "./store";

export function Hud() {
  const time = useGame((s) => s.time);
  const collected = useGame((s) => s.collected);
  const total = useGame((s) => s.total);
  const muted = useGame((s) => s.muted);
  const locked = useGame((s) => s.pointerLocked);
  const phase = useGame((s) => s.phase);
  const pause = useGame((s) => s.pause);
  const toggleMute = useGame((s) => s.toggleMute);

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

      <div className="pointer-events-none absolute right-3 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-20 md:right-4 md:bottom-4">
        <Minimap />
      </div>

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
