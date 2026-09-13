import { Play, RotateCcw } from "lucide-react";
import { formatTime, useGame } from "./store";

function Confetti() {
  const bits = Array.from({ length: 22 }, (_, i) => i);
  const colors = ["bg-sun", "bg-cyan", "bg-pink", "bg-lime"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((i) => (
        <span
          key={i}
          className={`confetti-bit border-2 border-ink ${colors[i % colors.length]}`}
          style={{
            left: `${4 + ((i * 17) % 92)}%`,
            animationDelay: `${(i % 8) * 0.08}s`,
            animationDuration: `${1.4 + (i % 5) * 0.18}s`,
            width: `${10 + (i % 4) * 4}px`,
            height: `${10 + ((i + 2) % 3) * 4}px`,
          }}
        />
      ))}
    </div>
  );
}

export function StartScreen({ onPlay }: { onPlay: () => void }) {
  const best = useGame((s) => s.bestTime);

  return (
    <div className="paper-grid absolute inset-0 z-30 overflow-y-auto px-4">
      <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col justify-center py-10">
        <div className="mb-4 flex flex-wrap gap-3">
          <span className="sticker -rotate-6 bg-cyan">LOW POLY</span>
          <span className="sticker rotate-6 bg-pink">FPS</span>
        </div>

        <header className="mb-6">
          <p className="font-display text-xs tracking-[0.28em] text-ink/70">
            NEO-BRUTAL MAZE
          </p>
          <h1 className="font-display text-[clamp(3.2rem,14vw,5.6rem)] leading-[0.88] tracking-tight text-ink">
            HARD
            <br />
            WALL
          </h1>
          <p className="mt-3 max-w-sm text-base leading-snug text-ink/80">
            第一人称低多边形迷宫。走廊里藏着色块，走出绿色出口即胜。
          </p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="info-card -rotate-1 bg-sun">
            <p className="font-display text-xs tracking-widest">WASD</p>
            <p className="text-sm text-ink/80">移动 / 平移</p>
          </div>
          <div className="info-card rotate-1 bg-cyan">
            <p className="font-display text-xs tracking-widest">MOUSE</p>
            <p className="text-sm text-ink/80">拖动看向</p>
          </div>
          <div className="info-card rotate-1 bg-pink">
            <p className="font-display text-xs tracking-widest">BLOCKS</p>
            <p className="text-sm text-ink/80">收集走廊色块</p>
          </div>
          <div className="info-card -rotate-1 bg-lime">
            <p className="font-display text-xs tracking-widest">EXIT</p>
            <p className="text-sm text-ink/80">找到绿色门廊</p>
          </div>
        </div>

        <button type="button" className="btn-brutal w-full bg-sun" onClick={onPlay}>
          <Play className="size-5" strokeWidth={2.8} />
          进入迷宫
        </button>

        <p className="mt-4 font-mono text-sm tabular-nums text-ink/70">
          {best === null ? "尚无最快纪录" : `最快纪录  ${formatTime(best)}`}
        </p>
      </div>
    </div>
  );
}

export function PauseScreen({
  onResume,
  onQuit,
}: {
  onResume: () => void;
  onQuit: () => void;
}) {
  const time = useGame((s) => s.time);
  const collected = useGame((s) => s.collected);
  const total = useGame((s) => s.total);
  const seed = useGame((s) => s.seed);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/45 px-4">
      <div className="w-full max-w-sm border-4 border-ink bg-paper p-6 shadow-brutal">
        <p className="font-display text-xs tracking-[0.22em] text-ink/60">PAUSED</p>
        <h2 className="mt-1 font-display text-4xl leading-none text-ink">暂停</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="border-3 border-ink bg-sun p-3">
            <dt className="font-display text-[10px] tracking-widest">TIME</dt>
            <dd className="font-mono text-lg tabular-nums">{formatTime(time)}</dd>
          </div>
          <div className="border-3 border-ink bg-cyan p-3">
            <dt className="font-display text-[10px] tracking-widest">BLOCKS</dt>
            <dd className="font-mono text-lg tabular-nums">
              {collected}/{total}
            </dd>
          </div>
        </dl>
        <p className="mt-3 font-mono text-xs text-ink/50">SEED {seed}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" className="btn-brutal bg-sun" onClick={onResume}>
            继续探索
          </button>
          <button type="button" className="btn-brutal bg-paper" onClick={onQuit}>
            返回封面
          </button>
        </div>
      </div>
    </div>
  );
}

export function WinScreen({ onReplay }: { onReplay: () => void }) {
  const winTime = useGame((s) => s.winTime);
  const winCollected = useGame((s) => s.winCollected);
  const total = useGame((s) => s.total);
  const best = useGame((s) => s.bestTime);
  const isBest = best !== null && winTime <= best + 0.0001;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 px-4">
      <Confetti />
      <div className="relative w-full max-w-sm border-4 border-ink bg-paper p-6 shadow-brutal">
        <span className="sticker absolute top-4 right-4 rotate-6 bg-lime">CLEAR</span>
        <p className="font-display text-xs tracking-[0.22em] text-ink/60">EXIT FOUND</p>
        <h2 className="mt-1 font-display text-4xl leading-none text-ink">
          出口找到了
        </h2>
        <p className="mt-2 text-sm text-ink/70">墙体很硬，你更硬。</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="border-3 border-ink bg-sun p-3">
            <p className="font-display text-[10px] tracking-widest">TIME</p>
            <p className="font-mono text-2xl tabular-nums leading-none">
              {formatTime(winTime)}
            </p>
          </div>
          <div className="border-3 border-ink bg-cyan p-3">
            <p className="font-display text-[10px] tracking-widest">BLOCKS</p>
            <p className="font-mono text-2xl tabular-nums leading-none">
              {winCollected}/{total}
            </p>
          </div>
        </div>

        <p className="mt-3 font-mono text-sm tabular-nums text-ink/70">
          {isBest ? "新的最快纪录" : `最快纪录  ${best === null ? "—" : formatTime(best)}`}
        </p>

        <button
          type="button"
          className="btn-brutal mt-5 w-full bg-lime"
          onClick={onReplay}
        >
          <RotateCcw className="size-5" strokeWidth={2.8} />
          再闯一次
        </button>
      </div>
    </div>
  );
}
