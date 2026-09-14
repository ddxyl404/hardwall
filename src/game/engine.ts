import * as THREE from "three";
import {
  ACCEL,
  CELL,
  EYE,
  FIXED_DT,
  FRICTION,
  GAMEPAD_LOOK,
  MOUSE_SENS,
  PALETTE,
  PLAYER_R,
  SPRINT_SPEED,
  WALK_SPEED,
} from "./constants";
import {
  sfxBounce,
  sfxBump,
  sfxCompass,
  sfxDash,
  sfxDoor,
  sfxFoot,
  sfxLock,
  sfxPad,
  sfxPickup,
  sfxPop,
  sfxReveal,
  sfxStamp,
  sfxTar,
  sfxWarp,
  sfxWin,
  unlockAudio,
} from "./audio";
import {
  COMPASS_TIME,
  DASH_MULT,
  DASH_TIME,
  DIFFICULTIES,
  PAD_BOOST,
  PAD_BOOST_CAP,
  POP_LAUNCH,
  REVEAL_TIME,
  TAR_SLOW,
} from "./difficulty";
import { moveAndCollide } from "./collision";
import { cellCenter } from "./maze";
import type { PickupKind } from "./maze";
import { PICKUP_INFO } from "./pickups";
import {
  exitIsLocked,
  exploreAtPlayer,
  held,
  installControlsProbe,
  markExplore,
  pushToast,
  runtime,
  tryOpenDoors,
} from "./runtime";
import { useGame } from "./store";
import { buildWorld, type WorldHandle } from "./world";

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyP",
]);

type Particle = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
};

function isCoarsePointer(): boolean {
  return (
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches)
  );
}

function pickPixelRatio(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(dpr, isCoarsePointer() ? 1.15 : 1.4);
}

export class HardwallEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: WorldHandle | null = null;
  private acc = 0;
  private hudAcc = 0;
  private trailAcc = 0;
  private lastTime = 0;
  private disposed = false;
  private particles: Particle[] = [];
  private particlePool: THREE.Mesh[] = [];
  private particleGeo: THREE.BoxGeometry;
  private particleMat: THREE.MeshBasicMaterial;
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly resizeObs: ResizeObserver;
  private crystal: THREE.Mesh | null = null;
  private exitGlow: THREE.PointLight | null = null;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private compassNeedle: THREE.Group;
  private fogNear = 42;
  private fogFar = 88;
  private fogNearTarget = 42;
  private fogFarTarget = 88;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isCoarsePointer(),
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(PALETTE.sky);
    this.renderer.setPixelRatio(pickPixelRatio());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 48, 95);

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.12, 96);
    this.camera.rotation.order = "YXZ";

    this.hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.cream, 1.35);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff6d0, 1.28);
    this.sun.position.set(22, 34, 14);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(512, 512);
    this.sun.shadow.camera.near = 4;
    this.sun.shadow.camera.right = 48;
    this.sun.shadow.camera.left = -48;
    this.sun.shadow.camera.top = 48;
    this.sun.shadow.camera.bottom = -48;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.particleMat = new THREE.MeshBasicMaterial({ color: PALETTE.sun });

    this.compassNeedle = this.makeCompassNeedle();
    this.scene.add(this.compassNeedle);

    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(canvas.parentElement ?? canvas);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.tick = this.tick.bind(this);
  }

  start(): void {
    installControlsProbe();
    this.layout();
    this.rebuild();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.addEventListener("click", this.onClick);
    this.renderer.setAnimationLoop(this.tick);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.removeEventListener("click", this.onClick);
    this.resizeObs.disconnect();
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.world?.dispose();
    this.particleGeo.dispose();
    this.particleMat.dispose();
    for (const p of this.particlePool) {
      (p.material as THREE.Material).dispose();
    }
    this.compassNeedle.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mat = o.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    this.renderer.dispose();
    if (window.__controlsTest) delete window.__controlsTest;
  }

  private makeCompassNeedle(): THREE.Group {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.05, 0.85),
      new THREE.MeshLambertMaterial({
        color: PALETTE.lime,
        emissive: PALETTE.lime,
        emissiveIntensity: 0.45,
      }),
    );
    shaft.position.z = -0.2;
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.32, 4),
      new THREE.MeshLambertMaterial({
        color: PALETTE.ink,
        emissive: PALETTE.lime,
        emissiveIntensity: 0.2,
      }),
    );
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.72;
    g.add(shaft, head);
    g.visible = false;
    return g;
  }

  private rebuild(): void {
    const maze = runtime.maze;
    if (!maze) return;
    this.world?.dispose();
    this.world = buildWorld(maze);
    this.scene.add(this.world.group);
    this.crystal = null;
    this.exitGlow = null;
    this.world.group.traverse((o) => {
      if (o.userData.exitGem && o instanceof THREE.Mesh) this.crystal = o;
      if (o.userData.exitGlow && o instanceof THREE.PointLight) this.exitGlow = o;
    });
    const midX = ((maze.cols - 1) * CELL) / 2;
    const midZ = ((maze.rows - 1) * CELL) / 2;
    this.sun.target.position.set(midX, 0, midZ);
    const span = Math.max(maze.cols, maze.rows) * CELL * 0.58;
    this.sun.shadow.camera.left = -span;
    this.sun.shadow.camera.right = span;
    this.sun.shadow.camera.top = span;
    this.sun.shadow.camera.bottom = -span;
    this.sun.shadow.camera.updateProjectionMatrix();
    const diff = DIFFICULTIES[maze.difficulty];
    this.fogNear = diff.fogNear;
    this.fogFar = Math.min(diff.fogFar, 96);
    this.fogNearTarget = this.fogNear;
    this.fogFarTarget = this.fogFar;
    this.scene.fog = new THREE.Fog(PALETTE.sky, this.fogNear, this.fogFar);
    this.renderer.shadowMap.needsUpdate = true;
    this.syncCamera(0);
  }

  private layout(): void {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setPixelRatio(pickPixelRatio());
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private onClick(): void {
    if (runtime.phase !== "playing") return;
    if (runtime.touchActive) return;
    if (document.pointerLockElement === this.canvas) return;
    const req = this.canvas.requestPointerLock as (
      opts?: PointerLockOptions,
    ) => Promise<void> | void;
    try {
      const r = req.call(this.canvas, { unadjustedMovement: true });
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch(() => {
          this.canvas.requestPointerLock();
        });
      }
    } catch {
      this.canvas.requestPointerLock();
    }
  }

  private onPointerLockChange(): void {
    const locked = document.pointerLockElement === this.canvas;
    runtime.pointerLocked = locked;
    useGame.getState().setPointerLocked(locked);
    if (!locked && runtime.phase === "playing" && !runtime.touchActive) {
      useGame.getState().pause();
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (runtime.phase !== "playing") return;
    if (document.pointerLockElement !== this.canvas) return;
    runtime.lookAX += e.movementX;
    runtime.lookAY += e.movementY;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    runtime.keys.add(e.code);
    if (GAME_CODES.has(e.code)) e.preventDefault();
    if (e.code === "Escape" && runtime.phase === "playing") {
      useGame.getState().pause();
    }
    if (e.code === "KeyP" && runtime.phase === "playing") {
      useGame.getState().pause();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    runtime.keys.delete(e.code);
  }

  private onBlur(): void {
    if (document.visibilityState === "hidden") runtime.keys.clear();
    if (document.visibilityState === "visible") unlockAudio();
  }

  private tick(time: number): void {
    if (this.disposed) return;
    if (!this.lastTime) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    if (runtime.phase === "playing") {
      if (runtime.hitstop > 0) {
        runtime.hitstop = Math.max(0, runtime.hitstop - dt);
      } else {
        this.acc += dt;
        this.acc = Math.min(this.acc, 0.25);
        while (this.acc >= FIXED_DT) {
          this.fixedStep(FIXED_DT);
          this.acc -= FIXED_DT;
        }
        runtime.time += dt;
      }
      this.hudAcc += dt;
      if (this.hudAcc >= 0.05) {
        this.hudAcc = 0;
        useGame.getState().syncHud();
      }
    } else {
      this.acc = 0;
    }
    this.animatePickups(dt);
    this.animateWorld(dt);
    this.stepParticles(dt);
    this.emitDashTrail(dt);
    this.syncFog(dt);
    this.syncCompass();
    this.syncExitGate();
    if (this.crystal) {
      this.crystal.rotation.y += dt * 1.3;
      this.crystal.position.y = 1.15 + Math.sin(runtime.time * 2.2) * 0.08;
    }
    this.syncCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private syncFog(dt: number): void {
    const maze = runtime.maze;
    if (!maze) return;
    const diff = DIFFICULTIES[maze.difficulty];
    const revealed = runtime.time < runtime.revealUntil;
    const tar = runtime.onTar;
    this.fogNearTarget = revealed ? Math.min(96, diff.fogNear * 1.85) : tar ? diff.fogNear * 0.55 : diff.fogNear;
    this.fogFarTarget = revealed
      ? Math.min(96, diff.fogFar * 1.65)
      : tar
        ? Math.min(96, diff.fogFar * 0.62)
        : Math.min(96, diff.fogFar);
    const k = 1 - Math.exp(-5.5 * dt);
    this.fogNear += (this.fogNearTarget - this.fogNear) * k;
    this.fogFar += (this.fogFarTarget - this.fogFar) * k;
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.near = this.fogNear;
      fog.far = this.fogFar;
    }
  }

  private syncCompass(): void {
    const maze = runtime.maze;
    const on = Boolean(maze) && runtime.time < runtime.compassUntil;
    this.compassNeedle.visible = on && runtime.phase === "playing";
    if (!on || !maze) return;
    const e = cellCenter(maze.exit.cx, maze.exit.cz);
    const dx = e.x - runtime.x;
    const dz = e.z - runtime.z;
    this.compassNeedle.position.set(runtime.x, 0.18, runtime.z);
    this.compassNeedle.rotation.y = Math.atan2(-dx, -dz);
  }

  private syncExitGate(): void {
    const locked = exitIsLocked();
    if (this.world?.exitLock) this.world.exitLock.visible = locked;
    const color = locked ? PALETTE.pink : PALETTE.lime;
    if (this.crystal) {
      const mat = this.crystal.material as THREE.MeshLambertMaterial;
      mat.color.setHex(color);
      mat.emissive.setHex(color);
    }
    if (this.exitGlow) this.exitGlow.color.setHex(color);
  }

  private fixedStep(dt: number): void {
    this.applyLook(dt);
    this.applyMove(dt);
    this.checkPickups();
    this.checkWarp();
    this.checkBoost();
    this.checkTars();
    this.checkPops();
    this.checkDoors();
    this.checkExit();
    exploreAtPlayer();
  }

  private applyLook(dt: number): void {
    const sens = MOUSE_SENS * runtime.lookSens;
    runtime.yaw -= runtime.lookAX * sens;
    runtime.pitch -= runtime.lookAY * sens;
    runtime.lookAX = 0;
    runtime.lookAY = 0;

    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads[0];
    if (pad && pad.mapping === "standard") {
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      const mag = Math.hypot(rx, ry);
      if (mag > 0.18) {
        const scale = ((mag - 0.18) / 0.82) / mag;
        runtime.yaw -= rx * scale * GAMEPAD_LOOK * runtime.lookSens * dt;
        runtime.pitch -= ry * scale * GAMEPAD_LOOK * 0.85 * runtime.lookSens * dt;
      }
    }

    const lim = Math.PI / 2 - 0.02;
    if (runtime.pitch > lim) runtime.pitch = lim;
    if (runtime.pitch < -lim) runtime.pitch = -lim;
  }

  private applyMove(dt: number): void {
    if (!runtime.maze) return;

    this.fwd.set(-Math.sin(runtime.yaw), 0, -Math.cos(runtime.yaw));
    this.right.set(Math.cos(runtime.yaw), 0, -Math.sin(runtime.yaw));

    let ax = 0;
    let az = 0;
    if (held("KeyW") || held("ArrowUp")) az += 1;
    if (held("KeyS") || held("ArrowDown")) az -= 1;
    if (held("KeyD") || held("ArrowRight")) ax += 1;
    if (held("KeyA") || held("ArrowLeft")) ax -= 1;
    ax += runtime.touchX;
    az += runtime.touchY;

    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads[0];
    if (pad && pad.mapping === "standard") {
      let lx = pad.axes[0] ?? 0;
      let ly = -(pad.axes[1] ?? 0);
      const mag = Math.hypot(lx, ly);
      if (mag > 0.15) {
        const scale = ((mag - 0.15) / 0.85) / mag;
        lx *= scale;
        ly *= scale;
        ax += lx;
        az += ly;
      }
    }

    const im = Math.hypot(ax, az);
    if (im > 1) {
      ax /= im;
      az /= im;
    }

    const sprint =
      held("ShiftLeft") ||
      held("ShiftRight") ||
      runtime.touchSprint ||
      (pad?.buttons[10]?.pressed ?? false) ||
      im > 0.95;
    const boosting = runtime.time < runtime.boostUntil;
    const padBoosting = runtime.time < runtime.padBoostUntil;
    let maxS = padBoosting
      ? PAD_BOOST_CAP
      : (sprint ? SPRINT_SPEED : WALK_SPEED) * (boosting ? DASH_MULT : 1);
    if (runtime.onTar) maxS *= TAR_SLOW;

    const wishX = this.fwd.x * az + this.right.x * ax;
    const wishZ = this.fwd.z * az + this.right.z * ax;

    if (im > 0.02) {
      runtime.vx += wishX * ACCEL * dt;
      runtime.vz += wishZ * ACCEL * dt;
      const s = Math.hypot(runtime.vx, runtime.vz);
      if (s > maxS) {
        runtime.vx *= maxS / s;
        runtime.vz *= maxS / s;
      }
    } else if (!padBoosting) {
      const damp = Math.exp(-FRICTION * (runtime.onTar ? dt * 1.8 : dt));
      runtime.vx *= damp;
      runtime.vz *= damp;
      if (Math.hypot(runtime.vx, runtime.vz) < 0.03) {
        runtime.vx = 0;
        runtime.vz = 0;
      }
    }

    const moved = moveAndCollide(
      runtime.x,
      runtime.z,
      runtime.vx,
      runtime.vz,
      dt,
      runtime.aabbs,
      PLAYER_R,
    );
    runtime.x = moved.x;
    runtime.z = moved.z;
    runtime.vx = moved.vx;
    runtime.vz = moved.vz;
    runtime.speed = Math.hypot(runtime.vx, runtime.vz);

    if (moved.hit && runtime.speed > 1.2 && runtime.time - runtime.lastBump > 0.28) {
      runtime.lastBump = runtime.time;
      sfxBump();
      runtime.trauma = Math.min(1, runtime.trauma + 0.1);
    }

    if (runtime.speed > 0.5) {
      runtime.walkDist += runtime.speed * dt;
      if (runtime.walkDist - runtime.lastFoot > 1.55) {
        runtime.lastFoot = runtime.walkDist;
        sfxFoot(0.92 + Math.random() * 0.18);
      }
      if (!runtime.reducedMotion) {
        runtime.bobPhase += runtime.speed * dt * 2.15;
        runtime.bob =
          Math.sin(runtime.bobPhase * 2) *
          0.038 *
          Math.min(1, runtime.speed / WALK_SPEED);
      }
    } else {
      runtime.bob *= Math.exp(-10 * dt);
    }
  }

  private checkPickups(): void {
    const maze = runtime.maze;
    if (!maze || !this.world) return;
    for (const p of maze.pickups) {
      if (runtime.collected.has(p.id)) continue;
      const dx = runtime.x - p.x;
      const dz = runtime.z - p.z;
      if (dx * dx + dz * dz > 0.82 * 0.82) continue;
      runtime.collected.add(p.id);
      const mesh = this.world.pickups[p.id];
      if (mesh) mesh.visible = false;
      this.burst(p.x, 0.8, p.z, p.kind, 18);
      this.applyPickup(p.kind);
      runtime.trauma = Math.min(1, runtime.trauma + 0.28);
      useGame.getState().collectOne();
    }
  }

  private applyPickup(kind: PickupKind): void {
    const info = PICKUP_INFO[kind];
    if (kind === "dash") {
      runtime.boostUntil = runtime.time + DASH_TIME;
      runtime.fovKick = Math.max(runtime.fovKick, 0.38);
      pushToast(`${info.label}  ${DASH_TIME}s`, info.css);
      sfxDash();
      return;
    }
    if (kind === "reveal") {
      runtime.revealUntil = runtime.time + REVEAL_TIME;
      this.revealMap();
      pushToast(`${info.label}  ${REVEAL_TIME}s`, info.css);
      sfxReveal();
      return;
    }
    if (kind === "compass") {
      runtime.compassUntil = runtime.time + COMPASS_TIME;
      pushToast(`${info.label}  ${COMPASS_TIME}s`, info.css);
      sfxCompass();
      return;
    }
    if (kind === "stamp") {
      runtime.stamps += 1;
      sfxStamp();
      if (tryOpenDoors()) {
        sfxDoor();
        runtime.trauma = Math.min(1, runtime.trauma + 0.22);
        runtime.fovKick = Math.max(runtime.fovKick, 0.22);
        this.burstDoors();
        pushToast("GATE OPEN", "lime");
      } else {
        pushToast(`${info.label}  ${runtime.stamps}`, info.css);
      }
      return;
    }
    runtime.blocks += 1;
    pushToast(`${info.label}  ${runtime.blocks}`, info.css);
    sfxPickup();
  }

  private revealMap(): void {
    const maze = runtime.maze;
    if (!maze) return;
    for (let z = 0; z < maze.rows; z++) {
      for (let x = 0; x < maze.cols; x++) {
        markExplore(x, z);
      }
    }
  }

  private burstDoors(): void {
    const maze = runtime.maze;
    if (!maze) return;
    for (const d of maze.doors) {
      if (!runtime.openDoors.has(d.id)) continue;
      this.burst(d.x, 1.4, d.z, "stamp", 16);
    }
  }

  private checkWarp(): void {
    const maze = runtime.maze;
    if (!maze) return;
    let onPad = -1;
    for (const t of maze.teleporters) {
      const dx = runtime.x - t.x;
      const dz = runtime.z - t.z;
      if (dx * dx + dz * dz < 0.62 * 0.62) {
        onPad = t.id;
        break;
      }
    }
    if (onPad < 0) {
      runtime.lastWarp = -1;
      return;
    }
    if (runtime.lastWarp === onPad) return;
    const src = maze.teleporters.find((t) => t.id === onPad);
    if (!src) return;
    const dest = maze.teleporters.find((t) => t.id === src.pair);
    if (!dest) return;
    this.burst(src.x, 0.9, src.z, "warp", 22);
    runtime.x = dest.x;
    runtime.z = dest.z;
    runtime.vx = 0;
    runtime.vz = 0;
    runtime.lastWarp = dest.id;
    runtime.fovKick = 0.5;
    runtime.hop = 0.38;
    runtime.hitstop = 0.07;
    runtime.trauma = Math.min(1, runtime.trauma + 0.36);
    pushToast("WARP", "cyan");
    sfxWarp();
    this.burst(dest.x, 0.9, dest.z, "warp", 22);
  }

  private checkBoost(): void {
    const maze = runtime.maze;
    if (!maze) return;
    let key = "";
    for (const b of maze.boosts) {
      const dx = runtime.x - b.x;
      const dz = runtime.z - b.z;
      if (dx * dx + dz * dz > 0.72 * 0.72) continue;
      key = `${b.cx},${b.cz}`;
      if (runtime.lastBoostKey === key) return;
      runtime.lastBoostKey = key;
      runtime.padBoostUntil = runtime.time + 0.72;
      runtime.vx += b.dx * PAD_BOOST;
      runtime.vz += b.dz * PAD_BOOST;
      const s = Math.hypot(runtime.vx, runtime.vz);
      if (s > PAD_BOOST_CAP) {
        runtime.vx *= PAD_BOOST_CAP / s;
        runtime.vz *= PAD_BOOST_CAP / s;
      }
      runtime.trauma = Math.min(1, runtime.trauma + 0.18);
      runtime.fovKick = Math.max(runtime.fovKick, 0.32);
      runtime.hop = Math.max(runtime.hop, 0.2);
      this.burst(b.x, 0.45, b.z, "dash", 16);
      pushToast("BOOST", "sun");
      sfxPad();
      return;
    }
    if (!key) runtime.lastBoostKey = "";
  }

  private checkTars(): void {
    const maze = runtime.maze;
    if (!maze) {
      runtime.onTar = false;
      return;
    }
    let on = false;
    for (const t of maze.tars) {
      const dx = runtime.x - t.x;
      const dz = runtime.z - t.z;
      if (dx * dx + dz * dz < 0.92 * 0.92) {
        on = true;
        break;
      }
    }
    if (on && !runtime.onTar && runtime.time - runtime.lastTarSfx > 0.4) {
      runtime.lastTarSfx = runtime.time;
      sfxTar();
      runtime.trauma = Math.min(1, runtime.trauma + 0.08);
    }
    runtime.onTar = on;
  }

  private checkPops(): void {
    const maze = runtime.maze;
    if (!maze || !this.world) return;
    for (const orb of maze.pops) {
      if (runtime.popped.has(orb.id)) continue;
      const dx = runtime.x - orb.x;
      const dz = runtime.z - orb.z;
      if (dx * dx + dz * dz > 0.68 * 0.68) continue;
      runtime.popped.add(orb.id);
      const mesh = this.world.pops[orb.id];
      if (mesh) mesh.visible = false;
      this.burst(orb.x, 1.05, orb.z, "pop", 20);
      this.fwd.set(-Math.sin(runtime.yaw), 0, -Math.cos(runtime.yaw));
      runtime.vx += this.fwd.x * POP_LAUNCH;
      runtime.vz += this.fwd.z * POP_LAUNCH;
      const s = Math.hypot(runtime.vx, runtime.vz);
      if (s > PAD_BOOST_CAP) {
        runtime.vx *= PAD_BOOST_CAP / s;
        runtime.vz *= PAD_BOOST_CAP / s;
      }
      runtime.padBoostUntil = Math.max(runtime.padBoostUntil, runtime.time + 0.38);
      runtime.hop = Math.max(runtime.hop, 0.42);
      runtime.fovKick = Math.max(runtime.fovKick, 0.24);
      runtime.trauma = Math.min(1, runtime.trauma + 0.22);
      markExplore(orb.cx, orb.cz);
      pushToast("POP  BOUNCE", "pink");
      sfxPop();
      sfxBounce();
    }
  }

  private checkDoors(): void {
    const maze = runtime.maze;
    if (!maze) return;
    for (const d of maze.doors) {
      if (runtime.openDoors.has(d.id)) continue;
      const dx = runtime.x - d.x;
      const dz = runtime.z - d.z;
      if (dx * dx + dz * dz > 1.55 * 1.55) continue;
      runtime.doorHintUntil = runtime.time + 0.55;
      if (runtime.speed > 1.1 && runtime.time - runtime.lastDoorBump > 0.45) {
        runtime.lastDoorBump = runtime.time;
        sfxLock();
        runtime.trauma = Math.min(1, runtime.trauma + 0.16);
        this.burst(d.x, 1.2, d.z, "stamp", 8);
      }
    }
  }

  private checkExit(): void {
    const maze = runtime.maze;
    if (!maze) return;
    const e = cellCenter(maze.exit.cx, maze.exit.cz);
    const dx = runtime.x - e.x;
    const dz = runtime.z - e.z;
    if (dx * dx + dz * dz > 0.95 * 0.95) return;
    if (exitIsLocked()) {
      if (runtime.time - runtime.lastLockNudge > 0.9) {
        runtime.lastLockNudge = runtime.time;
        runtime.lockHintUntil = runtime.time + 2.2;
        sfxLock();
        runtime.trauma = Math.min(1, runtime.trauma + 0.22);
      }
      return;
    }
    sfxWin();
    runtime.trauma = 0.7;
    this.burst(e.x, 1.2, e.z, "compass", 28);
    useGame.getState().win();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private animatePickups(dt: number): void {
    if (!this.world) return;
    const t = runtime.time;
    const revealed = t < runtime.revealUntil;
    for (const mesh of this.world.pickups) {
      if (!mesh.visible) continue;
      const phase = mesh.userData.phase as number;
      mesh.position.y = 0.72 + Math.sin(t * 2.4 + phase) * 0.12;
      const spin = mesh.userData.spinRoot as THREE.Object3D | undefined;
      if (spin) {
        spin.rotation.y += dt * 1.55;
        spin.rotation.x = Math.sin(t * 1.1 + phase) * 0.18;
      } else {
        mesh.rotation.y += dt * 1.35;
        mesh.rotation.x = Math.sin(t * 1.1 + phase) * 0.18;
      }
      const label = mesh.userData.label as THREE.Object3D | undefined;
      if (label) {
        label.quaternion.copy(this.camera.quaternion);
        label.position.y = 0.62 + Math.sin(t * 3 + phase) * 0.04;
      }
      const inner = mesh.userData.inner as THREE.Mesh | undefined;
      if (inner && inner.material instanceof THREE.MeshLambertMaterial) {
        inner.material.emissiveIntensity = revealed
          ? 0.7 + Math.sin(t * 8) * 0.2
          : 0.32;
      }
    }
  }

  private animateWorld(dt: number): void {
    if (!this.world) return;
    const t = runtime.time;
    for (const s of this.world.spinners) {
      if (!s.visible) continue;
      const speed = (s.userData.spinY as number | undefined) ?? 0;
      if (speed) s.rotation.y += dt * speed;
    }
    for (const mesh of this.world.pops) {
      if (!mesh.visible) continue;
      const phase = (mesh.userData.phase as number) || 0;
      mesh.position.y = 1.05 + Math.sin(t * 2.6 + phase) * 0.1;
      const label = mesh.userData.label as THREE.Object3D | undefined;
      if (label) label.quaternion.copy(this.camera.quaternion);
    }
    for (const g of this.world.doors) {
      const id = g.userData.doorId as number;
      const open = runtime.openDoors.has(id);
      const target = open ? 3.55 : 0;
      g.position.y += (target - g.position.y) * Math.min(1, dt * 5.5);
      g.visible = g.position.y < 3.35;
    }
    for (const g of this.world.boosts) {
      const pulse = 0.08 + (Math.sin(t * 9) * 0.5 + 0.5) * 0.22;
      g.position.y = pulse;
    }
    for (const g of this.world.warps) {
      const s = 1 + Math.sin(t * 5.2) * 0.06;
      g.scale.setScalar(s);
      const label = g.userData.label as THREE.Object3D | undefined;
      if (label) label.quaternion.copy(this.camera.quaternion);
    }
    for (const g of this.world.tars) {
      const label = g.userData.label as THREE.Object3D | undefined;
      if (label) label.quaternion.copy(this.camera.quaternion);
    }
    const boosting = runtime.time < runtime.boostUntil;
    if (!runtime.reducedMotion) {
      const want = 78 + runtime.fovKick * 24 + (boosting ? 9 : 0) - (runtime.onTar ? 6 : 0);
      if (Math.abs(this.camera.fov - want) > 0.05) {
        this.camera.fov += (want - this.camera.fov) * Math.min(1, dt * 8);
        this.camera.updateProjectionMatrix();
      }
      runtime.fovKick = Math.max(0, runtime.fovKick - dt * 1.7);
    }
  }

  private emitDashTrail(dt: number): void {
    if (runtime.phase !== "playing") return;
    if (runtime.time >= runtime.boostUntil) return;
    if (runtime.reducedMotion) return;
    if (runtime.speed < 1) return;
    this.trailAcc += dt;
    if (this.trailAcc < 0.045) return;
    this.trailAcc = 0;
    const mesh = this.allocParticle(PALETTE.cyan);
    mesh.position.set(
      runtime.x + (Math.random() - 0.5) * 0.2,
      0.55 + Math.random() * 0.4,
      runtime.z + (Math.random() - 0.5) * 0.2,
    );
    mesh.visible = true;
    mesh.scale.setScalar(0.85);
    this.particles.push({
      mesh,
      vx: -this.fwd.x * 1.4,
      vy: 0.4,
      vz: -this.fwd.z * 1.4,
      life: 0.28,
    });
  }

  private burst(
    x: number,
    y: number,
    z: number,
    kind: PickupKind | "pop" | "warp",
    count = 14,
  ): void {
    const color =
      kind === "pop"
        ? PALETTE.pink
        : kind === "warp"
          ? PALETTE.cyan
          : (PICKUP_INFO[kind]?.color ?? PALETTE.sun);
    for (let i = 0; i < count; i++) {
      const mesh = this.allocParticle(color);
      mesh.position.set(x, y, z);
      mesh.visible = true;
      mesh.scale.setScalar(1);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 4.6,
        vy: Math.random() * 3.6 + 1.2,
        vz: (Math.random() - 0.5) * 4.6,
        life: 0.45 + Math.random() * 0.28,
      });
    }
  }

  private allocParticle(color: number): THREE.Mesh {
    const mesh =
      this.particlePool.pop() ??
      new THREE.Mesh(this.particleGeo, this.particleMat.clone());
    (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    if (!mesh.parent) this.scene.add(mesh);
    return mesh;
  }

  private stepParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.vy -= 9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
      const s = Math.max(0, p.life * 2.2);
      p.mesh.scale.setScalar(s);
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particlePool.push(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private syncCamera(dt: number): void {
    this.camera.rotation.set(runtime.pitch, runtime.yaw, 0, "YXZ");
    let y = EYE + (runtime.reducedMotion ? 0 : runtime.bob);
    let x = runtime.x;
    let z = runtime.z;
    if (runtime.hop > 0 && !runtime.reducedMotion) {
      y += Math.sin(Math.min(1, runtime.hop) * Math.PI) * 0.42;
      runtime.hop = Math.max(0, runtime.hop - dt * 2.4);
    }
    const maze = runtime.maze;
    if (maze && !runtime.reducedMotion) {
      for (const yard of maze.courtyards) {
        if (Math.abs(runtime.x - yard.x) < CELL && Math.abs(runtime.z - yard.z) < CELL) {
          y += Math.sin(runtime.time * 3.1) * 0.035;
          break;
        }
      }
    }
    if (!runtime.reducedMotion && runtime.trauma > 0) {
      const shake = runtime.trauma * runtime.trauma;
      const t = runtime.time * 26;
      x += Math.sin(t) * shake * 0.03;
      y += Math.cos(t * 1.3) * shake * 0.02;
      z += Math.sin(t * 0.7) * shake * 0.03;
      runtime.trauma = Math.max(0, runtime.trauma - dt * 2.8);
    }
    this.camera.position.set(x, y, z);
  }
}
