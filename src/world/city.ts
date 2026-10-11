import * as THREE from 'three';
import { VB, disposeObject } from '../core/voxel';
import { pick, rand, chance } from '../core/util';
import { Character } from '../entities/character';
import { randomAppearance } from '../entities/appearance';
import { backRoomRect } from './shop';

export const SIDEWALK_NEAR = [2.0, 3.3];
export const SIDEWALK_FAR = [12.6, 13.8];
export const STREET_HALF = 48;

export const nightMats = {
  window: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x8aa4c8 }),
  lamp: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xbbbbbb }),
};
nightMats.window.userData.shared = true;
nightMats.lamp.userData.shared = true;

const BRICKS = [0xb5543c, 0xa0472f, 0x8f5a43, 0xc76b4e, 0x9c6b52, 0xd8c3a5, 0xc9b79c, 0x7a6f68, 0xe0b8a0, 0x9fb3c8, 0xd4a5a5, 0xa7c4a0];

interface Car { group: THREE.Group; speed: number; dir: number; lane: number; wheels: THREE.Object3D[] }
interface Walker { ch: Character; dir: number; lane: number; pause: number; talkT: number; dog: THREE.Group | null }

function windowsVB(): VB { const v = new VB(); v.jitter = 0.25; return v; }

function finalize(vb: VB, win: VB, lamp: VB, parent: THREE.Group): void {
  const g = vb.build({ shadow: true });
  parent.add(g);
  const wg = win.geometry('solid');
  if (wg) parent.add(new THREE.Mesh(wg, nightMats.window));
  const lg = lamp.geometry('solid');
  if (lg) parent.add(new THREE.Mesh(lg, nightMats.lamp));
}

function building(vb: VB, win: VB, x0: number, x1: number, z0: number, z1: number, h: number, color: number, facing: 1 | -1, opts: { stoop?: boolean; storefront?: string; fireEscape?: boolean; waterTower?: boolean }) {
  const w = x1 - x0, d = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  vb.box(cx, h / 2, cz, w - 0.05, h, d, color);
  // Gesims
  vb.box(cx, h + 0.15, cz, w + 0.1, 0.3, d + 0.1, new THREE.Color(color).multiplyScalar(0.8).getHex());
  const fz = facing === 1 ? z1 : z0;
  const off = facing * 0.03;
  // Fenster
  const floors = Math.floor((h - 1.2) / 2.2);
  const cols = Math.max(1, Math.floor((w - 0.8) / 1.5));
  const startFloor = opts.storefront ? 1 : 0;
  for (let f = startFloor; f < floors; f++) {
    const y = 1.6 + f * 2.2;
    for (let c = 0; c < cols; c++) {
      const x = x0 + 0.4 + (w - 0.8) * (c + 0.5) / cols;
      vb.box(x, y, fz + off, 0.95, 1.35, 0.06, 0xf2ece2);
      const lit = chance(0.45);
      win.box(x, y, fz + off * 2, 0.75, 1.15, 0.04, lit ? 0xffe2a6 : 0x6f86a8);
      vb.box(x, y - 0.72, fz + facing * 0.1, 1.0, 0.08, 0.2, 0xe8e0d0);
    }
  }
  if (opts.storefront) {
    vb.box(cx, 1.4, fz + off, w - 0.6, 2.2, 0.06, 0x3a3a3a);
    win.box(cx, 1.3, fz + off * 2, w - 1.0, 1.7, 0.04, 0xfff0c0);
    vb.box(cx, 2.75, fz + facing * 0.08, w - 0.4, 0.5, 0.14, pick([0x2e5e4e, 0x7a2e3a, 0x355070, 0x6d597a]));
    // kleine Markise
    for (let i = 0; i < Math.floor((w - 0.6) / 0.5); i++) {
      vb.box(x0 + 0.55 + i * 0.5, 2.4, fz + facing * 0.45, 0.5, 0.08, 0.8, i % 2 ? 0xffffff : pick([0x3bb273, 0xe84855, 0x4d9de0]));
    }
  }
  if (opts.stoop) {
    const sx = cx + rand(-w / 4, w / 4);
    for (let i = 0; i < 4; i++) vb.box(sx, 0.15 + i * 0.25, fz + facing * (1.2 - i * 0.3), 1.3, 0.3 + i * 0.25, 0.3, 0xb09080);
    vb.box(sx, 1.5, fz + off, 1.1, 2.2, 0.06, 0x4a2f22);
  }
  if (opts.fireEscape && floors > 2) {
    const ex = x0 + w * 0.3;
    for (let f = 1; f < floors; f++) {
      const y = 0.8 + f * 2.2;
      vb.box(ex, y, fz + facing * 0.5, 2.0, 0.06, 0.9, 0x2a2a2a);
      vb.box(ex, y + 0.45, fz + facing * 0.92, 2.0, 0.05, 0.05, 0x2a2a2a);
      for (let k = 0; k < 5; k++) vb.box(ex - 0.95 + k * 0.475, y + 0.22, fz + facing * 0.92, 0.04, 0.45, 0.04, 0x2a2a2a);
      vb.box(ex + (f % 2 ? 0.4 : -0.4), y + 1.1, fz + facing * 0.5, 0.25, 2.2, 0.06, 0x2a2a2a);
    }
  }
  if (opts.waterTower) {
    const tx = cx + rand(-w / 4, w / 4), tz = cz;
    for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) vb.box(tx + lx, h + 0.8, tz + lz, 0.1, 1.6, 0.1, 0x3a3a3a);
    vb.box(tx, h + 2.4, tz, 1.5, 1.8, 1.5, 0x8b6a4a);
    vb.box(tx, h + 3.5, tz, 1.1, 0.4, 1.1, 0x5a5a5a);
    vb.box(tx, h + 3.8, tz, 0.5, 0.25, 0.5, 0x5a5a5a);
  } else if (chance(0.6)) {
    vb.box(cx + rand(-w / 3, w / 3), h + 0.55, cz, 1.0, 0.6, 0.8, 0xb8bec6);
  }
}

function carModel(kind: 'taxi' | 'sedan' | 'van' | 'bus'): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const vb = new VB();
  const lamp = new VB();
  const wheels: THREE.Object3D[] = [];
  let L = 3.4, Wd = 1.6, bodyH = 0.6, color = 0xf7c531;
  if (kind === 'sedan') color = pick([0xe84855, 0x4d9de0, 0xffffff, 0x2f3542, 0x3bb273, 0xb48cf2, 0xff8c5a]);
  if (kind === 'van') { L = 4.0; color = pick([0xffffff, 0xd8e2ea, 0x7fd6b4]); }
  if (kind === 'bus') { L = 8.5; Wd = 2.0; color = 0x2a6fd6; }
  const y0 = 0.35;
  if (kind === 'bus') {
    vb.box(0, y0 + 1.2, 0, L, 2.3, Wd, color);
    vb.box(0, y0 + 1.6, 0, L - 0.6, 0.7, Wd + 0.02, 0x9fd4ff, 'glass');
    vb.box(0, y0 + 0.5, 0, L + 0.02, 0.15, Wd + 0.02, 0xffffff);
    vb.box(0, y0 + 2.4, 0, L - 0.4, 0.15, Wd - 0.4, 0xd8d8d8);
  } else {
    vb.box(0, y0 + bodyH / 2, 0, L, bodyH, Wd, color);
    const cabL = kind === 'van' ? L - 0.8 : L * 0.55;
    const cabX = kind === 'van' ? -0.3 : -0.1;
    vb.box(cabX, y0 + bodyH + 0.3, 0, cabL, 0.6, Wd - 0.15, color);
    vb.box(cabX, y0 + bodyH + 0.3, 0, cabL - 0.15, 0.45, Wd - 0.12, 0x9fd4ff, 'glass');
    vb.box(cabX + cabL / 2 - 0.04, y0 + bodyH + 0.3, 0, 0.1, 0.45, Wd - 0.3, 0x7fb8e0);
    if (kind === 'taxi') {
      vb.box(cabX, y0 + bodyH + 0.68, 0, 0.5, 0.15, 0.3, 0xffffff);
      for (let i = 0; i < 8; i++) vb.box(-L / 2 + 0.3 + i * 0.4, y0 + 0.35, Wd / 2 + 0.005, 0.2, 0.1, 0.01, i % 2 ? 0x111111 : 0xffffff, 'solid', 0);
      for (let i = 0; i < 8; i++) vb.box(-L / 2 + 0.3 + i * 0.4, y0 + 0.35, -Wd / 2 - 0.005, 0.2, 0.1, 0.01, i % 2 ? 0x111111 : 0xffffff, 'solid', 0);
    }
  }
  vb.box(L / 2 + 0.02, y0 + 0.2, 0, 0.06, 0.15, Wd - 0.2, 0xcccccc);
  vb.box(-L / 2 - 0.02, y0 + 0.2, 0, 0.06, 0.15, Wd - 0.2, 0xcccccc);
  lamp.box(L / 2 + 0.03, y0 + 0.4, Wd / 2 - 0.25, 0.04, 0.12, 0.25, 0xfffbe0);
  lamp.box(L / 2 + 0.03, y0 + 0.4, -Wd / 2 + 0.25, 0.04, 0.12, 0.25, 0xfffbe0);
  vb.box(-L / 2 - 0.03, y0 + 0.4, Wd / 2 - 0.25, 0.04, 0.12, 0.25, 0xff3040, 'glow');
  vb.box(-L / 2 - 0.03, y0 + 0.4, -Wd / 2 + 0.25, 0.04, 0.12, 0.25, 0xff3040, 'glow');
  const group = new THREE.Group();
  finalize(vb, new VB(), lamp, group);
  const wx = L / 2 - (kind === 'bus' ? 1.2 : 0.7);
  for (const x of [-wx, wx]) {
    for (const z of [-Wd / 2, Wd / 2]) {
      const wv = new VB();
      wv.box(0, 0, 0, 0.6, 0.6, 0.25, 0x1e1e1e);
      wv.box(0, 0, z > 0 ? 0.13 : -0.13, 0.3, 0.3, 0.02, 0xbfbfbf);
      wv.box(0, 0.2, 0, 0.12, 0.12, 0.27, 0x444444);
      const wg = wv.build();
      wg.position.set(x, 0.32, z);
      group.add(wg);
      wheels.push(wg);
    }
  }
  return { group, wheels };
}

function dogModel(): THREE.Group {
  const vb = new VB();
  const c = pick([0xc9a26b, 0x6b4a2b, 0xffffff, 0x2b2b2b, 0xe8d0a0]);
  vb.box(0, 0.3, 0, 0.22, 0.2, 0.5, c);
  vb.box(0, 0.45, 0.3, 0.2, 0.2, 0.2, c);
  vb.box(0, 0.42, 0.42, 0.1, 0.08, 0.08, 0x2b2b2b);
  vb.box(-0.08, 0.57, 0.28, 0.05, 0.08, 0.06, 0x3a2a1a);
  vb.box(0.08, 0.57, 0.28, 0.05, 0.08, 0.06, 0x3a2a1a);
  vb.box(0, 0.42, -0.28, 0.05, 0.05, 0.15, c);
  for (const [x, z] of [[-0.07, -0.18], [0.07, -0.18], [-0.07, 0.18], [0.07, 0.18]]) vb.box(x, 0.1, z, 0.06, 0.2, 0.06, c);
  vb.box(0, 0.46, 0.18, 0.21, 0.04, 0.05, 0xe84855);
  return vb.build();
}

export class City {
  readonly group = new THREE.Group();
  private staticGroup = new THREE.Group();
  private neighborGroup = new THREE.Group();
  cars: Car[] = [];
  walkers: Walker[] = [];
  streetLights: THREE.PointLight[] = [];
  onSay: ((ch: Character, text: string) => void) | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.group.add(this.staticGroup, this.neighborGroup);
    this.buildStatic();
    this.spawnCars();
    this.spawnWalkers(18);
  }

  private buildStatic(): void {
    const vb = new VB();
    const win = windowsVB();
    const lamp = new VB();
    const H = STREET_HALF + 20;
    // Bürgersteige
    for (let x = -H; x < H; x += 2) {
      vb.cube(x, -0.1, 0, 2, 0.22, 4.5, (x / 2) % 2 ? 0xd9d5cf : 0xd1ccc5, 'solid', 0.02);
      vb.cube(x, -0.1, 11.5, 2, 0.22, 3.5, (x / 2) % 2 ? 0xd9d5cf : 0xd1ccc5, 'solid', 0.02);
      vb.cube(x, -0.14, -18, 2, 0.1, 18, 0x9a958f, 'solid', 0.02);
    }
    vb.cube(-H, 0.0, 4.35, 2 * H, 0.14, 0.18, 0xb9b4ad, 'solid', 0);
    vb.cube(-H, 0.0, 11.45, 2 * H, 0.14, 0.18, 0xb9b4ad, 'solid', 0);
    // Straße
    vb.cube(-H, -0.15, 4.5, 2 * H, 0.15, 7, 0x4a4b52, 'solid', 0.02);
    for (let x = -H; x < H; x += 3) vb.cube(x, 0.001, 7.95, 1.6, 0.01, 0.1, 0xf7c531, 'solid', 0);
    // Zebrastreifen
    for (const cx of [-16, 18]) for (let z = 4.8; z < 11.3; z += 0.7) vb.cube(cx - 1.2, 0.002, z, 2.4, 0.01, 0.4, 0xf2f2f2, 'solid', 0);
    // gegenüberliegende Häuser
    let x = -H;
    let i = 0;
    while (x < H) {
      const w = rand(6, 10);
      const h = rand(9, 20);
      building(vb, win, x, x + w, 15, 15 + rand(7, 10), h, pick(BRICKS), -1, {
        stoop: chance(0.4), fireEscape: chance(0.6), waterTower: chance(0.3), storefront: chance(0.45) ? 'x' : undefined,
      });
      x += w;
      i++;
    }
    // Laternen, Bäume, Hydranten, Briefkasten, Bänke
    for (let lx = -H + 4; lx < H; lx += 12) {
      for (const lz of [4.05, 11.9]) {
        vb.box(lx, 2.0, lz, 0.14, 4.0, 0.14, 0x2a3a30);
        vb.box(lx, 0.15, lz, 0.3, 0.3, 0.3, 0x2a3a30);
        const dir = lz < 8 ? 1 : -1;
        vb.box(lx, 4.0, lz + dir * 0.4, 0.1, 0.1, 0.9, 0x2a3a30);
        vb.box(lx, 3.9, lz + dir * 0.85, 0.4, 0.15, 0.4, 0x2a3a30);
        lamp.box(lx, 3.78, lz + dir * 0.85, 0.32, 0.1, 0.32, 0xfff1c9);
      }
    }
    for (let tx = -H + 9; tx < H; tx += 12) {
      for (const tz of [3.6, 12.4]) {
        if (Math.abs(tx) < 9 && tz < 8) continue;
        vb.box(tx, 0.06, tz, 1.0, 0.1, 1.0, 0x6b4f3a);
        vb.box(tx, 1.0, tz, 0.2, 2.0, 0.2, 0x6b4f3a);
        for (let k = 0; k < 7; k++) vb.box(tx + rand(-0.6, 0.6), 2.3 + rand(0, 1.2), tz + rand(-0.6, 0.6), 0.9, 0.8, 0.9, pick([0x4caf50, 0x5cbf60, 0x3f9b4a, 0x6cc56f]), 'solid', 0.08);
      }
    }
    const hydrant = (hx: number, hz: number) => {
      vb.box(hx, 0.3, hz, 0.25, 0.6, 0.25, 0xd23d3d);
      vb.box(hx, 0.65, hz, 0.18, 0.12, 0.18, 0xd23d3d);
      vb.box(hx, 0.4, hz, 0.4, 0.1, 0.1, 0xd23d3d);
    };
    hydrant(-10.5, 3.9); hydrant(22, 12.2);
    // Briefkasten
    vb.box(-14, 0.55, 3.9, 0.6, 1.1, 0.5, 0x2a5aa8);
    vb.box(-14, 1.15, 3.9, 0.62, 0.15, 0.52, 0x2a5aa8);
    // Bank
    vb.box(14, 0.45, 12.3, 1.8, 0.08, 0.5, 0x8c6239);
    vb.box(14, 0.75, 12.55, 1.8, 0.4, 0.06, 0x8c6239);
    vb.box(13.3, 0.22, 12.3, 0.08, 0.44, 0.45, 0x2a2a2a);
    vb.box(14.7, 0.22, 12.3, 0.08, 0.44, 0.45, 0x2a2a2a);
    // Hot-Dog-Wagen
    vb.box(-22, 0.7, 12.6, 2.0, 0.9, 1.0, 0xe8e8e8);
    vb.box(-22, 1.3, 12.6, 2.0, 0.05, 1.0, 0xc0392b);
    for (let k = 0; k < 4; k++) vb.box(-22.75 + k * 0.5, 2.1, 12.6, 0.5, 0.06, 1.4, k % 2 ? 0xffd45e : 0xe84855);
    vb.box(-22.9, 1.7, 12.6, 0.06, 0.8, 0.06, 0x888888);
    vb.box(-21.1, 1.7, 12.6, 0.06, 0.8, 0.06, 0x888888);
    vb.box(-22.6, 0.3, 12.1, 0.5, 0.5, 0.06, 0x333333);
    vb.box(-21.4, 0.3, 12.1, 0.5, 0.5, 0.06, 0x333333);
    // Mülleimer
    vb.box(9.5, 0.45, 4.0, 0.5, 0.9, 0.5, 0x3a5a40);
    // U-Bahn-Eingang
    vb.box(28, 1.2, 12.9, 0.1, 2.4, 0.1, 0x2e5e4e);
    vb.box(28, 2.5, 12.9, 0.4, 0.4, 0.4, 0x3bb273);
    lamp.box(28, 2.5, 12.9, 0.42, 0.25, 0.42, 0xffffff);
    vb.box(30, 0.5, 13.4, 3.0, 1.0, 0.1, 0x2e5e4e);
    finalize(vb, win, lamp, this.staticGroup);
    // Ferne Skyline
    const sky = new VB();
    for (let k = 0; k < 18; k++) {
      const sx = -70 + k * 8 + rand(-2, 2);
      const sh = rand(20, 45);
      sky.box(sx, sh / 2, 40 + rand(0, 15), rand(5, 9), sh, 6, pick([0xb5c2d6, 0xa6b5cc, 0xc5cfdf, 0x98a8c0]), 'solid', 0.03);
    }
    sky.box(-6, 30, 50, 6, 60, 6, 0xb0bccf).box(-6, 63, 50, 3, 6, 3, 0xb0bccf).box(-6, 70, 50, 0.4, 8, 0.4, 0x9aa6b8);
    const sg = sky.build({ shadow: false, receive: false });
    this.staticGroup.add(sg);
  }

  buildNeighbors(W: number, D: number): void {
    disposeObject(this.neighborGroup);
    this.neighborGroup = new THREE.Group();
    this.group.add(this.neighborGroup);
    const vb = new VB();
    const win = windowsVB();
    const lamp = new VB();
    const H = STREET_HALF + 20;
    const shopNames = ['Bäckerei', 'Waschsalon', 'Blumen', 'Pizza', 'Bodega', 'Bücher'];
    for (const side of [-1, 1]) {
      let x = W / 2 + 0.3;
      let first = true;
      while (x < H) {
        const w = first ? 7 : rand(7, 11);
        const h = first ? 4.4 : rand(8, 16);
        const a = side > 0 ? x : -x - w;
        building(vb, win, a, a + w, -16, 0, h, pick(BRICKS), 1, {
          storefront: first || chance(0.5) ? pick(shopNames) : undefined,
          fireEscape: !first && chance(0.5),
          waterTower: !first && chance(0.35),
          stoop: !first && chance(0.3),
        });
        x += w;
        first = false;
      }
    }
    // Rückseite des Ladens: Hinterhof – neben und hinter dem Nebenraum
    const B = backRoomRect(W, D);
    const x0 = B.x1 + 0.3, x1 = W / 2 + 0.5;
    vb.box((x0 + x1) / 2, -0.05, -D - 3, x1 - x0, 0.1, 6, 0x8f8a84);
    vb.box((-W / 2 - 0.5 + x0) / 2, -0.05, -D - 4.65, x0 + W / 2 + 0.5, 0.1, 2.7, 0x8f8a84);
    vb.box(W / 2 - 1, 0.5, -D - 1.2, 1.2, 1.0, 0.8, 0x3a5a40);
    vb.box(W / 2 - 2.5, 0.4, -D - 1.0, 0.8, 0.8, 0.8, 0x8c6239);
    finalize(vb, win, lamp, this.neighborGroup);
  }

  private spawnCars(): void {
    const kinds: ('taxi' | 'sedan' | 'van' | 'bus')[] = ['taxi', 'taxi', 'taxi', 'sedan', 'sedan', 'van', 'taxi', 'bus', 'sedan', 'taxi'];
    kinds.forEach((k, i) => {
      const { group, wheels } = carModel(k);
      const dir = i % 2 ? 1 : -1;
      const lane = dir > 0 ? 6.3 : 9.7;
      group.position.set(rand(-STREET_HALF, STREET_HALF), 0, lane);
      group.rotation.y = dir > 0 ? 0 : Math.PI;
      this.group.add(group);
      this.cars.push({ group, wheels, dir, lane, speed: k === 'bus' ? 4 : rand(5, 9) });
    });
  }

  private spawnWalkers(n: number): void {
    for (let i = 0; i < n; i++) {
      const near = i % 3 !== 0;
      const lanes = near ? SIDEWALK_NEAR : SIDEWALK_FAR;
      const lane = pick(lanes) + rand(-0.2, 0.2);
      const ch = new Character(randomAppearance({ kid: chance(0.1), old: chance(0.15) }));
      ch.speed = rand(1.2, 2.0);
      const dir = chance(0.5) ? 1 : -1;
      ch.root.position.set(rand(-STREET_HALF, STREET_HALF), 0, lane);
      ch.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(ch.root);
      let dog: THREE.Group | null = null;
      if (chance(0.2)) {
        dog = dogModel();
        this.group.add(dog);
      }
      this.walkers.push({ ch, dir, lane, pause: 0, talkT: rand(5, 40), dog });
    }
  }

  update(dt: number, night: number): void {
    for (const c of this.cars) {
      c.group.position.x += c.dir * c.speed * dt;
      if (c.group.position.x > STREET_HALF + 10) c.group.position.x = -STREET_HALF - 10;
      if (c.group.position.x < -STREET_HALF - 10) c.group.position.x = STREET_HALF + 10;
      for (const w of c.wheels) w.rotation.z -= (c.speed * dt) / 0.3;
    }
    for (const w of this.walkers) {
      const p = w.ch.root.position;
      if (w.pause > 0) {
        w.pause -= dt;
        w.ch.animate(dt, false);
      } else {
        p.x += w.dir * w.ch.speed * dt;
        w.ch.root.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        w.ch.animate(dt, true);
        if (chance(dt * 0.02)) w.pause = rand(1.5, 4);
      }
      if (p.x > STREET_HALF) { p.x = -STREET_HALF; }
      if (p.x < -STREET_HALF) { p.x = STREET_HALF; }
      w.talkT -= dt;
      if (w.talkT < 0) {
        w.talkT = rand(15, 60);
        if (Math.abs(p.x) < 14 && this.onSay) this.onSay(w.ch, pick(['Taxi! TAXI!', 'Hast du das gesehen?', 'Nur noch ein Block…', 'Ich bin spät dran!', 'Schönes Wetter heute!', 'Ist das ein neuer Laden?', 'Hey, Frozen Yogurt!', 'Fuhgeddaboudit!', 'Ich lauf hier!', 'Wuff!']));
      }
      if (w.dog) {
        const d = w.dog.position;
        const tx = p.x + w.dir * 0.9, tz = p.z + 0.5;
        const moving = w.pause <= 0;
        d.x += (tx - d.x) * Math.min(1, dt * 5);
        d.z += (tz - d.z) * Math.min(1, dt * 5);
        w.dog.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        d.y = moving ? Math.abs(Math.sin(performance.now() / 90)) * 0.06 : 0;
      }
    }
    // Nachtmaterialien
    nightMats.window.color.setRGB(0.45 + night * 0.6, 0.55 + night * 0.4, 0.75 - night * 0.2);
    nightMats.lamp.color.setScalar(0.7 + night * 0.5);
  }
}
