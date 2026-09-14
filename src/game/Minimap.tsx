import { useEffect, useRef } from "react";
import { CELL } from "./constants";
import { PICKUP_INFO } from "./pickups";
import { runtime } from "./runtime";

const SIZE = 200;

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let id = 0;
    let last = 0;
    const draw = (t: number) => {
      id = requestAnimationFrame(draw);
      if (t - last < 90) return;
      last = t;
      if (runtime.phase !== "playing" && runtime.phase !== "paused") return;
      paint(ctx);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="pointer-events-none select-none">
      <div className="relative border-3 border-ink bg-paper shadow-brutal-sm">
        <span className="absolute -top-3 left-2 bg-sun px-1.5 font-display text-[10px] tracking-widest text-ink">
          MAP
        </span>
        <canvas
          ref={ref}
          width={SIZE}
          height={SIZE}
          className="block h-24 w-24 md:h-36 md:w-36"
        />
      </div>
    </div>
  );
}

function paint(ctx: CanvasRenderingContext2D) {
  const maze = runtime.maze;
  ctx.fillStyle = "#FFF8E7";
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (!maze) return;

  const pad = 10;
  const inner = SIZE - pad * 2;
  const cw = inner / maze.cols;
  const ch = inner / maze.rows;
  const ox = pad;
  const oy = pad;

  ctx.strokeStyle = "rgba(17,17,17,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= maze.cols; i++) {
    ctx.beginPath();
    ctx.moveTo(ox + i * cw, oy);
    ctx.lineTo(ox + i * cw, oy + inner);
    ctx.stroke();
  }
  for (let j = 0; j <= maze.rows; j++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + j * ch);
    ctx.lineTo(ox + inner, oy + j * ch);
    ctx.stroke();
  }

  const revealed = runtime.time < runtime.revealUntil;
  const seen = (x: number, z: number) =>
    revealed || Boolean(runtime.visited[z * maze.cols + x]);

  for (let z = 0; z < maze.rows; z++) {
    for (let x = 0; x < maze.cols; x++) {
      if (!seen(x, z)) continue;
      const isStart = x === maze.start.cx && z === maze.start.cz;
      const isExit = x === maze.exit.cx && z === maze.exit.cz;
      const isYard = maze.courtyards.some(
        (y) => x >= y.cx && x <= y.cx + 1 && z >= y.cz && z <= y.cz + 1,
      );
      const isWarp = maze.teleporters.some((t) => t.cx === x && t.cz === z);
      const isBoost = maze.boosts.some((t) => t.cx === x && t.cz === z);
      const isTar = maze.tars.some((t) => t.cx === x && t.cz === z);
      ctx.fillStyle = isExit
        ? "#C6F000"
        : isStart
          ? "#FFE500"
          : isWarp
            ? "#00D4E8"
            : isBoost
              ? "#FFE500"
              : isTar
                ? "#FF5A8A"
                : isYard
                  ? "#FFEFC2"
                  : "#F3E4B8";
      ctx.fillRect(ox + x * cw + 1, oy + z * ch + 1, cw - 2, ch - 2);
    }
  }

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "square";
  ctx.beginPath();
  for (let z = 0; z < maze.rows; z++) {
    for (let x = 0; x < maze.cols; x++) {
      const here = seen(x, z);
      const cell = maze.cellWalls[z]![x]!;
      const x0 = ox + x * cw;
      const y0 = oy + z * ch;
      const showN =
        cell.n &&
        (here || revealed || (z > 0 && runtime.visited[(z - 1) * maze.cols + x]));
      const showW =
        cell.w &&
        (here || revealed || (x > 0 && runtime.visited[z * maze.cols + (x - 1)]));
      const showS =
        cell.s &&
        (here ||
          revealed ||
          (z + 1 < maze.rows && runtime.visited[(z + 1) * maze.cols + x]));
      const showE =
        cell.e &&
        (here ||
          revealed ||
          (x + 1 < maze.cols && runtime.visited[z * maze.cols + (x + 1)]));
      if (showN) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + cw, y0);
      }
      if (showW) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0, y0 + ch);
      }
      if (z === maze.rows - 1 && showS) {
        ctx.moveTo(x0, y0 + ch);
        ctx.lineTo(x0 + cw, y0 + ch);
      }
      if (x === maze.cols - 1 && showE) {
        ctx.moveTo(x0 + cw, y0);
        ctx.lineTo(x0 + cw, y0 + ch);
      }
    }
  }
  ctx.stroke();

  for (const d of maze.doors) {
    const ax = d.dir === "e" ? d.cx : d.cx;
    const az = d.dir === "s" ? d.cz : d.cz;
    const bx = d.dir === "e" ? d.cx + 1 : d.cx;
    const bz = d.dir === "s" ? d.cz + 1 : d.cz;
    if (!seen(ax, az) && !seen(Math.min(bx, maze.cols - 1), Math.min(bz, maze.rows - 1))) {
      continue;
    }
    const x0 = ox + d.cx * cw;
    const y0 = oy + d.cz * ch;
    ctx.strokeStyle = runtime.openDoors.has(d.id) ? "#C6F000" : "#FF5A8A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (d.dir === "e") {
      ctx.moveTo(x0 + cw, y0 + 2);
      ctx.lineTo(x0 + cw, y0 + ch - 2);
    } else {
      ctx.moveTo(x0 + 2, y0 + ch);
      ctx.lineTo(x0 + cw - 2, y0 + ch);
    }
    ctx.stroke();
  }

  for (const p of maze.pickups) {
    if (runtime.collected.has(p.id)) continue;
    if (!seen(p.cx, p.cz)) continue;
    ctx.fillStyle = PICKUP_INFO[p.kind].hex;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(
      ox + (p.cx + 0.35) * cw,
      oy + (p.cz + 0.35) * ch,
      cw * 0.3,
      ch * 0.3,
    );
    ctx.fill();
    ctx.stroke();
  }

  for (const orb of maze.pops) {
    if (runtime.popped.has(orb.id)) continue;
    if (!seen(orb.cx, orb.cz)) continue;
    ctx.fillStyle = "#FF5A8A";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ox + (orb.cx + 0.5) * cw, oy + (orb.cz + 0.5) * ch, cw * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (runtime.visited[maze.exit.cz * maze.cols + maze.exit.cx] || revealed) {
    ctx.fillStyle = "#111111";
    ctx.font = '900 9px "Archivo Black", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "EX",
      ox + (maze.exit.cx + 0.5) * cw,
      oy + (maze.exit.cz + 0.5) * ch,
    );
  }

  const px = ox + (runtime.x / CELL + 0.5) * cw;
  const py = oy + (runtime.z / CELL + 0.5) * ch;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-runtime.yaw);
  ctx.fillStyle = "#FF5A8A";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
