import { PLAYER_R } from "./constants";
import type { Aabb } from "./maze";

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function resolveOne(
  px: number,
  pz: number,
  r: number,
  box: Aabb,
): { x: number; z: number; hit: boolean } {
  const nx = clamp(px, box.minX, box.maxX);
  const nz = clamp(pz, box.minZ, box.maxZ);
  let dx = px - nx;
  let dz = pz - nz;

  if (dx === 0 && dz === 0) {
    const left = px - box.minX;
    const right = box.maxX - px;
    const up = pz - box.minZ;
    const down = box.maxZ - pz;
    const m = Math.min(left, right, up, down);
    if (m === left) return { x: box.minX - r, z: pz, hit: true };
    if (m === right) return { x: box.maxX + r, z: pz, hit: true };
    if (m === up) return { x: px, z: box.minZ - r, hit: true };
    return { x: px, z: box.maxZ + r, hit: true };
  }

  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return { x: px, z: pz, hit: false };
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  return { x: px + dx * push, z: pz + dz * push, hit: true };
}

export function moveAndCollide(
  x: number,
  z: number,
  vx: number,
  vz: number,
  dt: number,
  aabbs: Aabb[],
  radius = PLAYER_R,
): { x: number; z: number; vx: number; vz: number; hit: boolean } {
  const dist = Math.hypot(vx, vz) * dt;
  const steps = Math.max(1, Math.ceil(dist / 0.12));
  const sdt = dt / steps;
  let hit = false;
  let px = x;
  let pz = z;
  let pvx = vx;
  let pvz = vz;

  for (let s = 0; s < steps; s++) {
    px += pvx * sdt;
    for (const box of aabbs) {
      const before = px;
      const r = resolveOne(px, pz, radius, box);
      if (r.hit) {
        px = r.x;
        pz = r.z;
        if (px !== before) pvx = 0;
        hit = true;
      }
    }

    pz += pvz * sdt;
    for (const box of aabbs) {
      const before = pz;
      const r = resolveOne(px, pz, radius, box);
      if (r.hit) {
        px = r.x;
        pz = r.z;
        if (pz !== before) pvz = 0;
        hit = true;
      }
    }
  }

  return { x: px, z: pz, vx: pvx, vz: pvz, hit };
}
