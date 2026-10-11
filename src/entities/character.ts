import * as THREE from 'three';
import { VB, disposeObject } from '../core/voxel';
import { Appearance } from './appearance';
import { angleLerp, damp } from '../core/util';
import type { P2 } from '../core/path';

const EYE = 0x2b2233;

function shade(c: number, f: number): number {
  return new THREE.Color(c).multiplyScalar(f).getHex();
}

function buildLeg(a: Appearance, side: number): THREE.Group {
  const vb = new VB();
  const L = 0.72;
  if (a.pants === 'lang') {
    vb.box(0, -0.31, 0, 0.17, 0.62, 0.2, a.pantsColor);
  } else if (a.pants === 'kurz') {
    vb.box(0, -0.13, 0, 0.18, 0.26, 0.21, a.pantsColor);
    vb.box(0, -0.44, 0, 0.14, 0.36, 0.16, a.skin);
  } else {
    vb.box(0, -0.38, 0, 0.14, 0.5, 0.16, a.skin);
    vb.box(0, -0.58, 0, 0.145, 0.06, 0.165, 0xffffff);
  }
  vb.box(0, -L + 0.06, 0.035, 0.18, 0.12, 0.27, a.shoes);
  vb.box(0, -L + 0.01, 0.035, 0.185, 0.03, 0.275, shade(a.shoes, 0.7), 'solid', 0);
  const g = vb.build();
  g.position.set(side * 0.105, L, 0);
  return g;
}

function buildArm(a: Appearance, side: number): THREE.Group {
  const vb = new VB();
  const longSleeve = a.shirt === 'hemd' || a.shirt === 'hoodie' || a.shirt === 'pulli';
  const sleeveCol = a.shirt === 'latzhose' ? a.shirtColor2 : a.shirtColor;
  if (longSleeve) {
    vb.box(0, -0.23, 0, 0.13, 0.46, 0.15, sleeveCol);
    vb.box(0, -0.465, 0, 0.135, 0.04, 0.155, shade(sleeveCol, 0.85), 'solid', 0);
  } else {
    vb.box(0, -0.1, 0, 0.14, 0.2, 0.16, sleeveCol);
    vb.box(0, -0.32, 0, 0.11, 0.26, 0.12, a.skin);
  }
  vb.box(0, -0.52, 0, 0.12, 0.1, 0.13, a.skin);
  const g = vb.build();
  g.position.set(side * 0.3, 1.27, 0);
  return g;
}

function buildTorso(a: Appearance, vb: VB): void {
  const y0 = 0.72, h = 0.58;
  const cy = y0 + h / 2;
  const W = 0.46, D = 0.26;
  switch (a.shirt) {
    case 'streifen':
      for (let i = 0; i < 6; i++) vb.box(0, y0 + 0.05 + i * 0.097, 0, W, 0.097, D, i % 2 ? a.shirtColor2 : a.shirtColor, 'solid', 0.01);
      break;
    case 'hemd':
      vb.box(0, cy, 0, W, h, D, a.shirtColor);
      vb.box(0, cy, D / 2 + 0.003, 0.03, h, 0.01, shade(a.shirtColor, 0.8));
      for (let i = 0; i < 4; i++) vb.box(0.03, y0 + 0.1 + i * 0.12, D / 2 + 0.008, 0.025, 0.025, 0.01, 0xffffff, 'solid', 0);
      vb.box(-0.08, y0 + h - 0.02, D / 2 + 0.01, 0.12, 0.06, 0.02, 0xffffff);
      vb.box(0.08, y0 + h - 0.02, D / 2 + 0.01, 0.12, 0.06, 0.02, 0xffffff);
      break;
    case 'hoodie':
      vb.box(0, cy, 0, W, h, D, a.shirtColor);
      vb.box(0, y0 + 0.14, D / 2 + 0.01, 0.3, 0.14, 0.02, shade(a.shirtColor, 0.85));
      vb.box(0, y0 + h - 0.02, -D / 2 - 0.03, 0.34, 0.16, 0.08, shade(a.shirtColor, 0.9));
      vb.box(-0.06, y0 + h - 0.12, D / 2 + 0.015, 0.02, 0.12, 0.01, 0xffffff, 'solid', 0);
      vb.box(0.06, y0 + h - 0.12, D / 2 + 0.015, 0.02, 0.12, 0.01, 0xffffff, 'solid', 0);
      break;
    case 'kleid':
      vb.box(0, cy + 0.05, 0, W, h - 0.1, D, a.shirtColor);
      vb.box(0, y0 - 0.02, 0, W + 0.12, 0.3, D + 0.12, a.shirtColor);
      vb.box(0, y0 + 0.17, 0, W + 0.02, 0.05, D + 0.02, a.shirtColor2);
      break;
    case 'pulli':
      vb.box(0, cy, 0, W, h, D, a.shirtColor);
      vb.box(0, y0 + 0.02, 0, W + 0.02, 0.05, D + 0.02, shade(a.shirtColor, 0.8));
      vb.box(0, cy + 0.05, D / 2 + 0.004, 0.22, 0.04, 0.01, a.shirtColor2, 'solid', 0);
      vb.box(0, cy - 0.05, D / 2 + 0.004, 0.22, 0.04, 0.01, a.shirtColor2, 'solid', 0);
      break;
    case 'latzhose':
      vb.box(0, cy, 0, W, h, D, a.shirtColor2);
      vb.box(0, y0 + 0.17, 0, W + 0.01, 0.34, D + 0.01, a.pantsColor);
      vb.box(0, y0 + 0.36, D / 2 + 0.005, 0.24, 0.16, 0.01, a.pantsColor);
      vb.box(-0.13, y0 + 0.47, D / 2 + 0.005, 0.05, 0.22, 0.01, a.pantsColor);
      vb.box(0.13, y0 + 0.47, D / 2 + 0.005, 0.05, 0.22, 0.01, a.pantsColor);
      break;
    default:
      vb.box(0, cy, 0, W, h, D, a.shirtColor);
      vb.box(0, y0 + h - 0.03, D / 2 + 0.004, 0.14, 0.04, 0.01, a.skin, 'solid', 0);
      vb.box(0, cy, D / 2 + 0.005, 0.12, 0.12, 0.01, a.shirtColor2, 'solid', 0);
  }
  if (a.pants === 'rock' && a.shirt !== 'kleid') {
    vb.box(0, y0 - 0.05, 0, W + 0.1, 0.24, D + 0.1, a.pantsColor);
  } else if (a.shirt !== 'kleid' && a.shirt !== 'latzhose') {
    vb.box(0, y0 + 0.03, 0, W + 0.005, 0.07, D + 0.005, a.pantsColor);
  }
  switch (a.accessory) {
    case 'rucksack':
      vb.box(0, cy, -D / 2 - 0.1, 0.36, 0.42, 0.18, a.accessoryColor);
      vb.box(0, cy - 0.1, -D / 2 - 0.2, 0.26, 0.15, 0.04, shade(a.accessoryColor, 0.8));
      vb.box(-0.15, cy + 0.12, D / 2 + 0.004, 0.05, 0.2, 0.01, shade(a.accessoryColor, 0.7));
      vb.box(0.15, cy + 0.12, D / 2 + 0.004, 0.05, 0.2, 0.01, shade(a.accessoryColor, 0.7));
      break;
    case 'schal':
      vb.box(0, y0 + h + 0.02, 0, 0.36, 0.1, 0.3, a.accessoryColor);
      vb.box(0.1, y0 + h - 0.15, D / 2 + 0.03, 0.09, 0.3, 0.04, a.accessoryColor);
      break;
    case 'tasche':
      vb.box(0.3, y0 + 0.02, 0.02, 0.08, 0.26, 0.28, a.accessoryColor);
      vb.box(0.05, cy + 0.1, D / 2 + 0.004, 0.42, 0.04, 0.01, shade(a.accessoryColor, 0.7));
      break;
    case 'kette':
      vb.box(0, y0 + h - 0.07, D / 2 + 0.008, 0.14, 0.025, 0.01, 0xf2c14e, 'solid', 0);
      vb.box(0, y0 + h - 0.11, D / 2 + 0.01, 0.04, 0.04, 0.01, 0xff6fa8, 'solid', 0);
      break;
    case 'schuerze':
      vb.box(0, y0 + 0.15, D / 2 + 0.012, 0.4, 0.46, 0.02, a.accessoryColor);
      vb.box(0, y0 + 0.08, D / 2 + 0.025, 0.2, 0.12, 0.01, shade(a.accessoryColor, 0.85));
      vb.box(0, y0 + 0.4, D / 2 + 0.014, 0.3, 0.12, 0.02, a.accessoryColor);
      break;
    case 'fliege':
      vb.box(-0.045, y0 + h - 0.05, D / 2 + 0.012, 0.07, 0.06, 0.02, a.accessoryColor);
      vb.box(0.045, y0 + h - 0.05, D / 2 + 0.012, 0.07, 0.06, 0.02, a.accessoryColor);
      vb.box(0, y0 + h - 0.05, D / 2 + 0.018, 0.03, 0.035, 0.02, shade(a.accessoryColor, 0.7));
      break;
  }
}

function buildHead(a: Appearance): THREE.Group {
  const vb = new VB();
  const S = 0.4;
  const cy = 0.21;
  vb.box(0, 0.03, 0, 0.16, 0.06, 0.16, a.skin); // Hals
  vb.box(0, cy + 0.02, 0, S, S, S, a.skin);
  const fz = S / 2 + 0.003;
  // Augen
  if (a.glasses !== 'sonne') {
    vb.box(-0.085, cy + 0.05, fz, 0.05, 0.07, 0.01, EYE, 'solid', 0);
    vb.box(0.085, cy + 0.05, fz, 0.05, 0.07, 0.01, EYE, 'solid', 0);
    vb.box(-0.075, cy + 0.07, fz + 0.002, 0.02, 0.02, 0.01, 0xffffff, 'solid', 0);
    vb.box(0.095, cy + 0.07, fz + 0.002, 0.02, 0.02, 0.01, 0xffffff, 'solid', 0);
  }
  vb.box(-0.13, cy - 0.03, fz, 0.06, 0.035, 0.01, 0xff9aa8, 'solid', 0);
  vb.box(0.13, cy - 0.03, fz, 0.06, 0.035, 0.01, 0xff9aa8, 'solid', 0);
  vb.box(0, cy - 0.07, fz, 0.08, 0.02, 0.01, 0x8a3b3b, 'solid', 0);
  vb.box(0, cy - 0.005, fz + 0.01, 0.035, 0.05, 0.02, shade(a.skin, 0.92), 'solid', 0); // Nase
  if (a.beard) {
    vb.box(0, cy - 0.12, fz - 0.02, S + 0.01, 0.14, 0.06, a.hairColor);
    vb.box(-0.17, cy - 0.04, fz - 0.06, 0.06, 0.14, 0.12, a.hairColor);
    vb.box(0.17, cy - 0.04, fz - 0.06, 0.06, 0.14, 0.12, a.hairColor);
    vb.box(0, cy - 0.065, fz + 0.002, 0.08, 0.025, 0.01, 0xaa5050, 'solid', 0);
  }
  // Brille
  if (a.glasses === 'rund' || a.glasses === 'eckig') {
    const c = a.glasses === 'rund' ? 0x8a5a2b : 0x222222;
    vb.box(-0.085, cy + 0.05, fz + 0.01, 0.11, 0.11, 0.01, c, 'solid', 0);
    vb.box(0.085, cy + 0.05, fz + 0.01, 0.11, 0.11, 0.01, c, 'solid', 0);
    vb.box(-0.085, cy + 0.05, fz + 0.016, 0.07, 0.07, 0.01, 0xd8eef8, 'solid', 0);
    vb.box(0.085, cy + 0.05, fz + 0.016, 0.07, 0.07, 0.01, 0xd8eef8, 'solid', 0);
    vb.box(-0.085, cy + 0.05, fz + 0.02, 0.035, 0.05, 0.01, EYE, 'solid', 0);
    vb.box(0.085, cy + 0.05, fz + 0.02, 0.035, 0.05, 0.01, EYE, 'solid', 0);
  } else if (a.glasses === 'sonne') {
    vb.box(0, cy + 0.06, fz + 0.01, S + 0.02, 0.03, 0.01, 0x111111, 'solid', 0);
    vb.box(-0.085, cy + 0.04, fz + 0.012, 0.12, 0.08, 0.01, 0x1a1a2a, 'solid', 0);
    vb.box(0.085, cy + 0.04, fz + 0.012, 0.12, 0.08, 0.01, 0x1a1a2a, 'solid', 0);
  }
  // Haare
  const hc = a.hairColor;
  const top = cy + S / 2 + 0.02;
  const hasHat = a.hat !== 'kein' && a.hat !== 'kopfhoerer' && a.hat !== 'blume';
  switch (a.hairStyle) {
    case 'glatze':
      break;
    case 'kurz':
      vb.box(0, top - 0.03, -0.01, S + 0.03, 0.08, S + 0.02, hc);
      vb.box(0, cy + 0.05, -S / 2 - 0.01, S + 0.03, 0.26, 0.04, hc);
      vb.box(-S / 2 - 0.01, cy + 0.08, -0.05, 0.03, 0.2, 0.28, hc);
      vb.box(S / 2 + 0.01, cy + 0.08, -0.05, 0.03, 0.2, 0.28, hc);
      break;
    case 'pony':
      vb.box(0, top - 0.03, 0, S + 0.04, 0.09, S + 0.04, hc);
      vb.box(0, cy + 0.13, fz + 0.01, S + 0.02, 0.07, 0.03, hc);
      vb.box(0, cy - 0.02, -S / 2 - 0.015, S + 0.04, 0.4, 0.05, hc);
      vb.box(-S / 2 - 0.015, cy - 0.0, -0.03, 0.04, 0.34, 0.36, hc);
      vb.box(S / 2 + 0.015, cy - 0.0, -0.03, 0.04, 0.34, 0.36, hc);
      break;
    case 'lang':
      vb.box(0, top - 0.03, 0, S + 0.04, 0.09, S + 0.04, hc);
      vb.box(0, cy - 0.12, -S / 2 - 0.02, S + 0.06, 0.62, 0.07, hc);
      vb.box(-S / 2 - 0.02, cy - 0.06, -0.02, 0.05, 0.5, 0.38, hc);
      vb.box(S / 2 + 0.02, cy - 0.06, -0.02, 0.05, 0.5, 0.38, hc);
      vb.box(0.07, cy + 0.15, fz + 0.01, 0.24, 0.05, 0.03, hc);
      break;
    case 'dutt':
      vb.box(0, top - 0.03, -0.01, S + 0.03, 0.08, S + 0.02, hc);
      vb.box(0, cy + 0.06, -S / 2 - 0.01, S + 0.03, 0.26, 0.04, hc);
      if (!hasHat) vb.box(0, top + 0.07, -0.08, 0.17, 0.14, 0.17, hc);
      break;
    case 'locken':
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) vb.box(x * 0.14, top + ((x + z) % 2 ? 0.0 : 0.03), z * 0.14 - 0.02, 0.16, 0.14, 0.16, hc, 'solid', 0.08);
      vb.box(0, cy + 0.02, -S / 2 - 0.03, S + 0.08, 0.32, 0.08, hc, 'solid', 0.08);
      vb.box(-S / 2 - 0.03, cy + 0.06, -0.05, 0.06, 0.25, 0.3, hc, 'solid', 0.08);
      vb.box(S / 2 + 0.03, cy + 0.06, -0.05, 0.06, 0.25, 0.3, hc, 'solid', 0.08);
      break;
    case 'irokese':
      if (!hasHat) for (let i = 0; i < 4; i++) vb.box(0, top + 0.06, 0.15 - i * 0.11, 0.08, 0.16 + (i === 1 ? 0.04 : 0), 0.1, hc);
      vb.box(0, cy + 0.05, -S / 2 - 0.01, 0.12, 0.26, 0.03, hc);
      break;
    case 'zoepfe':
      vb.box(0, top - 0.03, 0, S + 0.04, 0.09, S + 0.04, hc);
      vb.box(0, cy + 0.04, -S / 2 - 0.015, S + 0.04, 0.3, 0.04, hc);
      for (const sx of [-1, 1]) {
        vb.box(sx * (S / 2 + 0.05), cy - 0.05, -0.05, 0.08, 0.1, 0.08, hc);
        vb.box(sx * (S / 2 + 0.05), cy - 0.16, -0.05, 0.07, 0.1, 0.07, hc);
        vb.box(sx * (S / 2 + 0.05), cy - 0.24, -0.05, 0.06, 0.05, 0.06, a.hatColor);
      }
      break;
  }
  // Hüte
  const hat = a.hatColor;
  switch (a.hat) {
    case 'cap':
      vb.box(0, top + 0.02, -0.01, S + 0.05, 0.12, S + 0.05, hat);
      vb.box(0, top - 0.03, fz + 0.1, S + 0.02, 0.03, 0.2, shade(hat, 0.85));
      vb.box(0, top + 0.09, 0, 0.05, 0.03, 0.05, shade(hat, 0.8));
      break;
    case 'muetze':
      vb.box(0, top + 0.03, 0, S + 0.06, 0.16, S + 0.06, hat);
      vb.box(0, top - 0.05, 0, S + 0.07, 0.06, S + 0.07, shade(hat, 0.8));
      vb.box(0, top + 0.14, 0, 0.1, 0.08, 0.1, 0xffffff);
      break;
    case 'zylinder':
      vb.box(0, top - 0.01, 0, S + 0.2, 0.03, S + 0.2, 0x222222);
      vb.box(0, top + 0.17, 0, S - 0.04, 0.34, S - 0.04, 0x222222);
      vb.box(0, top + 0.05, 0, S - 0.03, 0.05, S - 0.03, hat);
      break;
    case 'fischerhut':
      vb.box(0, top - 0.02, 0, S + 0.2, 0.04, S + 0.2, hat);
      vb.box(0, top + 0.06, 0, S + 0.02, 0.14, S + 0.02, hat);
      break;
    case 'cowboy':
      vb.box(0, top - 0.02, 0, S + 0.34, 0.03, S + 0.22, 0x8b5a2b);
      vb.box(-S / 2 - 0.15, top + 0.02, 0, 0.06, 0.06, S + 0.22, 0x8b5a2b);
      vb.box(S / 2 + 0.15, top + 0.02, 0, 0.06, 0.06, S + 0.22, 0x8b5a2b);
      vb.box(0, top + 0.1, 0, S - 0.06, 0.18, S - 0.06, 0x8b5a2b);
      vb.box(0, top + 0.03, 0, S - 0.05, 0.04, S - 0.05, hat);
      break;
    case 'kopfhoerer':
      vb.box(0, top + 0.03, 0, 0.06, 0.05, S + 0.06, 0x333333);
      vb.box(-S / 2 - 0.04, cy + 0.03, 0, 0.08, 0.16, 0.14, hat);
      vb.box(S / 2 + 0.04, cy + 0.03, 0, 0.08, 0.16, 0.14, hat);
      vb.box(-S / 2 - 0.04, cy + 0.2, 0, 0.04, 0.2, 0.04, 0x333333);
      vb.box(S / 2 + 0.04, cy + 0.2, 0, 0.04, 0.2, 0.04, 0x333333);
      break;
    case 'blume':
      vb.box(S / 2 - 0.02, top - 0.02, 0.1, 0.12, 0.12, 0.05, hat);
      vb.box(S / 2 - 0.02, top - 0.02, 0.13, 0.05, 0.05, 0.02, 0xffe066);
      break;
    case 'baskenmuetze':
      vb.box(0.03, top + 0.02, 0, S + 0.1, 0.07, S + 0.06, hat);
      vb.box(0.03, top + 0.07, 0, 0.04, 0.05, 0.04, shade(hat, 0.7));
      break;
  }
  const g = vb.build();
  g.position.set(0, 1.3, 0);
  return g;
}

export type Pose = 'idle' | 'walk' | 'sit' | 'carry';

export class Character {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private head!: THREE.Group;
  private torso!: THREE.Group;
  readonly hand = new THREE.Group();
  readonly bubbleAnchor = new THREE.Object3D();
  private held: THREE.Object3D | null = null;
  private walkPhase = Math.random() * 10;
  private path: P2[] = [];
  private onArrive: (() => void) | null = null;
  private faceTarget: number | null = null;
  speed = 1.6;
  sitting = false;
  sitHeight = 0.47;
  slapT = 0;
  hop = 0;
  bobOffset = Math.random() * 6;
  moving = false;
  appearance: Appearance;

  constructor(appearance: Appearance) {
    this.appearance = appearance;
    this.root.add(this.body);
    this.build(appearance);
    this.bubbleAnchor.position.set(0, 2.0, 0);
    this.root.add(this.bubbleAnchor);
  }

  build(a: Appearance): void {
    this.appearance = a;
    for (const c of [...this.body.children]) if (c !== this.hand) disposeObject(c);
    this.legL = buildLeg(a, -1);
    this.legR = buildLeg(a, 1);
    this.armL = buildArm(a, -1);
    this.armR = buildArm(a, 1);
    const tvb = new VB();
    buildTorso(a, tvb);
    this.torso = tvb.build();
    this.head = buildHead(a);
    if (a.kid) this.head.scale.setScalar(1.25);
    this.body.add(this.legL, this.legR, this.armL, this.armR, this.torso, this.head);
    this.hand.position.set(0, 0.98, 0.34);
    if (!this.hand.parent) this.body.add(this.hand);
    this.root.scale.set(a.width, a.height, a.width);
    this.bubbleAnchor.position.y = 2.0 + (a.kid ? 0.25 : 0);
  }

  get position(): THREE.Vector3 { return this.root.position; }

  setHeld(obj: THREE.Object3D | null): void {
    if (this.held) disposeObject(this.held);
    this.held = obj;
    if (obj) {
      obj.scale.setScalar(1 / this.appearance.width);
      this.hand.add(obj);
    }
  }

  get holding(): boolean { return !!this.held; }

  walkTo(path: P2[] | null, onArrive?: () => void): void {
    this.path = path ? [...path] : [];
    this.onArrive = onArrive ?? null;
    this.faceTarget = null;
    if (this.sitting) this.standUp();
    if (!this.path.length && this.onArrive) {
      const cb = this.onArrive;
      this.onArrive = null;
      cb();
    }
  }

  stop(): void {
    this.path = [];
    this.onArrive = null;
  }

  get hasPath(): boolean { return this.path.length > 0; }

  faceTo(x: number, z: number): void {
    this.faceTarget = Math.atan2(x - this.root.position.x, z - this.root.position.z);
  }

  faceAngle(a: number): void { this.faceTarget = a; }

  sitAt(x: number, z: number, angle: number, height = 0.47): void {
    this.path = [];
    this.sitting = true;
    this.sitHeight = height;
    this.root.position.set(x, 0, z);
    this.root.rotation.y = angle;
    this.faceTarget = angle;
  }

  standUp(): void {
    this.sitting = false;
  }

  slap(): void { this.slapT = 0.35; }

  update(dt: number): void {
    let moving = false;
    if (this.path.length) {
      const t = this.path[0];
      const p = this.root.position;
      const dx = t.x - p.x, dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step || d < 0.02) {
        p.x = t.x; p.z = t.z;
        this.path.shift();
        if (!this.path.length && this.onArrive) {
          const cb = this.onArrive;
          this.onArrive = null;
          cb();
        }
      } else {
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        const target = Math.atan2(dx, dz);
        this.root.rotation.y = angleLerp(this.root.rotation.y, target, 1 - Math.exp(-12 * dt));
        moving = true;
      }
    } else if (this.faceTarget !== null) {
      this.root.rotation.y = angleLerp(this.root.rotation.y, this.faceTarget, 1 - Math.exp(-10 * dt));
    }
    this.animate(dt, moving);
  }

  /** Für den Spieler: Animation ohne Pfad */
  animate(dt: number, moving: boolean, speedFactor = 1): void {
    this.moving = moving;
    const carrying = !!this.held;
    if (this.sitting) {
      this.body.position.y = damp(this.body.position.y, this.sitHeight - 0.72, 12, dt);
      this.legL.rotation.x = damp(this.legL.rotation.x, -Math.PI / 2, 12, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, -Math.PI / 2, 12, dt);
      const talk = Math.sin(performance.now() / 300 + this.bobOffset) * 0.05;
      this.armL.rotation.x = damp(this.armL.rotation.x, -0.5 + talk, 8, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, carrying ? -1.1 : -0.5 - talk, 8, dt);
      this.head.rotation.z = Math.sin(performance.now() / 900 + this.bobOffset) * 0.06;
      return;
    }
    this.head.rotation.z = 0;
    if (moving) {
      this.walkPhase += dt * 9 * speedFactor * (this.speed / 1.6);
      const s = Math.sin(this.walkPhase);
      this.legL.rotation.x = s * 0.6;
      this.legR.rotation.x = -s * 0.6;
      this.armL.rotation.x = -s * 0.5;
      this.armR.rotation.x = carrying ? -1.1 : s * 0.5;
      if (carrying) this.armL.rotation.x = -1.1;
      this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.05 + this.hop;
    } else {
      this.legL.rotation.x = damp(this.legL.rotation.x, 0, 12, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, 0, 12, dt);
      const breathe = Math.sin(performance.now() / 700 + this.bobOffset) * 0.04;
      this.armL.rotation.x = damp(this.armL.rotation.x, carrying ? -1.1 : breathe, 10, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, carrying ? -1.1 : -breathe, 10, dt);
      this.body.position.y = damp(this.body.position.y, this.hop, 12, dt);
    }
    if (this.hop > 0) this.hop = Math.max(0, this.hop - dt * 0.8);
    if (this.slapT > 0) {
      this.slapT -= dt;
      const k = Math.max(0, this.slapT) / 0.35;
      this.armR.rotation.x = -2.6 + (1 - k) * 2.2;
    }
  }

  dispose(): void {
    disposeObject(this.root);
  }
}
