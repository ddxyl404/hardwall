import { useEffect, useRef, useState } from "react";
import { TOUCH_LOOK_SENS, MOUSE_SENS } from "./constants";
import { isTouchPreferred, runtime } from "./runtime";

type Stick = { x: number; y: number };

export function TouchControls() {
  const [enabled, setEnabled] = useState(false);
  const [stick, setStick] = useState<Stick>({ x: 0, y: 0 });
  const [looking, setLooking] = useState(false);
  const [sprinting, setSprinting] = useState(false);
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lastLook = useRef({ x: 0, y: 0 });
  const stickEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const enable = () => {
      runtime.touchActive = true;
      setEnabled(true);
    };
    if (isTouchPreferred()) enable();
    const onFirstTouch = () => enable();
    window.addEventListener("touchstart", onFirstTouch, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", onFirstTouch);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    runtime.touchActive = true;
    return () => {
      runtime.touchX = 0;
      runtime.touchY = 0;
      runtime.touchSprint = false;
    };
  }, [enabled]);

  if (!enabled) return null;

  const onStickDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    stickId.current = e.pointerId;
    moveStick(e.clientX, e.clientY);
  };

  const onStickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    e.preventDefault();
    moveStick(e.clientX, e.clientY);
  };

  const onStickUp = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    runtime.touchX = 0;
    runtime.touchY = 0;
    setStick({ x: 0, y: 0 });
  };

  const moveStick = (cx: number, cy: number) => {
    const el = stickEl.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    const dx = cx - ox;
    const dy = cy - oy;
    const max = 48;
    const mag = Math.hypot(dx, dy);
    const scale = mag > max ? max / mag : 1;
    const sx = dx * scale;
    const sy = dy * scale;
    runtime.touchX = sx / max;
    runtime.touchY = -sy / max;
    setStick({ x: sx, y: sy });
  };

  const onLookDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lookId.current = e.pointerId;
    lastLook.current = { x: e.clientX, y: e.clientY };
    setLooking(true);
  };

  const onLookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    e.preventDefault();
    const mx = e.clientX - lastLook.current.x;
    const my = e.clientY - lastLook.current.y;
    lastLook.current = { x: e.clientX, y: e.clientY };
    runtime.lookAX += mx * (TOUCH_LOOK_SENS / MOUSE_SENS);
    runtime.lookAY += my * (TOUCH_LOOK_SENS / MOUSE_SENS);
  };

  const onLookUp = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    lookId.current = null;
    setLooking(false);
  };

  const onSprintDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    runtime.touchSprint = true;
    setSprinting(true);
  };

  const onSprintUp = () => {
    runtime.touchSprint = false;
    setSprinting(false);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 touch-none">
      <div
        className="pointer-events-auto absolute bottom-[max(1.1rem,env(safe-area-inset-bottom))] left-4"
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
        style={{ touchAction: "none" }}
      >
        <div
          ref={stickEl}
          className="relative size-[7.4rem] rounded-full border-3 border-ink bg-paper/85 shadow-brutal-sm"
        >
          <span
            className="absolute size-12 -translate-x-1/2 -translate-y-1/2 border-3 border-ink bg-sun"
            style={{
              left: `calc(50% + ${stick.x}px)`,
              top: `calc(50% + ${stick.y}px)`,
            }}
          />
        </div>
        <p className="mt-1.5 text-center font-display text-[10px] tracking-widest text-ink">
          MOVE
        </p>
      </div>

      <div
        className={`pointer-events-auto absolute right-4 bottom-[max(7.4rem,calc(env(safe-area-inset-bottom)+6.2rem))] grid size-16 place-items-center border-3 border-ink shadow-brutal-sm ${
          sprinting ? "bg-cyan" : "bg-paper/85"
        }`}
        onPointerDown={onSprintDown}
        onPointerUp={onSprintUp}
        onPointerCancel={onSprintUp}
        style={{ touchAction: "none" }}
        aria-label="冲刺"
      >
        <span className="font-display text-[11px] tracking-widest">GO</span>
      </div>

      <div
        className={`pointer-events-auto absolute right-4 bottom-[max(1.1rem,env(safe-area-inset-bottom))] size-[7.4rem] rounded-full border-3 border-ink shadow-brutal-sm ${
          looking ? "bg-pink/80" : "bg-paper/80"
        }`}
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        style={{ touchAction: "none" }}
      >
        <p className="absolute inset-0 grid place-items-center font-display text-[11px] tracking-widest text-ink">
          LOOK
        </p>
      </div>
    </div>
  );
}
