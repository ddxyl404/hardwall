import * as THREE from "three";
import { CELL, PALETTE, WALL_H, WALL_T } from "./constants";
import type { MazeData, PickupKind, PickupSpec } from "./maze";
import { cellCenter, isCourtyardCell, openDoorsOf } from "./maze";

export type WorldHandle = {
  group: THREE.Group;
  pickups: THREE.Object3D[];
  pops: THREE.Object3D[];
  exitPos: THREE.Vector3;
  exitLock: THREE.Object3D | null;
  doors: THREE.Object3D[];
  spinners: THREE.Object3D[];
  dispose: () => void;
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

function setInstance(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
) {
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _q.identity();
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

function freezeInstanced(mesh: THREE.InstancedMesh) {
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
}

function makeSignTexture(text: string, bg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = "#111111";
  g.lineWidth = 10;
  g.strokeRect(5, 5, 246, 86);
  g.fillStyle = "#111111";
  g.font = '900 52px "Archivo Black", system-ui, sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  t.needsUpdate = true;
  return t;
}

function boxMesh(
  sx: number,
  sy: number,
  sz: number,
  color: number,
): THREE.Mesh {
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshLambertMaterial({ color }),
  );
  core.castShadow = true;
  return core;
}

export function buildWorld(maze: MazeData): WorldHandle {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = (g: THREE.BufferGeometry) => {
    geos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T) => {
    mats.push(m);
    return m;
  };

  const originX = ((maze.cols - 1) * CELL) / 2;
  const originZ = ((maze.rows - 1) * CELL) / 2;

  const groundGeo = trackGeo(
    new THREE.PlaneGeometry(maze.cols * CELL + 10, maze.rows * CELL + 10),
  );
  const groundMat = trackMat(
    new THREE.MeshLambertMaterial({ color: PALETTE.floor }),
  );
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(originX, -0.04, originZ);
  ground.receiveShadow = true;
  group.add(ground);

  const tileGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const tileMat = trackMat(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const tileCount = maze.cols * maze.rows;
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, tileCount);
  tiles.receiveShadow = true;
  tiles.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  let ti = 0;
  for (let z = 0; z < maze.rows; z++) {
    for (let x = 0; x < maze.cols; x++) {
      const c = cellCenter(x, z);
      let color: number = PALETTE.paper;
      const h = (x * 3 + z * 7 + maze.seed) % 17;
      if (x === maze.start.cx && z === maze.start.cz) color = PALETTE.sun;
      else if (x === maze.exit.cx && z === maze.exit.cz) color = PALETTE.lime;
      else if (maze.teleporters.some((t) => t.cx === x && t.cz === z)) color = PALETTE.cyan;
      else if (maze.boosts.some((t) => t.cx === x && t.cz === z)) color = PALETTE.sun;
      else if (
        maze.courtyards.some(
          (y) => x >= y.cx && x <= y.cx + 1 && z >= y.cz && z <= y.cz + 1,
        )
      )
        color = PALETTE.cream;
      else if (h === 0) color = PALETTE.cream;
      else if (h === 1) color = PALETTE.sun;
      else if (h === 2) color = PALETTE.cyan;
      setInstance(tiles, ti, c.x, 0.03, c.z, CELL * 0.96, 0.06, CELL * 0.96);
      _c.setHex(color);
      tiles.setColorAt(ti, _c);
      ti++;
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  freezeInstanced(tiles);
  tiles.receiveShadow = true;
  tiles.castShadow = false;
  group.add(tiles);

  const wallGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const inkMat = trackMat(new THREE.MeshLambertMaterial({ color: PALETTE.ink }));
  const wallMat = trackMat(
    new THREE.MeshLambertMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  const n = maze.walls.length;
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, n);
  const caps = new THREE.InstancedMesh(wallGeo, inkMat, n);
  walls.castShadow = true;
  walls.receiveShadow = false;
  caps.castShadow = false;
  caps.receiveShadow = false;

  const postMap = new Map<string, { x: number; z: number }>();
  const addPost = (x: number, z: number) => {
    const k = `${Math.round(x * 25)}_${Math.round(z * 25)}`;
    if (!postMap.has(k)) postMap.set(k, { x, z });
  };

  maze.walls.forEach((w, i) => {
    const alongX = w.sx >= w.sz;
    const visSx = alongX ? Math.max(0.08, w.sx - WALL_T * 2 - 0.008) : w.sx;
    const visSz = alongX ? w.sz : Math.max(0.08, w.sz - WALL_T * 2 - 0.008);
    setInstance(walls, i, w.x, w.y, w.z, visSx, w.sy, visSz);
    setInstance(caps, i, w.x, WALL_H + 0.04, w.z, visSx + 0.04, 0.08, visSz + 0.04);
    _c.setHex(w.color);
    walls.setColorAt(i, _c);
    if (alongX) {
      addPost(w.x - w.sx * 0.5 + WALL_T * 0.5, w.z);
      addPost(w.x + w.sx * 0.5 - WALL_T * 0.5, w.z);
    } else {
      addPost(w.x, w.z - w.sz * 0.5 + WALL_T * 0.5);
      addPost(w.x, w.z + w.sz * 0.5 - WALL_T * 0.5);
    }
  });
  walls.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  freezeInstanced(walls);
  freezeInstanced(caps);
  group.add(walls, caps);

  const postList = [...postMap.values()];
  if (postList.length) {
    const posts = new THREE.InstancedMesh(wallGeo, inkMat, postList.length);
    const postCaps = new THREE.InstancedMesh(wallGeo, inkMat, postList.length);
    posts.castShadow = true;
    posts.receiveShadow = false;
    postCaps.castShadow = false;
    for (let i = 0; i < postList.length; i++) {
      const p = postList[i]!;
      setInstance(posts, i, p.x, WALL_H * 0.5, p.z, WALL_T, WALL_H, WALL_T);
      setInstance(postCaps, i, p.x, WALL_H + 0.04, p.z, WALL_T + 0.05, 0.08, WALL_T + 0.05);
    }
    posts.instanceMatrix.needsUpdate = true;
    postCaps.instanceMatrix.needsUpdate = true;
    freezeInstanced(posts);
    freezeInstanced(postCaps);
    group.add(posts, postCaps);
  }

  const exitC = cellCenter(maze.exit.cx, maze.exit.cz);
  const exitGroup = new THREE.Group();
  exitGroup.position.set(exitC.x, 0, exitC.z);
  const pillarH = 2.6;
  const p1 = boxMesh(0.32, pillarH, 0.32, PALETTE.lime);
  p1.position.set(-0.85, pillarH / 2, 0);
  const p2 = boxMesh(0.32, pillarH, 0.32, PALETTE.lime);
  p2.position.set(0.85, pillarH / 2, 0);
  const lintel = boxMesh(2.15, 0.32, 0.32, PALETTE.sun);
  lintel.position.set(0, pillarH + 0.16, 0);
  exitGroup.add(p1, p2, lintel);

  const signTex = makeSignTexture("EXIT", "#C6F000");
  textures.push(signTex);
  const signMat = trackMat(
    new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }),
  );
  const sign = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.7, 0.64)), signMat);
  sign.position.set(0, pillarH + 0.7, 0.02);
  const signBack = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.82, 0.76)),
    trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink })),
  );
  signBack.position.set(0, pillarH + 0.7, -0.01);
  exitGroup.add(signBack, sign);

  const crystalGeo = trackGeo(new THREE.OctahedronGeometry(0.38, 0));
  const crystalMat = trackMat(
    new THREE.MeshLambertMaterial({
      color: PALETTE.lime,
      emissive: PALETTE.lime,
      emissiveIntensity: 0.35,
    }),
  );
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.position.set(0, 1.15, 0);
  crystal.userData.spin = true;
  crystal.userData.exitGem = true;
  exitGroup.add(crystal);

  const glow = new THREE.PointLight(PALETTE.lime, 2.2, 8, 2);
  glow.position.set(0, 1.4, 0);
  glow.userData.exitGlow = true;
  exitGroup.add(glow);

  const lock = boxMesh(1.55, 2.05, 0.18, PALETTE.pink);
  lock.position.set(0, 1.05, 0);
  lock.userData.exitLock = true;
  if (!maze.exitNeedsAll) lock.visible = false;
  exitGroup.add(lock);
  group.add(exitGroup);

  const pickups: THREE.Object3D[] = [];
  maze.pickups.forEach((p) => pickups.push(makePickup(p, trackGeo, trackMat)));
  pickups.forEach((m) => group.add(m));

  const doors: THREE.Object3D[] = [];
  const spinners: THREE.Object3D[] = [];
  const pops: THREE.Object3D[] = [];
  decorateInterior(maze, group, doors, spinners, pops, trackGeo, trackMat, textures);

  const skyline = buildSkyline(originX, originZ, maze, trackGeo, trackMat);
  group.add(skyline);

  const sun = buildSun();
  group.add(sun);

  return {
    group,
    pickups,
    pops,
    exitPos: new THREE.Vector3(exitC.x, 0, exitC.z),
    exitLock: lock,
    doors,
    spinners,
    dispose: () => {
      group.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

function pickupColor(kind: PickupKind): number {
  if (kind === "dash") return PALETTE.cyan;
  if (kind === "reveal") return PALETTE.pink;
  if (kind === "compass") return PALETTE.lime;
  if (kind === "stamp") return PALETTE.cream;
  return PALETTE.sun;
}

function makePickup(
  spec: PickupSpec,
  trackGeo: (g: THREE.BufferGeometry) => THREE.BufferGeometry,
  trackMat: <T extends THREE.Material>(m: T) => T,
): THREE.Object3D {
  const wrap = new THREE.Group();
  wrap.position.set(spec.x, 0.72, spec.z);
  wrap.userData.id = spec.id;
  wrap.userData.kind = spec.kind;
  wrap.userData.phase = spec.id * 0.9;

  const color = pickupColor(spec.kind);
  const ink = trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
  const fill = trackMat(
    new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.22,
    }),
  );

  let inner: THREE.Mesh;
  let shell: THREE.Mesh;
  if (spec.kind === "dash") {
    shell = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.34, 0)), ink);
    shell.scale.set(1.12, 1.45, 1.12);
    inner = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.3, 0)), fill);
    inner.scale.set(1, 1.32, 1);
  } else if (spec.kind === "reveal") {
    shell = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.32, 0)), ink);
    shell.scale.setScalar(1.12);
    inner = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.28, 0)), fill);
  } else if (spec.kind === "compass") {
    const cone = trackGeo(new THREE.ConeGeometry(0.28, 0.52, 4));
    shell = new THREE.Mesh(cone, ink);
    shell.scale.setScalar(1.14);
    inner = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.24, 0.46, 4)), fill);
  } else if (spec.kind === "stamp") {
    shell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.08, 0.4)), ink);
    inner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.05, 0.32)), fill);
  } else {
    shell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.48, 0.48)), ink);
    inner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.4, 0.4)), fill);
  }
  inner.castShadow = true;
  wrap.add(shell, inner);
  wrap.userData.inner = inner;
  return wrap;
}

const POSTER_WORDS = ["GO", "走", "POP", "MAX", "YES", "墙", "LOOK", "HOT"];

function decorateInterior(
  maze: MazeData,
  group: THREE.Group,
  doors: THREE.Object3D[],
  spinners: THREE.Object3D[],
  pops: THREE.Object3D[],
  trackGeo: (g: THREE.BufferGeometry) => THREE.BufferGeometry,
  trackMat: <T extends THREE.Material>(m: T) => T,
  textures: THREE.Texture[],
) {
  const posterTex = POSTER_WORDS.map((w, i) => {
    const bg = ["#FFE500", "#00D4E8", "#FF5A8A", "#C6F000"][i % 4]!;
    const t = makeSignTexture(w, bg);
    textures.push(t);
    return t;
  });

  const posterGeo = trackGeo(new THREE.PlaneGeometry(1.15, 0.44));
  const posterBackGeo = trackGeo(new THREE.PlaneGeometry(1.24, 0.52));
  const posterInk = trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
  const posterMats = posterTex.map((tex) =>
    trackMat(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })),
  );

  let posterN = 0;
  const posterCap = 12;
  for (let z = 0; z < maze.rows && posterN < posterCap; z++) {
    for (let x = 0; x < maze.cols && posterN < posterCap; x++) {
      if (((x * 5 + z * 11 + maze.seed) & 7) > 2) continue;
      const cell = maze.cellWalls[z]![x]!;
      const c = cellCenter(x, z);
      const faces: { px: number; pz: number; rot: number; wall: boolean }[] = [
        { px: c.x, pz: c.z - CELL * 0.5 + 0.22, rot: 0, wall: cell.n },
        { px: c.x, pz: c.z + CELL * 0.5 - 0.22, rot: Math.PI, wall: cell.s },
        { px: c.x + CELL * 0.5 - 0.22, pz: c.z, rot: -Math.PI / 2, wall: cell.e },
        { px: c.x - CELL * 0.5 + 0.22, pz: c.z, rot: Math.PI / 2, wall: cell.w },
      ];
      const face = faces.find((f) => f.wall);
      if (!face) continue;
      const mat = posterMats[posterN % posterMats.length]!;
      const board = new THREE.Mesh(posterGeo, mat);
      board.position.set(face.px, 1.55, face.pz);
      board.rotation.y = face.rot;
      const back = new THREE.Mesh(posterBackGeo, posterInk);
      back.position.copy(board.position);
      back.rotation.y = face.rot;
      back.translateZ(-0.012);
      group.add(back, board);
      posterN++;
    }
  }

  const lampGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const lampInk = trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
  const lampFill = trackMat(
    new THREE.MeshLambertMaterial({
      color: PALETTE.sun,
      emissive: PALETTE.sun,
      emissiveIntensity: 0.35,
    }),
  );
  const lampCells: { x: number; z: number }[] = [];
  for (let z = 0; z < maze.rows; z++) {
    for (let x = 0; x < maze.cols; x++) {
      if (openDoorsOf(maze.cellWalls[z]![x]!) >= 3) lampCells.push({ x, z });
    }
  }
  const lampCount = Math.min(lampCells.length, 18);
  if (lampCount > 0) {
    const shells = new THREE.InstancedMesh(lampGeo, lampInk, lampCount);
    const cores = new THREE.InstancedMesh(lampGeo, lampFill, lampCount);
    shells.castShadow = false;
    cores.castShadow = false;
    for (let i = 0; i < lampCount; i++) {
      const cell = lampCells[i]!;
      const c = cellCenter(cell.x, cell.z);
      setInstance(shells, i, c.x, 3.08, c.z, 0.38, 0.16, 0.38);
      setInstance(cores, i, c.x, 3.08, c.z, 0.3, 0.1, 0.3);
    }
    shells.instanceMatrix.needsUpdate = true;
    cores.instanceMatrix.needsUpdate = true;
    freezeInstanced(shells);
    freezeInstanced(cores);
    group.add(shells, cores);
  }

  const totemSpots: { x: number; z: number; color: number }[] = [];
  const totemPalette = [PALETTE.sun, PALETTE.cyan, PALETTE.pink, PALETTE.lime];
  for (let z = 0; z < maze.rows; z++) {
    for (let x = 0; x < maze.cols; x++) {
      if (openDoorsOf(maze.cellWalls[z]![x]!) !== 1) continue;
      if (x === maze.start.cx && z === maze.start.cz) continue;
      if (x === maze.exit.cx && z === maze.exit.cz) continue;
      if (maze.teleporters.some((t) => t.cx === x && t.cz === z)) continue;
      if (maze.pops.some((t) => t.cx === x && t.cz === z)) continue;
      if (isCourtyardCell(maze, x, z)) continue;
      const c = cellCenter(x, z);
      totemSpots.push({
        x: c.x,
        z: c.z,
        color: totemPalette[(x + z) % totemPalette.length]!,
      });
    }
  }
  if (totemSpots.length) {
    const totemGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
    const totemFill = trackMat(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const totemInk = trackMat(new THREE.MeshLambertMaterial({ color: PALETTE.ink }));
    const b1 = new THREE.InstancedMesh(totemGeo, totemFill, totemSpots.length);
    const b2 = new THREE.InstancedMesh(totemGeo, totemInk, totemSpots.length);
    const b3 = new THREE.InstancedMesh(totemGeo, totemFill, totemSpots.length);
    b1.castShadow = true;
    b2.castShadow = false;
    b3.castShadow = false;
    b1.receiveShadow = false;
    for (let i = 0; i < totemSpots.length; i++) {
      const s = totemSpots[i]!;
      setInstance(b1, i, s.x, 0.28, s.z, 0.42, 0.38, 0.42);
      setInstance(b2, i, s.x, 0.64, s.z, 0.3, 0.32, 0.3);
      setInstance(b3, i, s.x, 0.92, s.z, 0.22, 0.22, 0.22);
      _c.setHex(s.color);
      b1.setColorAt(i, _c);
      b3.setColorAt(i, _c);
    }
    b1.instanceMatrix.needsUpdate = true;
    b2.instanceMatrix.needsUpdate = true;
    b3.instanceMatrix.needsUpdate = true;
    if (b1.instanceColor) b1.instanceColor.needsUpdate = true;
    if (b3.instanceColor) b3.instanceColor.needsUpdate = true;
    freezeInstanced(b1);
    freezeInstanced(b2);
    freezeInstanced(b3);
    group.add(b1, b2, b3);
  }

  for (const yard of maze.courtyards) {
    const sculpture = new THREE.Group();
    sculpture.position.set(yard.x, 0, yard.z);
    const base = boxMesh(1.15, 0.28, 1.15, PALETTE.ink);
    base.position.y = 0.2;
    const mid = boxMesh(0.72, 0.72, 0.72, PALETTE.sun);
    mid.position.y = 0.78;
    const top = boxMesh(0.42, 0.42, 0.42, PALETTE.pink);
    top.position.y = 1.38;
    const gem = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.28, 0)),
      trackMat(
        new THREE.MeshLambertMaterial({
          color: PALETTE.lime,
          emissive: PALETTE.lime,
          emissiveIntensity: 0.4,
        }),
      ),
    );
    gem.position.y = 1.78;
    gem.userData.spinY = 1.4;
    sculpture.add(base, mid, top, gem);
    spinners.push(gem);
    group.add(sculpture);

    const bannerTex = makeSignTexture("YARD", "#00D4E8");
    textures.push(bannerTex);
    const banner = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(1.8, 0.5)),
      trackMat(new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide, toneMapped: false })),
    );
    banner.position.set(yard.x, 2.85, yard.z);
    banner.userData.spinY = 0.25;
    spinners.push(banner);
    group.add(banner);
  }

  const warpColors = [PALETTE.cyan, PALETTE.pink, PALETTE.sun, PALETTE.lime];
  for (const pad of maze.teleporters) {
    const g = new THREE.Group();
    g.position.set(pad.x, 0, pad.z);
    const hue = warpColors[Math.floor(pad.id / 2) % warpColors.length]!;
    const ring = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 8)),
      trackMat(
        new THREE.MeshLambertMaterial({
          color: hue,
          emissive: hue,
          emissiveIntensity: 0.28,
        }),
      ),
    );
    ring.position.y = 0.08;
    const hoop = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.58, 0.07, 6, 8)),
      trackMat(
        new THREE.MeshLambertMaterial({
          color: PALETTE.ink,
          emissive: hue,
          emissiveIntensity: 0.18,
        }),
      ),
    );
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = 0.95;
    hoop.userData.spinY = 1.6;
    const core = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.22, 0.22, 0.22)),
      trackMat(
        new THREE.MeshLambertMaterial({
          color: PALETTE.sun,
          emissive: PALETTE.sun,
          emissiveIntensity: 0.4,
        }),
      ),
    );
    core.position.y = 0.95;
    core.userData.spinY = -2.1;
    g.add(ring, hoop, core);
    spinners.push(hoop, core);
    group.add(g);
  }

  for (const pad of maze.boosts) {
    const g = new THREE.Group();
    g.position.set(pad.x, 0.08, pad.z);
    const yaw = Math.atan2(pad.dx, pad.dz);
    g.rotation.y = yaw;
    const chev = boxMesh(0.55, 0.08, 0.85, PALETTE.sun);
    const tip = boxMesh(0.32, 0.1, 0.32, PALETTE.ink);
    tip.position.set(0, 0.02, -0.42);
    g.add(chev, tip);
    group.add(g);
  }

  for (const door of maze.doors) {
    const g = new THREE.Group();
    g.position.set(door.x, 0, door.z);
    if (door.dir === "e") g.rotation.y = Math.PI / 2;
    const slab = boxMesh(CELL * 0.92, WALL_H * 0.92, 0.16, PALETTE.pink);
    slab.position.y = WALL_H * 0.46;
    g.add(slab);
    for (let i = -1; i <= 1; i++) {
      const bar = boxMesh(0.12, WALL_H * 0.8, 0.2, PALETTE.ink);
      bar.position.set(i * 0.7, WALL_H * 0.45, 0);
      g.add(bar);
    }
    const tagTex = makeSignTexture("GATE", "#FF5A8A");
    textures.push(tagTex);
    const tag = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(1.1, 0.36)),
      trackMat(new THREE.MeshBasicMaterial({ map: tagTex, toneMapped: false })),
    );
    tag.position.set(0, 2.55, 0.12);
    g.add(tag);
    g.userData.doorId = door.id;
    doors.push(g);
    group.add(g);
  }

  const popPalette = [PALETTE.pink, PALETTE.sun, PALETTE.cyan, PALETTE.lime];
  for (const orb of maze.pops) {
    const wrap = new THREE.Group();
    wrap.position.set(orb.x, 1.05, orb.z);
    wrap.userData.popId = orb.id;
    wrap.userData.phase = orb.id * 1.3;
    const hue = popPalette[orb.id % popPalette.length]!;
    const shell = new THREE.Mesh(
      trackGeo(new THREE.IcosahedronGeometry(0.34, 0)),
      trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink })),
    );
    shell.scale.setScalar(1.12);
    const inner = new THREE.Mesh(
      trackGeo(new THREE.IcosahedronGeometry(0.3, 0)),
      trackMat(
        new THREE.MeshLambertMaterial({
          color: hue,
          emissive: hue,
          emissiveIntensity: 0.32,
        }),
      ),
    );
    inner.castShadow = true;
    wrap.add(shell, inner);
    wrap.userData.spinY = 0.9;
    pops.push(wrap);
    spinners.push(wrap);
    group.add(wrap);
  }
}

function buildSkyline(
  ox: number,
  oz: number,
  maze: MazeData,
  trackGeo: (g: THREE.BufferGeometry) => THREE.BufferGeometry,
  trackMat: <T extends THREE.Material>(m: T) => T,
): THREE.Group {
  const g = new THREE.Group();
  const geo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const ink = trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
  const fill = trackMat(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const count = 16;
  const outlines = new THREE.InstancedMesh(geo, ink, count);
  const bodies = new THREE.InstancedMesh(geo, fill, count);
  bodies.castShadow = true;
  const colors = [PALETTE.sun, PALETTE.cyan, PALETTE.pink, PALETTE.cream, PALETTE.lime];
  const radius = Math.max(maze.cols, maze.rows) * CELL * 0.5 + 10;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + 0.18;
    const d = radius + (i % 4) * 3.4;
    const h = 5 + (i % 6) * 2.8;
    const w = 2.2 + (i % 3) * 0.8;
    const x = ox + Math.cos(ang) * d;
    const z = oz + Math.sin(ang) * d;
    setInstance(outlines, i, x, h / 2, z, w + 0.16, h + 0.16, w + 0.16);
    setInstance(bodies, i, x, h / 2, z, w, h, w);
    _c.setHex(colors[i % colors.length]!);
    bodies.setColorAt(i, _c);
  }
  outlines.instanceMatrix.needsUpdate = true;
  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  freezeInstanced(outlines);
  freezeInstanced(bodies);
  outlines.castShadow = false;
  bodies.castShadow = false;
  g.add(outlines, bodies);
  return g;
}

function buildSun(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(22, 26, -16);
  const ink = new THREE.Mesh(
    new THREE.CircleGeometry(5.3, 8),
    new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.DoubleSide }),
  );
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(4.9, 8),
    new THREE.MeshBasicMaterial({
      color: PALETTE.sun,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  disc.position.z = 0.05;
  g.add(ink, disc);
  g.lookAt(0, 8, 8);
  return g;
}
