import * as THREE from 'three';
import { VB, disposeObject } from '../core/voxel';
import { NavGrid, P2 } from '../core/path';
import { GameState, PlacedItem } from '../game/state';
import {
  LEVELS, PLACEABLE_BY_ID, THEME_BY_ID, TOPPINGS, FLAVORS, DRINKS, LICHTERKETTE, Placeable,
} from '../data/catalog';
import {
  COUNTER_H, zapferModel, eismaschineModel, waffleIronModel, coffeeModel, trashModel, storageFridgeModel,
  drinksFridgeModel, registerModel, toppingBarModel, placeableModel, signTexture, matchaBarModel, WaffleIronParts,
  ruehrwerkModel, basisRegalModel, sinkModel, MixerParts, tonneModel,
} from './models';

export const WALL_H = 3.2;

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface Station {
  id: string;
  x: number;
  /** Interaktionspunkt des Spielers */
  ix: number;
  iz: number;
  group: THREE.Group;
  /** wohin der Spieler beim Benutzen schaut (Standard: zur Rückwand) */
  face?: P2;
  /** zusätzliche Reichweite (große Geräte, die man von mehreren Seiten benutzt) */
  reach?: number;
}

export interface Seat {
  uid: number;
  x: number;
  z: number;
  angle: number;
  height: number;
  tableUid: number | null;
  occupant: unknown | null;
}

export interface TableInfo {
  uid: number;
  x: number;
  z: number;
  seats: Seat[];
  claimedBy: unknown | null;
  /** Geschirr steht noch drauf – erst abräumen, dann setzt sich wieder jemand */
  dirty?: boolean;
}

export interface Layout {
  W: number;
  D: number;
  counterZ: number;
  counterX0: number;
  counterX1: number;
  regX: number;
  ausgabeX: number;
  tbX: number;
  tbW: number;
  doorX: number;
  doorW: number;
  queueSpots: P2[];
  pickupSpots: P2[];
  fridgeSpot: P2;
  fridgePos: P2;
  doorIn: P2;
  doorOut: P2;
  placeArea: Rect;
  reserved: Rect[];
  /** Nebenraum (Produktion) hinter der Rückwand */
  back: Rect;
  /** Durchgang in der Rückwand (x von/bis) */
  backDoor: [number, number];
}

/** Nebenraum hinten links (vom Spieler aus gesehen rechts) – auch für die Stadt (Hinterhof) */
export function backRoomRect(W: number, D: number): Rect {
  return { x0: -W / 2, z0: -D - 3, x1: -W / 2 + 4.5, z1: -D };
}

const SLOT_ORDER = ['vorratskuehlschrank', 'trash', 'kaffeemaschine', 'matchabar', 'zapfer', 'eismaschine', 'waffeleisen'];

export function computeLayout(level: number, toppingCount: number): Layout {
  const { w: W, d: D } = LEVELS[level];
  const counterZ = -D + 3;
  const counterX0 = -W / 2 + 0.15;
  const counterX1 = W / 2 - 1.5;
  const regX = W / 2 - 4;
  const ausgabeX = regX - 1.4;
  const cols = Math.ceil(Math.max(1, toppingCount) / 2);
  const tbW = Math.max(1.4, cols * 0.3 + 0.2);
  const tbX = ausgabeX - 0.7 - tbW / 2;
  const doorX = W / 2 - 2.5;
  const doorW = 1.4;
  const queueSpots: P2[] = [];
  for (let z = counterZ + 0.95; z < -0.9; z += 0.8) queueSpots.push({ x: regX, z });
  const pickupSpots: P2[] = [];
  for (let x = ausgabeX - 0.1; x > -W / 2 + 0.6; x -= 0.85) pickupSpots.push({ x, z: counterZ + 0.95 });
  for (let x = ausgabeX - 0.5; x > -W / 2 + 0.6; x -= 0.85) pickupSpots.push({ x, z: counterZ + 1.75 });
  const fridgePos = { x: W / 2 - 0.45, z: counterZ + 1.6 };
  const fridgeSpot = { x: W / 2 - 1.25, z: counterZ + 1.6 };
  const reserved: Rect[] = [
    { x0: regX - 0.45, z0: counterZ + 0.4, x1: regX + 0.45, z1: 0 },
    { x0: -W / 2, z0: counterZ + 0.4, x1: ausgabeX + 0.4, z1: counterZ + 2.15 },
    { x0: doorX - 0.85, z0: -1.4, x1: doorX + 0.85, z1: 0 },
    { x0: W / 2 - 1.7, z0: counterZ + 0.4, x1: W / 2, z1: counterZ + 2.3 },
  ];
  return {
    W, D, counterZ, counterX0, counterX1, regX, ausgabeX, tbX, tbW, doorX, doorW,
    queueSpots, pickupSpots, fridgeSpot, fridgePos,
    doorIn: { x: doorX, z: -0.6 },
    doorOut: { x: doorX, z: 1.0 },
    placeArea: { x0: -W / 2 + 0.2, z0: counterZ + 0.4, x1: W / 2 - 0.2, z1: -0.2 },
    reserved,
    back: backRoomRect(W, D),
    backDoor: [-W / 2 + 0.4, -W / 2 + 1.9],
  };
}

export function itemRect(type: string, x: number, z: number, rot: number): Rect {
  const p = PLACEABLE_BY_ID.get(type)!;
  const quarter = Math.round(rot / (Math.PI / 2)) % 2 !== 0;
  const w = quarter ? p.d : p.w;
  const d = quarter ? p.w : p.d;
  return { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 };
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;
}

const SEAT_HEIGHT: Record<string, number> = { stuhl: 0.48, polsterstuhl: 0.52, hocker: 0.55, sitzsack: 0.32 };

export class Shop {
  readonly group = new THREE.Group();
  readonly furniture = new THREE.Group();
  layout!: Layout;
  nav!: NavGrid;
  colliders: Rect[] = [];
  stations = new Map<string, Station>();
  waffle: WaffleIronParts | null = null;
  mixer: MixerParts | null = null;
  seats: Seat[] = [];
  tables: TableInfo[] = [];
  furnitureMeshes = new Map<number, THREE.Group>();
  lights: THREE.PointLight[] = [];
  fairyLights: THREE.Group | null = null;
  signMat: THREE.MeshBasicMaterial | null = null;
  cozy = 0;
  private roomGroup = new THREE.Group();

  constructor(private scene: THREE.Scene) {
    scene.add(this.group);
    this.group.add(this.roomGroup, this.furniture);
  }

  rebuild(state: GameState): void {
    // bestehende Sitzbelegungen merken
    const oldSeats = new Map(this.seats.map((s) => [s.uid, s.occupant]));
    const oldTables = new Map(this.tables.map((t) => [t.uid, t.claimedBy]));
    const unlockedToppings = TOPPINGS.filter((t) => state.unlocked.includes(t.id));
    this.layout = computeLayout(state.level, unlockedToppings.length);
    disposeObject(this.roomGroup);
    this.roomGroup = new THREE.Group();
    this.group.add(this.roomGroup);
    this.colliders = [];
    this.stations.clear();
    this.buildRoom(state);
    this.buildStations(state);
    this.buildFurniture(state);
    for (const s of this.seats) s.occupant = oldSeats.get(s.uid) ?? null;
    for (const t of this.tables) t.claimedBy = oldTables.get(t.uid) ?? null;
    this.computeCozy(state);
  }

  private buildRoom(state: GameState): void {
    const L = this.layout;
    const { W, D } = L;
    const wallTheme = THEME_BY_ID.get(state.theme.wall)!;
    const floorTheme = THEME_BY_ID.get(state.theme.floor)!;
    const awning = THEME_BY_ID.get(state.theme.awning)!;
    const vb = new VB();
    // Gummimatte hinter der Theke: Fläche, unter der keine Fugen/Sprenkel liegen dürfen –
    // sonst liegen deren Oberseiten auf gleicher Höhe wie die Matte und flackern (Z-Fighting)
    const matX1 = W / 2 - 1.6, matZ1 = L.counterZ - 0.4;
    const underMat = (x: number, z: number) => x < matX1 && z < matZ1;
    // Boden
    for (let x = -W / 2; x < W / 2; x += 1) {
      for (let z = -D; z < 0; z += 1) {
        const ix = Math.round(x + W / 2), iz = Math.round(z + D);
        let c: number;
        const cs = floorTheme.colors;
        if (floorTheme.id === 'floor_holz') c = cs[(ix + (iz % 2) * 2) % 2] ?? cs[0];
        else if (floorTheme.id === 'floor_terrazzo') c = cs[0];
        else c = cs[(ix + iz) % 2];
        vb.cube(x, -0.1, z, 1, 0.1, 1, c, 'solid', 0.03);
        if (floorTheme.id === 'floor_holz' && !underMat(x + 0.5, z + 0.5)) {
          vb.cube(x, 0, z + 0.46, 1, 0.012, 0.08, 0xb08a62, 'solid', 0);
        }
        if (floorTheme.id === 'floor_terrazzo') {
          for (let k = 0; k < 3; k++) {
            const px = x + Math.random() * 0.85, pz = z + Math.random() * 0.85;
            if (!underMat(px + 0.07, pz + 0.06)) vb.cube(px, 0, pz, 0.14, 0.01, 0.12, cs[1 + (k % 2)], 'solid', 0);
          }
        }
      }
    }
    // Gummimatte hinter der Theke
    vb.cube(-W / 2, 0, -D, matX1 + W / 2, 0.025, matZ1 + D, 0x6b6470, 'solid', 0.02);

    const wc = wallTheme.colors[0];
    const wc2 = wallTheme.colors[1];
    const T = 0.3;
    // Seitenwände
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + T / 2);
      vb.box(x, WALL_H / 2, -D / 2, T, WALL_H, D, wc);
      vb.box(x - sx * 0.155, 0.5, -D / 2, 0.01, 1.0, D, wc2, 'solid', 0);
      vb.box(x - sx * 0.16, 1.02, -D / 2, 0.02, 0.05, D, 0xffffff, 'solid', 0);
      this.colliders.push({ x0: x - T / 2, z0: -D, x1: x + T / 2, z1: 0.2 });
      // Wandleuchten
      for (let z = -D + 2; z < -0.5; z += 3) {
        vb.box(x - sx * 0.2, 2.3, z, 0.1, 0.25, 0.25, 0xfff1c9, 'glow');
        vb.box(x - sx * 0.17, 2.15, z, 0.06, 0.06, 0.15, 0xd4af37);
      }
    }
    // Rückwand (niedrig, Puppenhaus-Schnitt) – mit Durchgang zum Nebenraum
    const lowWall = (x0: number, z0: number, x1: number, z1: number, collide: boolean) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      vb.box(cx, 0.3, cz, w, 0.6, d, wc);
      vb.box(cx, 0.62, cz, w + 0.02, 0.05, d + 0.02, 0xffffff);
      if (collide) this.colliders.push({ x0, z0, x1, z1 });
    };
    const [bd0, bd1] = L.backDoor;
    lowWall(-W / 2 - T, -D - T, bd0, -D, true);
    lowWall(bd1, -D - T, W / 2 + T, -D, true);
    // Türrahmen
    for (const x of [bd0, bd1]) vb.box(x, 0.35, -D - T / 2, 0.08, 0.7, T + 0.06, 0x7a5a3a);
    this.buildBackRoom(vb, lowWall);
    // Frontwand mit Fenstern und Tür
    const dx0 = L.doorX - L.doorW / 2, dx1 = L.doorX + L.doorW / 2;
    const segs: [number, number][] = [[-W / 2 - T, dx0], [dx1, W / 2 + T]];
    const ext = 0xfaf3ea;
    for (const [a, b] of segs) {
      const w = b - a, cx = (a + b) / 2;
      vb.box(cx, 0.4, 0, w, 0.8, T, ext);
      vb.box(cx, 0.4, -T / 2 - 0.005, w, 0.8, 0.01, wc2, 'solid', 0);
      vb.box(cx, 0.82, 0, w, 0.06, T + 0.1, 0xffffff);
      vb.box(cx, 1.7, 0, w, 1.8, 0.04, 0xe8f6ff, 'glass');
      // Sprossen
      const n = Math.max(1, Math.round(w / 1.8));
      for (let i = 0; i <= n; i++) vb.box(a + (w * i) / n, 1.7, 0, 0.08, 1.8, 0.1, 0xffffff);
      this.colliders.push({ x0: a, z0: -T / 2, x1: b, z1: T / 2 });
    }
    // über den Fenstern / der Tür
    vb.box(0, 2.9, 0, W + 2 * T, 0.6, T, ext);
    vb.box(0, 2.62, 0, W + 2 * T, 0.06, T + 0.1, 0xffffff);
    // Türrahmen + offene Tür
    vb.box(dx0 - 0.04, 1.3, 0, 0.08, 2.6, 0.2, 0x7a5a3a);
    vb.box(dx1 + 0.04, 1.3, 0, 0.08, 2.6, 0.2, 0x7a5a3a);
    vb.box(dx0 + 0.05, 1.3, 0.55, 0.06, 2.4, 1.0, 0xe8f6ff, 'glass');
    vb.box(dx0 + 0.05, 1.3, 0.55, 0.08, 2.5, 0.06, 0x7a5a3a);
    vb.box(dx0 + 0.05, 1.3, 1.05, 0.08, 2.5, 0.06, 0x7a5a3a);
    vb.box(L.doorX, 0.005, 0.45, L.doorW, 0.02, 0.6, 0x8a5a3a); // Fußmatte
    this.colliders.push({ x0: dx0, z0: 0.05, x1: dx0 + 0.1, z1: 1.1 });
    // Fassade außen + Markise
    vb.box(0, 3.4, 0.05, W + 2 * T + 0.4, 0.9, T + 0.2, 0x355070);
    const aw = awning.colors;
    const stripes = Math.round((W + 1) / 0.5);
    for (let i = 0; i < stripes; i++) {
      const x = -W / 2 - 0.5 + i * 0.5 + 0.25;
      if (x > dx0 - 0.1 && x < dx1 + 0.1) continue;
      for (let k = 0; k < 4; k++) {
        vb.box(x, 2.82 - k * 0.12, 0.35 + k * 0.28, 0.5, 0.08, 0.3, i % 2 ? aw[1] : aw[0], 'solid', 0.01);
      }
      vb.box(x, 2.38, 1.36, 0.5, 0.14, 0.04, i % 2 ? aw[0] : aw[1], 'solid', 0.01);
    }
    // Pflanzkästen draußen
    for (const [a, b] of segs) {
      if (b - a < 1.5) continue;
      const cx = (a + b) / 2;
      vb.box(cx, 0.25, 0.45, Math.min(2.4, b - a - 0.4), 0.5, 0.4, 0x8c6239);
      for (let i = 0; i < 6; i++) vb.box(cx - 0.9 + i * 0.36, 0.6, 0.45, 0.22, 0.22, 0.22, i % 2 ? 0xff8fb0 : 0x6cc56f, 'solid', 0.1);
    }
    this.colliders.push({ x0: -W / 2 - T, z0: 0.2, x1: L.doorX - L.doorW / 2 - 0.05, z1: 0.7 });
    this.colliders.push({ x0: L.doorX + L.doorW / 2 + 0.05, z0: 0.2, x1: W / 2 + T, z1: 0.7 });

    // Theke
    const cz = L.counterZ;
    const cx0 = L.counterX0, cx1 = L.counterX1;
    const cw = cx1 - cx0, ccx = (cx0 + cx1) / 2;
    vb.box(ccx, COUNTER_H / 2, cz, cw, COUNTER_H, 0.8, 0xfff6e8);
    for (let x = cx0 + 0.25; x < cx1; x += 0.5) {
      vb.box(x, 0.5, cz + 0.405, 0.25, 0.82, 0.01, awning.colors[0], 'solid', 0.02);
    }
    vb.box(ccx, 0.05, cz + 0.38, cw, 0.1, 0.06, 0x8c6239);
    vb.box(ccx, COUNTER_H + 0.025, cz, cw + 0.06, 0.05, 0.88, 0xf4f1ec, 'solid', 0.01);
    this.colliders.push({ x0: cx0 - 0.2, z0: cz - 0.45, x1: cx1, z1: cz + 0.45 });
    // Klappe
    vb.box(cx1 + 0.75, COUNTER_H + 0.025, cz, 1.4, 0.04, 0.85, 0xe9e2d8);
    vb.box(cx1 + 0.03, COUNTER_H / 2, cz, 0.06, COUNTER_H, 0.8, 0xe9e2d8);

    // Kasse
    const reg = registerModel();
    reg.position.set(L.regX, COUNTER_H + 0.05, cz - 0.05);
    reg.rotation.y = Math.PI;
    this.roomGroup.add(reg);
    // Ausgabe-Schild
    vb.box(L.ausgabeX, COUNTER_H + 0.06, cz, 0.8, 0.02, 0.6, 0xb9e6d4, 'solid', 0);
    vb.box(L.ausgabeX, COUNTER_H + 0.25, cz + 0.32, 0.6, 0.18, 0.03, 0x7fd6b4);
    vb.box(L.ausgabeX, COUNTER_H + 0.25, cz + 0.34, 0.5, 0.06, 0.01, 0xffffff, 'glow', 0);
    vb.box(L.ausgabeX, COUNTER_H + 0.12, cz + 0.32, 0.03, 0.14, 0.03, 0x5fb894);
    // Toppingbar
    const unlocked = TOPPINGS.filter((t) => state.unlocked.includes(t.id));
    const tb = toppingBarModel(unlocked.map((t) => t.color), L.tbW);
    tb.position.set(L.tbX, COUNTER_H + 0.05, cz);
    this.roomGroup.add(tb);
    // Deko auf der Theke links
    const leftEnd = L.tbX - L.tbW / 2 - 0.3;
    if (leftEnd - cx0 > 1.2) {
      vb.box(leftEnd - 0.5, COUNTER_H + 0.2, cz, 0.8, 0.35, 0.5, 0xeaf6fb, 'glass');
      for (let i = 0; i < 3; i++) {
        vb.box(leftEnd - 0.75 + i * 0.25, COUNTER_H + 0.12, cz, 0.15, 0.12, 0.15, [0xf6a2b8, 0x8c5a3c, 0xfbe7a8][i]);
      }
      vb.box(cx0 + 0.4, COUNTER_H + 0.15, cz - 0.15, 0.2, 0.25, 0.2, 0xffffff);
      vb.box(cx0 + 0.4, COUNTER_H + 0.38, cz - 0.15, 0.3, 0.25, 0.3, 0x6cc56f, 'solid', 0.1);
    }

    // Schild innen + außen
    const tex = signTexture(state.shopName);
    const signW = Math.min(W - 2, 6.5);
    this.signMat = new THREE.MeshBasicMaterial({ map: tex });
    const signIn = new THREE.Mesh(new THREE.PlaneGeometry(signW, signW * 96 / 512), this.signMat);
    signIn.position.set(0, 2.92, -0.17);
    signIn.rotation.y = Math.PI;
    const signOut = new THREE.Mesh(new THREE.PlaneGeometry(signW, signW * 96 / 512), this.signMat);
    signOut.position.set(0, 3.4, 0.21);
    this.roomGroup.add(signIn, signOut);

    // Lichterkette
    if (state.theme.lights) {
      const cols = [0xfff2a8, 0xff9ff3, 0x9ff0ff, 0xb8ffb0];
      let k = 0;
      for (let x = -W / 2 + 0.3; x < W / 2; x += 0.45) {
        const sag = Math.abs(Math.sin(x * 1.2)) * 0.15;
        vb.box(x, 2.55 - sag, -0.25, 0.08, 0.1, 0.08, cols[k++ % 4], 'glow', 0);
      }
      for (const sx of [-1, 1]) {
        for (let z = -D + 0.3; z < -0.3; z += 0.45) {
          const sag = Math.abs(Math.sin(z * 1.2)) * 0.15;
          vb.box(sx * (W / 2 - 0.08), 2.75 - sag, z, 0.08, 0.1, 0.08, cols[k++ % 4], 'glow', 0);
        }
      }
    }

    const room = vb.build();
    room.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
    this.roomGroup.add(room);

    // Innenlichter
    for (const l of this.lights) l.removeFromParent();
    this.lights = [];
    for (let x = -W / 2 + 3; x <= W / 2 - 2; x += 5) {
      for (const z of [L.counterZ + 2.5, -D + 1.2]) {
        const p = new THREE.PointLight(0xffd9a8, 6, 11, 1.6);
        p.position.set(x, 2.9, z);
        this.roomGroup.add(p);
        this.lights.push(p);
      }
    }
  }

  /** Nebenraum: hier wird Frozen Yogurt aus der Basis angerührt */
  private buildBackRoom(vb: VB, lowWall: (x0: number, z0: number, x1: number, z1: number, collide: boolean) => void): void {
    const B = this.layout.back;
    const D = this.layout.D;
    const T = 0.3;
    // Fliesenboden (etwas höher als der Hinterhof, damit nichts flackert)
    for (let x = B.x0; x < B.x1 - 0.01; x += 0.5) {
      for (let z = B.z0; z < B.z1 - 0.01; z += 0.5) {
        const k = Math.round((x - B.x0) / 0.5) + Math.round((z - B.z0) / 0.5);
        vb.cube(x, -0.1, z, 0.5, 0.115, 0.5, k % 2 ? 0xdfe7ec : 0xf3f6f8, 'solid', 0.02);
      }
    }
    // niedrige Wände (Puppenhaus-Schnitt)
    lowWall(B.x0 - T, B.z0 - T, B.x1 + T, B.z0, false);
    lowWall(B.x0 - T, B.z0, B.x0, -D - T, false);
    lowWall(B.x1, B.z0, B.x1 + T, -D - T, false);
    // Schild über dem Durchgang
    const [bd0, bd1] = this.layout.backDoor;
    vb.box((bd0 + bd1) / 2, 0.75, -D - T / 2, bd1 - bd0 + 0.1, 0.12, 0.06, 0x7a5a3a);
    vb.box((bd0 + bd1) / 2, 0.75, -D - T / 2 - 0.035, bd1 - bd0 - 0.1, 0.06, 0.01, 0xfff1c9, 'glow', 0);
    // Milchkannen in der Ecke
    for (let i = 0; i < 3; i++) vb.box(B.x0 + 0.3 + i * 0.32, 0.25, B.z0 + 0.3, 0.26, 0.5, 0.26, 0xdfe5ea);
  }

  private buildBackStations(): void {
    const B = this.layout.back;
    const D = this.layout.D;
    // Rührwerk an der Rückwand (zeigt zur Kamera)
    this.mixer = ruehrwerkModel();
    const mx = B.x0 + 3.0;
    this.mixer.group.position.set(mx, 0, -D - 0.42);
    this.mixer.group.rotation.y = Math.PI;
    this.roomGroup.add(this.mixer.group);
    this.colliders.push({ x0: mx - 0.6, z0: -D - 0.8, x1: mx + 0.6, z1: -D });
    this.stations.set('ruehrwerk', { id: 'ruehrwerk', x: mx, ix: mx, iz: -D - 1.3, group: this.mixer.group, face: { x: mx, z: -D } });
    // Basis-Kühlregal an der Seitenwand
    const rz = -D - 1.9;
    const regal = basisRegalModel();
    regal.position.set(B.x1 - 0.32, 0, rz);
    regal.rotation.y = -Math.PI / 2;
    this.roomGroup.add(regal);
    this.colliders.push({ x0: B.x1 - 0.62, z0: rz - 0.5, x1: B.x1, z1: rz + 0.5 });
    this.stations.set('basisregal', { id: 'basisregal', x: B.x1 - 0.3, ix: B.x1 - 1.2, iz: rz, group: regal, face: { x: B.x1, z: rz } });
    // Spüle (Deko)
    const sink = sinkModel();
    sink.position.set(B.x0 + 0.32, 0, -D - 2.2);
    sink.rotation.y = Math.PI / 2;
    this.roomGroup.add(sink);
    this.colliders.push({ x0: B.x0, z0: -D - 2.75, x1: B.x0 + 0.65, z1: -D - 1.65 });
    this.colliders.push({ x0: B.x0, z0: B.z0, x1: B.x0 + 1.15, z1: B.z0 + 0.45 });
    // Licht
    const p = new THREE.PointLight(0xfff4e0, 5, 7, 1.6);
    p.position.set((B.x0 + B.x1) / 2, 2.6, (B.z0 + B.z1) / 2);
    this.roomGroup.add(p);
    this.lights.push(p);
  }

  /** Mülltonne draußen an der Bordsteinkante – dahin kommt der volle Müllsack */
  private buildStreetBin(): void {
    const L = this.layout;
    const x = L.doorX - L.doorW / 2 - 1.8, z = 3.85;
    const m = tonneModel();
    m.position.set(x, 0, z);
    m.rotation.y = Math.PI;
    this.roomGroup.add(m);
    this.colliders.push({ x0: x - 0.55, z0: z - 0.35, x1: x + 0.55, z1: z + 0.35 });
    this.stations.set('tonne', { id: 'tonne', x, ix: x, iz: z, group: m, face: { x, z }, reach: 0.55 });
  }

  private buildStations(state: GameState): void {
    this.buildBackStations();
    this.buildStreetBin();
    const L = this.layout;
    const D = L.D;
    const slotX = (i: number) => L.W / 2 - 0.75 - i * 1.1;
    SLOT_ORDER.forEach((id, i) => {
      const owned = id === 'trash' || state.equipment.includes(id);
      const x = slotX(i);
      let g: THREE.Group;
      if (!owned) {
        const vb = new VB();
        // liegt auf der Gummimatte (Oberseite 0,025) – deutlich darüber, sonst flackert es
        vb.box(0, 0.033, 0, 0.9, 0.016, 0.6, 0xdcd3c8, 'solid', 0);
        for (let k = -2; k <= 2; k++) vb.box(k * 0.18, 0.044, 0.28, 0.1, 0.01, 0.03, 0xf28cab, 'solid', 0);
        g = vb.build();
        g.position.set(x, 0, -D + 0.5);
        this.roomGroup.add(g);
        return;
      }
      switch (id) {
        case 'zapfer':
          g = zapferModel(FLAVORS.filter((f) => f.machine === 'zapfer' && state.unlocked.includes(f.id)).map((f) => f.color));
          break;
        case 'eismaschine':
          g = eismaschineModel(FLAVORS.filter((f) => f.machine === 'eismaschine' && state.unlocked.includes(f.id)).map((f) => f.color));
          break;
        case 'waffeleisen':
          this.waffle = waffleIronModel();
          g = this.waffle.group;
          break;
        case 'kaffeemaschine':
          g = coffeeModel();
          break;
        case 'matchabar':
          g = matchaBarModel();
          break;
        case 'vorratskuehlschrank':
          g = storageFridgeModel();
          break;
        default:
          g = trashModel();
      }
      g.position.set(x, 0, -D + 0.45);
      this.roomGroup.add(g);
      this.colliders.push({ x0: x - 0.5, z0: -D, x1: x + 0.5, z1: -D + 0.85 });
      this.stations.set(id, { id, x, ix: x, iz: -D + 1.35, group: g });
    });
    if (!state.equipment.includes('waffeleisen')) this.waffle = null;
    // Getränkekühlschrank
    if (state.equipment.includes('getraenkekuehlschrank')) {
      const g = drinksFridgeModel(DRINKS.filter((d) => state.unlocked.includes(d.id)).map((d) => d.color));
      g.position.set(L.fridgePos.x, 0, L.fridgePos.z);
      g.rotation.y = -Math.PI / 2;
      this.roomGroup.add(g);
      this.colliders.push({ x0: L.fridgePos.x - 0.35, z0: L.fridgePos.z - 0.45, x1: L.W / 2, z1: L.fridgePos.z + 0.45 });
      this.stations.set('getraenkekuehlschrank', { id: 'getraenkekuehlschrank', x: L.fridgePos.x, ix: L.fridgePos.x - 1.0, iz: L.fridgePos.z, group: g });
    }
    // virtuelle Stationen an der Theke
    const cz = L.counterZ;
    this.stations.set('kasse', { id: 'kasse', x: L.regX, ix: L.regX, iz: cz - 0.85, group: new THREE.Group() });
    this.stations.set('ausgabe', { id: 'ausgabe', x: L.ausgabeX, ix: L.ausgabeX, iz: cz - 0.85, group: new THREE.Group() });
    this.stations.set('toppings', { id: 'toppings', x: L.tbX, ix: L.tbX, iz: cz - 0.85, group: new THREE.Group() });
  }

  buildFurniture(state: GameState): void {
    for (const g of this.furnitureMeshes.values()) disposeObject(g);
    this.furnitureMeshes.clear();
    const L = this.layout;
    for (const it of state.placed) {
      const g = placeableModel(it.type);
      g.position.set(it.x, 0, it.z);
      g.rotation.y = it.rot;
      g.userData.uid = it.uid;
      this.furniture.add(g);
      this.furnitureMeshes.set(it.uid, g);
    }
    // Navigationsraster
    const nav = new NavGrid(-L.W / 2, -L.D, Math.round(L.W / 0.5), Math.round(L.D / 0.5), 0.5);
    nav.blockRect(-L.W / 2, -L.D, L.W / 2, L.counterZ + 0.5);
    nav.blockRect(-L.W / 2, -L.D, -L.W / 2 + 0.2, 0);
    nav.blockRect(L.W / 2 - 0.2, -L.D, L.W / 2, 0);
    if (state.equipment.includes('getraenkekuehlschrank')) {
      nav.blockRect(L.fridgePos.x - 0.4, L.fridgePos.z - 0.5, L.W / 2, L.fridgePos.z + 0.5);
    }
    const playerCols: Rect[] = [];
    for (const it of state.placed) {
      const p = PLACEABLE_BY_ID.get(it.type);
      if (!p || !p.blocking) continue;
      const r = itemRect(it.type, it.x, it.z, it.rot);
      nav.blockRect(r.x0, r.z0, r.x1, r.z1, 0.2);
      playerCols.push(r);
    }
    this.nav = nav;
    this.colliders = this.colliders.filter((c) => !(c as any).furniture);
    for (const r of playerCols) this.colliders.push(Object.assign({ furniture: true }, r));
    // Sitzplätze
    // Objekte nach uid wiederverwenden, damit Referenzen von Kund:innen gültig bleiben
    const oldSeats = new Map(this.seats.map((s) => [s.uid, s]));
    const oldTables = new Map(this.tables.map((t) => [t.uid, t]));
    this.tables = state.placed
      .filter((p) => PLACEABLE_BY_ID.get(p.type)?.cat === 'tisch')
      .map((p) => {
        const t = oldTables.get(p.uid);
        if (t) { t.x = p.x; t.z = p.z; t.seats = []; return t; }
        return { uid: p.uid, x: p.x, z: p.z, seats: [], claimedBy: null };
      });
    this.seats = [];
    for (const it of state.placed) {
      const p = PLACEABLE_BY_ID.get(it.type);
      if (!p?.seat) continue;
      let best: TableInfo | null = null;
      let bd = 1.5;
      for (const t of this.tables) {
        const tr = itemRect(state.placed.find((q) => q.uid === t.uid)!.type, t.x, t.z, state.placed.find((q) => q.uid === t.uid)!.rot);
        const dx = Math.max(tr.x0 - it.x, 0, it.x - tr.x1);
        const dz = Math.max(tr.z0 - it.z, 0, it.z - tr.z1);
        const d = Math.hypot(dx, dz);
        if (d < bd) { bd = d; best = t; }
      }
      let angle = it.rot;
      if (best) {
        const tr = itemRect(state.placed.find((q) => q.uid === best!.uid)!.type, best.x, best.z, state.placed.find((q) => q.uid === best!.uid)!.rot);
        const nx = Math.max(tr.x0, Math.min(tr.x1, it.x));
        const nz = Math.max(tr.z0, Math.min(tr.z1, it.z));
        angle = Math.atan2(nx - it.x, nz - it.z);
      }
      const seat: Seat = oldSeats.get(it.uid) ?? {
        uid: it.uid, x: 0, z: 0, angle: 0, height: 0.48, tableUid: null, occupant: null,
      };
      Object.assign(seat, { x: it.x, z: it.z, angle, height: SEAT_HEIGHT[it.type] ?? 0.48, tableUid: best ? best.uid : null });
      this.seats.push(seat);
      if (best && best.seats.length < 4) best.seats.push(seat);
    }
  }

  computeCozy(state: GameState): number {
    let c = 0;
    for (const it of state.placed) c += PLACEABLE_BY_ID.get(it.type)?.cozy ?? 0;
    for (const id of [state.theme.wall, state.theme.floor, state.theme.awning]) c += THEME_BY_ID.get(id)?.cozy ?? 0;
    if (state.theme.lights) c += LICHTERKETTE.cozy;
    this.cozy = c;
    return c;
  }

  /** Prüft, ob ein Möbelstück an dieser Stelle stehen darf. */
  canPlace(state: GameState, type: string, x: number, z: number, rot: number, ignoreUid: number | null): boolean {
    const L = this.layout;
    const def = PLACEABLE_BY_ID.get(type) as Placeable;
    const r = itemRect(type, x, z, rot);
    const A = L.placeArea;
    if (r.x0 < A.x0 || r.x1 > A.x1 || r.z0 < A.z0 || r.z1 > A.z1) return false;
    if (def.blocking || def.seat) {
      for (const res of L.reserved) if (rectsOverlap(r, res)) return false;
    }
    if (state.equipment.includes('getraenkekuehlschrank') && rectsOverlap(r, { x0: L.fridgePos.x - 1.7, z0: L.fridgePos.z - 0.6, x1: L.W / 2, z1: L.fridgePos.z + 0.6 })) return false;
    for (const it of state.placed) {
      if (it.uid === ignoreUid) continue;
      const o = PLACEABLE_BY_ID.get(it.type)!;
      if (type === 'teppich' || it.type === 'teppich') continue;
      const orr = itemRect(it.type, it.x, it.z, it.rot);
      if (rectsOverlap(r, orr, -0.02)) return false;
      void o;
    }
    if (def.blocking) {
      const nav = this.nav.clone();
      for (const it of state.placed) {
        if (it.uid === ignoreUid) continue;
      }
      // neu blockieren & Erreichbarkeit prüfen
      if (ignoreUid !== null) {
        const old = state.placed.find((p) => p.uid === ignoreUid);
        if (old && PLACEABLE_BY_ID.get(old.type)?.blocking) {
          // altes Objekt freigeben (grob)
          const orr = itemRect(old.type, old.x, old.z, old.rot);
          nav.blockRect(orr.x0, orr.z0, orr.x1, orr.z1, 0.2, 0);
          for (const it of state.placed) {
            if (it.uid === ignoreUid || !PLACEABLE_BY_ID.get(it.type)?.blocking) continue;
            const q = itemRect(it.type, it.x, it.z, it.rot);
            nav.blockRect(q.x0, q.z0, q.x1, q.z1, 0.2);
          }
        }
      }
      nav.blockRect(r.x0, r.z0, r.x1, r.z1, 0.2);
      const from = L.doorIn;
      const targets: P2[] = [L.queueSpots[0], L.pickupSpots[0], L.pickupSpots[Math.min(4, L.pickupSpots.length - 1)], L.fridgeSpot];
      for (const t of targets) if (!nav.findPath(from.x, from.z, t.x, t.z)) return false;
      // alle Sitzplätze müssen erreichbar bleiben
      for (const s of this.seats) {
        if (s.uid === ignoreUid) continue;
        if (!nav.findPath(from.x, from.z, s.x, s.z)) return false;
      }
    }
    return true;
  }

  updateSign(name: string): void {
    if (!this.signMat) return;
    this.signMat.map?.dispose();
    this.signMat.map = signTexture(name);
    this.signMat.needsUpdate = true;
  }

  seatCount(): number {
    return this.seats.filter((s) => s.tableUid !== null).length;
  }
}
