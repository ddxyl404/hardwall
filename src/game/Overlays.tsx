import type { ReactNode } from "react";
import {
  BookOpen,
  Play,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { DIFFICULTIES, DIFFICULTY_LIST, type DifficultyId } from "./difficulty";
import { formatTime, useGame, type Bests } from "./store";

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

const TONE: Record<DifficultyId, string> = {
  soft: "bg-sun",
  hard: "bg-cyan",
  brutal: "bg-pink",
};

function SettingsBody() {
  const muted = useGame((s) => s.muted);
  const lookSens = useGame((s) => s.lookSens);
  const toggleMute = useGame((s) => s.toggleMute);
  const setLookSens = useGame((s) => s.setLookSens);

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="font-display text-xs tracking-[0.18em] text-ink/70">
          鼠标灵敏度
        </span>
        <input
          type="range"
          min={0.5}
          max={1.8}
          step={0.05}
          value={lookSens}
          onChange={(e) => setLookSens(Number(e.target.value))}
          className="slider-brutal mt-2"
          aria-label="鼠标灵敏度"
        />
        <span className="mt-1 block font-mono text-sm tabular-nums text-ink/70">
          {lookSens.toFixed(2)}×
        </span>
      </label>
      <button
        type="button"
        className={`btn-brutal w-full ${muted ? "bg-pink" : "bg-lime"}`}
        onClick={toggleMute}
      >
        {muted ? (
          <VolumeX className="size-5" strokeWidth={2.8} />
        ) : (
          <Volume2 className="size-5" strokeWidth={2.8} />
        )}
        {muted ? "已静音" : "声音开"}
      </button>
    </div>
  );
}

function HowBody() {
  return (
    <div className="flex flex-col gap-3 text-sm leading-snug text-ink/80">
      <div className="grid grid-cols-2 gap-2">
        <div className="info-card bg-sun">
          <p className="font-display text-xs tracking-widest">WASD</p>
          <p>移动 / 平移</p>
        </div>
        <div className="info-card bg-cyan">
          <p className="font-display text-xs tracking-widest">MOUSE</p>
          <p>拖动看向</p>
        </div>
        <div className="info-card bg-paper">
          <p className="font-display text-xs tracking-widest">SHIFT</p>
          <p>冲刺</p>
        </div>
        <div className="info-card bg-lime">
          <p className="font-display text-xs tracking-widest">EXIT</p>
          <p>绿色门廊出门</p>
        </div>
      </div>
      <p className="font-display text-xs tracking-[0.18em] text-ink/60">ITEMS</p>
      <ul className="grid gap-2">
        <li className="info-card bg-sun">黄块 · 收集计分</li>
        <li className="info-card bg-cyan">青锥 · 疾跑加速</li>
        <li className="info-card bg-pink">粉晶 · 小地图全开</li>
        <li className="info-card bg-lime">绿标 · 出口指南针</li>
        <li className="info-card bg-paper">奶油章 · 贴满就开闸</li>
      </ul>
      <p className="font-display text-xs tracking-[0.18em] text-ink/60">WORLD</p>
      <ul className="grid gap-2">
        <li className="info-card bg-cyan">青环 WARP · 成对传送</li>
        <li className="info-card bg-pink">粉门 GATE · 捷径闸门</li>
        <li className="info-card bg-sun">黄箭 ARROW · 把你弹出去</li>
        <li className="info-card bg-paper">YARD · 2×2 雕塑庭院</li>
        <li className="info-card bg-lime">POP · 走廊气球，撞破有彩屑</li>
      </ul>
      <p>暴墙关必须收齐黄块，粉色闸门才会打开。</p>
    </div>
  );
}

export function StartScreen({ onPlay }: { onPlay: () => void }) {
  const page = useGame((s) => s.menuPage);
  const setPage = useGame((s) => s.setMenuPage);
  const difficulty = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const bests = useGame((s) => s.bests);

  if (page === "how") {
    return (
      <MenuShell>
        <p className="font-display text-xs tracking-[0.22em] text-ink/60">MANUAL</p>
        <h2 className="mt-1 font-display text-4xl leading-none text-ink">操作说明</h2>
        <div className="mt-5">
          <HowBody />
        </div>
        <button
          type="button"
          className="btn-brutal mt-5 w-full bg-sun"
          onClick={() => setPage("home")}
        >
          返回封面
        </button>
      </MenuShell>
    );
  }

  if (page === "settings") {
    return (
      <MenuShell>
        <p className="font-display text-xs tracking-[0.22em] text-ink/60">SETUP</p>
        <h2 className="mt-1 font-display text-4xl leading-none text-ink">设置</h2>
        <div className="mt-5">
          <SettingsBody />
        </div>
        <button
          type="button"
          className="btn-brutal mt-5 w-full bg-sun"
          onClick={() => setPage("home")}
        >
          返回封面
        </button>
      </MenuShell>
    );
  }

  return (
    <div className="paper-grid absolute inset-0 z-30 overflow-y-auto px-4">
      <div className="relative mx-auto flex min-h-full w-full max-w-xl flex-col justify-center py-8">
        <div className="mb-4 flex flex-wrap gap-3">
          <span className="sticker -rotate-6 bg-cyan">LOW POLY</span>
          <span className="sticker rotate-6 bg-pink">FPS</span>
          <span className="sticker -rotate-2 bg-lime">3 LEVELS</span>
        </div>

        <header className="mb-5">
          <p className="font-display text-xs tracking-[0.28em] text-ink/70">
            NEO-BRUTAL MAZE
          </p>
          <h1 className="font-display text-[clamp(3.2rem,14vw,5.6rem)] leading-[0.88] tracking-tight text-ink">
            HARD
            <br />
            WALL
          </h1>
          <p className="mt-3 max-w-sm text-base leading-snug text-ink/80">
            彩色硬边迷宫。捡色块、踩传送、贴章开闸，走出绿色出口。
          </p>
        </header>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {DIFFICULTY_LIST.map((id) => {
            const d = DIFFICULTIES[id];
            const selected = difficulty === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDifficulty(id)}
                className={`info-card text-left ${TONE[id]} ${
                  selected ? "ring-select" : "opacity-85"
                }`}
              >
                <p className="font-display text-xs tracking-widest">{d.name}</p>
                <p className="font-display text-lg leading-none">{d.nameZh}</p>
                <p className="mt-1 text-xs leading-tight text-ink/75">{d.blurb}</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-ink/70">
                  {bestLabel(bests, id)}
                </p>
              </button>
            );
          })}
        </div>

        <button type="button" className="btn-brutal w-full bg-sun" onClick={onPlay}>
          <Play className="size-5" strokeWidth={2.8} />
          进入迷宫
        </button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-brutal bg-paper"
            onClick={() => setPage("how")}
          >
            <BookOpen className="size-5" strokeWidth={2.8} />
            操作说明
          </button>
          <button
            type="button"
            className="btn-brutal bg-paper"
            onClick={() => setPage("settings")}
          >
            <Settings2 className="size-5" strokeWidth={2.8} />
            设置
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuShell({ children }: { children: ReactNode }) {
  return (
    <div className="paper-grid absolute inset-0 z-30 overflow-y-auto px-4">
      <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col justify-center py-10">
        {children}
      </div>
    </div>
  );
}

function bestLabel(bests: Bests, id: DifficultyId): string {
  const t = bests[id];
  return t === null ? "尚无纪录" : formatTime(t);
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
  const difficulty = useGame((s) => s.difficulty);
  const page = useGame((s) => s.pausePage);
  const setPage = useGame((s) => s.setPausePage);
  const spec = DIFFICULTIES[difficulty];

  if (page === "settings") {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/45 px-4">
        <div className="w-full max-w-sm border-4 border-ink bg-paper p-6 shadow-brutal">
          <p className="font-display text-xs tracking-[0.22em] text-ink/60">SETUP</p>
          <h2 className="mt-1 font-display text-4xl leading-none text-ink">设置</h2>
          <div className="mt-5">
            <SettingsBody />
          </div>
          <button
            type="button"
            className="btn-brutal mt-5 w-full bg-sun"
            onClick={() => setPage("main")}
          >
            返回暂停
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/45 px-4">
      <div className="w-full max-w-sm border-4 border-ink bg-paper p-6 shadow-brutal">
        <p className="font-display text-xs tracking-[0.22em] text-ink/60">PAUSED</p>
        <h2 className="mt-1 font-display text-4xl leading-none text-ink">暂停</h2>
        <p className="mt-2 font-display text-sm tracking-widest text-ink/70">
          {spec.name} · {spec.nameZh}
        </p>
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
          <button
            type="button"
            className="btn-brutal bg-paper"
            onClick={() => setPage("settings")}
          >
            <Settings2 className="size-5" strokeWidth={2.8} />
            设置
          </button>
          <button type="button" className="btn-brutal bg-paper" onClick={onQuit}>
            返回封面
          </button>
        </div>
      </div>
    </div>
  );
}

export function WinScreen({
  onReplay,
  onMenu,
}: {
  onReplay: () => void;
  onMenu: () => void;
}) {
  const winTime = useGame((s) => s.winTime);
  const winCollected = useGame((s) => s.winCollected);
  const winStamps = useGame((s) => s.winStamps);
  const stampTotal = useGame((s) => s.stampTotal);
  const total = useGame((s) => s.total);
  const bests = useGame((s) => s.bests);
  const difficulty = useGame((s) => s.difficulty);
  const best = bests[difficulty];
  const isBest = best !== null && winTime <= best + 0.0001;
  const spec = DIFFICULTIES[difficulty];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 px-4">
      <Confetti />
      <div className="relative w-full max-w-sm border-4 border-ink bg-paper p-6 shadow-brutal">
        <span className="sticker absolute top-4 right-4 rotate-6 bg-lime">CLEAR</span>
        <p className="font-display text-xs tracking-[0.22em] text-ink/60">
          {spec.name} · EXIT FOUND
        </p>
        <h2 className="mt-1 font-display text-4xl leading-none text-ink">
          出口找到了
        </h2>
        <p className="mt-2 text-sm text-ink/70">墙是彩色的，你更硬。</p>

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
        {stampTotal > 0 && (
          <div className="mt-3 border-3 border-ink bg-paper p-3">
            <p className="font-display text-[10px] tracking-widest">STAMP</p>
            <p className="font-mono text-xl tabular-nums leading-none">
              {winStamps}/{stampTotal}
            </p>
          </div>
        )}

        <p className="mt-3 font-mono text-sm tabular-nums text-ink/70">
          {isBest ? `新的 ${spec.nameZh} 纪录` : `最快  ${best === null ? "—" : formatTime(best)}`}
        </p>

        <button
          type="button"
          className="btn-brutal mt-5 w-full bg-lime"
          onClick={onReplay}
        >
          <RotateCcw className="size-5" strokeWidth={2.8} />
          再闯一次
        </button>
        <button type="button" className="btn-brutal mt-3 w-full bg-paper" onClick={onMenu}>
          换个难度
        </button>
      </div>
    </div>
  );
}
