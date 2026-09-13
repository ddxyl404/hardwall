import * as THREE from "three";
import { CELL, PALETTE } from "./constants";
import type { MazeData, PickupSpec } from "./maze";
import { cellCenter } from "./maze";

export type WorldHandle = {
  group: THREE.Group;
  pickups: THREE.Object3D[];
  exitPos: THREE.Vector3;
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

function makeSignTexture(text: string, bg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = "#111111";
  g.lineWidth = 18;
  g.strokeRect(10, 10, 492, 172);
  g.fillStyle = "#111111";
  g.font = '900 110px "Archivo Black", system-ui, sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 104);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function boxMesh(
  sx: number,
  sy: number,
  sz: number,
  color: number,
  outlined = true,
): THREE.Group {
  const g = new THREE.Group();
  if (outlined) {
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(sx + 0.1, sy + 0.1, sz + 0.1),
      new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
    );
    g.add(shell);
  }
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshLambertMaterial({ color }),
  );
  core.castShadow = true;
  core.receiveShadow = true;
  g.add(core);
  return g;
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
    new THREE.PlaneGeometry(maze.cols * CELL + 8, maze.rows * CELL + 8),
  );
  const groundMat = trackMat(
    new THREE.MeshLambertMaterial({ color: PALETTE.ink }),
  );
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(originX, -0.04, originZ);
  ground.receiveShadow = true;
  group.add(ground);

  const tileGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const tileMat = trackMat(
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  const tileCount = maze.cols * maze.rows;
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, tileCount);
  tiles.receiveShadow = true;
  tiles.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  let ti = 0;
  for (let z = 0; z < maze.rows; z++) {
    for (let x = 0; x < maze.cols; x++) {
      const c = cellCenter(x, z);
      let color: number = PALETTE.floor;
      const h = (x * 3 + z * 7 + maze.seed) % 13;
      if (x === maze.start.cx && z === maze.start.cz) color = PALETTE.sun;
      else if (x === maze.exit.cx && z === maze.exit.cz) color = PALETTE.lime;
      else if (h === 0) color = PALETTE.sun;
      else if (h === 1) color = PALETTE.cyan;
      setInstance(tiles, ti, c.x, 0.05, c.z, CELL * 0.9, 0.1, CELL * 0.9);
      _c.setHex(color);
      tiles.setColorAt(ti, _c);
      ti++;
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  group.add(tiles);

  const wallGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const inkMat = trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
  const wallMat = trackMat(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const n = maze.walls.length;
  const outlines = new THREE.InstancedMesh(wallGeo, inkMat, n);
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, n);
  walls.castShadow = true;
  walls.receiveShadow = true;
  outlines.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  walls.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  maze.walls.forEach((w, i) => {
    setInstance(outlines, i, w.x, w.y, w.z, w.sx + 0.1, w.sy + 0.1, w.sz + 0.1);
    setInstance(walls, i, w.x, w.y, w.z, w.sx, w.sy, w.sz);
    _c.setHex(w.color);
    walls.setColorAt(i, _c);
  });
  outlines.instanceMatrix.needsUpdate = true;
  walls.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  group.add(outlines);
  group.add(walls);

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
  exitGroup.add(crystal);

  const glow = new THREE.PointLight(PALETTE.lime, 2.2, 8, 2);
  glow.position.set(0, 1.4, 0);
  exitGroup.add(glow);
  group.add(exitGroup);

  const pickups: THREE.Object3D[] = [];
  maze.pickups.forEach((p) => pickups.push(makePickup(p, trackGeo, trackMat)));
  pickups.forEach((m) => group.add(m));

  const skyline = buildSkyline(originX, originZ, maze, trackGeo, trackMat);
  group.add(skyline);

  const sun = buildSun();
  group.add(sun);

  return {
    group,
    pickups,
    exitPos: new THREE.Vector3(exitC.x, 0, exitC.z),
    dispose: () => {
      group.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
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

  const color =
    spec.kind === 0 ? PALETTE.sun : spec.kind === 1 ? PALETTE.cyan : PALETTE.pink;
  const ink = trackMat(new THREE.MeshBasicMaterial({ color: PALETTE.ink }));
  const fill = trackMat(
    new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.18,
    }),
  );

  let inner: THREE.Mesh;
  let shell: THREE.Mesh;
  if (spec.kind === 0) {
    shell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.48, 0.48)), ink);
    inner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.4, 0.4)), fill);
  } else if (spec.kind === 1) {
    shell = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.34, 0)), ink);
    shell.scale.setScalar(1.12);
    inner = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.3, 0)), fill);
  } else {
    shell = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.32, 0)), ink);
    shell.scale.setScalar(1.12);
    inner = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.28, 0)), fill);
  }
  inner.castShadow = true;
  wrap.add(shell, inner);
  wrap.userData.inner = inner;
  return wrap;
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
  const colors = [PALETTE.sun, PALETTE.cyan, PALETTE.pink, PALETTE.white, PALETTE.lime];
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


