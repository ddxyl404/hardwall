import { useEffect, useRef, useState } from "react";
import { TOUCH_LOOK_SENS, MOUSE_SENS } from "./constants";
import { runtime } from "./runtime";

type Stick = {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
};

export function TouchControls() {
  const [enabled, setEnabled] = useState(false);
  const [stick, setStick] = useState<Stick | null>(null);
  const stickRef = useRef<Stick | null>(null);
  const lookId = useRef<number | null>(null);
  const lastLook = useRef({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const coarse =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0;
    setEnabled(coarse);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = rootRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const left = x < rect.width * 0.46;
      if (left && !stickRef.current) {
        el.setPointerCapture(e.pointerId);
        const next = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        stickRef.current = next;
        setStick(next);
      } else if (!left && lookId.current === null) {
        el.setPointerCapture(e.pointerId);
        lookId.current = e.pointerId;
        lastLook.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onMove = (e: PointerEvent) => {
      const cur = stickRef.current;
      if (cur && e.pointerId === cur.id) {
        const dx = e.clientX - cur.ox;
        const dy = e.clientY - cur.oy;
        const max = 52;
        const mag = Math.hypot(dx, dy);
        const scale = mag > max ? max / mag : 1;
        const sx = dx * scale;
        const sy = dy * scale;
        runtime.touchX = sx / max;
        runtime.touchY = -sy / max;
        const next = { ...cur, x: sx, y: sy };
        stickRef.current = next;
        setStick(next);
      } else if (lookId.current === e.pointerId) {
        const mx = e.clientX - lastLook.current.x;
        const my = e.clientY - lastLook.current.y;
        lastLook.current = { x: e.clientX, y: e.clientY };
        runtime.lookAX += mx * (TOUCH_LOOK_SENS / MOUSE_SENS);
        runtime.lookAY += my * (TOUCH_LOOK_SENS / MOUSE_SENS);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (stickRef.current && e.pointerId === stickRef.current.id) {
        runtime.touchX = 0;
        runtime.touchY = 0;
        stickRef.current = null;
        setStick(null);
      }
      if (lookId.current === e.pointerId) lookId.current = null;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      runtime.touchX = 0;
      runtime.touchY = 0;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-10 touch-none"
      style={{ touchAction: "none" }}
    >
      <div className="pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-5">
        <div className="relative size-[7.25rem] rounded-full border-3 border-ink bg-paper/80 shadow-brutal-sm">
          <span
            className="absolute size-11 -translate-x-1/2 -translate-y-1/2 border-3 border-ink bg-sun"
            style={{
              left: `calc(50% + ${stick?.x ?? 0}px)`,
              top: `calc(50% + ${stick?.y ?? 0}px)`,
            }}
          />
        </div>
        <p className="mt-2 text-center font-display text-[10px] tracking-widest text-ink">
          MOVE
        </p>
      </div>
    </div>
  );
}
