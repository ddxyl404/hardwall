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
import { sfxBump, sfxFoot, sfxPickup, sfxWin, unlockAudio } from "./audio";
import { moveAndCollide } from "./collision";
import { cellCenter } from "./maze";
import {
  exploreAtPlayer,
  held,
  installControlsProbe,
  runtime,
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

export class HardwallEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: WorldHandle | null = null;
  private acc = 0;
  private hudAcc = 0;
  private lastTime = 0;
  private disposed = false;
  private particles: Particle[] = [];
  private particlePool: THREE.Mesh[] = [];
  private particleGeo: THREE.BoxGeometry;
  private particleMat: THREE.MeshBasicMaterial;
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly resizeObs: ResizeObserver;
  private crystal: THREE.Object3D | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(PALETTE.sky);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 48, 95);

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.08, 160);
    this.camera.rotation.order = "YXZ";

    const hemi = new THREE.HemisphereLight(PALETTE.sky, PALETTE.floor, 1.15);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff3c4, 1.15);
    dir.position.set(22, 34, 14);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 4;
    dir.shadow.camera.far = 90;
    dir.shadow.camera.left = -42;
    dir.shadow.camera.right = 42;
    dir.shadow.camera.top = 42;
    dir.shadow.camera.bottom = -42;
    dir.shadow.bias = -0.0004;
    dir.shadow.normalBias = 0.035;
    this.scene.add(dir);
    this.scene.add(dir.target);

    this.particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.particleMat = new THREE.MeshBasicMaterial({ color: PALETTE.sun });

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
    this.renderer.dispose();
    if (window.__controlsTest) delete window.__controlsTest;
  }

  private rebuild(): void {
    const maze = runtime.maze;
    if (!maze) return;
    this.world?.dispose();
    this.world = buildWorld(maze);
    this.scene.add(this.world.group);
    this.crystal = null;
    this.world.group.traverse((o) => {
      if (o.userData.spin) this.crystal = o;
    });
    const midX = ((maze.cols - 1) * CELL) / 2;
    const midZ = ((maze.rows - 1) * CELL) / 2;
    this.scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight) {
        o.target.position.set(midX, 0, midZ);
      }
    });
    this.syncCamera(0);
  }

  private layout(): void {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private onClick(): void {
    if (runtime.phase !== "playing") return;
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
    if (!locked && runtime.phase === "playing") {
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
      this.acc += dt;
      this.acc = Math.min(this.acc, 0.25);
      while (this.acc >= FIXED_DT) {
        this.fixedStep(FIXED_DT);
        this.acc -= FIXED_DT;
      }
      runtime.time += dt;
      this.hudAcc += dt;
      if (this.hudAcc >= 0.1) {
        this.hudAcc = 0;
        useGame.getState().syncHud();
      }
    } else {
      this.acc = 0;
    }
    this.animatePickups(dt);
    this.stepParticles(dt);
    if (this.crystal) {
      this.crystal.rotation.y += dt * 1.3;
      this.crystal.position.y = 1.15 + Math.sin(runtime.time * 2.2) * 0.08;
    }
    this.syncCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private fixedStep(dt: number): void {
    this.applyLook(dt);
    this.applyMove(dt);
    this.checkPickups();
    this.checkExit();
    exploreAtPlayer();
  }

  private applyLook(dt: number): void {
    runtime.yaw -= runtime.lookAX * MOUSE_SENS;
    runtime.pitch -= runtime.lookAY * MOUSE_SENS;
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
        runtime.yaw -= rx * scale * GAMEPAD_LOOK * dt;
        runtime.pitch -= ry * scale * GAMEPAD_LOOK * 0.85 * dt;
      }
    }

    const lim = Math.PI / 2 - 0.02;
    if (runtime.pitch > lim) runtime.pitch = lim;
    if (runtime.pitch < -lim) runtime.pitch = -lim;
  }

  private applyMove(dt: number): void {
    const maze = runtime.maze;
    if (!maze) return;

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
      (pad?.buttons[10]?.pressed ?? false) ||
      im > 0.95;
    const maxS = sprint ? SPRINT_SPEED : WALK_SPEED;

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
    } else {
      const damp = Math.exp(-FRICTION * dt);
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
      maze.aabbs,
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
      runtime.trauma = Math.min(1, runtime.trauma + 0.18);
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
      if (dx * dx + dz * dz > 0.7 * 0.7) continue;
      runtime.collected.add(p.id);
      const mesh = this.world.pickups[p.id];
      if (mesh) mesh.visible = false;
      this.burst(p.x, 0.8, p.z, p.kind);
      sfxPickup();
      runtime.trauma = Math.min(1, runtime.trauma + 0.28);
      useGame.getState().collectOne();
    }
  }

  private checkExit(): void {
    const maze = runtime.maze;
    if (!maze) return;
    const e = cellCenter(maze.exit.cx, maze.exit.cz);
    const dx = runtime.x - e.x;
    const dz = runtime.z - e.z;
    if (dx * dx + dz * dz > 0.95 * 0.95) return;
    sfxWin();
    runtime.trauma = 0.7;
    useGame.getState().win();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private animatePickups(dt: number): void {
    if (!this.world) return;
    const t = runtime.time;
    for (const mesh of this.world.pickups) {
      if (!mesh.visible) continue;
      const phase = mesh.userData.phase as number;
      mesh.position.y = 0.72 + Math.sin(t * 2.4 + phase) * 0.12;
      mesh.rotation.y += dt * 1.35;
      mesh.rotation.x = Math.sin(t * 1.1 + phase) * 0.18;
    }
  }

  private burst(x: number, y: number, z: number, kind: number): void {
    const colors = [PALETTE.sun, PALETTE.cyan, PALETTE.pink];
    const color = colors[kind] ?? PALETTE.sun;
    for (let i = 0; i < 14; i++) {
      const mesh = this.allocParticle(color);
      mesh.position.set(x, y, z);
      mesh.visible = true;
      mesh.scale.setScalar(1);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 4.2,
        vy: Math.random() * 3.4 + 1.2,
        vz: (Math.random() - 0.5) * 4.2,
        life: 0.45 + Math.random() * 0.25,
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
    if (!runtime.reducedMotion && runtime.trauma > 0) {
      const shake = runtime.trauma * runtime.trauma;
      x += (Math.random() * 2 - 1) * shake * 0.08;
      y += (Math.random() * 2 - 1) * shake * 0.05;
      z += (Math.random() * 2 - 1) * shake * 0.08;
      runtime.trauma = Math.max(0, runtime.trauma - dt * 2.4);
    }
    this.camera.position.set(x, y, z);
  }
}


