import { useEffect, useRef, useState } from "react";
import { COLS, ROWS } from "./constants";
import { unlockAudio } from "./audio";
import { Crosshair, Hud } from "./Hud";
import { generateMaze } from "./maze";
import { PauseScreen, StartScreen, WinScreen } from "./Overlays";
import { loadRuntime } from "./runtime";
import { useGame } from "./store";
import { TouchControls } from "./TouchControls";

export function GameApp() {
  const phase = useGame((s) => s.phase);
  const [session, setSession] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const begin = () => {
    unlockAudio();
    const seed =
      (Math.floor(performance.now() * 1000) ^ ((Math.random() * 0xffffffff) >>> 0)) >>>
      0;
    const maze = generateMaze(COLS, ROWS, seed);
    loadRuntime(maze);
    useGame.getState().startGame(maze.pickups.length, seed);
    setSession((n) => n + 1);
  };

  const resume = () => {
    unlockAudio();
    useGame.getState().resume();
    const canvas = canvasRef.current;
    if (canvas && !("ontouchstart" in window && navigator.maxTouchPoints > 0)) {
      try {
        canvas.requestPointerLock();
      } catch {
        /* mobile / unsupported */
      }
    }
  };

  const quit = () => {
    useGame.getState().toMenu();
    setSession(0);
  };

  useEffect(() => {
    useGame.getState().hydrateBest();
  }, []);

  useEffect(() => {
    if (session === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: { start: () => void; dispose: () => void } | null = null;
    void import("./engine").then(({ HardwallEngine }) => {
      if (disposed || !canvasRef.current) return;
      engine = new HardwallEngine(canvasRef.current);
      engine.start();
    });
    return () => {
      disposed = true;
      engine?.dispose();
    };
  }, [session]);

  return (
    <div className="game-root relative h-dvh w-full overflow-hidden bg-sky text-ink">
      {session > 0 && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full touch-none"
        />
      )}

      {phase === "playing" && <Crosshair />}
      {(phase === "playing" || phase === "paused") && <Hud />}
      {phase === "playing" && <TouchControls />}

      {phase === "menu" && <StartScreen onPlay={begin} />}
      {phase === "paused" && <PauseScreen onResume={resume} onQuit={quit} />}
      {phase === "won" && <WinScreen onReplay={begin} />}
    </div>
  );
}
